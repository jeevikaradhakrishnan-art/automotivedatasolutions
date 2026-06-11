import { Download, Lock } from "lucide-react";
import type { Job } from "@/store/platform";
import { SOLUTIONS } from "@/data/solutions";

const statusStyle: Record<Job["status"], string> = {
  queued: "border-muted-foreground/30 text-muted-foreground bg-muted/40",
  running: "border-cyan/40 text-cyan bg-cyan/10",
  review: "border-amber/40 text-amber bg-amber/10",
  success: "border-success/40 text-success bg-success/10",
  failed: "border-danger/40 text-danger bg-danger/10",
};
const statusLabel: Record<Job["status"], string> = {
  queued: "QUEUED",
  running: "RUNNING",
  review: "PENDING REVIEW",
  success: "COMPLETED",
  failed: "FAILED",
};

function fmtMs(ms: number) {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const m = Math.floor(ms / 60_000), s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

function fmtRuntime(j: Job) {
  if (j.runtimeMs) return fmtMs(j.runtimeMs);
  if (j.finishedAt && j.startedAt) {
    const ms = new Date(j.finishedAt).getTime() - new Date(j.startedAt).getTime();
    if (ms > 0) return fmtMs(ms);
  }
  if (j.status === "running") return "Running…";
  return "—";
}

const STATUS_PRIORITY: Record<Job["status"], number> = {
  running: 0,
  review:  1,
  success: 2,
  failed:  3,
  queued:  4,
};

export function JobsTable({
  jobs,
  onDownload,
  onAbort,
  onSelect,
  showSolution = false,
}: {
  jobs: Job[];
  onDownload: (j: Job) => void;
  onAbort?: (j: Job) => void;
  onSelect?: (j: Job) => void;
  showSolution?: boolean;
}) {
  const sorted = [...jobs].sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);
  if (jobs.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-md py-10 text-center text-xs text-muted-foreground">
        No jobs yet. Run a workflow from the Workflows tab — each selected source creates its own job.
      </div>
    );
  }
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-surface-elevated/60">
          <tr className="text-left font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            <th className="px-3 py-2">Job</th>
            {showSolution && <th className="px-3 py-2">Solution</th>}
            <th className="px-3 py-2">Workflow · Source</th>
            <th className="px-3 py-2">Started</th>
            <th className="px-3 py-2">Runtime</th>
            <th className="px-3 py-2">Rows</th>
            <th className="px-3 py-2">Review</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Output</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((j) => {
            const sol = SOLUTIONS.find((s) => s.id === j.solutionId);
            const reviewLabel = j.reviewTotal
              ? `${j.reviewApproved ?? 0}/${j.reviewTotal}${j.reviewRejected ? ` · ${j.reviewRejected} rej` : ""}`
              : "—";
            return (
              <tr key={j.id} onClick={() => onSelect?.(j)} className={`border-t border-border hover:bg-surface-elevated/40 ${onSelect ? "cursor-pointer" : ""}`}>
                <td className="px-3 py-2 font-mono">{j.id.slice(0, 8)}</td>
                {showSolution && <td className="px-3 py-2">{sol?.title}</td>}
                <td className="px-3 py-2">
                  <div className="truncate max-w-[260px]">{j.workflow ?? "—"}</div>
                  <div className="text-[10px] font-mono text-muted-foreground truncate max-w-[260px]">{j.source}</div>
                </td>
                <td className="px-3 py-2 font-mono text-muted-foreground">
                  <div>{new Date(j.startedAt).toLocaleDateString()}</div>
                  <div className="text-[10px] opacity-70">{new Date(j.startedAt).toLocaleTimeString()}</div>
                </td>
                <td className="px-3 py-2 font-mono">{fmtRuntime(j)}</td>
                <td className="px-3 py-2 font-mono">{j.rowsProduced ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-[11px]">{reviewLabel}</td>
                <td className="px-3 py-2">
                  <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${statusStyle[j.status]}`}>
                    {statusLabel[j.status]}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  {j.status === "success" && (j.reviewTotal === 0 || (j.reviewApproved ?? 0) > 0) ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDownload(j); }}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[11px] font-mono border border-border hover:border-cyan/30 hover:text-cyan transition"
                    >
                      <Download className="size-3" /> {j.format}
                    </button>
                  ) : j.status === "review" || (j.status === "success" && (j.reviewTotal ?? 0) > 0 && (j.reviewApproved ?? 0) === 0) ? (
                    <span className="inline-flex items-center gap-1 h-7 px-2 rounded text-[10px] font-mono border border-amber/30 text-amber bg-amber/5">
                      <Lock className="size-3" /> LOCKED
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60 text-[11px]">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
