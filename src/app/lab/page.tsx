"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { RunTimeline } from "@/components/lab/run-timeline";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { RunProvider, RunRecord } from "@/lib/agent/types";
import type { SkillSummary } from "@/lib/skills/types";

type ProviderStatus = {
  cursor: { available: boolean; label: string; description: string };
  deepseek: {
    available: boolean;
    label: string;
    description: string;
    model?: string;
  };
  defaultProvider: RunProvider;
};

function LabContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedSkill = searchParams.get("skill");

  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [skillId, setSkillId] = useState(preselectedSkill ?? "");
  const [autoMatch, setAutoMatch] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<RunProvider>("cursor");
  const [providers, setProviders] = useState<ProviderStatus | null>(null);
  const [run, setRun] = useState<RunRecord | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => {
        setSkills(d.skills ?? []);
        if (preselectedSkill) setSkillId(preselectedSkill);
        else if (d.skills?.length) setSkillId(d.skills[0].id);
      });
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => {
        setProviders(d.providers);
        setProvider(d.providers.defaultProvider);
      });
  }, [preselectedSkill]);

  const canRun =
    provider === "cursor"
      ? providers?.cursor.available
      : providers?.deepseek.available;

  const subscribeRun = useCallback((runId: string) => {
    const source = new EventSource(`/api/runs/${runId}/stream`);
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.run) setRun(payload.run);
      if (payload.type === "done") {
        source.close();
        setRunning(false);
      }
    };
    source.onerror = () => {
      source.close();
      setRunning(false);
    };
    return () => source.close();
  }, []);

  async function handleRun(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    if (!autoMatch && !skillId) return;
    setRunning(true);
    setError(null);
    setRun(null);

    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillId: autoMatch ? undefined : skillId,
          prompt,
          provider,
          autoMatch,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "启动失败");
      setRun(data.run);
      subscribeRun(data.run.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "启动失败");
      setRunning(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh)] flex-col">
      <header className="border-b border-zinc-200 px-6 py-4">
        <h1 className="text-xl font-semibold">运行实验室</h1>
        <p className="text-sm text-zinc-500">
          选择 skill、Provider 和测试 prompt，实时观察执行过程
        </p>
        {providers && !providers.cursor.available && !providers.deepseek.available && (
          <p className="mt-2 text-sm text-amber-600">
            请配置 CURSOR_API_KEY 或 DEEPSEEK_API_KEY 后再运行。
          </p>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr]">
        <div className="border-r border-zinc-200 p-4">
          <form onSubmit={handleRun} className="space-y-4">
            <div className="space-y-2">
              <Label>运行 Provider</Label>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 p-3 text-sm">
                  <input
                    type="radio"
                    name="provider"
                    value="cursor"
                    checked={provider === "cursor"}
                    onChange={() => setProvider("cursor")}
                    disabled={!providers?.cursor.available}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">Cursor Agent</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      完整 agent 运行时，支持真实 tool call
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 p-3 text-sm">
                  <input
                    type="radio"
                    name="provider"
                    value="deepseek"
                    checked={provider === "deepseek"}
                    onChange={() => setProvider("deepseek")}
                    disabled={!providers?.deepseek.available}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">DeepSeek Agent</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      多轮 tool call（读文件、跑命令、写结果）
                      {providers?.deepseek.model ? ` · ${providers.deepseek.model}` : ""}
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <label className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm">
              <input
                type="checkbox"
                checked={autoMatch}
                onChange={(e) => setAutoMatch(e.target.checked)}
              />
              <span>
                <span className="font-medium">Auto 自动匹配</span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  不手动选 skill，由 agent 扫描 description 自动匹配（贴近 Cursor 真实行为）
                </span>
              </span>
            </label>

            {!autoMatch && (
            <div className="space-y-2">
              <Label htmlFor="skill">Skill</Label>
              <select
                id="skill"
                value={skillId}
                onChange={(e) => setSkillId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-transparent px-3 text-sm"
                required
              >
                <option value="">选择 skill...</option>
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.scope})
                  </option>
                ))}
              </select>
            </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="prompt">测试 Prompt</Label>
              <Textarea
                id="prompt"
                placeholder="描述你想让 agent 用这个 skill 完成的任务..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                required
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" disabled={running || !canRun || (!autoMatch && !skillId)} className="w-full">
              {running ? "运行中..." : "开始运行"}
            </Button>

            {run && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.push(`/runs/${run.id}`)}
              >
                查看完整记录
              </Button>
            )}
          </form>
        </div>

        <div className="min-h-0">
          {run ? (
            <RunTimeline record={run} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              选择 skill 并输入 prompt 后开始运行
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LabPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">加载中...</div>}>
      <LabContent />
    </Suspense>
  );
}
