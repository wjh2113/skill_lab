"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { RunProvider } from "@/lib/agent/types";
import type { SkillSummary } from "@/lib/skills/types";

export default function ExperimentPage() {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [skillId, setSkillId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<RunProvider>("deepseek");
  const [labelA, setLabelA] = useState("简洁指令");
  const [prefixA, setPrefixA] = useState("请直接执行，不要解释过程。");
  const [labelB, setLabelB] = useState("详细指令");
  const [prefixB, setPrefixB] = useState("请先分析 skill 工作流，逐步执行并说明每一步。");
  const [result, setResult] = useState<{ runIdA?: string; runIdB?: string } | null>(null);

  useEffect(() => {
    fetch("/api/skills").then((r) => r.json()).then((d) => {
      setSkills(d.skills ?? []);
      if (d.skills?.[0]) setSkillId(d.skills[0].id);
    });
  }, []);

  async function runExperiment() {
    const res = await fetch("/api/experiments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skillId,
        prompt,
        provider,
        variantA: { label: labelA, systemPrefix: prefixA },
        variantB: { label: labelB, systemPrefix: prefixB },
      }),
    });
    const data = await res.json();
    setResult(data.experiment);
  }

  return (
    <div className="flex flex-1 flex-col p-6">
      <h1 className="text-xl font-semibold">A/B Prompt 实验</h1>
      <p className="mt-1 text-sm text-zinc-500">同一 skill、同一任务，对比两种 system prompt 策略</p>

      <div className="mt-4 space-y-4 max-w-2xl">
        <div>
          <Label>Skill</Label>
          <select
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          >
            {skills.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>任务 Prompt</Label>
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className="mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-3">
            <Label>变体 A</Label>
            <Input value={labelA} onChange={(e) => setLabelA(e.target.value)} className="mt-1" />
            <Textarea value={prefixA} onChange={(e) => setPrefixA(e.target.value)} rows={2} className="mt-2" />
          </div>
          <div className="rounded-lg border p-3">
            <Label>变体 B</Label>
            <Input value={labelB} onChange={(e) => setLabelB(e.target.value)} className="mt-1" />
            <Textarea value={prefixB} onChange={(e) => setPrefixB(e.target.value)} rows={2} className="mt-2" />
          </div>
        </div>
        <Button onClick={runExperiment} disabled={!skillId || !prompt.trim()}>启动 A/B 实验</Button>
      </div>

      {result?.runIdA && result?.runIdB && (
        <div className="mt-6 flex gap-4">
          <Link href={`/runs/${result.runIdA}`} className="text-violet-600 hover:underline">
            变体 A → {result.runIdA.slice(-8)}
          </Link>
          <Link href={`/runs/${result.runIdB}`} className="text-violet-600 hover:underline">
            变体 B → {result.runIdB.slice(-8)}
          </Link>
        </div>
      )}
    </div>
  );
}
