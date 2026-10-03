import { NextResponse } from "next/server";
import { importSkillFromGitHub } from "@/lib/github/importer";
import { ensureSkillDirs } from "@/lib/skills/scanner";
import type { ImportSkillInput } from "@/lib/skills/types";

export async function POST(request: Request) {
  try {
    await ensureSkillDirs();
    const body = (await request.json()) as ImportSkillInput;
    const result = await importSkillFromGitHub(body);
    return NextResponse.json({ result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
