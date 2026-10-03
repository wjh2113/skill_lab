import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { readLockfile, upsertLockEntry, type SkillLockEntry } from "@/lib/skills/lockfile";
import type { SkillSummary } from "@/lib/skills/types";

async function hashDir(dir: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === ".git") continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else {
        hash.update(entry.name);
        hash.update(await fs.readFile(full));
      }
    }
  }
  await walk(dir);
  return hash.digest("hex");
}

export type SkillVersionInfo = {
  name: string;
  currentHash: string;
  lockEntry?: SkillLockEntry;
  changed: boolean;
  source?: string;
};

export async function getSkillVersionInfo(skill: SkillSummary): Promise<SkillVersionInfo> {
  const currentHash = await hashDir(skill.path);
  const lockfile = await readLockfile();
  const lockEntry = lockfile.skills[skill.name];
  const changed = lockEntry ? lockEntry.computedHash !== currentHash : true;

  return {
    name: skill.name,
    currentHash,
    lockEntry,
    changed,
    source: lockEntry?.source ?? skill.source?.source,
  };
}

export async function syncSkillHash(skill: SkillSummary): Promise<string> {
  const hash = await hashDir(skill.path);
  const lockfile = await readLockfile();
  const existing = lockfile.skills[skill.name];
  await upsertLockEntry(skill.name, {
    source: existing?.source ?? "local",
    sourceType: existing?.sourceType ?? "github",
    skillPath: existing?.skillPath,
    installedAt: existing?.installedAt ?? new Date().toISOString(),
    computedHash: hash,
  });
  return hash;
}
