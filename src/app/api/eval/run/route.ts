import { NextResponse } from "next/server";
import { createRunRecord, startRunExecution } from "@/lib/agent/runner";
import { loadEvalSuite } from "@/lib/eval/suites";
import { getSkillById } from "@/lib/skills/scanner";
import type { RunProvider } from "@/lib/agent/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    skillId: string;
    provider?: RunProvider;
    caseIds?: string[];
  };

  const skill = await getSkillById(body.skillId);
  if (!skill) return NextResponse.json({ error: "Skill not found" }, { status: 404 });

  const suite = await loadEvalSuite(skill.id, skill.name);
  const cases = body.caseIds
    ? suite.cases.filter((c) => body.caseIds!.includes(c.id))
    : suite.cases;

  const runs = [];
  for (const c of cases) {
    const record = await createRunRecord({
      skillId: skill.id,
      prompt: c.prompt,
      provider: body.provider,
    });
    startRunExecution(record);
    runs.push({ caseId: c.id, caseName: c.name, runId: record.id });
  }

  return NextResponse.json({ runs, total: runs.length });
}
