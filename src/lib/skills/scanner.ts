import fs from "fs/promises";
import path from "path";
import {
  encodeSkillId,
  getPersonalSkillsDir,
  getProjectSkillScanDirs,
} from "@/lib/config";
import { readLockfile } from "@/lib/skills/lockfile";
import { parseSkillMarkdown } from "@/lib/skills/parser";
import type { SkillFile, SkillScope, SkillSummary } from "@/lib/skills/types";

const SKIP_DIRS = new Set(["node_modules", ".git", ".next"]);

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function buildFileTree(dir: string, base: string): Promise<SkillFile[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nodes: SkillFile[] = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(base, fullPath);

    if (entry.isDirectory()) {
      const children = await buildFileTree(fullPath, base);
      if (children.length > 0) {
        nodes.push({
          path: relPath,
          name: entry.name,
          type: "directory",
          children,
        });
      }
    } else {
      nodes.push({ path: relPath, name: entry.name, type: "file" });
    }
  }

  return nodes;
}

async function scanSkillDir(
  skillDir: string,
  scope: SkillScope,
  lockSources: Record<string, { source: string; sourceType: string; skillPath?: string; installedAt?: string }>
): Promise<SkillSummary | null> {
  const skillMdPath = path.join(skillDir, "SKILL.md");
  if (!(await pathExists(skillMdPath))) return null;

  const folderName = path.basename(skillDir);
  const raw = await fs.readFile(skillMdPath, "utf-8");
  const lineCount = raw.split("\n").length;
  const { frontmatter } = parseSkillMarkdown(raw);

  const name = frontmatter.name ?? folderName;
  const description = frontmatter.description ?? "";
  const warnings: string[] = [];

  if (frontmatter.name && frontmatter.name !== folderName) {
    warnings.push(`frontmatter name "${frontmatter.name}" 与目录名 "${folderName}" 不一致`);
  }
  if (lineCount > 500) {
    warnings.push(`SKILL.md 共 ${lineCount} 行，建议控制在 500 行以内`);
  }
  if (!description) {
    warnings.push("缺少 description 字段");
  }

  const files = await buildFileTree(skillDir, skillDir);
  const lockEntry = lockSources[name];

  return {
    id: encodeSkillId(scope, name),
    name,
    description,
    scope,
    path: skillDir,
    files,
    lineCount,
    disableModelInvocation: frontmatter.disableModelInvocation,
    warnings,
    source: lockEntry,
  };
}

async function scanScopeDir(
  rootDir: string,
  scope: SkillScope,
  lockSources: Record<string, { source: string; sourceType: string; skillPath?: string; installedAt?: string }>
): Promise<SkillSummary[]> {
  if (!(await pathExists(rootDir))) return [];

  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const skills: SkillSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
    const skill = await scanSkillDir(path.join(rootDir, entry.name), scope, lockSources);
    if (skill) skills.push(skill);
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listSkills(): Promise<SkillSummary[]> {
  const lockfile = await readLockfile();
  const lockSources = Object.fromEntries(
    Object.entries(lockfile.skills).map(([name, entry]) => [
      name,
      {
        source: entry.source,
        sourceType: entry.sourceType,
        skillPath: entry.skillPath,
        installedAt: entry.installedAt,
      },
    ])
  );

  const personal = await scanScopeDir(getPersonalSkillsDir(), "personal", lockSources);

  const project: SkillSummary[] = [];
  const seenProjectNames = new Set<string>();
  for (const dir of getProjectSkillScanDirs()) {
    const found = await scanScopeDir(dir, "project", lockSources);
    for (const skill of found) {
      if (seenProjectNames.has(skill.name)) continue;
      seenProjectNames.add(skill.name);
      project.push(skill);
    }
  }

  return [...project, ...personal];
}

export async function getSkillById(id: string): Promise<SkillSummary | null> {
  const skills = await listSkills();
  return skills.find((s) => s.id === id) ?? null;
}

export async function readSkillFile(
  skillPath: string,
  relativePath: string
): Promise<string> {
  const resolved = path.resolve(skillPath, relativePath);
  if (!resolved.startsWith(path.resolve(skillPath))) {
    throw new Error("Invalid file path");
  }
  return fs.readFile(resolved, "utf-8");
}

export async function ensureSkillDirs(): Promise<void> {
  for (const dir of getProjectSkillScanDirs()) {
    await fs.mkdir(dir, { recursive: true });
  }
}
