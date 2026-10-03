import fs from "fs/promises";
import path from "path";
import { getDataDir } from "@/lib/config";

export type EvalCase = {
  id: string;
  name: string;
  prompt: string;
  tags?: string[];
};

export type EvalSuite = {
  skillId: string;
  skillName: string;
  cases: EvalCase[];
  updatedAt: string;
};

function suitePath(skillName: string): string {
  return path.join(getDataDir(), "eval-suites", `${skillName}.json`);
}

export async function loadEvalSuite(skillId: string, skillName: string): Promise<EvalSuite> {
  try {
    const raw = await fs.readFile(suitePath(skillName), "utf-8");
    return JSON.parse(raw) as EvalSuite;
  } catch {
    return {
      skillId,
      skillName,
      cases: getDefaultCases(skillName),
      updatedAt: new Date().toISOString(),
    };
  }
}

export async function saveEvalSuite(suite: EvalSuite): Promise<void> {
  const p = suitePath(suite.skillName);
  await fs.mkdir(path.dirname(p), { recursive: true });
  suite.updatedAt = new Date().toISOString();
  await fs.writeFile(p, JSON.stringify(suite, null, 2), "utf-8");
}

function getDefaultCases(skillName: string): EvalCase[] {
  if (skillName === "english-blog-translate") {
    return [
      {
        id: "case-1",
        name: "博客 URL 翻译",
        prompt: "翻译：https://waitbutwhy.com/2025/11/bhutan.html",
        tags: ["url", "translate"],
      },
    ];
  }
  return [
    {
      id: "case-1",
      name: "基础测试",
      prompt: `请使用 ${skillName} skill 完成一个典型任务`,
      tags: ["smoke"],
    },
  ];
}
