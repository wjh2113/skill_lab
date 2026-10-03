import { NextResponse } from "next/server";
import { createSkill } from "@/lib/skills/creator";
import { ensureSkillDirs, listSkills } from "@/lib/skills/scanner";
import type { CreateSkillInput } from "@/lib/skills/types";

export async function GET() {
  await ensureSkillDirs();
  const skills = await listSkills();
  return NextResponse.json({ skills });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateSkillInput;
    const skill = await createSkill(body);
    return NextResponse.json({ skill }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create skill";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
