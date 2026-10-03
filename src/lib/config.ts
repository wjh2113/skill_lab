import os from "os";
import path from "path";

export function getWorkspaceRoot(): string {
  return process.env.SKILL_LAB_WORKSPACE ?? process.cwd();
}

export function getPersonalSkillsDir(): string {
  return (
    process.env.SKILL_LAB_PERSONAL_DIR ??
    path.join(os.homedir(), ".cursor", "skills")
  );
}

export function getProjectSkillsDir(): string {
  return path.join(getWorkspaceRoot(), ".cursor", "skills");
}

/** skills.sh CLI installs Cursor skills here (see `npx skills add -a cursor`) */
export function getAgentsSkillsDir(): string {
  return path.join(getWorkspaceRoot(), ".agents", "skills");
}

export function getProjectSkillScanDirs(): string[] {
  return [getProjectSkillsDir(), getAgentsSkillsDir()];
}

export function getDataDir(): string {
  return path.join(getWorkspaceRoot(), "data");
}

export function getRunsDir(): string {
  return path.join(getDataDir(), "runs");
}

export function getLockfilePath(): string {
  return path.join(getDataDir(), "skills-lock.json");
}

export function encodeSkillId(scope: "personal" | "project", name: string): string {
  return `${scope}:${name}`;
}

export function decodeSkillId(id: string): { scope: "personal" | "project"; name: string } {
  const [scope, ...rest] = id.split(":");
  if (scope !== "personal" && scope !== "project") {
    throw new Error(`Invalid skill id: ${id}`);
  }
  const name = rest.join(":");
  if (!name) {
    throw new Error(`Invalid skill id: ${id}`);
  }
  return { scope, name };
}
