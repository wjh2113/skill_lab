const runLocks = new Map<string, Promise<void>>();

export async function withRunLock<T>(runId: string, fn: () => Promise<T>): Promise<T> {
  const prev = runLocks.get(runId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chain = prev.then(() => gate);
  runLocks.set(runId, chain);

  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (runLocks.get(runId) === chain) {
      runLocks.delete(runId);
    }
  }
}
