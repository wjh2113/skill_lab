import {
  getAgentsSkillsDir,
  getPersonalSkillsDir,
  getProjectSkillsDir,
} from "@/lib/config";
import {
  createInitialPipeline,
  type PipelineStep,
  type PipelineStepId,
} from "@/lib/agent/pipeline-types";
import {
  initPipeline,
  updatePipelineStep,
  updateRun,
} from "@/lib/agent/store";
import type { RunRecord } from "@/lib/agent/types";
import { pickBestMatch, scoreSkillsAgainstPrompt } from "@/lib/skills/matcher";
import { parseSkillMarkdown } from "@/lib/skills/parser";
import {
  getSkillById,
  listSkills,
  readSkillFile,
} from "@/lib/skills/scanner";
import type { SkillSummary } from "@/lib/skills/types";

export type InitializationResult = {
  selectedSkill: SkillSummary;
  loadedFiles: string[];
  matchResults: ReturnType<typeof scoreSkillsAgainstPrompt>;
  skillContextLength: number;
};

async function stepDelay(ms = 120): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function runAgentInitialization(
  record: RunRecord
): Promise<InitializationResult> {
  const pipeline = createInitialPipeline();
  await initPipeline(record.id, pipeline);

  const now = () => new Date().toISOString();

  async function runStep<T>(
    stepId: PipelineStepId,
    fn: () => Promise<{ details?: Record<string, unknown>; result: T }>
  ): Promise<T> {
    await updatePipelineStep(record.id, stepId, {
      status: "running",
      startedAt: now(),
    });
    await stepDelay();
    try {
      const { details, result } = await fn();
      await updatePipelineStep(record.id, stepId, {
        status: "done",
        finishedAt: now(),
        details,
      });
      return result;
    } catch (err) {
      await updatePipelineStep(record.id, stepId, {
        status: "error",
        finishedAt: now(),
        details: {
          error: err instanceof Error ? err.message : "Unknown error",
        },
      });
      throw err;
    }
  }

  await runStep("init", async () => ({
    details: {
      provider: record.provider,
      model: record.model,
      workspace: process.env.SKILL_LAB_WORKSPACE ?? process.cwd(),
      runId: record.id,
    },
    result: true,
  }));

  const scanResult = await runStep("scan_dirs", async () => {
    const projectDir = getProjectSkillsDir();
    const agentsDir = getAgentsSkillsDir();
    const personalDir = getPersonalSkillsDir();
    const skills = await listSkills();

    const projectNames = skills
      .filter((s) => s.scope === "project" && s.path.startsWith(projectDir))
      .map((s) => s.name);
    const agentsNames = skills
      .filter((s) => s.scope === "project" && s.path.startsWith(agentsDir))
      .map((s) => s.name);
    const personalNames = skills.filter((s) => s.scope === "personal").map((s) => s.name);

    return {
      details: {
        directories: [
          {
            path: projectDir,
            scope: "project",
            label: ".cursor/skills/",
            found: projectNames,
            count: projectNames.length,
          },
          {
            path: agentsDir,
            scope: "project",
            label: ".agents/skills/",
            found: agentsNames,
            count: agentsNames.length,
          },
          {
            path: personalDir,
            scope: "personal",
            label: "~/.cursor/skills/",
            found: personalNames,
            count: personalNames.length,
          },
        ],
        totalSkills: skills.length,
      },
      result: skills,
    };
  });

  await runStep("parse_frontmatter", async () => {
    const parsed = await Promise.all(
      scanResult.map(async (skill) => {
        const raw = await readSkillFile(skill.path, "SKILL.md");
        const { frontmatter } = parseSkillMarkdown(raw);
        return {
          skillId: skill.id,
          folder: skill.name,
          path: skill.path,
          frontmatter: {
            name: frontmatter.name ?? skill.name,
            description: frontmatter.description ?? "",
            disableModelInvocation: frontmatter.disableModelInvocation ?? false,
          },
          lineCount: skill.lineCount,
          fileCount: countFiles(skill.files),
        };
      })
    );

    return {
      details: { skills: parsed },
      result: parsed,
    };
  });

  await runStep("receive_prompt", async () => ({
    details: {
      prompt: record.prompt,
      length: record.prompt.length,
      hasUrl: /https?:\/\//.test(record.prompt),
      preselectedSkillId: record.skillId,
      preselectedSkillName: record.skillName,
    },
    result: record.prompt,
  }));

  const matchResults = await runStep("match_skills", async () => {
    const forcedId = record.autoMatch ? undefined : record.skillId;
    const results = scoreSkillsAgainstPrompt(record.prompt, scanResult, forcedId);

    return {
      details: {
        algorithm:
          "prompt 分词 + description 关键词重叠 + skill 触发词表 + 实验室指定加权",
        promptPreview: record.prompt.slice(0, 120),
        results: results.map((r) => ({
          name: r.name,
          scope: r.scope,
          score: r.score,
          matchedTerms: r.matchedTerms,
          descriptionPreview: r.description.slice(0, 100) + (r.description.length > 100 ? "..." : ""),
        })),
      },
      result: results,
    };
  });

  const selectedMatch = await runStep("select_skill", async () => {
    const forcedId = record.autoMatch ? undefined : record.skillId;
    const picked = pickBestMatch(matchResults, forcedId);
    if (!picked) {
      throw new Error("没有匹配的 skill");
    }

    const skill = await getSkillById(picked.skillId);
    if (!skill) throw new Error(`Skill 不存在: ${picked.skillId}`);

    const reason = record.autoMatch
      ? `自动匹配：description 得分最高 (${picked.score})`
      : picked.skillId === record.skillId
        ? "实验室已指定 skill（匹配验证通过）"
        : `description 匹配得分最高 (${picked.score})`;

    await updateRun(record.id, {
      skillId: skill.id,
      skillName: skill.name,
    });

    return {
      details: {
        selected: {
          skillId: picked.skillId,
          name: picked.name,
          score: picked.score,
          matchedTerms: picked.matchedTerms,
        },
        reason,
        runnerNote:
          record.provider === "cursor"
            ? "Cursor Agent 通过 settingSources 自动发现 skill，并在 system prompt 中呈现 description 供模型选择"
            : record.autoMatch
              ? "DeepSeek Agent 模式：自动匹配 skill 后，由 Agent 多轮调用工具执行任务"
              : "DeepSeek Agent 模式由实验室预指定 skill，Agent 加载 SKILL.md 后多轮 tool call 执行",
      },
      result: skill,
    };
  });

  const loadResult = await runStep("load_skill_content", async () => {
    const filesToLoad = ["SKILL.md", "reference.md", "workflow.md", "preferences.md"];
    const loaded: { file: string; chars: number; preview?: string }[] = [];

    for (const file of filesToLoad) {
      try {
        const content = await readSkillFile(selectedMatch.path, file);
        loaded.push({
          file,
          chars: content.length,
          preview: file === "SKILL.md" ? content.slice(0, 200) + "..." : undefined,
        });
      } catch {
        // optional file
      }
    }

    const skillMd = await readSkillFile(selectedMatch.path, "SKILL.md");
    const { frontmatter, body } = parseSkillMarkdown(skillMd);

    return {
      details: {
        skillPath: selectedMatch.path,
        loadedFiles: loaded,
        frontmatter,
        bodyLineCount: body.split("\n").length,
        injectionNote:
          record.provider === "cursor"
            ? "Skill 内容通过 Cursor 内置 skill 发现机制注入 agent 上下文"
            : "SKILL.md 及 reference 文件内容注入 LLM system prompt",
      },
      result: { loadedFiles: loaded.map((f) => f.file), contextLength: skillMd.length },
    };
  });

  await updatePipelineStep(record.id, "execute", {
    status: "running",
    startedAt: now(),
  });

  return {
    selectedSkill: selectedMatch,
    loadedFiles: loadResult.loadedFiles,
    matchResults,
    skillContextLength: loadResult.contextLength,
  };
}

export async function finishExecuteStep(
  runId: string,
  status: "done" | "error",
  details?: Record<string, unknown>
): Promise<void> {
  await updatePipelineStep(runId, "execute", {
    status,
    finishedAt: new Date().toISOString(),
    details,
  });
}

function countFiles(
  files: SkillSummary["files"],
  count = 0
): number {
  for (const f of files) {
    if (f.type === "file") count++;
    else if (f.children) count = countFiles(f.children, count);
  }
  return count;
}
