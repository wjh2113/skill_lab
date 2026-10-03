"use client";

import type { SkillDependencyGraph } from "@/lib/skills/dependencies";

const TYPE_COLORS: Record<string, string> = {
  file: "bg-blue-100 text-blue-800",
  script: "bg-amber-100 text-amber-800",
  mcp: "bg-violet-100 text-violet-800",
  external: "bg-zinc-100 text-zinc-800",
};

export function DependencyGraphView({ graph }: { graph: SkillDependencyGraph }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {graph.nodes.map((node) => (
          <div
            key={node.name + (node.path ?? "")}
            className={`rounded-lg px-3 py-2 text-xs ${TYPE_COLORS[node.type] ?? TYPE_COLORS.file}`}
          >
            <div className="font-medium">{node.name}</div>
            {node.path && <div className="font-mono opacity-70">{node.path}</div>}
            <div className="mt-0.5 opacity-60">{node.type}</div>
          </div>
        ))}
      </div>
      {graph.edges.length > 0 && (
        <div className="space-y-1 text-xs text-zinc-500">
          <div className="font-medium text-zinc-700">关系</div>
          {graph.edges.map((e, i) => (
            <div key={i} className="font-mono">
              {e.from} —[{e.label}]→ {e.to}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
