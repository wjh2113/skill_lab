import { NextResponse } from "next/server";
import { loadRun } from "@/lib/agent/store";
import { exportRunAsMarkdown } from "@/lib/export/report";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await loadRun(id);
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const markdown = exportRunAsMarkdown(run);
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="run-${id.slice(-8)}.md"`,
    },
  });
}
