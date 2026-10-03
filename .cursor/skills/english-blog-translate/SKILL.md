---
name: english-blog-translate
description: Fetches English blog URLs into local Markdown and translates them to Chinese. Saves files under domain folders with kebab-case names. Use when the user wants to save, archive, or translate an English blog article, blog URL, or English Markdown file.
---

# 英文博客翻译

将英文博客 URL 抓取为 Markdown，并翻译、润色为中文版，保存在项目根目录下按域名组织的文件夹中。

## 输出结构

```
<项目根目录>/
└── <domain>/
    ├── <blog>.md          # 英文版
    └── 中译-<blog>.md     # 中文版（最终版）
```

| 字段 | 规则 |
|------|------|
| `<domain>` | URL 主机名，如 `github.com`、`mp.weixin.qq.com`（去掉 `www.`） |
| `<blog>` | 从页面标题（首选）或 URL 路径提取，kebab-case，2–6 个英文单词 |
| 中文版命名 | `中译-` + 英文文件名（不含扩展名） |

## 依赖

首次使用前安装脚本依赖：

```bash
pip install -r .cursor/skills/english-blog-translate/scripts/requirements.txt
```

## 工作流

按顺序执行三步，每步完成后确认输出再继续。

```
Task Progress:
- [ ] 步骤一：抓取英文博客 → `<domain>/<blog>.md`
- [ ] 步骤二：翻译为中文初稿
- [ ] 步骤三：审阅润色 → `<domain>/中译-<blog>.md`
```

### 步骤一：抓取并保存英文 Markdown

**始终使用固定脚本**，不要手写抓取逻辑：

```bash
python .cursor/skills/english-blog-translate/scripts/fetch_blog.py "<URL>" [--output-dir <项目根目录>]
```

- `--output-dir` 默认为当前工作目录（项目根目录）
- 脚本输出 JSON：`domain`、`slug`、`english_path`、`title`
- 读取生成的英文 Markdown 确认内容完整（标题、正文、链接）

若用户已有英文 Markdown 而无需抓取，跳过此步，从该文件路径推断 `domain` 与 `<blog>` 命名；若无法推断，按 [naming rules](reference.md#naming) 手动确定。

### 步骤二：翻译为中文

1. 读取 [prompts/translate.md](prompts/translate.md) 中的固定翻译 prompt
2. 将英文 Markdown 全文作为输入
3. 生成中文译文，**保留原有 Markdown 结构**（标题层级、代码块、链接、列表）
4. 代码块内代码不翻译；专有名词首次出现可保留英文并在括号内标注
5. 此步产出为中文初稿，暂存于对话中或临时写入同目录（步骤三会覆盖为最终版）

### 步骤三：审阅润色并保存中文版

1. 读取 [prompts/polish.md](prompts/polish.md) 中的固定润色 prompt
2. 读取 [terminology.md](terminology.md) 中的术语表，翻译时统一用词
3. 对照英文原文审阅步骤二的中文初稿：准确性、流畅度、术语一致性
4. 润色后写入 `<domain>/中译-<blog>.md`

> **注意**：`prompts/polish.md` 与 `terminology.md` 可由用户后续补充；若尚未配置，使用 prompt 文件中的占位说明完成基础润色，并提醒用户补充术语表。

## 质量检查

完成三步后确认：

- [ ] 英文文件位于 `<domain>/<blog>.md`
- [ ] 中文文件位于 `<domain>/中译-<blog>.md`
- [ ] 文件名符合 kebab-case、2–6 词规则
- [ ] 中文版 Markdown 结构与原英文一致
- [ ] 术语表中的词条在译文中统一

## 附加资源

- 命名与边界情况：[reference.md](reference.md)
- 脚本依赖：[scripts/requirements.txt](scripts/requirements.txt)
