"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Beaker,
  Download,
  FlaskConical,
  GitCompare,
  History,
  Home,
  Network,
  Plus,
  Search,
  Sparkles,
  Split,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Skill 目录", icon: Home },
  { href: "/skills/compare", label: "Skill 对比", icon: GitCompare },
  { href: "/skills/new", label: "创建 Skill", icon: Plus },
  { href: "/skills/import", label: "GitHub 导入", icon: Download },
  { href: "/skills/discover", label: "Skill 发现", icon: Search },
  { href: "/lab", label: "运行实验室", icon: Beaker },
  { href: "/lab/experiment", label: "A/B 实验", icon: Split },
  { href: "/eval", label: "评测套件", icon: FlaskConical },
  { href: "/runs", label: "运行记录", icon: History },
  { href: "/mcp", label: "MCP 联调", icon: Network },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-4">
        <Sparkles className="h-5 w-5 text-violet-600" />
        <div>
          <div className="text-sm font-semibold">Skill Lab</div>
          <div className="text-xs text-zinc-500">研究 Agent Skills</div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
