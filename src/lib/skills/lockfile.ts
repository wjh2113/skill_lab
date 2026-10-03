import fs from "fs/promises";
import path from "path";
import { getLockfilePath } from "@/lib/config";

export type SkillLockEntry = {
  source: string;
  sourceType: "github";
  skillPath?: string;
  installedAt: string;
  computedHash: string;
};

export type SkillsLockfile = {
  version: 1;
  skills: Record<string, SkillLockEntry>;
};

const DEFAULT_LOCKFILE: SkillsLockfile = { version: 1, skills: {} };

export async function readLockfile(): Promise<SkillsLockfile> {
  const lockPath = getLockfilePath();
  try {
    const raw = await fs.readFile(lockPath, "utf-8");
    return JSON.parse(raw) as SkillsLockfile;
  } catch {
    return { ...DEFAULT_LOCKFILE };
  }
}

export async function writeLockfile(lockfile: SkillsLockfile): Promise<void> {
  const lockPath = getLockfilePath();
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  await fs.writeFile(lockPath, JSON.stringify(lockfile, null, 2) + "\n", "utf-8");
}

export async function upsertLockEntry(
  name: string,
  entry: SkillLockEntry
): Promise<void> {
  const lockfile = await readLockfile();
  lockfile.skills[name] = entry;
  await writeLockfile(lockfile);
}
