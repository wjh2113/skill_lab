import { NextResponse } from "next/server";
import { getSkillVersionInfo, syncSkillHash } from "@/lib/skills/versions";
import { getSkillById } from "@/lib/skills/scanner";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const skill = await getSkillById(decodeURIComponent(id));
  if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const version = await getSkillVersionInfo(skill);
  return NextResponse.json({ version });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const skill = await getSkillById(decodeURIComponent(id));
  if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const hash = await syncSkillHash(skill);
  return NextResponse.json({ hash, synced: true });
}
