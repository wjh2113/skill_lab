"use client";

import type { SkillCompareResult } from "@/lib/skills/diff";
import { cn } from "@/lib/utils";

export function DiffView({ comparison }: { comparison: SkillCompareResult }) {
  return (
    <div>
      <div className="mb-3 flex gap-4 text-sm text-zinc-500">
        <span className="text-red-600">-{comparison.stats.removed}</span>
        <span className="text-emerald-600">+{comparison.stats.added}</span>
        <span>{comparison.stats.same} 相同</span>
      </div>
      <pre className="overflow-auto rounded-lg border border-zinc-200 text-xs">
        {comparison.diff.map((line, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              line.type === "add" && "bg-emerald-50",
              line.type === "remove" && "bg-red-50"
            )}
          >
            <span className="w-16 shrink-0 border-r border-zinc-200 px-2 py-0.5 text-zinc-400">
              {line.lineNo?.a ?? ""}
              {line.lineNo?.a && line.lineNo?.b ? "/" : ""}
              {line.lineNo?.b ?? ""}
            </span>
            <span
              className={cn(
                "w-4 shrink-0 text-center",
                line.type === "add" && "text-emerald-600",
                line.type === "remove" && "text-red-600"
              )}
            >
              {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
            </span>
            <span className="flex-1 px-2 py-0.5">{line.content || " "}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
