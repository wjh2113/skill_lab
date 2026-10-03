"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SkillSummary } from "@/lib/skills/types";
import type { RunProvider } from "@/lib/agent/types";
import type { EvalSuite } from "@/lib/eval/suites";

export default function EvalPage() {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [skillId, setSkillId] = useState("");
  const [suite, setSuite] = useState<EvalSuite | null>(null);
  const [provider, setProvider] = useState<RunProvider>("deepseek");
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<Array<{ caseId: string; caseName: string; runId: string }>>([]);

  useEffect(() => {
    fetch("/api/skills").then((r) => r.json()).then((d) => {
      setSkills(d.skills ?? []);
      if (d.skills?.[0]) setSkillId(d.skills[0].id);
    });
  }, []);

  useEffect(() => {
    if (!skillId) return;
    fetch(`/api/eval/${encodeURIComponent(skillId)}`)
      .then((r) => r.json())
      .then((d) => setSuite(d.suite));
  }, [skillId]);

  async function runBatch() {
    setRunning(true);
    const res = await fetch("/api/eval/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillId, provider }),
    });
    const data = await res.json();
    setRuns(data.runs ?? []);
    setRunning(false);
  }

  return (
    <div className="flex flex-1 flex-col p-6">
      <h1 className="text-xl font-semibold">Skill 评测套件</h1>
      <p className="mt-1 text-sm text-zinc-500">批量运行测试 prompt，对比执行结果</p>

      <div className="mt-4 flex flex-wrap gap-3">
        <select
          value={skillId}
          onChange={(e) => setSkillId(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          {skills.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as RunProvider)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="deepseek">DeepSeek</option>
          <option value="cursor">Cursor</option>
        </select>
        <Button onClick={runBatch} disabled={running || !skillId}>
          {running ? "运行中..." : "批量运行"}
        </Button>
      </div>

      {suite && (
        <div className="mt-6">
          <h2 className="text-sm font-medium">测试用例 ({suite.cases.length})</h2>
          <ul className="mt-2 space-y-2">
            {suite.cases.map((c) => (
              <li key={c.id} className="rounded-lg border p-3 text-sm">
                <div className="font-medium">{c.name}</div>
                <p className="mt-1 text-zinc-500">{c.prompt}</p>
                {c.tags?.map((t) => (
                  <Badge key={t} variant="secondary" className="mt-1 mr-1">{t}</Badge>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {runs.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-medium">运行结果</h2>
          <ul className="mt-2 space-y-1">
            {runs.map((r) => (
              <li key={r.runId}>
                <Link href={`/runs/${r.runId}`} className="text-sm text-violet-600 hover:underline">
                  {r.caseName} → {r.runId.slice(-8)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
