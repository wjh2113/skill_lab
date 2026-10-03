import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { getWorkspaceRoot } from "@/lib/config";
import type { ToolCall, ToolDefinition } from "@/lib/agent/deepseek-agent/types";

const execFileAsync = promisify(execFile);

const MAX_READ_CHARS = 100_000;
const MAX_WRITE_CHARS = 200_000;
const MAX_TERMINAL_OUTPUT = 50_000;
const TERMINAL_TIMEOUT_MS = 120_000;

function getWorkspace(): string {
  return path.resolve(getWorkspaceRoot());
}

function resolveInWorkspace(inputPath: string): string {
  const workspace = getWorkspace();
  const resolved = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(workspace, inputPath);

  if (resolved !== workspace && !resolved.startsWith(workspace + path.sep)) {
    throw new Error(`Path outside workspace: ${inputPath}`);
  }
  return resolved;
}

async function walkFiles(
  dir: string,
  workspace: string,
  pattern: RegExp,
  results: string[],
  depth = 0
): Promise<void> {
  if (depth > 8 || results.length >= 100) return;

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= 100) break;
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".next") {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(workspace, fullPath);

    if (entry.isDirectory()) {
      await walkFiles(fullPath, workspace, pattern, results, depth + 1);
    } else if (pattern.test(relPath) || pattern.test(entry.name)) {
      results.push(relPath);
    }
  }
}

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read a text file from the workspace. Use for SKILL.md, scripts, source files, and outputs.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path relative to workspace root" },
          offset: {
            type: "number",
            description: "Optional 1-based start line (for large files)",
          },
          limit: { type: "number", description: "Optional max lines to read" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write or overwrite a text file in the workspace. Creates parent directories.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path relative to workspace root" },
          content: { type: "string", description: "File content" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_directory",
      description: "List files and directories at a workspace path.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Directory path relative to workspace root (default: .)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "glob_file_search",
      description:
        "Find files by glob-like pattern (e.g. **/*.py, scripts/*.md). Returns up to 100 paths.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Glob pattern (supports * and **)" },
          path: {
            type: "string",
            description: "Optional subdirectory to search from (default: workspace root)",
          },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_terminal",
      description:
        "Run a shell command in the workspace (python3, pip, pdftoppm, etc.). cwd defaults to workspace root.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute" },
          cwd: {
            type: "string",
            description: "Optional working directory relative to workspace root",
          },
        },
        required: ["command"],
      },
    },
  },
];

function globPatternToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "___GLOBSTAR___")
    .replace(/\*/g, "[^/]*")
    .replace(/___GLOBSTAR___/g, ".*");
  return new RegExp(`^${escaped}$`);
}

async function toolReadFile(args: Record<string, unknown>): Promise<string> {
  const filePath = resolveInWorkspace(String(args.path));
  const raw = await fs.readFile(filePath, "utf-8");

  const offset = typeof args.offset === "number" ? args.offset : undefined;
  const limit = typeof args.limit === "number" ? args.limit : undefined;

  let content = raw;
  if (offset !== undefined || limit !== undefined) {
    const lines = raw.split("\n");
    const start = Math.max(0, (offset ?? 1) - 1);
    const end = limit !== undefined ? start + limit : lines.length;
    content = lines.slice(start, end).join("\n");
  }

  if (content.length > MAX_READ_CHARS) {
    return (
      content.slice(0, MAX_READ_CHARS) +
      `\n\n...(truncated, ${content.length - MAX_READ_CHARS} chars omitted)`
    );
  }
  return content;
}

async function toolWriteFile(args: Record<string, unknown>): Promise<string> {
  const filePath = resolveInWorkspace(String(args.path));
  const content = String(args.content ?? "");

  if (content.length > MAX_WRITE_CHARS) {
    throw new Error(`Content too large (max ${MAX_WRITE_CHARS} chars)`);
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
  return `Wrote ${path.relative(getWorkspace(), filePath)} (${content.length} chars)`;
}

async function toolListDirectory(args: Record<string, unknown>): Promise<string> {
  const dirPath = resolveInWorkspace(String(args.path ?? "."));
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const lines = entries
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => `${e.isDirectory() ? "d" : "f"}\t${e.name}`);
  return lines.join("\n") || "(empty directory)";
}

async function toolGlobSearch(args: Record<string, unknown>): Promise<string> {
  const pattern = String(args.pattern);
  const base = resolveInWorkspace(String(args.path ?? "."));
  const workspace = getWorkspace();
  const regex = globPatternToRegExp(pattern);
  const results: string[] = [];
  await walkFiles(base, workspace, regex, results);
  return results.length > 0 ? results.join("\n") : "No files matched";
}

async function toolRunTerminal(args: Record<string, unknown>): Promise<string> {
  const command = String(args.command ?? "").trim();
  if (!command) throw new Error("command is required");

  const cwd = args.cwd ? resolveInWorkspace(String(args.cwd)) : getWorkspace();

  const { stdout, stderr } = await execFileAsync(command, {
    cwd,
    shell: true,
    timeout: TERMINAL_TIMEOUT_MS,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, CI: "1", NO_COLOR: "1" },
  });

  const combined = [stdout, stderr].filter(Boolean).join("\n").trim();
  if (!combined) return "(command completed with no output)";
  if (combined.length > MAX_TERMINAL_OUTPUT) {
    return (
      combined.slice(0, MAX_TERMINAL_OUTPUT) +
      `\n\n...(truncated, ${combined.length - MAX_TERMINAL_OUTPUT} chars omitted)`
    );
  }
  return combined;
}

export async function executeAgentTool(toolCall: ToolCall): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(toolCall.function.arguments || "{}") as Record<string, unknown>;
  } catch {
    return `Error: invalid tool arguments JSON: ${toolCall.function.arguments}`;
  }

  try {
    switch (toolCall.function.name) {
      case "read_file":
        return await toolReadFile(args);
      case "write_file":
        return await toolWriteFile(args);
      case "list_directory":
        return await toolListDirectory(args);
      case "glob_file_search":
        return await toolGlobSearch(args);
      case "run_terminal":
        return await toolRunTerminal(args);
      default:
        return `Error: unknown tool ${toolCall.function.name}`;
    }
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
