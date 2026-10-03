"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Loader2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PipelineStepExplanation } from "@/components/lab/pipeline-step-explanation";
import type { PipelineStep, PipelineStepStatus } from "@/lib/agent/pipeline-types";

function StepStatusIcon({ status }: { status: PipelineStepStatus }) {
  switch (status) {
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-violet-600" />;
    case "done":
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    case "error":
      return <XCircle className="h-4 w-4 text-red-600" />;
    case "skipped":
      return <Circle className="h-4 w-4 text-zinc-300" />;
    default:
      return <Circle className="h-4 w-4 text-zinc-300" />;
  }
}

function MatchResultsDetail({ details }: { details: Record<string, unknown> }) {
  const results = details.results as Array<{
    name: string;
    scope: string;
    score: number;
    matchedTerms: string[];
  }> | undefined;

  if (!results?.length) return null;

  return (
    <div className="mt-2 space-y-2">
      {results.map((r) => (
        <div key={r.name} className="rounded-md bg-zinc-50 p-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{r.name}</span>
            <span className="text-violet-600">{r.score} 分</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-500"
              style={{ width: `${r.score}%` }}
            />
          </div>
          {r.matchedTerms.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {r.matchedTerms.map((t) => (
                <span
                  key={t}
                  className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ScanDirsDetail({ details }: { details: Record<string, unknown> }) {
  const directories = details.directories as Array<{
    label: string;
    path: string;
    found: string[];
    count: number;
  }> | undefined;

  if (!directories) return null;

  return (
    <div className="mt-2 space-y-2">
      {directories.map((dir) => (
        <div key={dir.path} className="rounded-md bg-zinc-50 p-2 text-xs">
          <div className="font-medium text-zinc-700">{dir.label}</div>
          <div className="mt-0.5 font-mono text-[10px] text-zinc-400">{dir.path}</div>
          <div className="mt-1 text-zinc-500">
            发现 {dir.count} 个 skill：
            {dir.found.length > 0 ? dir.found.join(", ") : "无"}
          </div>
        </div>
      ))}
    </div>
  );
}

function FrontmatterDetail({ details }: { details: Record<string, unknown> }) {
  const skills = details.skills as Array<{
    folder: string;
    frontmatter: { name: string; description: string; disableModelInvocation: boolean };
    lineCount: number;
  }> | undefined;

  if (!skills) return null;

  return (
    <div className="mt-2 space-y-2">
      {skills.map((s) => (
        <div key={s.folder} className="rounded-md bg-zinc-50 p-2 text-xs">
          <div className="font-mono font-medium">{s.folder}/SKILL.md</div>
          <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-zinc-500">
            <span>name:</span>
            <span className="font-mono text-zinc-700">{s.frontmatter.name}</span>
            <span>description:</span>
            <span className="line-clamp-2 text-zinc-700">
              {s.frontmatter.description || "(空)"}
            </span>
            <span>lines:</span>
            <span>{s.lineCount}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadedFilesDetail({ details }: { details: Record<string, unknown> }) {
  const loaded = details.loadedFiles as Array<{ file: string; chars: number }> | undefined;
  if (!loaded) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {loaded.map((f) => (
        <span
          key={f.file}
          className="rounded-md border border-zinc-200 bg-white px-2 py-1 font-mono text-[10px]"
        >
          {f.file} ({f.chars.toLocaleString()} chars)
        </span>
      ))}
    </div>
  );
}

function StepDetails({ step }: { step: PipelineStep }) {
  if (!step.details) return null;

  switch (step.id) {
    case "scan_dirs":
      return <ScanDirsDetail details={step.details} />;
    case "parse_frontmatter":
      return <FrontmatterDetail details={step.details} />;
    case "match_skills":
      return <MatchResultsDetail details={step.details} />;
    case "load_skill_content":
      return <LoadedFilesDetail details={step.details} />;
    default:
      return (
        <pre className="mt-2 overflow-auto rounded bg-zinc-950 p-2 text-[10px] text-zinc-100">
          {JSON.stringify(step.details, null, 2)}
        </pre>
      );
  }
}

function PipelineStepRow({ step, index }: { step: PipelineStep; index: number }) {
  const [expanded, setExpanded] = useState(
    step.status === "running" || step.status === "done"
  );
  const hasDetails = step.details && Object.keys(step.details).length > 0;
  const isActive = step.status === "running";

  return (
    <div className="relative flex gap-3">
      {index > 0 && (
        <div
          className={cn(
            "absolute left-[11px] top-0 h-3 w-0.5 -translate-y-full",
            step.status === "pending" ? "bg-zinc-200" : "bg-violet-300"
          )}
        />
      )}
      <div className="relative z-10 mt-0.5 shrink-0">
        <StepStatusIcon status={step.status} />
      </div>
      <div
        className={cn(
          "min-w-0 flex-1 rounded-lg border p-3 transition-colors",
          isActive
            ? "border-violet-300 bg-violet-50/50"
            : step.status === "done"
              ? "border-zinc-200 bg-white"
              : "border-zinc-100 bg-zinc-50/50"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-400">Step {index + 1}</span>
              <span className="text-sm font-semibold">{step.title}</span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">{step.description}</p>
          </div>
          {hasDetails && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="shrink-0 text-zinc-400 hover:text-zinc-600"
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </div>
        {expanded && hasDetails && <StepDetails step={step} />}
        <PipelineStepExplanation stepId={step.id} />
      </div>
    </div>
  );
}

export function AgentPipeline({ pipeline }: { pipeline: PipelineStep[] }) {
  const doneCount = pipeline.filter((s) => s.status === "done").length;
  const runningStep = pipeline.find((s) => s.status === "running");

  return (
    <div className="border-b border-zinc-200 bg-zinc-50/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Agent 初始化流程</h3>
          <p className="text-xs text-zinc-500">
            {runningStep
              ? `正在执行：${runningStep.title}`
              : `${doneCount}/${pipeline.length} 步已完成`}
            {" · "}
            每步可展开「解释说明」了解 Cursor 真实行为
          </p>
        </div>
        <div className="flex gap-1">
          {pipeline.map((step) => (
            <div
              key={step.id}
              className={cn(
                "h-1.5 w-6 rounded-full transition-colors",
                step.status === "done"
                  ? "bg-emerald-500"
                  : step.status === "running"
                    ? "bg-violet-500 animate-pulse"
                    : step.status === "error"
                      ? "bg-red-500"
                      : "bg-zinc-200"
              )}
              title={step.title}
            />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {pipeline.map((step, i) => (
          <PipelineStepRow key={step.id} step={step} index={i} />
        ))}
      </div>
    </div>
  );
}
