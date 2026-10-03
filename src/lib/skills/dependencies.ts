import type { SkillSummary } from "@/lib/skills/types";

export type SkillDependency = {
  type: "file" | "script" | "mcp" | "external";
  name: string;
  path?: string;
};

export type SkillDependencyGraph = {
  skillId: string;
  name: string;
  nodes: SkillDependency[];
  edges: { from: string; to: string; label?: string }[];
};

export function analyzeSkillDependencies(
  skill: SkillSummary,
  skillMdContent: string
): SkillDependencyGraph {
  const nodes: SkillDependency[] = [{ type: "file", name: "SKILL.md", path: "SKILL.md" }];
  const edges: SkillDependencyGraph["edges"] = [];

  function walkFiles(files: SkillSummary["files"], prefix = "") {
    for (const f of files) {
      if (f.type === "file") {
        const p = prefix ? `${prefix}/${f.name}` : f.name;
        if (p !== "SKILL.md") {
          const type = p.startsWith("scripts/") ? "script" : "file";
          nodes.push({ type, name: f.name, path: p });
          edges.push({ from: "SKILL.md", to: p, label: "contains" });
        }
      } else if (f.children) {
        walkFiles(f.children, f.path);
      }
    }
  }
  walkFiles(skill.files);

  const mdLinks = skillMdContent.match(/\[([^\]]*)\]\(([^)]+)\)/g) ?? [];
  for (const link of mdLinks) {
    const m = link.match(/\(([^)]+)\)/);
    const target = m?.[1];
    if (target && !target.startsWith("http") && !nodes.some((n) => n.path === target)) {
      nodes.push({ type: "file", name: target.split("/").pop() ?? target, path: target });
      edges.push({ from: "SKILL.md", to: target, label: "references" });
    }
  }

  const scriptRefs = skillMdContent.match(/scripts\/[\w.-]+/g) ?? [];
  for (const ref of [...new Set(scriptRefs)]) {
    if (!nodes.some((n) => n.path === ref)) {
      nodes.push({ type: "script", name: ref.split("/").pop() ?? ref, path: ref });
      edges.push({ from: "SKILL.md", to: ref, label: "executes" });
    }
  }

  if (/mcp|MCP|WebFetch|browser/i.test(skillMdContent)) {
    nodes.push({ type: "mcp", name: "MCP Tools" });
    edges.push({ from: "SKILL.md", to: "MCP Tools", label: "may use" });
  }

  if (/pip install|npm install|npx /i.test(skillMdContent)) {
    nodes.push({ type: "external", name: "Package deps" });
    edges.push({ from: "SKILL.md", to: "Package deps", label: "requires" });
  }

  return { skillId: skill.id, name: skill.name, nodes, edges };
}
