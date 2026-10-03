import { NextResponse } from "next/server";
import { lintSkill } from "@/lib/skills/linter";
import { getSkillById, readSkillFile } from "@/lib/skills/scanner";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const skill = await getSkillById(decodeURIComponent(id));
  if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const content = await readSkillFile(skill.path, "SKILL.md").catch(() => "");
  return NextResponse.json({ result: lintSkill(skill, content) });
}
