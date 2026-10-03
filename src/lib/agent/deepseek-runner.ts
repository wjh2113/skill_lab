import { getLLMConfig } from "@/lib/ai/config";
import { LLMError } from "@/lib/ai/deepseek";
import {
  buildAgentSystemPrompt,
  runDeepSeekAgentLoop,
} from "@/lib/agent/deepseek-agent/loop";
import {
  finishExecuteStep,
  runAgentInitialization,
} from "@/lib/agent/initialize";
import {
  appendRunEvents,
  updateRun,
} from "@/lib/agent/store";
import type { RunRecord } from "@/lib/agent/types";
import { getSkillById, readSkillFile } from "@/lib/skills/scanner";

let eventCounter = 0;

function nextEventId(): string {
  eventCounter += 1;
  return `evt-ds-${Date.now()}-${eventCounter}`;
}

async function loadSkillContext(skillPath: string): Promise<string> {
  const parts: string[] = [];
  const skillMd = await readSkillFile(skillPath, "SKILL.md");
  parts.push("## SKILL.md\n\n" + skillMd);

  const optionalFiles = ["reference.md", "workflow.md", "preferences.md"];
  for (const file of optionalFiles) {
    try {
      const content = await readSkillFile(skillPath, file);
      parts.push(`## ${file}\n\n${content}`);
    } catch {
      // optional
    }
  }

  return parts.join("\n\n---\n\n");
}

export async function executeRunWithDeepSeek(record: RunRecord): Promise<void> {
  const config = getLLMConfig();
  if (!config) {
    await updateRun(record.id, {
      status: "error",
      finishedAt: new Date().toISOString(),
      error: "未配置 DeepSeek API Key",
      events: [
        ...record.events,
        {
          id: nextEventId(),
          type: "error",
          timestamp: new Date().toISOString(),
          data: {
            message:
              "请设置 DEEPSEEK_API_KEY（或 LLM_API_KEY）以及 AI_BASE_URL / AI_MODEL",
          },
        },
      ],
    });
    return;
  }

  if (!record.autoMatch && record.skillId !== "auto:pending") {
    const skill = await getSkillById(record.skillId);
    if (!skill) {
      await updateRun(record.id, {
        status: "error",
        finishedAt: new Date().toISOString(),
        error: "Skill 不存在",
      });
      return;
    }
  }

  await appendRunEvents(record.id, [
    {
      id: nextEventId(),
      type: "status",
      timestamp: new Date().toISOString(),
      data: {
        status: "RUNNING",
        message: `DeepSeek Agent · ${config.model} · tool loop`,
      },
    },
  ]);

  try {
    const initResult = await runAgentInitialization(record);
    const { selectedSkill } = initResult;

    const skillContext = await loadSkillContext(selectedSkill.path);
    const system = buildAgentSystemPrompt({
      skillName: selectedSkill.name,
      skillPath: selectedSkill.path,
      skillContext,
    });

    const user = [
      `Use skill「${selectedSkill.name}」to complete this task:`,
      "",
      record.prompt,
    ].join("\n");

    const loopResult = await runDeepSeekAgentLoop({
      system,
      user,
      sink: {
        onAssistantText: async (text) => {
          await appendRunEvents(record.id, [
            {
              id: nextEventId(),
              type: "assistant_text",
              timestamp: new Date().toISOString(),
              data: { text },
            },
          ]);
        },
        onToolCallStart: async (name, args, callId) => {
          await appendRunEvents(record.id, [
            {
              id: nextEventId(),
              type: "tool_call_start",
              timestamp: new Date().toISOString(),
              data: { callId, name, args },
            },
          ]);
        },
        onToolResult: async (name, result, callId) => {
          await appendRunEvents(record.id, [
            {
              id: nextEventId(),
              type: "tool_result",
              timestamp: new Date().toISOString(),
              data: { callId, name, result },
            },
          ]);
        },
        onStatus: async (message) => {
          await appendRunEvents(record.id, [
            {
              id: nextEventId(),
              type: "status",
              timestamp: new Date().toISOString(),
              data: { status: "RUNNING", message },
            },
          ]);
        },
      },
    });

    await updateRun(record.id, {
      status: "finished",
      finishedAt: new Date().toISOString(),
      result: loopResult.finalText || undefined,
      model: config.model,
    });
    await finishExecuteStep(record.id, "done", {
      mode: "deepseek-agent",
      iterations: loopResult.iterations,
      toolCallCount: loopResult.toolCallCount,
      contextLength: initResult.skillContextLength,
      responseLength: loopResult.finalText.length,
    });
  } catch (err) {
    const message =
      err instanceof LLMError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown error";
    await appendRunEvents(record.id, [
      {
        id: nextEventId(),
        type: "error",
        timestamp: new Date().toISOString(),
        data: { message },
      },
    ]);
    await updateRun(record.id, {
      status: "error",
      finishedAt: new Date().toISOString(),
      error: message,
    });
    await finishExecuteStep(record.id, "error", { message });
  }
}
