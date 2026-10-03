"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Beaker, ExternalLink, Save } from "lucide-react";
import { DependencyGraphView } from "@/components/skills/dependency-graph";
import { FileTree } from "@/components/skills/file-tree";
import { LintPanel } from "@/components/skills/lint-panel";
import { CodePreview } from "@/components/skills/markdown-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { SkillDependencyGraph } from "@/lib/skills/dependencies";
import type { SkillLintResult } from "@/lib/skills/linter";
import type { SkillVersionInfo } from "@/lib/skills/versions";
import type { SkillSummary } from "@/lib/skills/types";

type Tab = "preview" | "edit" | "lint" | "deps" | "version";

export default function SkillDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const skillId = decodeURIComponent(params.id);

  const [skill, setSkill] = useState<SkillSummary | null>(null);
  const [tab, setTab] = useState<Tab>("preview");
  const [selectedPath, setSelectedPath] = useState("SKILL.md");
  const [fileContent, setFileContent] = useState("");
  const [editContent, setEditContent] = useState("");
  const [lint, setLint] = useState<SkillLintResult | null>(null);
  const [graph, setGraph] = useState<SkillDependencyGraph | null>(null);
  const [version, setVersion] = useState<SkillVersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFile = useCallback(
    async (path: string) => {
      const res = await fetch(
        `/api/skills/${encodeURIComponent(skillId)}/files?path=${encodeURIComponent(path)}`
      );
      if (!res.ok) throw new Error("无法读取文件");
      const data = await res.json();
      setFileContent(data.content);
      setEditContent(data.content);
      setSelectedPath(path);
    },
    [skillId]
  );

  useEffect(() => {
    async function load() {
      try {
        const [skillRes, lintRes, depRes, verRes] = await Promise.all([
          fetch(`/api/skills/${encodeURIComponent(skillId)}`),
          fetch(`/api/skills/${encodeURIComponent(skillId)}/lint`),
          fetch(`/api/skills/${encodeURIComponent(skillId)}/dependencies`),
          fetch(`/api/skills/${encodeURIComponent(skillId)}/versions`),
        ]);
        if (!skillRes.ok) throw new Error("Skill 不存在");
        const skillData = await skillRes.json();
        setSkill(skillData.skill);
        setLint((await lintRes.json()).result);
        setGraph((await depRes.json()).graph);
        setVersion((await verRes.json()).version);
        await loadFile("SKILL.md");
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [skillId, loadFile]);

  async function saveFile() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/skills/${encodeURIComponent(skillId)}/files`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: selectedPath, content: editContent }),
        }
      );
      if (!res.ok) throw new Error("保存失败");
      setFileContent(editContent);
      setTab("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function syncVersion() {
    await fetch(`/api/skills/${encodeURIComponent(skillId)}/versions`, { method: "POST" });
    const verRes = await fetch(`/api/skills/${encodeURIComponent(skillId)}/versions`);
    setVersion((await verRes.json()).version);
  }

  if (loading) return <div className="p-6 text-sm text-zinc-500">加载中...</div>;
  if (error || !skill) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error ?? "Skill 不存在"}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/")}>返回</Button>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "preview", label: "预览" },
    { id: "edit", label: "编辑" },
    { id: "lint", label: "规范检查" },
    { id: "deps", label: "依赖图" },
    { id: "version", label: "版本" },
  ];

  return (
    <div className="flex h-[calc(100vh)] flex-col">
      <header className="border-b border-zinc-200 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{skill.name}</h1>
              <Badge variant="secondary">{skill.scope}</Badge>
              {lint && <Badge variant={lint.score >= 80 ? "success" : "warning"}>{lint.score}分</Badge>}
            </div>
            <p className="mt-1 text-sm text-zinc-500">{skill.description}</p>
            {skill.source && (
              <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400">
                <ExternalLink className="h-3 w-3" />来源: {skill.source.source}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/skills/compare?a=${encodeURIComponent(skill.id)}`}>对比</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/eval?skill=${encodeURIComponent(skill.id)}`}>评测</Link>
            </Button>
            <Button asChild>
              <Link href={`/lab?skill=${encodeURIComponent(skill.id)}`}>
                <Beaker className="h-4 w-4" />运行
              </Link>
            </Button>
          </div>
        </div>
        <div className="mt-3 flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
 tab === t.id
 ? "bg-zinc-900 text-white"
 : "text-zinc-500 hover:bg-zinc-100"
 }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {skill.warnings.length > 0 && tab === "preview" && (
          <div className="mt-2 space-y-1">
            {skill.warnings.map((w) => (
              <div key={w} className="flex items-center gap-2 text-xs text-amber-600">
                <AlertTriangle className="h-3 w-3" />{w}
              </div>
            ))}
          </div>
        )}
      </header>

      {tab === "preview" && (
        <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr]">
          <div className="border-r border-zinc-200">
            <div className="border-b px-3 py-2 text-xs font-medium text-zinc-500">文件</div>
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="p-2">
                <FileTree files={skill.files} selectedPath={selectedPath} onSelect={(p) => loadFile(p).catch(() => setError("无法读取"))} />
              </div>
            </ScrollArea>
          </div>
          <ScrollArea className="h-[calc(100vh-160px)]">
            <CodePreview content={fileContent} filename={selectedPath} />
          </ScrollArea>
        </div>
      )}

      {tab === "edit" && (
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-sm">{selectedPath}</span>
            <Button onClick={saveFile} disabled={saving}>
              <Save className="h-4 w-4" />{saving ? "保存中..." : "保存"}
            </Button>
          </div>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[calc(100vh-280px)] flex-1 font-mono text-sm"
          />
        </div>
      )}

      {tab === "lint" && lint && (
        <div className="p-6"><LintPanel result={lint} /></div>
      )}

      {tab === "deps" && graph && (
        <div className="p-6"><DependencyGraphView graph={graph} /></div>
      )}

      {tab === "version" && version && (
        <div className="space-y-4 p-6 text-sm">
          <div>
            <span className="text-zinc-500">当前 Hash：</span>
            <code className="text-xs">{version.currentHash.slice(0, 16)}...</code>
          </div>
          {version.lockEntry && (
            <div>
              <span className="text-zinc-500">锁定 Hash：</span>
              <code className="text-xs">{version.lockEntry.computedHash.slice(0, 16)}...</code>
            </div>
          )}
          <Badge variant={version.changed ? "warning" : "success"}>
            {version.changed ? "有未同步变更" : "已同步"}
          </Badge>
          {version.source && <p className="text-zinc-500">来源: {version.source}</p>}
          <Button variant="outline" onClick={syncVersion}>同步 Hash 到 lockfile</Button>
        </div>
      )}
    </div>
  );
}
