import { loadRun, subscribeRun } from "@/lib/agent/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const initial = await loadRun(id);
  if (!initial) {
    return new Response("Run not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let lastEventCount = 0;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const pushRun = (run: Awaited<ReturnType<typeof loadRun>>) => {
        if (!run) return;
        const newEvents = run.events.slice(lastEventCount);
        lastEventCount = run.events.length;
        send({ type: "update", run, newEvents });
        if (run.status !== "running") {
          send({ type: "done", run });
          closed = true;
          controller.close();
        }
      };

      pushRun(initial);

      const unsubscribe = subscribeRun(id, (run) => pushRun(run));

      const poll = setInterval(async () => {
        if (closed) {
          clearInterval(poll);
          return;
        }
        const run = await loadRun(id);
        if (run && (run.events.length > lastEventCount || run.status !== "running")) {
          pushRun(run);
        }
        if (run && run.status !== "running") {
          clearInterval(poll);
        }
      }, 1000);

      const timeout = setTimeout(() => {
        if (!closed) {
          closed = true;
          clearInterval(poll);
          unsubscribe();
          controller.close();
        }
      }, 30 * 60 * 1000);

      return () => {
        closed = true;
        clearInterval(poll);
        clearTimeout(timeout);
        unsubscribe();
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
