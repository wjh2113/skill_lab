import Link from "next/link";
import { listRuns } from "@/lib/agent/store";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

function statusVariant(status: string) {
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

export default async function RunsPage() {
  const runs = await listRuns();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 px-6 py-5">
        <h1 className="text-2xl font-semibold">运行记录</h1>
        <p className="mt-1 text-sm text-zinc-500">历史 agent 运行与调用过程回放</p>
      </header>

      <div className="flex-1 p-6">
        {runs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 py-16 text-center">
            <p className="text-zinc-500">还没有运行记录</p>
            <Link href="/lab" className="mt-4 inline-block text-sm text-violet-600 hover:underline">
              去运行实验室
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Provider</th>
                  <th className="px-4 py-3 font-medium">Skill</th>
                  <th className="px-4 py-3 font-medium">Prompt</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className="border-t border-zinc-200 hover:bg-zinc-50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/runs/${run.id}`}
                        className="font-mono text-violet-600 hover:underline"
                      >
                        {run.id.slice(-8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs">{run.provider}</span>
                      {run.model && (
                        <span className="block text-xs text-zinc-400">{run.model}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{run.skillName}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-zinc-500">
                      {run.prompt}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{formatDate(run.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
