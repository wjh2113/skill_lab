import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { getWorkspaceRoot } from "@/lib/config";
import { streamChatCompletion } from "@/lib/ai/deepseek";
import {
  appendRunEvents,
  updateRun,
  updateRunEvent,
} from "@/lib/agent/store";
import type { RunRecord } from "@/lib/agent/types";
import { readSkillFile } from "@/lib/skills/scanner";

const execFileAsync = promisify(execFile);

type RunContext = {
  nextEventId: () => string;
};

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  return match?.[0] ?? null;
}

async function runFetchScript(url: string, skillPath: string): Promise<{
  domain: string;
  slug: string;
  title: string | null;
  english_path: string;
  chinese_path: string;
}> {
  const scriptPath = path.join(skillPath, "scripts", "fetch_blog.py");
  const workspace = getWorkspaceRoot();

  const { stdout, stderr } = await execFileAsync(
    "python3",
    [scriptPath, url, "--output-dir", workspace],
    { cwd: workspace, maxBuffer: 10 * 1024 * 1024, timeout: 120_000 }
  );

  if (stderr && !stdout) {
    throw new Error(stderr.slice(0, 500));
  }

  return JSON.parse(stdout) as {
    domain: string;
    slug: string;
    title: string | null;
    english_path: string;
    chinese_path: string;
  };
}

async function streamTranslation(
  record: RunRecord,
  system: string,
  user: string,
  nextEventId: () => string
): Promise<string> {
  let assistantEventId: string | null = null;
  let pending = Promise.resolve();

  const fullText = await streamChatCompletion({
    system,
    user,
    maxTokens: 16384,
    onChunk: (chunk) => {
      if (!chunk.text) return;
      const delta = chunk.text;
      pending = pending.then(async () => {
        if (!assistantEventId) {
          assistantEventId = nextEventId();
          await appendRunEvents(record.id, [
            {
              id: assistantEventId,
              type: "assistant_text",
              timestamp: new Date().toISOString(),
              data: { text: delta, streaming: true },
            },
          ]);
        } else {
          await updateRunEvent(record.id, assistantEventId, (data) => ({
            ...data,
            text: String(data.text ?? "") + delta,
          }));
        }
      });
    },
  });

  await pending;
  return fullText;
}

export async function executeEnglishBlogTranslate(
  record: RunRecord,
  skillPath: string,
  ctx: RunContext
): Promise<boolean> {
  const url = extractUrl(record.prompt);
  if (!url) return false;

  await appendRunEvents(record.id, [
    {
      id: ctx.nextEventId(),
      type: "tool_call_start",
      timestamp: new Date().toISOString(),
      data: { name: "fetch_blog.py", args: { url } },
    },
  ]);

  let fetchResult;
  try {
    fetchResult = await runFetchScript(url, skillPath);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message.includes("Missing dependencies") ||
          err.message.includes("trafilatura")
          ? "缺少 Python 依赖，请运行: pip install -r .cursor/skills/english-blog-translate/scripts/requirements.txt"
          : err.message
        : "抓取失败";
    await appendRunEvents(record.id, [
      {
        id: ctx.nextEventId(),
        type: "error",
        timestamp: new Date().toISOString(),
        data: { message },
      },
    ]);
    await updateRun(record.id, {
      status: "error",
      finishedAt: new Date().toISOString(),
      error: message,
    });
    return true;
  }

  await appendRunEvents(record.id, [
    {
      id: ctx.nextEventId(),
      type: "tool_result",
      timestamp: new Date().toISOString(),
      data: { name: "fetch_blog.py", result: fetchResult },
    },
    {
      id: ctx.nextEventId(),
      type: "status",
      timestamp: new Date().toISOString(),
      data: {
        status: "RUNNING",
        message: `已抓取 ${fetchResult.english_path}，正在翻译...`,
      },
    },
  ]);

  const englishContent = await fs.readFile(fetchResult.english_path, "utf-8");
  const translatePrompt = await readSkillFile(skillPath, "prompts/translate.md");

  const system = [
    translatePrompt,
    "",
    "---",
    "",
    "以下是待翻译的英文 Markdown 全文：",
  ].join("\n");

  const fullText = await streamTranslation(
    record,
    system,
    englishContent,
    ctx.nextEventId
  );

  await fs.writeFile(fetchResult.chinese_path, fullText, "utf-8");

  await updateRun(record.id, {
    status: "finished",
    finishedAt: new Date().toISOString(),
    result: `翻译完成，已保存至：\n${fetchResult.chinese_path}\n\n---\n\n${fullText.slice(0, 2000)}${fullText.length > 2000 ? "\n\n...(完整内容见文件)" : ""}`,
    model: record.model,
  });

  return true;
}
