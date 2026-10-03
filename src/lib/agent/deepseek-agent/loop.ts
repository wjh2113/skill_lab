import { chatCompletion, LLMError } from "@/lib/ai/deepseek";
import { getWorkspaceRoot } from "@/lib/config";
import { AGENT_TOOLS, executeAgentTool } from "@/lib/agent/deepseek-agent/tools";
import type {
  AgentEventSink,
  AgentLoopResult,
  ChatMessage,
} from "@/lib/agent/deepseek-agent/types";

const DEFAULT_MAX_ITERATIONS = 25;

function getMaxIterations(): number {
  const raw = process.env.DEEPSEEK_AGENT_MAX_ITERATIONS?.trim();
  const n = raw ? parseInt(raw, 10) : DEFAULT_MAX_ITERATIONS;
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50) : DEFAULT_MAX_ITERATIONS;
}

export function buildAgentSystemPrompt(options: {
  skillName: string;
  skillPath: string;
  skillContext: string;
}): string {
  const workspace = getWorkspaceRoot();
  return [
    "You are an autonomous coding agent executing a Cursor Agent Skill.",
    "Follow the skill instructions below precisely. Use tools to read files, run commands, write outputs, and iterate until the task is complete or you are blocked.",
    "",
    "Rules:",
    "- Prefer acting with tools over describing what you would do.",
    "- After each tool result, decide the next step; do not stop after a single tool call unless the task is done.",
    "- All file paths are relative to the workspace root unless absolute within workspace.",
    "- When installing dependencies or running scripts, use run_terminal.",
    "- When finished, reply with a concise summary: what you did, key outputs, and their paths.",
    "",
    `Workspace: ${workspace}`,
    `Skill: ${options.skillName}`,
    `Skill path: ${options.skillPath}`,
    "",
    "--- Skill files ---",
    "",
    options.skillContext,
  ].join("\n");
}

export async function runDeepSeekAgentLoop(options: {
  system: string;
  user: string;
  sink: AgentEventSink;
}): Promise<AgentLoopResult> {
  const messages: ChatMessage[] = [
    { role: "system", content: options.system },
    { role: "user", content: options.user },
  ];

  const maxIterations = getMaxIterations();
  let toolCallCount = 0;
  let finalText = "";

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    if (options.sink.onStatus) {
      await options.sink.onStatus(`Agent 第 ${iteration + 1}/${maxIterations} 轮`);
    }

    let response;
    try {
      response = await chatCompletion({
        messages,
        tools: AGENT_TOOLS,
        maxTokens: 8192,
        temperature: 0.3,
      });
    } catch (err) {
      throw err instanceof LLMError ? err : new LLMError(String(err));
    }

    if (response.content?.trim()) {
      finalText = response.content.trim();
      await options.sink.onAssistantText(response.content);
    }

    const toolCalls = response.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return { finalText, iterations: iteration + 1, toolCallCount };
    }

    messages.push({
      role: "assistant",
      content: response.content,
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      toolCallCount += 1;
      let parsedArgs: unknown = {};
      try {
        parsedArgs = JSON.parse(toolCall.function.arguments || "{}");
      } catch {
        parsedArgs = toolCall.function.arguments;
      }

      await options.sink.onToolCallStart(
        toolCall.function.name,
        parsedArgs,
        toolCall.id
      );

      const result = await executeAgentTool(toolCall);
      await options.sink.onToolResult(toolCall.function.name, result, toolCall.id);

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }
  }

  throw new LLMError(
    `Agent 达到最大迭代次数 (${maxIterations})，任务可能未完成。可增大 DEEPSEEK_AGENT_MAX_ITERATIONS 后重试。`
  );
}
