import { NextResponse } from "next/server";
import {
  generateExperimentId,
  listExperiments,
  saveExperiment,
  type Experiment,
} from "@/lib/experiments/store";
import { createRunRecord, startRunExecution } from "@/lib/agent/runner";
import type { RunProvider } from "@/lib/agent/types";
import { getSkillById } from "@/lib/skills/scanner";

export async function GET() {
  const experiments = await listExperiments();
  return NextResponse.json({ experiments });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    skillId: string;
    prompt: string;
    provider?: RunProvider;
    variantA: { label: string; systemPrefix: string };
    variantB: { label: string; systemPrefix: string };
  };

  const skill = await getSkillById(body.skillId);
  if (!skill) return NextResponse.json({ error: "Skill not found" }, { status: 404 });

  const exp: Experiment = {
    id: generateExperimentId(),
    skillId: skill.id,
    skillName: skill.name,
    prompt: body.prompt,
    provider: body.provider ?? "deepseek",
    variantA: body.variantA,
    variantB: body.variantB,
    createdAt: new Date().toISOString(),
  };

  const promptA = `[${body.variantA.label}]\n${body.variantA.systemPrefix}\n\n${body.prompt}`;
  const promptB = `[${body.variantB.label}]\n${body.variantB.systemPrefix}\n\n${body.prompt}`;

  const runA = await createRunRecord({
    skillId: skill.id,
    prompt: promptA,
    provider: body.provider,
  });
  const runB = await createRunRecord({
    skillId: skill.id,
    prompt: promptB,
    provider: body.provider,
  });

  exp.runIdA = runA.id;
  exp.runIdB = runB.id;
  await saveExperiment(exp);

  startRunExecution(runA);
  startRunExecution(runB);

  return NextResponse.json({ experiment: exp }, { status: 201 });
}
