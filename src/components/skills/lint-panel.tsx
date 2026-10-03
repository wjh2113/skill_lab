"use client";

import { Badge } from "@/components/ui/badge";
import type { SkillLintResult } from "@/lib/skills/linter";
import { lintScoreVariant } from "@/lib/skills/linter";

export function LintPanel({ result }: { result: SkillLintResult }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">规范评分</span>
        <Badge variant={lintScoreVariant(result.score)}>{result.score}/100</Badge>
      </div>
      {result.issues.length === 0 ? (
        <p className="text-sm text-emerald-600">无问题，符合 create-skill 规范</p>
      ) : (
        <ul className="space-y-2">
          {result.issues.map((issue) => (
            <li
              key={issue.rule}
              className="rounded-lg border border-zinc-200 p-3 text-sm"
            >
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    issue.severity === "error"
                      ? "error"
                      : issue.severity === "warning"
                        ? "warning"
                        : "secondary"
                  }
                >
                  {issue.severity}
                </Badge>
                <span className="font-mono text-xs text-zinc-400">{issue.rule}</span>
              </div>
              <p className="mt-1">{issue.message}</p>
              {issue.suggestion && (
                <p className="mt-1 text-xs text-zinc-500">建议：{issue.suggestion}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
