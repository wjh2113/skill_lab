import { NextResponse } from "next/server";
import { compareSkills } from "@/lib/skills/diff";
import { getSkillById } from "@/lib/skills/scanner";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const a = searchParams.get("a");
  const b = searchParams.get("b");
  const file = searchParams.get("file") ?? "SKILL.md";

  if (!a || !b) {
    return NextResponse.json({ error: "a and b query params required" }, { status: 400 });
  }

  const [skillA, skillB] = await Promise.all([
    getSkillById(decodeURIComponent(a)),
    getSkillById(decodeURIComponent(b)),
  ]);

  if (!skillA || !skillB) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  const comparison = await compareSkills(skillA, skillB, file);
  return NextResponse.json({ comparison });
}
