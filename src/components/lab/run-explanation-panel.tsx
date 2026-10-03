"use client";

import { BookOpen, Loader2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { buildRuleBasedExplanation } from "@/lib/agent/run-explainer";
import type { RunRecord } from "@/lib/agent/types";

export function RunExplanationPanel({ record }: { record: RunRecord }) {
  const [open, setOpen] = useState(true);
  const [aiText, setAiText] = useState<string | null>(record.explanation ?? null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const ruleExplanation = useMemo(() => buildRuleBasedExplanation(record), [record]);

  const hasPipeline = (record.pipeline?.length ?? 0) > 0;
  const canShow = hasPipeline || record.status !== "running";

  if (!canShow) return null;

  async function generateAiExplanation() {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch(`/api/runs/${record.id}/explain`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "生成失败");
      setAiText(data.explanation);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="border-b border-zinc-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-50"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-violet-600" />
          <span className="text-sm font-semibold">解释说明</span>
          <span className="text-xs text-zinc-500">{ruleExplanation.summary}</span>
        </div>
        <span className="text-xs text-zinc-400">{open ? "收起" : "展开"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-zinc-100 px-4 py-4">
          {ruleExplanation.sections.map((section) => (
            <div key={section.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {section.title}
              </h4>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                {section.content}
              </p>
            </div>
          ))}

          <div className="border-t border-zinc-100 pt-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-500">AI 深度解读（可选）</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={aiLoading || record.status === "running"}
                onClick={generateAiExplanation}
              >
                {aiLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {aiText ? "重新生成" : "生成 AI 解读"}
              </Button>
            </div>
            {aiError && <p className="mt-2 text-xs text-red-600">{aiError}</p>}
            {aiText && (
              <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50/30 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                {aiText}
              </div>
            )}
            {!aiText && !aiError && (
              <p className="mt-2 text-xs text-zinc-400">
                需要配置 DEEPSEEK_API_KEY。基于流水线数据生成更易读的中文解读。
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
