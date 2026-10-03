# Skill Lab

个人用的 Cursor Agent Skill 研究工具。在浏览器中加载、创建、导入 skill，并通过 Cursor SDK 运行 agent，可视化文件、执行结果与工具调用过程。

## 功能

### 核心
- **Skill 目录** — 扫描 skill，显示规范评分
- **文件预览 / 编辑器** — 浏览并直接编辑 SKILL.md
- **创建 / GitHub 导入 / skills.sh 发现**
- **运行实验室** — Cursor Agent 或 DeepSeek，支持 **Auto 自动匹配**
- **Agent 初始化流程可视化** — 8 步 pipeline（扫描→YAML→匹配→选择→加载→执行）
- **运行记录** — 持久化 + **Markdown 报告导出**

### 研究工具
- **Skill 对比** — `/skills/compare` 并排 diff
- **规范检查器** — frontmatter、description、行数 lint
- **依赖图** — 解析 reference、scripts、MCP 引用
- **版本追踪** — hash 同步到 skills-lock.json
- **评测套件** — `/eval` 批量测试 prompt
- **A/B 实验** — `/lab/experiment` 对比两种 system prompt
- **MCP 联调** — `/mcp` 读取 .cursor/mcp.json 并测试
- **通用 Script Executor** — DeepSeek 模式自动运行 skill 内 scripts/*.py

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置 API Key
cp .env.example .env.local
# 编辑 .env.local，填入 CURSOR_API_KEY

# 3. 启动开发服务器
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

## 运行 Provider

| Provider | 配置 | 能力 |
|----------|------|------|
| **Cursor Agent** | `CURSOR_API_KEY` | 完整 agent 运行时，支持真实 tool call |
| **DeepSeek** | `DEEPSEEK_API_KEY` + `AI_BASE_URL` + `AI_MODEL` | 注入 SKILL.md 后流式回复，适合研究 skill 指令本身 |

在运行实验室可选择 Provider。默认策略（`RUN_PROVIDER=auto`）：有 Cursor Key 时用 Cursor，否则用 DeepSeek。

## 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `CURSOR_API_KEY` | Cursor 模式 | Cursor API Key |
| `DEEPSEEK_API_KEY` | DeepSeek 模式 | DeepSeek API Key（也可用 `LLM_API_KEY`） |
| `AI_BASE_URL` | 否 | 默认 `https://api.deepseek.com/v1` |
| `AI_MODEL` | 否 | 默认 `deepseek-chat`（可用 `deepseek-reasoner`） |
| `RUN_PROVIDER` | 否 | `cursor` / `deepseek` / `auto` |
| `SKILL_LAB_WORKSPACE` | 否 | Agent 工作目录，默认项目根 |
| `SKILL_LAB_PERSONAL_DIR` | 否 | 个人 skill 目录，默认 `~/.cursor/skills` |

## Skill 存储位置

| 位置 | 作用 |
|------|------|
| `.cursor/skills/<name>/` | 项目级 skill（默认导入/创建位置） |
| `~/.cursor/skills/<name>/` | 个人级 skill（全局可用） |

## GitHub 导入示例

```
仓库 URL: https://github.com/aliyun/qwen-dianjin
子路径:   DianJin-SKILLS/investment-advisor/comparable-company-analysis
```

导入记录保存在 `data/skills-lock.json`。

## 项目结构

```
src/
├── app/              # 页面与 API 路由
├── components/       # UI 组件
└── lib/
    ├── skills/       # 扫描、创建、解析
    ├── github/       # GitHub 导入
    └── agent/        # Cursor SDK 运行与记录
data/
├── skills-lock.json  # 导入来源追踪
└── runs/             # 运行记录 JSON
```

## 技术栈

- Next.js 15 + React 19 + Tailwind CSS
- Radix UI
- `@cursor/sdk` — 本地 agent 运行与流式观测
- `gray-matter` — SKILL.md frontmatter 解析
- `simple-git` — GitHub 浅克隆

## 注意事项

- 运行实验室需要有效的 `CURSOR_API_KEY` 和本机 Cursor 环境
- GitHub 导入目前仅支持公开仓库
- 不会写入 `~/.cursor/skills-cursor/`（Cursor 内置 reserved 目录）
