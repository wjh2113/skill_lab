"use client";

import { ChevronDown, ChevronRight, File, Folder } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { SkillFile } from "@/lib/skills/types";

function FileTreeNode({
  node,
  selectedPath,
  onSelect,
  depth = 0,
}: {
  node: SkillFile;
  selectedPath?: string;
  onSelect: (path: string) => void;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isSelected = node.path === selectedPath;

  if (node.type === "directory") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-sm hover:bg-zinc-100"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <Folder className="h-3.5 w-3.5 text-amber-500" />
          <span>{node.name}</span>
        </button>
        {open &&
          node.children?.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(node.path)}
      className={cn(
        "flex w-full items-center gap-1 rounded px-2 py-1 text-left text-sm hover:bg-zinc-100",
        isSelected && "bg-zinc-100 font-medium"
      )}
      style={{ paddingLeft: `${depth * 12 + 24}px` }}
    >
      <File className="h-3.5 w-3.5 text-zinc-400" />
      <span>{node.name}</span>
    </button>
  );
}

export function FileTree({
  files,
  selectedPath,
  onSelect,
}: {
  files: SkillFile[];
  selectedPath?: string;
  onSelect: (path: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      {files.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
