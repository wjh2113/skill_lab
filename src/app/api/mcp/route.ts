import { NextResponse } from "next/server";
import { loadMcpServers, testMcpServer } from "@/lib/mcp/config";

export async function GET() {
  const servers = await loadMcpServers();
  return NextResponse.json({ servers });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { name: string };
  const servers = await loadMcpServers();
  const server = servers.find((s) => s.name === body.name);
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });
  const result = await testMcpServer(server);
  return NextResponse.json({ server: result });
}
