import { getStepExplanation } from "@/lib/agent/pipeline-explanations";
import type { PipelineStep } from "@/lib/agent/pipeline-types";
import type { RunRecord } from "@/lib/agent/types";

export type RunExplanationSection = {
  title: string;
  content: string;
};

export type RunExplanation = {
  summary: string;
  sections: RunExplanationSection[];
  generatedAt: string;
  source: "rule";
};

function getStepDetails(step: PipelineStep): string {
  const d = step.details;
  if (!d) return "";

  switch (step.id) {
    case "scan_dirs": {
      const dirs = d.directories as Array<{ label: string; count: number; found: string[] }> | undefined;
      if (!dirs?.length) return "";
      return dirs
        .map((dir) => `${dir.label}：${dir.count} 个（${dir.found.join("、") || "无"}）`)
        .join("；");
    }
    case "match_skills": {
      const results = d.results as Array<{ name: string; score: number; matchedTerms: string[] }> | undefined;
      if (!results?.length) return "";
      const top = results.slice(0, 3);
      return top
        .map((r) => `${r.name} ${r.score} 分${r.matchedTerms.length ? `（命中：${r.matchedTerms.join("、")}）` : ""}`)
        .join("；");
    }
    case "select_skill": {
      const selected = d.selected as { name: string; score: number } | undefined;
      const reason = d.reason as string | undefined;
      if (!selected) return reason ?? "";
      return `选中 ${selected.name}（${selected.score} 分）${reason ? `，${reason}` : ""}`;
    }
    case "load_skill_content": {
      const loaded = d.loadedFiles as Array<{ file: string; chars: number }> | undefined;
      if (!loaded?.length) return "";
      return `已加载 ${loaded.map((f) => f.file).join("、")}`;
    }
    case "execute": {
      if (d.mode) return String(d.mode);
      if (d.message) return String(d.message);
      return "";
    }
    default:
      return "";
  }
}

/** 基于流水线数据生成可读的规则解释（无需 LLM） */
export function buildRuleBasedExplanation(record: RunRecord): RunExplanation {
  const sections: RunExplanationSection[] = [];
  const pipeline = record.pipeline ?? [];

  sections.push({
    title: "运行概览",
    content: [
      `任务：「${record.prompt}」`,
      `Provider：${record.provider}${record.model ? ` · ${record.model}` : ""}`,
      record.autoMatch
        ? "模式：Auto 自动匹配 skill"
        : `模式：手动指定 skill「${record.skillName}」`,
      `状态：${record.status}`,
      record.skillName && record.skillName !== "(自动匹配中)"
        ? `最终 skill：${record.skillName}`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (pipeline.length > 0) {
    const stepLines = pipeline
      .filter((s) => s.status === "done" || s.status === "error")
      .map((step) => {
        const expl = getStepExplanation(step.id);
        const detail = getStepDetails(step);
        const statusLabel =
          step.status === "done" ? "✓" : step.status === "error" ? "✗" : "·";
        return `${statusLabel} ${step.title}：${expl.summary}${detail ? `\n   → ${detail}` : ""}`;
      });

    if (stepLines.length > 0) {
      sections.push({
        title: "初始化流水线解读",
        content: stepLines.join("\n\n"),
      });
    }
  }

  const matchStep = pipeline.find((s) => s.id === "match_skills" && s.details);
  if (matchStep?.details && record.autoMatch) {
    const results = matchStep.details.results as Array<{ name: string; score: number }> | undefined;
    const best = results?.[0];
    if (best && best.score > 0) {
      sections.push({
        title: "为何匹配到这个 Skill",
        content: [
          `prompt「${record.prompt}」与 skill「${best.name}」的 description 相关性最高（${best.score} 分）。`,
          "Cursor 真实环境中由 LLM 根据 description 语义做类似判断；实验室使用可解释的关键词评分便于调试 description。",
          best.score < 40
            ? "提示：得分偏低，建议优化 skill 的 description，加入用户可能使用的关键词。"
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      });
    }
  }

  if (record.provider === "deepseek") {
    sections.push({
      title: "DeepSeek Agent 模式说明",
      content:
        "本模式使用 DeepSeek 作为底层 LLM，在加载 SKILL.md 后进入 Agent 循环：模型可调用 read_file、write_file、run_terminal、glob_file_search 等工具，根据结果多轮决策直到任务完成。建议使用 deepseek-chat 模型。",
    });
  }

  if (record.status === "error" && record.error) {
    sections.push({
      title: "错误原因",
      content: record.error,
    });
  } else if (record.status === "finished" && record.result) {
    const preview =
      record.result.length > 400 ? record.result.slice(0, 400) + "…" : record.result;
    sections.push({
      title: "执行结果摘要",
      content: preview,
    });
  }

  const summaryParts = [
    record.autoMatch ? `Auto 匹配到 skill「${record.skillName}」` : `使用 skill「${record.skillName}」`,
    record.status === "finished" ? "任务已完成" : record.status === "error" ? "运行失败" : "运行中",
    pipeline.length > 0 ? `经历 ${pipeline.filter((s) => s.status === "done").length} 步初始化` : null,
  ].filter(Boolean);

  return {
    summary: summaryParts.join("，") + "。",
    sections,
    generatedAt: new Date().toISOString(),
    source: "rule",
  };
}

export function buildAiExplainPrompt(record: RunRecord): { system: string; user: string } {
  const rule = buildRuleBasedExplanation(record);
  const pipelineJson = JSON.stringify(
    record.pipeline?.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      details: s.details,
    })),
    null,
    2
  );

  return {
    system: [
      "你是 Cursor Agent Skill 研究助手，擅长用清晰的中文向开发者解释 agent 运行过程。",
      "请基于提供的运行数据，写一份「解释说明」：",
      "- 用 2-3 句话概括本次运行发生了什么",
      "- 分点说明 skill 如何被选中、上下文如何加载、最终如何执行",
      "- 若 Auto 匹配，解释为何选中该 skill",
      "- 指出 DeepSeek 与 Cursor 模式的差异（如适用）",
      "- 语言简洁，面向正在学习 Agent Skill 的开发者",
      "不要使用 markdown 标题符号（#），可用加粗或分点列表。",
    ].join("\n"),
    user: [
      "## 运行记录",
      `Prompt: ${record.prompt}`,
      `Skill: ${record.skillName} (${record.skillId})`,
      `Provider: ${record.provider}`,
      `AutoMatch: ${record.autoMatch ?? false}`,
      `Status: ${record.status}`,
      record.error ? `Error: ${record.error}` : "",
      record.result ? `Result preview: ${record.result.slice(0, 800)}` : "",
      "",
      "## 规则解释（参考）",
      rule.summary,
      "",
      "## 流水线数据",
      pipelineJson,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
