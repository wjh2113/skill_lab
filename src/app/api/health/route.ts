import { NextResponse } from "next/server";
import { getProviderStatus } from "@/lib/ai/config";

export async function GET() {
  const providers = getProviderStatus();
  return NextResponse.json({
    ok: true,
    hasApiKey: providers.cursor.available || providers.deepseek.available,
    providers,
    workspace: process.env.SKILL_LAB_WORKSPACE ?? process.cwd(),
  });
}
