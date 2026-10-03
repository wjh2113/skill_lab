import Link from "next/link";
import { AlertTriangle, ExternalLink, FolderGit2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SkillSummary } from "@/lib/skills/types";

export function SkillCard({ skill }: { skill: SkillSummary }) {
  return (
    <Link href={`/skills/${encodeURIComponent(skill.id)}`}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{skill.name}</CardTitle>
            <Badge variant={skill.scope === "personal" ? "secondary" : "outline"}>
              {skill.scope === "personal" ? (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" /> 个人
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <FolderGit2 className="h-3 w-3" /> 项目
                </span>
              )}
            </Badge>
          </div>
          <CardDescription className="line-clamp-2">
            {skill.description || "无 description"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
            <span>{skill.lineCount} 行</span>
            {skill.source && (
              <span className="flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                {skill.source.source}
              </span>
            )}
          </div>
          {skill.warnings.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <AlertTriangle className="h-3 w-3" />
              {skill.warnings.length} 个警告
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
