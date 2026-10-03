import type { PipelineStep } from "@/lib/agent/pipeline-types";

export type RunProvider = "cursor" | "deepseek";

export type RunStatus = "running" | "finished" | "error" | "cancelled";

export type RunEventType =
  | "assistant_text"
  | "thinking"
  | "tool_call_start"
  | "tool_call_end"
  | "tool_result"
  | "status"
  | "error";

export type RunEvent = {
  id: string;
  type: RunEventType;
  timestamp: string;
  data: Record<string, unknown>;
};

export type RunRecord = {
  id: string;
  skillId: string;
  skillName: string;
  prompt: string;
  provider: RunProvider;
  model?: string;
  autoMatch?: boolean;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  events: RunEvent[];
  pipeline?: PipelineStep[];
  result?: string;
  error?: string;
  /** AI 生成的运行解读（可选） */
  explanation?: string;
  agentId?: string;
  runId?: string;
};

export type CreateRunInput = {
  skillId?: string;
  prompt: string;
  provider?: RunProvider;
  autoMatch?: boolean;
};
