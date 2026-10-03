"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RunTimeline } from "@/components/lab/run-timeline";
import { Button } from "@/components/ui/button";
import type { RunRecord } from "@/lib/agent/types";
import Link from "next/link";

export default function RunDetailPage() {
  const params = useParams<{ id: string }>();
  const [run, setRun] = useState<RunRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let source: EventSource | null = null;

    async function load() {
      const res = await fetch(`/api/runs/${params.id}`);
      if (!res.ok) {
        setError("运行记录不存在");
        return;
      }
      const data = await res.json();
      setRun(data.run);

      if (data.run.status === "running") {
        source = new EventSource(`/api/runs/${params.id}/stream`);
        source.onmessage = (event) => {
          const payload = JSON.parse(event.data);
          if (payload.run) setRun(payload.run);
        };
      }
    }

    load();
    return () => source?.close();
  }, [params.id]);

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/runs">返回列表</Link>
        </Button>
      </div>
    );
  }

  if (!run) {
    return <div className="p-6 text-sm text-zinc-500">加载中...</div>;
  }

  return (
    <div className="flex h-[calc(100vh)] flex-col">
      <div className="border-b border-zinc-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/runs">← 返回运行记录</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/runs/${params.id}/export`} download>
              导出 Markdown 报告
            </a>
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <RunTimeline record={run} />
      </div>
    </div>
  );
}
