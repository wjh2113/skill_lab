"use client";

import { AgentPipeline } from "@/components/lab/agent-pipeline";
import { RunExplanationPanel } from "@/components/lab/run-explanation-panel";
import {
  Bot,
  Brain,
  ChevronDown,
  ChevronRight,
  Hammer,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatDate } from "@/lib/utils";
import type { RunEvent, RunRecord } from "@/lib/agent/types";

function EventIcon({ type }: { type: RunEvent["type"] }) {
  switch (type) {
    case "assistant_text":
      return <Bot className="h-4 w-4 text-violet-600" />;
    case "thinking":
      return <Brain className="h-4 w-4 text-blue-500" />;
    case "tool_call_start":
    case "tool_call_end":
    case "tool_result":
      return <Hammer className="h-4 w-4 text-amber-600" />;
    default:
      return <MessageSquare className="h-4 w-4 text-zinc-500" />;
  }
}

function EventBlock({ event }: { event: RunEvent }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails =
    event.type.startsWith("tool_") &&
    (event.data.args !== undefined || event.data.result !== undefined);

  const label =
    event.type === "assistant_text"
      ? "Assistant"
      : event.type === "thinking"
        ? "Thinking"
        : event.type === "tool_call_start"
          ? `Tool: ${String(event.data.name ?? "unknown")}`
          : event.type === "tool_call_end"
            ? `Tool done: ${String(event.data.name ?? "unknown")}`
            : event.type === "tool_result"
              ? `Result: ${String(event.data.name ?? "unknown")}`
              : event.type === "status"
                ? `Status: ${String(event.data.status ?? "")}`
                : "Error";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex items-start gap-2">
        <EventIcon type={event.type} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{label}</span>
            <span className="shrink-0 text-xs text-zinc-400">
              {formatDate(event.timestamp)}
            </span>
          </div>

          {event.type === "assistant_text" && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">
              {String(event.data.text ?? "")}
            </p>
          )}

          {event.type === "thinking" && (
            <p className="mt-2 text-sm italic text-zinc-500">{String(event.data.text ?? "")}</p>
          )}

          {event.type === "error" && (
            <p className="mt-2 text-sm text-red-600">{String(event.data.message ?? "")}</p>
          )}

          {hasDetails && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-2 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {expanded ? "收起详情" : "展开详情"}
            </button>
          )}

          {expanded && hasDetails && (
            <pre className="mt-2 overflow-auto rounded bg-zinc-950 p-2 text-xs text-zinc-100">
              {JSON.stringify(
                { args: event.data.args, result: event.data.result, status: event.data.status },
                null,
                2
              )}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function statusVariant(status: RunRecord["status"]) {
  switch (status) {
    case "finished":
      return "success" as const;
    case "error":
      return "error" as const;
    case "running":
      return "warning" as const;
    default:
      return "secondary" as const;
  }
}

export function RunTimeline({
  record,
  showHeader = true,
}: {
  record: RunRecord;
  showHeader?: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      {showHeader && (
        <div className="border-b border-zinc-200 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">运行 #{record.id.slice(-8)}</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Skill: {record.skillName} · {record.provider}
                {record.model ? ` · ${record.model}` : ""} · {formatDate(record.startedAt)}
              </p>
            </div>
            <Badge variant={statusVariant(record.status)} className="gap-1">
              {record.status === "running" && <Loader2 className="h-3 w-3 animate-spin" />}
              {record.status}
            </Badge>
          </div>
          <div className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm">
            <div className="mb-1 text-xs font-medium text-zinc-500">Prompt</div>
            <p className="whitespace-pre-wrap">{record.prompt}</p>
          </div>
        </div>
      )}

      {record.pipeline && record.pipeline.length > 0 && (
        <AgentPipeline pipeline={record.pipeline} />
      )}

      <RunExplanationPanel record={record} />

      <ScrollArea className="flex-1">
        <div className="space-y-3 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            执行时间线
          </div>
          {record.events.length === 0 && record.status === "running" && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              等待 agent 响应...
            </div>
          )}
          {record.events.map((event) => (
            <EventBlock key={event.id} event={event} />
          ))}
        </div>
      </ScrollArea>

      {record.result && (
        <div className="border-t border-zinc-200 p-4">
          <div className="mb-2 text-sm font-medium">最终结果</div>
          <div
            className={cn(
              "rounded-lg bg-zinc-50 p-3 text-sm whitespace-pre-wrap"
            )}
          >
            {record.result}
          </div>
        </div>
      )}

      {record.error && record.status === "error" && (
        <div className="border-t border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {record.error}
        </div>
      )}
    </div>
  );
}
