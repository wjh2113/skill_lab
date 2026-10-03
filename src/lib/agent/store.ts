import fs from "fs/promises";
import path from "path";
import { getRunsDir } from "@/lib/config";
import type { RunEvent, RunRecord } from "@/lib/agent/types";
import type { PipelineStep, PipelineStepId } from "@/lib/agent/pipeline-types";
import { withRunLock } from "@/lib/agent/run-lock";

const activeListeners = new Map<string, Set<(record: RunRecord) => void>>();

function runFilePath(id: string): string {
  return path.join(getRunsDir(), `${id}.json`);
}

export async function ensureRunsDir(): Promise<void> {
  await fs.mkdir(getRunsDir(), { recursive: true });
}

async function loadRunUnsafe(id: string): Promise<RunRecord | null> {
  try {
    const raw = await fs.readFile(runFilePath(id), "utf-8");
    return JSON.parse(raw) as RunRecord;
  } catch {
    return null;
  }
}

async function saveRunUnsafe(record: RunRecord): Promise<void> {
  await ensureRunsDir();
  await fs.writeFile(runFilePath(record.id), JSON.stringify(record, null, 2), "utf-8");
  notifyListeners(record);
}

export async function saveRun(record: RunRecord): Promise<void> {
  return withRunLock(record.id, () => saveRunUnsafe(record));
}

export async function loadRun(id: string): Promise<RunRecord | null> {
  return withRunLock(id, () => loadRunUnsafe(id));
}

export async function listRuns(): Promise<RunRecord[]> {
  await ensureRunsDir();
  const files = await fs.readdir(getRunsDir());
  const runs: RunRecord[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const run = await loadRunUnsafe(file.replace(/\.json$/, ""));
    if (run) runs.push(run);
  }
  return runs.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

export async function appendRunEvents(
  id: string,
  events: RunEvent[]
): Promise<RunRecord | null> {
  return withRunLock(id, async () => {
    const record = await loadRunUnsafe(id);
    if (!record) return null;
    record.events.push(...events);
    await saveRunUnsafe(record);
    return record;
  });
}

export async function updateRunEvent(
  id: string,
  eventId: string,
  updater: (data: Record<string, unknown>) => Record<string, unknown>
): Promise<RunRecord | null> {
  return withRunLock(id, async () => {
    const record = await loadRunUnsafe(id);
    if (!record) return null;
    const event = record.events.find((e) => e.id === eventId);
    if (event) {
      event.data = updater(event.data);
      event.timestamp = new Date().toISOString();
    }
    await saveRunUnsafe(record);
    return record;
  });
}

export async function updateRun(
  id: string,
  patch: Partial<RunRecord>
): Promise<RunRecord | null> {
  return withRunLock(id, async () => {
    const record = await loadRunUnsafe(id);
    if (!record) return null;
    Object.assign(record, patch);
    await saveRunUnsafe(record);
    return record;
  });
}

export async function initPipeline(id: string, steps: PipelineStep[]): Promise<void> {
  return withRunLock(id, async () => {
    const record = await loadRunUnsafe(id);
    if (!record) return;
    record.pipeline = steps;
    await saveRunUnsafe(record);
  });
}

export async function updatePipelineStep(
  id: string,
  stepId: PipelineStepId,
  patch: Partial<PipelineStep>
): Promise<RunRecord | null> {
  return withRunLock(id, async () => {
    const record = await loadRunUnsafe(id);
    if (!record?.pipeline) return null;
    const step = record.pipeline.find((s) => s.id === stepId);
    if (step) Object.assign(step, patch);
    await saveRunUnsafe(record);
    return record;
  });
}

export function subscribeRun(id: string, listener: (record: RunRecord) => void): () => void {
  if (!activeListeners.has(id)) {
    activeListeners.set(id, new Set());
  }
  activeListeners.get(id)!.add(listener);
  return () => {
    activeListeners.get(id)?.delete(listener);
  };
}

function notifyListeners(record: RunRecord): void {
  activeListeners.get(record.id)?.forEach((listener) => listener(record));
}

export function generateRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
