import { Agent, CursorAgentError } from "@cursor/sdk";
import { getDefaultProvider, getLLMConfig, hasCursorApiKey } from "@/lib/ai/config";
import { getWorkspaceRoot } from "@/lib/config";
import { executeRunWithDeepSeek } from "@/lib/agent/deepseek-runner";
import { extractAssistantText, sdkMessageToRunEvent } from "@/lib/agent/events";
import {
  finishExecuteStep,
  runAgentInitialization,
} from "@/lib/agent/initialize";
import {
  appendRunEvents,
  generateRunId,
  saveRun,
  updateRun,
} from "@/lib/agent/store";
import type { CreateRunInput, RunEvent, RunRecord, RunProvider } from "@/lib/agent/types";
import { getSkillById } from "@/lib/skills/scanner";

const runningTasks = new Map<string, Promise<void>>();

function flattenEvents(
  mapped: ReturnType<typeof sdkMessageToRunEvent>
): RunEvent[] {
  if (!mapped) return [];
  return Array.isArray(mapped) ? mapped : [mapped];
}

export async function createRunRecord(input: CreateRunInput): Promise<RunRecord> {
  if (!input.prompt.trim()) throw new Error("prompt 不能为空");

  const provider = input.provider ?? getDefaultProvider();
  if (provider === "cursor" && !hasCursorApiKey()) {
    throw new Error("未配置 CURSOR_API_KEY，请改用 DeepSeek 模式或配置 API Key");
  }
  if (provider === "deepseek" && !getLLMConfig()) {
    throw new Error("未配置 DeepSeek API Key（DEEPSEEK_API_KEY 或 LLM_API_KEY）");
  }

  const autoMatch = input.autoMatch ?? !input.skillId;
  const skill = input.skillId ? await getSkillById(input.skillId) : null;

  if (!autoMatch && !skill) {
    throw new Error(`Skill not found: ${input.skillId}`);
  }

  const llm = getLLMConfig();

  const record: RunRecord = {
    id: generateRunId(),
    skillId: skill?.id ?? "auto:pending",
    skillName: skill?.name ?? "(自动匹配中)",
    prompt: input.prompt.trim(),
    provider,
    autoMatch,
    model: provider === "deepseek" ? llm?.model : "composer-2.5",
    status: "running",
    startedAt: new Date().toISOString(),
    events: [],
  };

  await saveRun(record);
  return record;
}

export function startRunExecution(record: RunRecord): void {
  if (runningTasks.has(record.id)) return;
  const task = (record.provider === "deepseek" ? executeRunWithDeepSeek(record) : executeRun(record)).finally(() => {
    runningTasks.delete(record.id);
  });
  runningTasks.set(record.id, task);
}

async function executeRun(record: RunRecord): Promise<void> {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    await updateRun(record.id, {
      status: "error",
      finishedAt: new Date().toISOString(),
      error: "未配置 CURSOR_API_KEY",
      events: [
        ...record.events,
        {
          id: `evt-error-${Date.now()}`,
          type: "error",
          timestamp: new Date().toISOString(),
          data: { message: "未配置 CURSOR_API_KEY，请在 .env.local 中设置" },
        },
      ],
    });
    return;
  }

  const prompt = [
    `请使用 skill「${record.skillName}」完成以下任务。`,
    "先读取并遵循该 skill 的 SKILL.md 指令，再执行。",
    "",
    record.prompt,
  ].join("\n");

  let agent: Awaited<ReturnType<typeof Agent.create>> | null = null;

  try {
    await runAgentInitialization(record);

    agent = await Agent.create({
      apiKey,
      model: { id: "composer-2.5" },
      local: {
        cwd: getWorkspaceRoot(),
        settingSources: ["project", "user"],
      },
    });

    await updateRun(record.id, { agentId: agent.agentId });

    const run = await agent.send(prompt);
    await updateRun(record.id, { runId: run.id });

    const sdkMessages = [];

    for await (const message of run.stream()) {
      sdkMessages.push(message);
      const mapped = sdkMessageToRunEvent(message);
      const events = flattenEvents(mapped);
      if (events.length > 0) {
        await appendRunEvents(record.id, events);
      }
    }

    const result = await run.wait();
    const assistantText = extractAssistantText(sdkMessages);

    await updateRun(record.id, {
      status: result.status === "finished" ? "finished" : "error",
      finishedAt: new Date().toISOString(),
      result: assistantText || result.result || undefined,
      error: result.status === "error" ? "Agent run failed" : undefined,
    });
    await finishExecuteStep(record.id, result.status === "finished" ? "done" : "error", {
      mode: "cursor-agent",
      agentId: agent.agentId,
      runId: run.id,
      toolCallCount: record.events.filter((e) => e.type === "tool_call_start").length,
    });
  } catch (err) {
    const message =
      err instanceof CursorAgentError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown error";

    await appendRunEvents(record.id, [
      {
        id: `evt-error-${Date.now()}`,
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
    await finishExecuteStep(record.id, "error", { message }).catch(() => {});
  } finally {
    if (agent) {
      try {
        await agent[Symbol.asyncDispose]();
      } catch {
        // ignore dispose errors
      }
    }
  }
}

export function isRunActive(id: string): boolean {
  return runningTasks.has(id);
}
