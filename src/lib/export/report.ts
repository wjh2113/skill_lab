import type { RunRecord } from "@/lib/agent/types";

export function exportRunAsMarkdown(run: RunRecord): string {
  const lines: string[] = [
    `# Skill Lab 运行报告`,
    "",
    `- **Run ID**: \`${run.id}\``,
    `- **Skill**: ${run.skillName}`,
    `- **Provider**: ${run.provider}${run.model ? ` (${run.model})` : ""}`,
    `- **Status**: ${run.status}`,
    `- **Started**: ${run.startedAt}`,
    run.finishedAt ? `- **Finished**: ${run.finishedAt}` : "",
    "",
    "## Prompt",
    "",
    "```",
    run.prompt,
    "```",
    "",
  ];

  if (run.pipeline?.length) {
    lines.push("## Agent 初始化流程", "");
    for (const step of run.pipeline) {
      lines.push(`### ${step.title} (${step.status})`, "", step.description, "");
      if (step.details) {
        lines.push("```json", JSON.stringify(step.details, null, 2), "```", "");
      }
    }
  }

  lines.push("## 执行时间线", "");
  for (const event of run.events) {
    lines.push(`- **${event.type}** (${event.timestamp})`);
    if (event.data.text) lines.push(`  > ${String(event.data.text).slice(0, 200)}`);
    if (event.data.message) lines.push(`  > ${event.data.message}`);
    if (event.data.name) lines.push(`  - tool: ${event.data.name}`);
  }

  if (run.result) {
    lines.push("", "## 最终结果", "", run.result);
  }
  if (run.error) {
    lines.push("", "## 错误", "", run.error);
  }

  return lines.filter(Boolean).join("\n");
}
