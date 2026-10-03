import Link from "next/link";
import { AlertCircle, Plus, Download } from "lucide-react";
import { SkillCard } from "@/components/skills/skill-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { lintSkill, lintScoreVariant } from "@/lib/skills/linter";
import { ensureSkillDirs, listSkills, readSkillFile } from "@/lib/skills/scanner";

export default async function HomePage() {
  await ensureSkillDirs();
  const skills = await listSkills();
  const lintResults = await Promise.all(
    skills.map(async (skill) => {
      const content = await readSkillFile(skill.path, "SKILL.md").catch(() => "");
      return lintSkill(skill, content);
    })
  );
  const lintMap = Object.fromEntries(lintResults.map((r) => [r.skillId, r]));

  const hasApiKey =
    Boolean(process.env.CURSOR_API_KEY?.trim()) ||
    Boolean(
      process.env.DEEPSEEK_API_KEY?.trim() ||
        process.env.LLM_API_KEY?.trim() ||
        process.env.AI_API_KEY?.trim()
    );

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Skill 目录</h1>
            <p className="mt-1 text-sm text-zinc-500">
              扫描 ~/.cursor/skills 与 .cursor/skills 下的所有 skill
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/skills/import"><Download className="h-4 w-4" />导入</Link>
            </Button>
            <Button asChild>
              <Link href="/skills/new"><Plus className="h-4 w-4" />创建</Link>
            </Button>
          </div>
        </div>
        {!hasApiKey && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            未配置 API Key。请设置 CURSOR_API_KEY 或 DEEPSEEK_API_KEY 后再使用运行实验室。
          </div>
        )}
      </header>

      <div className="flex-1 p-6">
        {skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 py-16 text-center">
            <p className="text-lg font-medium">还没有 skill</p>
            <p className="mt-2 max-w-md text-sm text-zinc-500">
              从 GitHub 导入、skills.sh 发现、或创建新的 skill 开始研究。
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" asChild><Link href="/skills/discover">Skill 发现</Link></Button>
              <Button variant="outline" asChild><Link href="/skills/import">GitHub 导入</Link></Button>
              <Button asChild><Link href="/skills/new">创建 Skill</Link></Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {skills.map((skill) => (
              <div key={skill.id} className="relative">
                <SkillCard skill={skill} />
                {lintMap[skill.id] && (
                  <Badge
                    variant={lintScoreVariant(lintMap[skill.id].score)}
                    className="absolute right-3 top-3"
                  >
                    {lintMap[skill.id].score}分
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
