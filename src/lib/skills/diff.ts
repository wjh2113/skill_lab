import { readSkillFile } from "@/lib/skills/scanner";
import type { SkillSummary } from "@/lib/skills/types";

export type DiffLine = {
  type: "same" | "add" | "remove";
  content: string;
  lineNo?: { a?: number; b?: number };
};

export type SkillCompareResult = {
  skillA: SkillSummary;
  skillB: SkillSummary;
  file: string;
  diff: DiffLine[];
  stats: { added: number; removed: number; same: number };
};

function lineDiff(a: string[], b: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  const maxLen = Math.max(a.length, b.length);
  let ai = 0;
  let bi = 0;

  while (ai < a.length || bi < b.length) {
    const lineA = a[ai];
    const lineB = b[bi];

    if (lineA === lineB && lineA !== undefined) {
      result.push({ type: "same", content: lineA, lineNo: { a: ai + 1, b: bi + 1 } });
      ai++;
      bi++;
    } else if (bi >= b.length || (ai < a.length && a.slice(ai).indexOf(lineB ?? "") === -1)) {
      result.push({ type: "remove", content: lineA ?? "", lineNo: { a: ai + 1 } });
      ai++;
    } else if (ai >= a.length) {
      result.push({ type: "add", content: lineB ?? "", lineNo: { b: bi + 1 } });
      bi++;
    } else {
      result.push({ type: "remove", content: lineA ?? "", lineNo: { a: ai + 1 } });
      ai++;
    }
  }
  return result;
}

export async function compareSkills(
  skillA: SkillSummary,
  skillB: SkillSummary,
  file = "SKILL.md"
): Promise<SkillCompareResult> {
  const [contentA, contentB] = await Promise.all([
    readSkillFile(skillA.path, file).catch(() => ""),
    readSkillFile(skillB.path, file).catch(() => ""),
  ]);

  const diff = lineDiff(contentA.split("\n"), contentB.split("\n"));
  return {
    skillA,
    skillB,
    file,
    diff,
    stats: {
      added: diff.filter((d) => d.type === "add").length,
      removed: diff.filter((d) => d.type === "remove").length,
      same: diff.filter((d) => d.type === "same").length,
    },
  };
}
