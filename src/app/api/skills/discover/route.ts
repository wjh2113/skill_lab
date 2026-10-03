import { NextResponse } from "next/server";
import { installSkillsSh, searchSkillsSh } from "@/lib/skills/skills-sh";

export const maxDuration = 300;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  if (!q.trim()) {
    return NextResponse.json({ error: "q query param required" }, { status: 400 });
  }
  const result = await searchSkillsSh(q);
  return NextResponse.json({ result });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { packageRef: string };
  if (!body.packageRef) {
    return NextResponse.json({ error: "packageRef required" }, { status: 400 });
  }
  const result = await installSkillsSh(body.packageRef);
  return NextResponse.json(result);
}
