import fs from "fs/promises";
import path from "path";
import { getDataDir } from "@/lib/config";
import type { RunProvider } from "@/lib/agent/types";

export type Experiment = {
  id: string;
  skillId: string;
  skillName: string;
  prompt: string;
  provider: RunProvider;
  variantA: { label: string; systemPrefix: string };
  variantB: { label: string; systemPrefix: string };
  runIdA?: string;
  runIdB?: string;
  createdAt: string;
};

function experimentsDir(): string {
  return path.join(getDataDir(), "experiments");
}

export async function listExperiments(): Promise<Experiment[]> {
  try {
    const files = await fs.readdir(experimentsDir());
    const exps: Experiment[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const raw = await fs.readFile(path.join(experimentsDir(), f), "utf-8");
      exps.push(JSON.parse(raw) as Experiment);
    }
    return exps.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function saveExperiment(exp: Experiment): Promise<void> {
  await fs.mkdir(experimentsDir(), { recursive: true });
  await fs.writeFile(
    path.join(experimentsDir(), `${exp.id}.json`),
    JSON.stringify(exp, null, 2),
    "utf-8"
  );
}

export function generateExperimentId(): string {
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
