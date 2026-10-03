import { NextResponse } from "next/server";
import { loadEvalSuite, saveEvalSuite } from "@/lib/eval/suites";
import { getSkillById } from "@/lib/skills/scanner";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const skill = await getSkillById(decodeURIComponent(id));
  if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const suite = await loadEvalSuite(skill.id, skill.name);
  return NextResponse.json({ suite });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const skill = await getSkillById(decodeURIComponent(id));
  if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json();
  await saveEvalSuite({ ...body, skillId: skill.id, skillName: skill.name });
  return NextResponse.json({ ok: true });
}
