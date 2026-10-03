"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { McpServerEntry } from "@/lib/mcp/config";

export default function McpPage() {
  const [servers, setServers] = useState<McpServerEntry[]>([]);
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/mcp").then((r) => r.json()).then((d) => setServers(d.servers ?? []));
  }, []);

  async function test(name: string) {
    setTesting(name);
    const res = await fetch("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setServers((prev) => prev.map((s) => (s.name === name ? data.server : s)));
    setTesting(null);
  }

  return (
    <div className="flex flex-1 flex-col p-6">
      <h1 className="text-xl font-semibold">MCP 联调面板</h1>
      <p className="mt-1 text-sm text-zinc-500">读取 .cursor/mcp.json 并测试连通性</p>

      {servers.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">未找到 MCP 配置（.cursor/mcp.json）</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {servers.map((s) => (
            <li key={s.name} className="rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{s.name}</span>
                  <Badge variant="secondary" className="ml-2">{s.type}</Badge>
                  {s.status && s.status !== "unknown" && (
                    <Badge variant={s.status === "ok" ? "success" : "error"} className="ml-1">
                      {s.status}
                    </Badge>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => test(s.name)} disabled={testing === s.name}>
                  {testing === s.name ? "测试中..." : "测试"}
                </Button>
              </div>
              {s.command && <p className="mt-2 font-mono text-xs text-zinc-500">{s.command}</p>}
              {s.url && <p className="mt-2 font-mono text-xs text-zinc-500">{s.url}</p>}
              {s.message && <p className="mt-1 text-xs text-zinc-400">{s.message}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
