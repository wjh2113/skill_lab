# 命名与边界情况

## 命名

### domain

从 URL 的 host 提取，小写，去掉 `www.` 前缀。

| URL | domain |
|-----|--------|
| `https://www.github.com/foo/bar` | `github.com` |
| `https://mp.weixin.qq.com/s/abc` | `mp.weixin.qq.com` |

### slug（`<blog>`）

1. **首选**：页面 `<title>`，取 `|`、`:`、`-` 分隔的第一段，提取英文单词，kebab-case，2–6 词
2. **备选**：URL path 各段（从后往前），提取英文单词，凑够 2–6 词
3. 过滤停用词：`a`, `an`, `the`, `and`, `or`, `but`, `in`, `on`, `at`, `to`, `for`, `of`, `with`, `by`
4. 不足 2 词时用 `blog`、`post`、`article` 补齐

示例：

| 标题 | slug |
|------|------|
| `Understanding React Server Components \| React Blog` | `understanding-react-server-components` |
| `A Guide to TypeScript` | `guide-typescript` |

### 中文版文件名

`中译-{slug}.md`，与英文版同目录。

## 抓取失败

- 页面需登录或反爬：告知用户，建议手动复制正文保存为 `<domain>/<slug>.md` 后继续步骤二
- 提取内容不完整：检查是否为 SPA；可尝试让用户提供全文 HTML 或 Markdown

## 已有英文 Markdown

用户直接提供 `.md` 文件时：

1. 若文件已在 `<domain>/<blog>.md`，直接用于步骤二
2. 若在任意路径，读取内容后按规则确定 `domain` 与 `slug`，必要时移动到标准目录
