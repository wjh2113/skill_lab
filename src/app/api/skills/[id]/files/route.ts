import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getSkillById, readSkillFile } from "@/lib/skills/scanner";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get("path");

  if (!filePath) {
    return NextResponse.json({ error: "path query parameter required" }, { status: 400 });
  }

  const skill = await getSkillById(decodeURIComponent(id));
  if (!skill) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  try {
    const content = await readSkillFile(skill.path, filePath);
    return NextResponse.json({ path: filePath, content });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read file";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const skill = await getSkillById(decodeURIComponent(id));
  if (!skill) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  const body = (await request.json()) as { path: string; content: string };
  if (!body.path || body.content === undefined) {
    return NextResponse.json({ error: "path and content required" }, { status: 400 });
  }

  const resolved = path.resolve(skill.path, body.path);
  if (!resolved.startsWith(path.resolve(skill.path))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  await fs.writeFile(resolved, body.content, "utf-8");
  return NextResponse.json({ ok: true, path: body.path });
}
