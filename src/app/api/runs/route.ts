import { NextResponse } from "next/server";
import { createRunRecord, startRunExecution } from "@/lib/agent/runner";
import { listRuns } from "@/lib/agent/store";
import type { CreateRunInput } from "@/lib/agent/types";

export async function GET() {
  const runs = await listRuns();
  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateRunInput;
    const record = await createRunRecord(body);
    startRunExecution(record);
    return NextResponse.json({ run: record }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start run";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
