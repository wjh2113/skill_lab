import { getLLMConfig } from "@/lib/ai/config";
import type {
  AssistantResponse,
  ChatMessage,
  ToolDefinition,
} from "@/lib/agent/deepseek-agent/types";

export class LLMError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "LLMError";
  }
}

type StreamChunkHandler = (chunk: {
  text?: string;
  reasoning?: string;
  done: boolean;
}) => void;

export async function chatCompletion(options: {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
}): Promise<AssistantResponse> {
  const config = getLLMConfig();
  if (!config) throw new LLMError("未配置 DeepSeek API Key（DEEPSEEK_API_KEY 或 LLM_API_KEY）");

  const body: Record<string, unknown> = {
    model: config.model,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 8192,
    messages: options.messages,
  };

  if (options.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = "auto";
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new LLMError(
      detail
        ? `DeepSeek 请求失败 (${response.status}): ${detail.slice(0, 300)}`
        : `DeepSeek 请求失败 (${response.status})`,
      response.status
    );
  }

  const parsed = (await response.json()) as {
    choices?: Array<{
      finish_reason?: string | null;
      message?: {
        content?: string | null;
        tool_calls?: Array<{
          id: string;
          type: "function";
          function: { name: string; arguments: string };
        }>;
      };
    }>;
  };

  const choice = parsed.choices?.[0];
  const message = choice?.message;

  return {
    content: message?.content ?? null,
    tool_calls: message?.tool_calls,
    finish_reason: choice?.finish_reason ?? null,
  };
}

export async function streamChatCompletion(options: {
  system: string;
  user: string;
  onChunk: StreamChunkHandler;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const config = getLLMConfig();
  if (!config) throw new LLMError("未配置 DeepSeek API Key（DEEPSEEK_API_KEY 或 LLM_API_KEY）");

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 8192,
      stream: true,
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new LLMError(
      detail
        ? `DeepSeek 请求失败 (${response.status}): ${detail.slice(0, 300)}`
        : `DeepSeek 请求失败 (${response.status})`,
      response.status
    );
  }

  if (!response.body) {
    throw new LLMError("DeepSeek 响应体为空");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") {
        options.onChunk({ done: true });
        continue;
      }

      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{
            delta?: {
              content?: string;
              reasoning_content?: string;
            };
          }>;
        };
        const delta = parsed.choices?.[0]?.delta;
        const text = delta?.content;
        const reasoning = delta?.reasoning_content;

        if (text) {
          fullText += text;
          options.onChunk({ text, done: false });
        }
        if (reasoning) {
          options.onChunk({ reasoning, done: false });
        }
      } catch {
        // skip malformed chunks
      }
    }
  }

  return fullText.trim();
}
