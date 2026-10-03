import { execFile } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { getWorkspaceRoot } from "@/lib/config";
import { upsertLockEntry } from "@/lib/skills/lockfile";

const execFileAsync = promisify(execFile);

export type SkillsShItem = {
  packageRef: string;
  owner: string;
  repo: string;
  skillName: string;
  installsLabel: string;
  installsCount: number;
  url: string;
};

export type SkillsShSearchResult = {
  query: string;
  items: SkillsShItem[];
  hint?: string;
  error?: string;
};

export type SkillsShInstallResult = {
  ok: boolean;
  output: string;
  installPath?: string;
  skillName?: string;
  skillId?: string;
};

/** Strip ANSI color codes from CLI output */
function stripAnsi(text: string): string {
  return text
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b\].*?(?:\u0007|\u001b\\)/g, "");
}

/** Parse "21K installs" / "948 installs" / "4.8K installs" → number */
function parseInstallCount(label: string): number {
  const match = label.match(/([\d.]+)\s*([KkMm])?/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2]?.toUpperCase();
  if (unit === "K") return Math.round(num * 1000);
  if (unit === "M") return Math.round(num * 1_000_000);
  return Math.round(num);
}

function buildCliEnv(): NodeJS.ProcessEnv {
  const home = os.homedir();
  const extraPaths = [
    path.join(home, ".local", "bin"),
    path.join(home, ".nvm", "versions", "node", process.version, "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
  ];
  return {
    ...process.env,
    PATH: [...extraPaths, process.env.PATH ?? ""].filter(Boolean).join(":"),
    CI: "1",
    NO_COLOR: "1",
    FORCE_COLOR: "0",
  };
}

function extractExecOutput(err: unknown): string {
  if (!(err instanceof Error)) return "安装失败";
  const execErr = err as Error & { stdout?: string | Buffer; stderr?: string | Buffer };
  const parts = [
    execErr.stdout ? String(execErr.stdout) : "",
    execErr.stderr ? String(execErr.stderr) : "",
    execErr.message,
  ].filter(Boolean);
  return stripAnsi(parts.join("\n")).trim();
}

function looksLikeInstallSuccess(output: string): boolean {
  return (
    /Installation complete/i.test(output) ||
    /Installed \d+ skill/i.test(output) ||
    /Done!\s*Review skills/i.test(output)
  );
}

function cleanInstallPath(raw: string): string {
  return raw
    .replace(/[│├─└╯╮].*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseInstallPath(output: string): string | undefined {
  const arrowMatch = output.match(/→\s*(~[^\n│]+)/);
  if (arrowMatch) {
    return cleanInstallPath(arrowMatch[1].replace(/^~/, os.homedir()));
  }
  const summaryMatch = output.match(
    /(?:^|\n)\s*((?:~|\/)?[^\n│]*\/\.agents\/skills\/[\w.-]+)/m
  );
  if (!summaryMatch) return undefined;
  const raw = summaryMatch[1].replace(/^~/, os.homedir());
  return cleanInstallPath(raw);
}

function parseSkillNameFromRef(packageRef: string): string {
  const at = packageRef.lastIndexOf("@");
  return at >= 0 ? packageRef.slice(at + 1) : packageRef;
}

function parseSkillNameFromOutput(output: string, packageRef: string): string {
  const installedMatch = output.match(/✓\s*([\w.-]+)\s*\(/);
  if (installedMatch) return installedMatch[1];
  const selectedMatch = output.match(/Selected \d+ skill:\s*([\w.-]+)/i);
  if (selectedMatch) return selectedMatch[1];
  return parseSkillNameFromRef(packageRef);
}

async function recordLockEntry(packageRef: string, installPath: string, skillName: string): Promise<void> {
  const hash = Buffer.from(`${packageRef}:${installPath}`).toString("base64url").slice(0, 16);
  await upsertLockEntry(skillName, {
    source: `https://skills.sh/${packageRef.replace("@", "/")}`,
    sourceType: "github",
    skillPath: installPath,
    installedAt: new Date().toISOString(),
    computedHash: hash,
  });
}

/**
 * Parse `npx skills find` output into structured items.
 *
 * Example block:
 *   owner/repo@skill-name  21K installs
 *   └ https://skills.sh/owner/repo/skill-name
 */
export function parseSkillsShOutput(raw: string, query: string): SkillsShSearchResult {
  const clean = stripAnsi(raw);
  const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);

  let hint: string | undefined;
  const items: SkillsShItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("Install with")) {
      hint = line.replace(/^Install with\s*/i, "").trim();
      continue;
    }

    const mainMatch = line.match(
      /^([\w.-]+\/[\w.-]+)@([\w.-]+)\s+([\d.]+[KkMm]?\s*installs?)/i
    );
    if (!mainMatch) continue;

    const [, repoPath, skillName, installsLabel] = mainMatch;
    const slashIdx = repoPath.indexOf("/");
    const owner = repoPath.slice(0, slashIdx);
    const repo = repoPath.slice(slashIdx + 1);

    let url = "";
    const nextLine = lines[i + 1];
    if (nextLine?.startsWith("└")) {
      url = nextLine.replace(/^└\s*/, "").trim();
      i++;
    }

    items.push({
      packageRef: `${repoPath}@${skillName}`,
      owner,
      repo,
      skillName,
      installsLabel: installsLabel.trim(),
      installsCount: parseInstallCount(installsLabel),
      url,
    });
  }

  return { query, items, hint };
}

export async function searchSkillsSh(query: string): Promise<SkillsShSearchResult> {
  try {
    const { stdout, stderr } = await execFileAsync(
      "npx",
      ["--yes", "skills", "find", query],
      {
        timeout: 60_000,
        maxBuffer: 4 * 1024 * 1024,
        env: buildCliEnv(),
        cwd: getWorkspaceRoot(),
      }
    );
    const output = stdout || stderr;
    const parsed = parseSkillsShOutput(output, query);
    if (parsed.items.length === 0 && /error|failed|not found/i.test(output)) {
      return { ...parsed, error: stripAnsi(output).trim() };
    }
    return parsed;
  } catch (err) {
    const message = extractExecOutput(err) || "搜索失败，请确认已安装 Node.js 且网络可用";
    return { query, items: [], error: message };
  }
}

export async function installSkillsSh(packageRef: string): Promise<SkillsShInstallResult> {
  const cwd = getWorkspaceRoot();
  const args = ["--yes", "skills", "add", packageRef, "-a", "cursor", "-y", "--copy"];

  try {
    const { stdout, stderr } = await execFileAsync("npx", args, {
      timeout: 300_000,
      maxBuffer: 8 * 1024 * 1024,
      cwd,
      env: buildCliEnv(),
    });
    const rawOutput = stdout + stderr;
    const output = stripAnsi(rawOutput).trim();
    const installPath = parseInstallPath(output);
    const skillName = parseSkillNameFromOutput(output, packageRef);

    if (installPath) {
      await recordLockEntry(packageRef, installPath, skillName);
    }

    return {
      ok: true,
      output,
      installPath,
      skillName,
      skillId: skillName ? `project:${skillName}` : undefined,
    };
  } catch (err) {
    const rawOutput = extractExecOutput(err);
    const installPath = parseInstallPath(rawOutput);
    const skillName = parseSkillNameFromOutput(rawOutput, packageRef);

    if (looksLikeInstallSuccess(rawOutput)) {
      if (installPath) {
        await recordLockEntry(packageRef, installPath, skillName);
      }
      return {
        ok: true,
        output: rawOutput,
        installPath,
        skillName,
        skillId: skillName ? `project:${skillName}` : undefined,
      };
    }

    if (installPath) {
      try {
        await fs.access(path.join(installPath, "SKILL.md"));
        await recordLockEntry(packageRef, installPath, skillName);
        return {
          ok: true,
          output: `${rawOutput}\n\n（CLI 返回非零退出码，但 skill 文件已存在，视为安装成功）`.trim(),
          installPath,
          skillName,
          skillId: skillName ? `project:${skillName}` : undefined,
        };
      } catch {
        // skill dir missing — fall through to failure
      }
    }

    const hint =
      /timed out|ETIMEDOUT/i.test(rawOutput)
        ? "\n\n首次安装需要克隆 GitHub 仓库，可能耗时 1–3 分钟。请检查网络后重试，或在终端运行：\n" +
          `npx skills add ${packageRef} -a cursor -y --copy`
        : "";

    return { ok: false, output: (rawOutput + hint).trim() || "安装失败" };
  }
}
