export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type AssistantResponse = {
  content: string | null;
  tool_calls?: ToolCall[];
  finish_reason: string | null;
};

export type AgentLoopResult = {
  finalText: string;
  iterations: number;
  toolCallCount: number;
};

export type AgentEventSink = {
  onAssistantText: (text: string) => Promise<void>;
  onToolCallStart: (name: string, args: unknown, callId: string) => Promise<void>;
  onToolResult: (name: string, result: string, callId: string) => Promise<void>;
  onStatus?: (message: string) => Promise<void>;
};
