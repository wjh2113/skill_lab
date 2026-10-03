"use client";

import { ExternalLink, Loader2, Package, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { SkillsShInstallResult, SkillsShItem, SkillsShSearchResult } from "@/lib/skills/skills-sh";

const SUGGESTIONS = ["translate", "pdf", "commit", "review", "deploy", "database"];

function formatInstalls(count: number, label: string): string {
  if (label) return label;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K installs`;
  return `${count} installs`;
}

function SkillResultCard({
  item,
  onInstall,
  installing,
}: {
  item: SkillsShItem;
  onInstall: (ref: string) => void;
  installing: string | null;
}) {
  const isInstalling = installing === item.packageRef;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-base font-mono">{item.skillName}</CardTitle>
            <CardDescription className="mt-1 font-mono text-xs">
              {item.owner}/{item.repo}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="shrink-0 gap-1">
            <Package className="h-3 w-3" />
            {formatInstalls(item.installsCount, item.installsLabel)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2 pt-0">
        <code className="truncate text-[10px] text-zinc-400">{item.packageRef}</code>
        <div className="flex shrink-0 gap-2">
          {item.url && (
            <Button variant="ghost" size="sm" asChild>
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={isInstalling}
            onClick={() => onInstall(item.packageRef)}
          >
            {isInstalling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "安装"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SkillsShSearchResult | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installOut, setInstallOut] = useState<(SkillsShInstallResult & { ref: string }) | null>(null);

  async function search(q?: string) {
    const term = (q ?? query).trim();
    if (!term) return;
    setLoading(true);
    setResult(null);
    setInstallOut(null);
    try {
      const res = await fetch(`/api/skills/discover?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      setResult(data.result);
    } finally {
      setLoading(false);
    }
  }

  async function install(packageRef: string) {
    setInstalling(packageRef);
    setInstallOut(null);
    try {
      const res = await fetch("/api/skills/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageRef }),
      });
      const data = (await res.json()) as SkillsShInstallResult;
      setInstallOut({ ref: packageRef, ...data, output: data.output ?? "未知错误" });
    } finally {
      setInstalling(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col p-6">
      <h1 className="text-xl font-semibold">Skill 发现</h1>
      <p className="mt-1 text-sm text-zinc-500">
        搜索 skills.sh 社区 skill，一键安装到 Cursor
      </p>

      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            className="pl-9"
            placeholder="搜索关键词，如 translate、pdf、commit..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
        </div>
        <Button onClick={() => search()} disabled={!query.trim() || loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "搜索"}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setQuery(s);
              search(s);
            }}
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
          >
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <div className="mt-8 flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在搜索 skills.sh...
        </div>
      )}

      {result?.error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {result.error}
        </div>
      )}

      {result && !loading && result.items.length === 0 && !result.error && (
        <div className="mt-8 text-center text-sm text-zinc-500">
          未找到与「{result.query}」相关的 skill，试试其他关键词
        </div>
      )}

      {result && result.items.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              找到 <span className="font-medium text-zinc-700">{result.items.length}</span> 个结果
              {result.hint && (
                <span className="ml-2 text-xs">· 安装命令: <code className="text-violet-600">{result.hint}</code></span>
              )}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {result.items.map((item) => (
              <SkillResultCard
                key={item.packageRef}
                item={item}
                onInstall={install}
                installing={installing}
              />
            ))}
          </div>
        </div>
      )}

      {installOut && (
        <div
          className={`mt-6 rounded-lg border p-4 text-sm ${
 installOut.ok
 ? "border-emerald-200 bg-emerald-50 text-emerald-800"
 : "border-red-200 bg-red-50 text-red-800"
 }`}
        >
          <p className="font-medium">{installOut.ok ? "安装成功" : "安装失败"} — {installOut.ref}</p>
          {installOut.ok && installOut.installPath && (
            <p className="mt-1 text-xs opacity-90">
              安装路径: <code>{installOut.installPath}</code>
              {installOut.skillId && (
                <>
                  {" "}
                  ·{" "}
                  <Link href={`/skills/${encodeURIComponent(installOut.skillId)}`} className="underline">
                    查看 skill 详情
                  </Link>
                </>
              )}
            </p>
          )}
          {!installOut.ok && (
            <p className="mt-1 text-xs opacity-90">
              首次安装需克隆 GitHub 仓库，可能耗时 1–3 分钟。若持续失败，可在项目目录终端运行：
              <code className="mt-1 block rounded bg-black/5 px-2 py-1">
                npx skills add {installOut.ref} -a cursor -y --copy
              </code>
            </p>
          )}
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs opacity-80">
            {installOut.output}
          </pre>
        </div>
      )}

      <div className="mt-8 border-t pt-4 text-xs text-zinc-400">
        数据来源:{" "}
        <a href="https://skills.sh" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">
          skills.sh
        </a>
        {" "}· 也可手动输入 packageRef 安装:{" "}
        <code>owner/repo@skill-name</code>
      </div>
    </div>
  );
}
