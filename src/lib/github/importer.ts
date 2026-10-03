import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import simpleGit from "simple-git";
import {
  getPersonalSkillsDir,
  getProjectSkillsDir,
} from "@/lib/config";
import { upsertLockEntry } from "@/lib/skills/lockfile";
import { parseSkillMarkdown, validateSkillName } from "@/lib/skills/parser";
import type { ImportSkillInput, SkillScope } from "@/lib/skills/types";
import { getSkillById } from "@/lib/skills/scanner";
import { encodeSkillId } from "@/lib/config";

export type ImportResult = {
  skillId: string;
  name: string;
  scope: SkillScope;
  path: string;
  source: string;
};

function parseGitHubUrl(repoUrl: string): { owner: string; repo: string } {
  const trimmed = repoUrl.trim().replace(/\.git$/, "");
  const match = trimmed.match(
    /(?:https?:\/\/github\.com\/|github\.com\/|git@github\.com:)([^/]+)\/([^/]+)/
  );
  if (!match) {
    throw new Error("无法解析 GitHub URL，请使用 https://github.com/owner/repo 格式");
  }
  return { owner: match[1], repo: match[2] };
}

async function findSkillDir(root: string, skillPath?: string): Promise<string> {
  if (skillPath) {
    const candidate = path.join(root, skillPath);
    try {
      await fs.access(path.join(candidate, "SKILL.md"));
      return candidate;
    } catch {
      throw new Error(`在 ${skillPath} 下未找到 SKILL.md`);
    }
  }

  async function walk(dir: string, depth: number): Promise<string | null> {
    if (depth > 6) return null;
    try {
      await fs.access(path.join(dir, "SKILL.md"));
      return dir;
    } catch {
      // continue
    }
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === ".git") continue;
      const found = await walk(path.join(dir, entry.name), depth + 1);
      if (found) return found;
    }
    return null;
  }

  const found = await walk(root, 0);
  if (!found) throw new Error("仓库中未找到 SKILL.md");
  return found;
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git") continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function hashDir(dir: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        const content = await fs.readFile(full);
        hash.update(entry.name);
        hash.update(content);
      }
    }
  }
  await walk(dir);
  return hash.digest("hex");
}

function getTargetBase(scope: SkillScope): string {
  return scope === "personal" ? getPersonalSkillsDir() : getProjectSkillsDir();
}

export async function importSkillFromGitHub(
  input: ImportSkillInput
): Promise<ImportResult> {
  const { owner, repo } = parseGitHubUrl(input.repoUrl);
  const source = `${owner}/${repo}`;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-lab-import-"));

  try {
    const git = simpleGit();
    const cloneUrl = `https://github.com/${owner}/${repo}.git`;

    if (input.skillPath) {
      await git.clone(cloneUrl, tmpDir, [
        "--depth",
        "1",
        "--filter=blob:none",
        "--sparse",
      ]);
      const repoGit = simpleGit(tmpDir);
      await repoGit.raw(["sparse-checkout", "set", input.skillPath]);
    } else {
      await git.clone(cloneUrl, tmpDir, ["--depth", "1"]);
    }

    const skillSrcDir = await findSkillDir(tmpDir, input.skillPath);
    const skillMd = await fs.readFile(path.join(skillSrcDir, "SKILL.md"), "utf-8");
    const { frontmatter } = parseSkillMarkdown(skillMd);
    const folderName = path.basename(skillSrcDir);
    const name = frontmatter.name ?? folderName;

    const nameError = validateSkillName(name);
    if (nameError) throw new Error(nameError);

    const targetDir = path.join(getTargetBase(input.targetScope), name);
    try {
      await fs.access(targetDir);
      if (!input.overwrite) {
        throw new Error(`Skill "${name}" 已存在，勾选覆盖以继续`);
      }
      await fs.rm(targetDir, { recursive: true, force: true });
    } catch (err) {
      if (err instanceof Error && err.message.includes("已存在")) throw err;
    }

    await copyDir(skillSrcDir, targetDir);
    const computedHash = await hashDir(targetDir);

    await upsertLockEntry(name, {
      source,
      sourceType: "github",
      skillPath: input.skillPath ?? (path.relative(tmpDir, skillSrcDir) || undefined),
      installedAt: new Date().toISOString(),
      computedHash,
    });

    const skill = await getSkillById(encodeSkillId(input.targetScope, name));
    if (!skill) throw new Error("导入后无法读取 skill");

    return {
      skillId: skill.id,
      name,
      scope: input.targetScope,
      path: targetDir,
      source,
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
