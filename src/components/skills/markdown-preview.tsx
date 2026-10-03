"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function MarkdownPreview({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const isMarkdown = content.endsWith(".md") || content.includes("# ");

  if (!isMarkdown && !content.startsWith("---")) {
    return (
      <pre className={cn("overflow-auto rounded-lg bg-zinc-950 p-4 text-sm text-zinc-100", className)}>
        <code>{content}</code>
      </pre>
    );
  }

  return (
    <article
      className={cn(
        "prose prose-zinc max-w-none prose-pre:bg-zinc-950 prose-pre:text-zinc-100",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  );
}

export function CodePreview({ content, filename }: { content: string; filename: string }) {
  const isMarkdown = filename.endsWith(".md");
  if (isMarkdown) {
    return <MarkdownPreview content={content} className="p-4" />;
  }
  return (
    <pre className="overflow-auto p-4 text-sm">
      <code>{content}</code>
    </pre>
  );
}
