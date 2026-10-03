"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ImportSkillPage() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [skillPath, setSkillPath] = useState("");
  const [targetScope, setTargetScope] = useState<"project" | "personal">("project");
  const [overwrite, setOverwrite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/skills/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl,
          skillPath: skillPath.trim() || undefined,
          targetScope,
          overwrite,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "导入失败");
      router.push(`/skills/${encodeURIComponent(data.result.skillId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl flex-1 p-6">
      <Card>
        <CardHeader>
          <CardTitle>从 GitHub 导入 Skill</CardTitle>
          <CardDescription>
            浅克隆公开仓库，定位 SKILL.md 并安装到本地 skill 目录
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="repoUrl">GitHub 仓库 URL</Label>
              <Input
                id="repoUrl"
                placeholder="https://github.com/owner/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="skillPath">Skill 子路径（可选）</Label>
              <Input
                id="skillPath"
                placeholder="path/to/skill-folder"
                value={skillPath}
                onChange={(e) => setSkillPath(e.target.value)}
              />
              <p className="text-xs text-zinc-500">
                留空则自动搜索仓库中第一个含 SKILL.md 的目录
              </p>
            </div>

            <div className="space-y-2">
              <Label>安装位置</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="scope"
                    value="project"
                    checked={targetScope === "project"}
                    onChange={() => setTargetScope("project")}
                  />
                  项目
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="scope"
                    value="personal"
                    checked={targetScope === "personal"}
                    onChange={() => setTargetScope("personal")}
                  />
                  个人
                </label>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
              />
              覆盖已存在的同名 skill
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "导入中..." : "导入 Skill"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
