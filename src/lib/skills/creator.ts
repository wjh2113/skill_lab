import fs from "fs/promises";
import path from "path";
import {
  getPersonalSkillsDir,
  getProjectSkillsDir,
  encodeSkillId,
} from "@/lib/config";
import { validateSkillName } from "@/lib/skills/parser";
import type { CreateSkillInput, SkillSummary } from "@/lib/skills/types";
import { getSkillById } from "@/lib/skills/scanner";

function buildSkillMarkdown(input: CreateSkillInput): string {
  return `---
name: ${input.name}
description: ${input.description}
disable-model-invocation: true
---

# ${input.name.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}

## Quick Start

在此描述 skill 的核心工作流程。

## Instructions

1. 步骤一
2. 步骤二
3. 步骤三

## Examples

**示例输入：**
\`\`\`
用户的典型请求
\`\`\`

**示例输出：**
\`\`\`
期望的输出格式
\`\`\`
`;
}

function buildReferenceMarkdown(name: string): string {
  return `# ${name} Reference

详细参考文档。仅在需要时由 agent 读取。
`;
}

function getTargetDir(scope: CreateSkillInput["scope"], name: string): string {
  const base = scope === "personal" ? getPersonalSkillsDir() : getProjectSkillsDir();
  return path.join(base, name);
}

export async function createSkill(input: CreateSkillInput): Promise<SkillSummary> {
  const nameError = validateSkillName(input.name);
  if (nameError) throw new Error(nameError);
  if (!input.description.trim()) throw new Error("description 不能为空");

  const targetDir = getTargetDir(input.scope, input.name);

  try {
    await fs.access(targetDir);
    throw new Error(`Skill "${input.name}" 已存在于 ${input.scope} 目录`);
  } catch (err) {
    if (err instanceof Error && err.message.includes("已存在")) throw err;
  }

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, "SKILL.md"), buildSkillMarkdown(input), "utf-8");

  if (input.includeReference) {
    await fs.writeFile(
      path.join(targetDir, "reference.md"),
      buildReferenceMarkdown(input.name),
      "utf-8"
    );
  }

  const skill = await getSkillById(encodeSkillId(input.scope, input.name));
  if (!skill) throw new Error("创建 skill 后无法读取");
  return skill;
}
