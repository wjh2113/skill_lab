"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DiffView } from "@/components/skills/diff-view";
import type { SkillCompareResult } from "@/lib/skills/diff";
import type { SkillSummary } from "@/lib/skills/types";

function CompareContent() {
  const params = useSearchParams();
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [skillA, setSkillA] = useState(params.get("a") ?? "");
  const [skillB, setSkillB] = useState(params.get("b") ?? "");
  const [comparison, setComparison] = useState<SkillCompareResult | null>(null);

  useEffect(() => {
    fetch("/api/skills").then((r) => r.json()).then((d) => setSkills(d.skills ?? []));
  }, []);

  useEffect(() => {
    if (skillA && skillB) {
      fetch(`/api/skills/compare?a=${encodeURIComponent(skillA)}&b=${encodeURIComponent(skillB)}`)
        .then((r) => r.json())
        .then((d) => setComparison(d.comparison ?? null));
    }
  }, [skillA, skillB]);

  return (
    <div className="flex flex-1 flex-col p-6">
      <h1 className="text-xl font-semibold">Skill 对比</h1>
      <p className="mt-1 text-sm text-zinc-500">并排 diff 两个 skill 的 SKILL.md</p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <select
          value={skillA}
          onChange={(e) => setSkillA(e.target.value)}
          className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
        >
          <option value="">Skill A</option>
          {skills.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={skillB}
          onChange={(e) => setSkillB(e.target.value)}
          className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
        >
          <option value="">Skill B</option>
          {skills.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      {comparison && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-medium">
            {comparison.skillA.name} vs {comparison.skillB.name}
          </h2>
          <DiffView comparison={comparison} />
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-6">加载中...</div>}>
      <CompareContent />
    </Suspense>
  );
}
