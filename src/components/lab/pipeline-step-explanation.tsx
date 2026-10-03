"use client";

import { BookOpen, ChevronDown, ChevronRight, Info } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { getStepExplanation } from "@/lib/agent/pipeline-explanations";
import type { PipelineStepId } from "@/lib/agent/pipeline-types";

export function PipelineStepExplanation({
  stepId,
  className,
  defaultOpen = false,
}: {
  stepId: PipelineStepId;
  className?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const expl = getStepExplanation(stepId);

  return (
    <div className={cn("mt-2", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <BookOpen className="h-3 w-3" />
        解释说明
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-md border border-violet-100 bg-violet-50/50 p-3 text-xs">
          <ExplanationBlock title="做什么" content={expl.summary} />
          <ExplanationBlock title="Cursor 真实行为" content={expl.cursorBehavior} />
          <ExplanationBlock title="实验室如何展示" content={expl.labBehavior} />
          {expl.tips && expl.tips.length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-1 font-medium text-zinc-600">
                <Info className="h-3 w-3" />
                要点
              </div>
              <ul className="list-inside list-disc space-y-0.5 text-zinc-600">
                {expl.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExplanationBlock({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <div className="mb-0.5 font-medium text-zinc-600">{title}</div>
      <p className="leading-relaxed text-zinc-600">{content}</p>
    </div>
  );
}
