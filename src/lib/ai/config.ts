export type RunProvider = "cursor" | "deepseek";

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: RunProvider;
}

export function getLLMConfig(): LLMConfig | null {
  const apiKey =
    process.env.DEEPSEEK_API_KEY?.trim() ||
    process.env.LLM_API_KEY?.trim() ||
    process.env.AI_API_KEY?.trim() ||
    "";

  if (!apiKey) return null;

  const baseUrl = (
    process.env.AI_BASE_URL?.trim() ||
    process.env.LLM_BASE_URL?.trim() ||
    "https://api.deepseek.com/v1"
  ).replace(/\/$/, "");

  const model =
    process.env.AI_MODEL?.trim() ||
    process.env.LLM_MODEL?.trim() ||
    "deepseek-chat";

  return { apiKey, baseUrl, model, provider: "deepseek" };
}

export function hasCursorApiKey(): boolean {
  return Boolean(process.env.CURSOR_API_KEY?.trim());
}

export function hasDeepSeekApiKey(): boolean {
  return getLLMConfig() !== null;
}

export function getDefaultProvider(): RunProvider {
  const preferred = process.env.RUN_PROVIDER?.trim() as RunProvider | undefined;
  if (preferred === "cursor" || preferred === "deepseek") return preferred;
  if (hasCursorApiKey()) return "cursor";
  if (hasDeepSeekApiKey()) return "deepseek";
  return "cursor";
}

export function getProviderStatus() {
  const llm = getLLMConfig();
  return {
    cursor: {
      available: hasCursorApiKey(),
      label: "Cursor Agent",
      description: "完整 agent 运行时，支持真实 tool call",
    },
    deepseek: {
      available: hasDeepSeekApiKey(),
      label: "DeepSeek Agent",
      description: "DeepSeek 驱动的 Agent 运行时，支持 read/write/terminal 等 tool call 多轮循环",
      model: llm?.model,
      baseUrl: llm?.baseUrl,
    },
    defaultProvider: getDefaultProvider(),
  };
}
