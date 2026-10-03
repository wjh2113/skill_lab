import { validateSkillName } from "@/lib/skills/parser";
import type { SkillSummary } from "@/lib/skills/types";

export type LintSeverity = "error" | "warning" | "info";

export type LintIssue = {
  rule: string;
  severity: LintSeverity;
  message: string;
  suggestion?: string;
};

export type SkillLintResult = {
  skillId: string;
  name: string;
  score: number;
  issues: LintIssue[];
};

export function lintSkill(skill: SkillSummary, skillMdContent?: string): SkillLintResult {
  const issues: LintIssue[] = [];

  const nameError = validateSkillName(skill.name);
  if (nameError) {
    issues.push({ rule: "name-format", severity: "error", message: nameError });
  }

  if (!skill.description.trim()) {
    issues.push({
      rule: "description-required",
      severity: "error",
      message: "缺少 description 字段",
      suggestion: "添加第三人称 description，包含 WHAT 和 WHEN 触发词",
    });
  } else if (skill.description.length < 50) {
    issues.push({
      rule: "description-length",
      severity: "warning",
      message: `description 仅 ${skill.description.length} 字符，可能不够具体`,
      suggestion: "补充触发场景关键词，如文件类型、用户常用说法",
    });
  }

  if (skill.description.match(/\b(I |You |you can|I can)\b/i)) {
    issues.push({
      rule: "description-person",
      severity: "warning",
      message: "description 使用了第一/第二人称",
      suggestion: "改为第三人称，如「Processes PDF files... Use when...」",
    });
  }

  if (skill.lineCount > 500) {
    issues.push({
      rule: "line-count",
      severity: "warning",
      message: `SKILL.md 共 ${skill.lineCount} 行，超过 500 行建议`,
      suggestion: "将详细内容移到 reference.md，SKILL.md 只保留核心流程",
    });
  }

  if (skill.warnings.some((w) => w.includes("不一致"))) {
    issues.push({
      rule: "name-folder-match",
      severity: "warning",
      message: "frontmatter name 与目录名不一致",
      suggestion: "将目录重命名或与 frontmatter name 对齐",
    });
  }

  const triggerWords = ["use when", "when the user", "when working", "当用户", "使用当"];
  if (skill.description && !triggerWords.some((t) => skill.description.toLowerCase().includes(t))) {
    issues.push({
      rule: "trigger-terms",
      severity: "info",
      message: "description 缺少明确的 WHEN 触发语",
      suggestion: '添加 "Use when..." 或「当用户...时使用」',
    });
  }

  if (skillMdContent) {
    if (!skillMdContent.includes("##")) {
      issues.push({
        rule: "structure",
        severity: "info",
        message: "SKILL.md 缺少二级标题结构",
        suggestion: "添加 ## Quick Start、## Instructions 等章节",
      });
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warnCount = issues.filter((i) => i.severity === "warning").length;
  const score = Math.max(0, 100 - errorCount * 25 - warnCount * 8);

  return { skillId: skill.id, name: skill.name, score, issues };
}

export function lintScoreVariant(score: number): "success" | "warning" | "error" {
  if (score >= 80) return "success";
  if (score >= 50) return "warning";
  return "error";
}
