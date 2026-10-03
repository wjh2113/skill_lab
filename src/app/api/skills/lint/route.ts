import { NextResponse } from "next/server";
import { lintSkill } from "@/lib/skills/linter";
import { listSkills, readSkillFile } from "@/lib/skills/scanner";

export async function GET() {
  const skills = await listSkills();
  const results = await Promise.all(
    skills.map(async (skill) => {
      let content = "";
      try {
        content = await readSkillFile(skill.path, "SKILL.md");
      } catch {
        // ignore
      }
      return lintSkill(skill, content);
    })
  );
  return NextResponse.json({ results });
}
