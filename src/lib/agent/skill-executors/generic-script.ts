import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { getWorkspaceRoot } from "@/lib/config";
import { readSkillFile } from "@/lib/skills/scanner";

const execFileAsync = promisify(execFile);

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  return match?.[0] ?? null;
}

function findScriptRef(skillMd: string): string | null {
  const match = skillMd.match(/scripts\/[\w.-]+\.(py|sh|js)/);
  return match?.[0] ?? null;
}

export async function tryGenericScriptExecutor(
  skillPath: string,
  prompt: string
): Promise<{ output: string; script: string } | null> {
  const skillMd = await readSkillFile(skillPath, "SKILL.md");
  const scriptRel = findScriptRef(skillMd);
  if (!scriptRel) return null;

  const scriptPath = path.join(skillPath, scriptRel);
  try {
    await fs.access(scriptPath);
  } catch {
    return null;
  }

  const url = extractUrl(prompt);
  const workspace = getWorkspaceRoot();
  const ext = path.extname(scriptRel);

  if (ext === ".py" && url) {
    const { stdout, stderr } = await execFileAsync(
      "python3",
      [scriptPath, url, "--output-dir", workspace],
      { cwd: workspace, maxBuffer: 10 * 1024 * 1024, timeout: 120_000 }
    );
    return { output: stdout || stderr, script: scriptRel };
  }

  return null;
}
