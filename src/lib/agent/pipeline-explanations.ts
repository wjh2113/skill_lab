import type { PipelineStepId } from "@/lib/agent/pipeline-types";

export type StepExplanation = {
  /** 这一步在做什么 */
  summary: string;
  /** Cursor Agent 真实行为 */
  cursorBehavior: string;
  /** Skill Lab 如何模拟/展示 */
  labBehavior: string;
  /** 关键概念或注意事项 */
  tips?: string[];
};

export const PIPELINE_STEP_EXPLANATIONS: Record<PipelineStepId, StepExplanation> = {
  init: {
    summary: "创建 Agent 运行实例，加载工作区、Provider 与运行时配置。",
    cursorBehavior:
      "Cursor 启动 Agent 时会绑定当前工作区（cwd），读取 `.cursor/rules`、MCP 配置，并根据 settingSources 决定从哪些目录发现 skill。",
    labBehavior:
      "Skill Lab 记录本次运行的 Provider（Cursor / DeepSeek）、模型名、runId，为后续流水线步骤做准备。",
    tips: [
      "Cursor 的 project scope 对应项目内 skill；user scope 对应 ~/.cursor/skills/",
      "DeepSeek 模式不会启动完整 Agent，仅模拟 skill 发现与注入流程",
    ],
  },
  scan_dirs: {
    summary: "扫描磁盘上的 skill 目录，列出所有包含 SKILL.md 的文件夹。",
    cursorBehavior:
      "Agent 启动前，Cursor 会扫描 `.cursor/skills/`、`~/.cursor/skills/`，以及通过 skills CLI 安装的 `.agents/skills/`。每个子目录若含 SKILL.md 即视为一个 skill。",
    labBehavior:
      "实验室调用 listSkills() 遍历上述目录，展示每个目录下发现的 skill 名称与路径。",
    tips: [
      "目录名与 frontmatter 的 name 字段建议保持一致",
      "skills.sh 安装的 skill 默认落在 .agents/skills/",
    ],
  },
  parse_frontmatter: {
    summary: "读取每个 SKILL.md 顶部的 YAML frontmatter，提取 name 与 description。",
    cursorBehavior:
      "Cursor 解析 SKILL.md 的 --- 包裹的 YAML 块，将 name、description 写入 skill 元数据。description 是 Agent 决定是否启用该 skill 的核心依据。",
    labBehavior:
      "实验室用 gray-matter 解析 frontmatter，展示 name、description、行数，并检查 disableModelInvocation 等字段。",
    tips: [
      "description 应写清楚「何时使用」，而非 skill 能做什么",
      "disableModelInvocation: true 时，skill 不会进入自动匹配候选",
      "建议 SKILL.md 正文控制在 500 行以内",
    ],
  },
  receive_prompt: {
    summary: "接收用户输入的任务描述（Prompt），作为 skill 匹配的输入。",
    cursorBehavior:
      "用户消息进入 Agent 后，Cursor 将 prompt 与所有已发现 skill 的 description 一起呈现给模型，由模型判断是否需要调用某个 skill。",
    labBehavior:
      "实验室展示原始 prompt 长度、是否含 URL，以及是否已预指定 skill（非 Auto 模式）。",
    tips: [
      "prompt 越具体，自动匹配越准确",
      "含 URL 的 prompt 会额外加权 blog/translate 类 skill",
    ],
  },
  match_skills: {
    summary: "将 prompt 与各 skill 的 description 进行相关性评分。",
    cursorBehavior:
      "Cursor 不公开具体算法，但本质是让 LLM 根据 description 语义判断哪个 skill 与当前任务最相关。description 质量直接决定匹配效果。",
    labBehavior:
      "实验室使用可解释的启发式算法：prompt 分词 + description 关键词重叠 + 触发词表 + 指定 skill 加权，输出每个 skill 的得分与命中词。",
    tips: [
      "得分条与 matchedTerms 可帮助调试 description 是否覆盖常见用户说法",
      "Auto 模式下得分最高且 >0 的 skill 会被选中",
    ],
  },
  select_skill: {
    summary: "根据匹配结果或用户指定，确定本次运行使用的 skill。",
    cursorBehavior:
      "Cursor Agent 在内部选定 skill 后，会加载其 SKILL.md 正文及相关文件到上下文，后续 tool call 与回复都遵循该 skill 指令。",
    labBehavior:
      "实验室将选中的 skillId、名称、得分写入 run 记录，并在流水线中展示选择理由。",
    tips: [
      "手动指定 skill 时，匹配步骤仍运行但会强制选中指定项",
      "若无任何 skill 得分 >0，Auto 模式会报错「没有匹配的 skill」",
    ],
  },
  load_skill_content: {
    summary: "读取 SKILL.md 及 reference 等附属文件，准备注入 Agent 上下文。",
    cursorBehavior:
      "Cursor 将 skill 文件内容注入 agent 的 system/context 层。模型在执行任务时会参考这些指令，但未必一次性加载所有文件。",
    labBehavior:
      "DeepSeek Agent 将 SKILL.md 及 reference 文件拼入 system prompt，随后进入 tool call 循环；Cursor 模式由 SDK settingSources 自动完成，实验室仅展示已加载文件列表。",
    tips: [
      "reference.md、workflow.md 等可选文件会在存在时被一并加载",
      "DeepSeek Agent 通过 read_file / run_terminal 等工具执行 skill 中的脚本与命令",
    ],
  },
  execute: {
    summary: "按 skill 工作流执行任务：调用工具、读写文件或生成回复。",
    cursorBehavior:
      "Cursor Agent 可真实执行 tool call（读文件、运行终端、MCP 等），并多轮迭代直到任务完成。",
    labBehavior:
      "Cursor 模式通过 @cursor/sdk 流式展示 tool call；DeepSeek Agent 模式使用 DeepSeek + 内置工具（read_file、write_file、run_terminal 等）多轮循环，直到模型停止调用工具。",
    tips: [
      "执行时间线中的 Tool 事件表示真实工具调用",
      "DeepSeek Agent 建议使用 deepseek-chat（支持 function calling）",
      "可通过 DEEPSEEK_AGENT_MAX_ITERATIONS 调整最大轮数（默认 25）",
    ],
  },
};

export function getStepExplanation(stepId: PipelineStepId): StepExplanation {
  return PIPELINE_STEP_EXPLANATIONS[stepId];
}
