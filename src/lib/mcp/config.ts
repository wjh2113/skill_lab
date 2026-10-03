import fs from "fs/promises";
import path from "path";
import { getWorkspaceRoot } from "@/lib/config";

export type McpServerEntry = {
  name: string;
  type: "stdio" | "http" | "sse" | "unknown";
  command?: string;
  url?: string;
  status?: "unknown" | "ok" | "error";
  message?: string;
};

export async function loadMcpServers(): Promise<McpServerEntry[]> {
  const configPath = path.join(getWorkspaceRoot(), ".cursor", "mcp.json");
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(raw) as {
      mcpServers?: Record<string, { command?: string; args?: string[]; url?: string; type?: string }>;
    };
    return Object.entries(config.mcpServers ?? {}).map(([name, srv]) => ({
      name,
      type: srv.url ? (srv.type as McpServerEntry["type"]) ?? "http" : "stdio",
      command: srv.command ? [srv.command, ...(srv.args ?? [])].join(" ") : undefined,
      url: srv.url,
      status: "unknown" as const,
    }));
  } catch {
    return [];
  }
}

export async function testMcpServer(server: McpServerEntry): Promise<McpServerEntry> {
  if (server.type === "http" || server.type === "sse") {
    if (!server.url) return { ...server, status: "error", message: "缺少 URL" };
    try {
      const res = await fetch(server.url, { method: "GET", signal: AbortSignal.timeout(5000) });
      return {
        ...server,
        status: res.ok || res.status === 405 ? "ok" : "error",
        message: `HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        ...server,
        status: "error",
        message: err instanceof Error ? err.message : "连接失败",
      };
    }
  }
  return {
    ...server,
    status: "ok",
    message: "stdio 服务器需在 agent 运行时验证",
  };
}
