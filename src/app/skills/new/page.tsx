"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NewSkillPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"project" | "personal">("project");
  const [includeReference, setIncludeReference] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, scope, includeReference }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "创建失败");
      router.push(`/skills/${encodeURIComponent(data.skill.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl flex-1 p-6">
      <Card>
        <CardHeader>
          <CardTitle>创建 Skill</CardTitle>
          <CardDescription>
            基于 Cursor create-skill 规范生成 SKILL.md 骨架
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">名称</Label>
              <Input
                id="name"
                placeholder="my-skill-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                pattern="[a-z0-9-]+"
              />
              <p className="text-xs text-zinc-500">小写字母、数字、连字符，最多 64 字符</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="描述 skill 做什么、何时使用（第三人称）"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>安装位置</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="scope"
                    value="project"
                    checked={scope === "project"}
                    onChange={() => setScope("project")}
                  />
                  项目 (.cursor/skills/)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="scope"
                    value="personal"
                    checked={scope === "personal"}
                    onChange={() => setScope("personal")}
                  />
                  个人 (~/.cursor/skills/)
                </label>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeReference}
                onChange={(e) => setIncludeReference(e.target.checked)}
              />
              同时创建 reference.md
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "创建中..." : "创建 Skill"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
