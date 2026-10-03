import { NextResponse } from "next/server";
import { streamChatCompletion } from "@/lib/ai/deepseek";
import { getLLMConfig } from "@/lib/ai/config";
import { buildAiExplainPrompt, buildRuleBasedExplanation } from "@/lib/agent/run-explainer";
import { loadRun, updateRun } from "@/lib/agent/store";

export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await loadRun(id);
  if (!record) {
    return NextResponse.json({ error: "运行记录不存在" }, { status: 404 });
  }

  const config = getLLMConfig();
  if (!config) {
    const rule = buildRuleBasedExplanation(record);
    return NextResponse.json({
      explanation: rule.sections.map((s) => `${s.title}\n${s.content}`).join("\n\n"),
      source: "rule",
      message: "未配置 DeepSeek API Key，已返回规则解释",
    });
  }

  const { system, user } = buildAiExplainPrompt(record);

  try {
    const explanation = await streamChatCompletion({
      system,
      user,
      maxTokens: 2048,
      temperature: 0.4,
      onChunk: () => {},
    });

    await updateRun(id, { explanation });

    return NextResponse.json({ explanation, source: "ai" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "生成解释失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await loadRun(id);
  if (!record) {
    return NextResponse.json({ error: "运行记录不存在" }, { status: 404 });
  }

  const rule = buildRuleBasedExplanation(record);
  return NextResponse.json({
    explanation: record.explanation ?? null,
    rule,
  });
}
