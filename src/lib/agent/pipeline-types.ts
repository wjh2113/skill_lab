export type PipelineStepStatus = "pending" | "running" | "done" | "error" | "skipped";

export type PipelineStepId =
  | "init"
  | "scan_dirs"
  | "parse_frontmatter"
  | "receive_prompt"
  | "match_skills"
  | "select_skill"
  | "load_skill_content"
  | "execute";

export type PipelineStep = {
  id: PipelineStepId;
  title: string;
  description: string;
  status: PipelineStepStatus;
  startedAt?: string;
  finishedAt?: string;
  details?: Record<string, unknown>;
};

export const PIPELINE_TEMPLATE: Omit<PipelineStep, "status">[] = [
  {
    id: "init",
    title: "Agent 初始化",
    description: "创建运行实例，加载 Provider 与工作目录配置",
  },
  {
    id: "scan_dirs",
    title: "扫描 Skill 目录",
    description: "发现 .cursor/skills/、.agents/skills/ 与 ~/.cursor/skills/ 下的 skill",
  },
  {
    id: "parse_frontmatter",
    title: "解析 YAML Frontmatter",
    description: "读取每个 SKILL.md 的 name、description 等元数据",
  },
  {
    id: "receive_prompt",
    title: "接收 Prompt",
    description: "获取用户输入的任务描述",
  },
  {
    id: "match_skills",
    title: "Skill 匹配",
    description: "将 prompt 与各 skill 的 description 进行关键词匹配评分",
  },
  {
    id: "select_skill",
    title: "选择 Skill",
    description: "根据匹配分数或实验室指定，确定要执行的 skill",
  },
  {
    id: "load_skill_content",
    title: "加载 Skill 内容",
    description: "读取 SKILL.md 及 reference 等附属文件，注入 agent 上下文",
  },
  {
    id: "execute",
    title: "执行 Skill",
    description: "按 skill 工作流调用工具或 LLM 完成任务",
  },
];

export function createInitialPipeline(): PipelineStep[] {
  return PIPELINE_TEMPLATE.map((step) => ({ ...step, status: "pending" }));
}
