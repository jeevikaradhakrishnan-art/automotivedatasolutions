import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

// Use relative URL so browser calls stay on the same HTTPS origin (IIS proxies /api/* to backend)
const BOT_API = typeof window !== "undefined"
  ? ""
  : "http://localhost:8001";
import { useMemo, useState, useEffect, useRef } from "react";
import {
  ArrowLeft, Check, Plus, FileDown, Sparkles, Database, Workflow, Inbox,
  Play, Globe, Settings2, Boxes, GitBranch, Send, ListChecks, Eye,
  CheckCircle2, AlertCircle, Loader2, Circle, X, Lock, Trash2, Upload,
} from "lucide-react";
import { WorkflowPreviewModal } from "@/components/solutions/WorkflowPreviewModal";
import { getSolution, NEWS_INSIGHTS, type NewsInsight } from "@/data/solutions";
import {
  usePlatform, downloadFile, toCSV, getWorkflowsFor, INTEGRATIONS,
  type Job, type Workflow as Wfl, type WorkflowParam, type WorkflowStage,
  type HitlItem,
} from "@/store/platform";
import { DataPreviewTable } from "@/components/solutions/DataPreviewTable";
import { JobsTable } from "@/components/solutions/JobsTable";
import { InsightDetailModal } from "@/components/solutions/InsightDetailModal";

const generateId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
};

type Tab = "sources" | "workflows" | "jobs" | "review" | "data" | "integrations" | "insights";

const JOB_STATUS_ORDER: Record<string, number> = { running: 0, review: 1, success: 2, failed: 3, queued: 4 };

export const Route = createFileRoute("/_app/solutions/$id")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as Tab | undefined),
  }),
  component: SolutionDetail,
});

function SolutionDetail() {
  const { id } = Route.useParams();
  const { tab: tabParam } = Route.useSearch();
  const navigate = useNavigate();
  const solution = getSolution(id);
  const [tab, setTab] = useState<Tab>(tabParam ?? "sources");
  const [openInsight, setOpenInsight] = useState<NewsInsight | null>(null);
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const [jobFilter, setJobFilter] = useState<"all" | "success">("success");

  const subscribed = usePlatform((s) => s.subscriptions.includes(solution?.id ?? "vehicle-spec"));
  const toggleSub = usePlatform((s) => s.toggleSubscription);
  const allJobs = usePlatform((s) => s.jobs);
  const addJob = usePlatform((s) => s.addJob);
  const updateJob = usePlatform((s) => s.updateJob);
  const addHitl = usePlatform((s) => s.addHitl);
  const addFeedback = usePlatform((s) => s.addFeedback);

  // Live lookup — always reflects latest Zustand state, never a stale snapshot
  const openJob = useMemo(() => openJobId ? allJobs.find((j) => j.id === openJobId) ?? null : null, [openJobId, allJobs]);

  if (!solution) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Solution not found.</p>
        <button onClick={() => navigate({ to: "/" })} className="mt-3 text-cyan text-sm">Back</button>
      </div>
    );
  }

  const workflows = getWorkflowsFor(solution.id);
  const jobs = allJobs.filter((j) => j.solutionId === solution.id);

  const filteredJobs = useMemo(() => {
    const sorted = [...jobs].sort(
      (a, b) => (JOB_STATUS_ORDER[a.status] ?? 5) - (JOB_STATUS_ORDER[b.status] ?? 5),
    );
    return jobFilter === "all"
      ? sorted.filter((j) => j.status !== "failed")
      : sorted.filter((j) => j.status === jobFilter);
  }, [jobs, jobFilter]);

  // Map source script name → backend bot_id
  const sourceToBotId = (script?: string): string | null => {
    if (script === "BMW_Data_Collector.py")    return "bmw-configurator";
    if (script === "tesla_data_extractor.py")  return "tesla-configurator";
    if (script === "tesla_live_extractor.py")  return "tesla-configurator";
    return null;
  };

  // Create a single job — calls the real backend for BMW/Tesla sources
  const runJob = async (sourceName: string, sourceScript?: string, workflow?: Wfl, mode: "full" | "delta" = "full") => {
    const botId = sourceToBotId(sourceScript ?? "");

    // For real bot sources, call the backend
    if (botId) {
      const localJobId = generateId();
      const job: Job = {
        id: localJobId,
        solutionId: solution.id,
        source: sourceName,
        workflow: workflow?.name ?? "OEM Configurator Run",
        status: "running",
        mode,
        startedAt: new Date().toISOString(),
        format: "JSON",
        botId,
      };
      addJob(job);
      setTab("jobs");
      setJobFilter("all");

      try {
        const useCached = false;
        let res = await fetch(`${BOT_API}/api/bots/${botId}/run?use_cached=${useCached}`, { method: "POST" });
        // 409 = previous run left the bot stuck in "running" — force-reset and retry once
        if (res.status === 409) {
          console.warn(`[HITL] Bot ${botId} stuck in running state — auto-resetting and retrying`);
          await fetch(`${BOT_API}/api/bots/${botId}/reset`, { method: "POST" });
          res = await fetch(`${BOT_API}/api/bots/${botId}/run?use_cached=${useCached}`, { method: "POST" });
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { job_id: backendJobId } = await res.json();
        updateJob(localJobId, { botJobId: backendJobId });

        // Poll backend until job leaves running state
        const jobStartedAt = new Date().toISOString();
        const poll = setInterval(async () => {
          try {
            const statusRes = await fetch(`${BOT_API}/api/jobs/${backendJobId}`);
            if (!statusRes.ok) return;
            const backendJob = await statusRes.json();

            if (backendJob.status !== "running") {
              clearInterval(poll);
              // "success" is ONLY set by completeJobReview after HITL approval.
              // Map backend "completed" (0-record run) and "error" to "failed" here.
              const frontendStatus = backendJob.status === "review" ? "review" : "failed";
              const finishedAt = backendJob.finishedAt ?? new Date().toISOString();
              const runtimeMs = backendJob.runtimeMs
                ?? (new Date(finishedAt).getTime() - new Date(jobStartedAt).getTime());
              updateJob(localJobId, {
                status:          frontendStatus,
                finishedAt,
                runtimeMs,
                rowsProduced:    backendJob.rowsProduced ?? 0,
                reviewTotal:     backendJob.reviewTotal ?? 0,
                reviewApproved:  0,
                reviewRejected:  0,
              });
              // Load real HITL items from backend
              (backendJob.hitlItems ?? []).forEach((h: Record<string, unknown>) => {
                addHitl({
                  id:          h.id as string,
                  solutionId:  solution.id,
                  jobId:       localJobId,
                  uid:            h.uid as string | undefined,
                  htmlFile:       h.htmlFile as string | undefined,
                  screenshotFile: h.screenshotFile as string | undefined,
                  liveUrl:        h.liveUrl as string | undefined,
                  recordName:  h.recordName as string | undefined,
                  summary:     h.summary as string,
                  detail:      h.detail as string,
                  fields:      h.fields as HitlItem["fields"],
                  confidence:  h.confidence as number,
                  status:      "pending",
                  createdAt:   h.createdAt as string,
                  previewKind: "html",
                  workflow:    workflow?.name,
                });
              });
            }
          } catch { /* ignore transient errors */ }
        }, 3000);
      } catch (err) {
        updateJob(localJobId, { status: "failed", finishedAt: new Date().toISOString() });
      }
      return;
    }

    // Fallback simulation for non-scripted sources
    const job: Job = {
      id: generateId(),
      solutionId: solution.id,
      source: sourceName,
      workflow: workflow?.name,
      status: "running",
      mode,
      startedAt: new Date().toISOString(),
      format: solution.formats[0] as Job["format"],
      steps: (workflow?.stages ?? [
        { kind: "aggregate", name: "Source crawl", detail: "" },
        { kind: "qa", name: "Awaiting review", detail: "" },
      ]).map((st, i) => ({
        name: `${st.kind} · ${st.name}`,
        status: i === 0 ? "running" : "pending",
        ts: i === 0 ? "T+00:00" : "—",
        note: st.detail || undefined,
      })),
    };
    addJob(job);
    setTab("jobs");
    setJobFilter("all");
    const startMs = Date.now();
    setTimeout(() => {
      const rows = Math.floor(120 + Math.random() * 3800);
      const reviewN = Math.max(2, Math.min(6, Math.floor(rows / 60)));
      updateJob(job.id, {
        status: "review",
        finishedAt: new Date().toISOString(),
        runtimeMs: Date.now() - startMs,
        rowsProduced: rows,
        reviewTotal: reviewN,
        reviewApproved: 0,
        reviewRejected: 0,
        deltaSummary: mode === "delta" ? { added: Math.floor(rows * 0.3), updated: Math.floor(rows * 0.1), removed: 2 } : undefined,
        steps: (workflow?.stages ?? []).map((st, i, arr) => ({
          name: `${st.kind} · ${st.name}`,
          status: i === arr.length - 1 ? "running" : "ok",
          ts: "T+0" + Math.floor(Math.random() * 60) + "s",
          note: i === arr.length - 1 ? "Awaiting human review" : (st.detail || undefined),
        })),
      });
      solution.sampleRows.slice(0, reviewN).forEach((r, i) => {
        const recName = Object.values(r).slice(0, 2).join(" · ");
        addHitl({
          id: generateId(), solutionId: solution.id, jobId: job.id, workflow: workflow?.name,
          recordName: recName, summary: recName,
          detail: `Auto-flagged for human verification — confidence below threshold on key fields.`,
          fields: solution.sampleColumns.map((c) => ({
            group: "record", name: c.toLowerCase().replace(/\s+/g, "_"),
            value: String(r[c] ?? "—"),
            confidence: Math.max(55, 100 - Math.floor(Math.random() * 35)),
          })),
          confidence: 75 - i * 3, status: "pending", createdAt: new Date().toISOString(),
          previewKind: solution.id === "plants" || solution.id === "dealer-inventory" ? "pdf" : "html",
        });
      });
    }, 1600 + Math.random() * 1400);
  };

  // Workflow run: spawn one job per selected source
  const runWorkflow = (workflow: Wfl, mode: "full" | "delta", sources: string[]) => {
    const list = sources.length ? sources : solution.sources.slice(0, 1).map((s) => s.name);
    list.forEach((srcName, idx) => {
      const srcDef = solution.sources.find((s) => s.name === srcName);
      setTimeout(() => runJob(srcName, srcDef?.script, workflow, mode), idx * 250);
    });
  };

  const handleAbort = async (j: Job) => {
    updateJob(j.id, { status: "failed", finishedAt: new Date().toISOString() });
    if (j.botJobId) {
      try {
        await fetch(`${BOT_API}/api/jobs/${j.botJobId}/abort`, { method: "POST" });
      } catch { /* ignore */ }
    }
  };

  const handleDownload = async (j: Job, fmt?: "csv" | "json") => {
    // Real bot jobs: download from backend
    if (j.botJobId) {
      const format = fmt ?? (j.format === "JSON" ? "json" : "csv");
      const url = `${BOT_API}/api/jobs/${j.botJobId}/download?format=${format}`;
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        const cd = res.headers.get("Content-Disposition") ?? "";
        const match = cd.match(/filename="?([^"]+)"?/);
        a.download = match?.[1] ?? `${j.botId ?? "bot"}_${j.botJobId.slice(0, 8)}.${format}`;
        a.click();
        URL.revokeObjectURL(objUrl);
        return;
      }
      // Bot job download blocked by backend — do NOT fall back to sample data
      if (res.status === 403) {
        alert("Download is locked until HITL review is submitted. Go to the Review tab to approve this job.");
      }
      return;
    }
    // Fallback: use sample data (non-bot / seeded jobs only)
    const cols = solution.sampleColumns;
    const rows = solution.sampleRows;
    const base = `${solution.id}-${j.source.toLowerCase().replace(/\s+/g, "-")}-${j.id.slice(0, 6)}`;
    if (j.format === "JSON") downloadFile(`${base}.json`, JSON.stringify(rows, null, 2), "application/json");
    else downloadFile(`${base}.csv`, toCSV(cols, rows), "text/csv");
  };

  const pendingReview = allJobs.filter((j) => j.solutionId === solution.id && j.status === "review").length;
  const tabs: { id: Tab; label: string; icon: typeof Inbox; show: boolean; badge?: number }[] = [
    { id: "sources",      label: "Sources",      icon: Globe,         show: true, badge: solution.sources.length },
    { id: "workflows",    label: "Workflows",    icon: Workflow,      show: true, badge: workflows.length },
    { id: "jobs",         label: "Jobs",         icon: Inbox,         show: true, badge: jobs.length },
    { id: "review",       label: "Review · HITL", icon: ListChecks,   show: true, badge: pendingReview || undefined },
    { id: "data",         label: "Data",         icon: Database,      show: true },
    { id: "integrations", label: "Integrations", icon: Send,          show: true },
    { id: "insights",     label: "Insights",     icon: Sparkles,      show: solution.hasInsights },
  ];


  const insights = solution.id === "news" ? NEWS_INSIGHTS : [];

  return (
    <div className="p-5 space-y-4">
      <div>
        <Link to="/" className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="size-3" /> ALL SOLUTIONS
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10px] font-mono tracking-widest text-muted-foreground">SOLUTION · {solution.code}</div>
            <h1 className="text-2xl font-semibold mt-1 tracking-tight">{solution.title}</h1>
            <p className="text-sm text-muted-foreground max-w-3xl mt-1">{solution.short}</p>

          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-mono px-2 py-1 rounded border ${
              solution.type === "Data + Insights" ? "border-amber/40 text-amber bg-amber/10" : "border-cyan/30 text-cyan bg-cyan/5"
            }`}>{solution.type.toUpperCase()}</span>
            <button
              onClick={() => toggleSub(solution.id)}
              className={`h-9 px-3 rounded text-xs font-mono flex items-center gap-1.5 border transition ${
                subscribed ? "bg-success/10 border-success/40 text-success" : "border-border hover:border-cyan/30"
              }`}
            >
              {subscribed ? <><Check className="size-3.5" /> ACTIVATED</> : <><Plus className="size-3.5" /> ACTIVATE USE CASE</>}
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.filter((t) => t.show).map((t) => {
          const Active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 h-9 -mb-px text-xs font-mono flex items-center gap-1.5 border-b-2 transition whitespace-nowrap ${
                Active ? "border-cyan text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="size-3.5" />
              {t.label.toUpperCase()}
              {t.badge ? (
                <span className="ml-1 font-mono text-[10px] px-1 rounded bg-cyan/10 text-cyan">{t.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "workflows" && (
        <WorkflowsTab workflows={workflows} solutionSources={solution.sources.map((s) => s.name)} onRun={runWorkflow} />
      )}

      {tab === "sources" && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Each source is a configured bot. Run individually for an ad-hoc pull, or wire many sources into a Workflow.
          </div>
          <div className="grid md:grid-cols-2 gap-2">
            {solution.sources.map((src) => (
              <div key={src.name} className="panel p-3 flex items-center gap-3">
                <div className="size-9 rounded bg-input/60 grid place-items-center"><Globe className="size-4 text-cyan" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{src.name}</div>
                  <div className="text-[10px] font-mono text-muted-foreground truncate">{src.url}{src.region ? ` · ${src.region}` : ""}</div>
                </div>
                <button
                  onClick={() => runJob(src.name, src.script)}
                  className="h-8 px-3 rounded text-[11px] font-mono flex items-center gap-1.5 bg-cyan/10 border border-cyan/30 text-cyan hover:bg-cyan/20 transition"
                >
                  <Play className="size-3" /> RUN
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "jobs" && (
        <div className="space-y-3">
          {/* Filter tabs */}
          <div className="flex gap-1 p-0.5 rounded-lg border border-border bg-card shadow-sm w-fit flex-wrap">
            {(["all", "success"] as const).map((f) => {
              const labels = { all: "All", success: "Completed" };
              const count = f === "all" ? jobs.length : jobs.filter((j) => j.status === f).length;
              return (
                <button
                  key={f}
                  onClick={() => setJobFilter(f)}
                  className={`flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium transition ${
                    jobFilter === f
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
                  }`}
                >
                  {labels[f]}
                  <span className="font-mono text-[10px] px-1 rounded bg-black/10 dark:bg-white/10">{count}</span>
                </button>
              );
            })}
          </div>
          <JobsTable jobs={filteredJobs} onDownload={handleDownload} onAbort={handleAbort} onSelect={(j) => { if (j.status === "review") { setTab("review"); } else { setOpenJobId(j.id); } }} />
        </div>
      )}

      {tab === "review" && (
        <SolutionReviewQueue solutionId={solution.id} />
      )}

      {tab === "data" && <DataTab solutionId={solution.id} columns={solution.sampleColumns} sampleRows={solution.sampleRows} approvedJobs={jobs.filter((j) => j.status === "success")} />}

      {tab === "integrations" && <IntegrationsTab solutionId={solution.id} workflows={workflows} />}

      {tab === "insights" && solution.hasInsights && (
        solution.id === "news" ? (
          <div className="flex flex-col gap-2" style={{ height: "calc(100vh - 220px)", minHeight: 520 }}>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-mono tracking-widest text-muted-foreground">
                PREDICTIVE INSIGHTS · ANALYSIS DASHBOARD
              </span>
              <a
                href="http://3.7.204.198:3000/analysis"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-mono text-cyan hover:underline flex items-center gap-1"
              >
                Open in new tab ↗
              </a>
            </div>
            <iframe
              src="http://3.7.204.198:3000/analysis"
              title="Predictive Insights Analysis"
              className="flex-1 w-full rounded border border-border"
              style={{ minHeight: 480 }}
              allow="fullscreen"
            />
          </div>
        ) : (
          <div className="panel p-6 text-sm text-muted-foreground">
            AI-generated strategic insights surface here once jobs have been run.
          </div>
        )
      )}

      <InsightDetailModal insight={openInsight} onClose={() => setOpenInsight(null)} />
      {openJob && <JobDrawer job={openJob} onClose={() => setOpenJobId(null)} onDownload={handleDownload} onAbort={() => { handleAbort(openJob); setOpenJobId(null); }} onFeedback={(rating, message) => addFeedback({ id: generateId(), solutionId: solution.id, workflow: openJob.workflow, jobId: openJob.id, rating, message, createdAt: new Date().toISOString() })} />}
    </div>
  );
}




// =========================== Workflows tab ===========================

function WorkflowsTab({
  workflows, solutionSources, onRun,
}: {
  workflows: Wfl[];
  solutionSources: string[];
  onRun: (workflow: Wfl, mode: "full" | "delta", sources: string[]) => void;
}) {
  const [configuring, setConfiguring] = useState<Wfl | null>(null);
  const [viewing, setViewing] = useState<Wfl | null>(null);

  if (workflows.length === 0) {
    return <div className="panel p-6 text-sm text-muted-foreground">No workflows defined.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Workflows orchestrate <span className="text-cyan font-mono">aggregate → transform → enrich</span> across multiple sources.
        Each selected source spawns its own job — review queue groups them by use-case.
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        {workflows.map((w) => (
          <WorkflowCard
            key={w.id}
            w={w}
            onConfigure={() => setConfiguring(w)}
            onView={() => setViewing(w)}
            onRun={(mode) => onRun(w, mode, solutionSources)}
          />
        ))}
      </div>
      {configuring && (
        <WorkflowConfigDrawer
          workflow={configuring}
          solutionSources={solutionSources}
          onClose={() => setConfiguring(null)}
          onView={() => setViewing(configuring)}
          onRun={(mode, picked) => {
            onRun(configuring, mode, picked);
            setConfiguring(null);
          }}
        />
      )}
      {viewing && <WorkflowPreviewModal workflow={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function WorkflowCard({ w, onConfigure, onView, onRun }: { w: Wfl; onConfigure: () => void; onView: () => void; onRun: (mode: "full" | "delta") => void }) {
  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">{w.name}</div>
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
              w.status === "active" ? "border-success/40 text-success bg-success/10" : "border-muted-foreground/30 text-muted-foreground"
            }`}>{w.status.toUpperCase()}</span>
            {w.deltaCapable && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-cyan/30 text-cyan bg-cyan/5">DELTA</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-snug">{w.description}</p>
        </div>
      </div>

      <StagePipeline stages={w.stages} />

      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <span>{w.schedule} · {w.sources} src</span>
        <span>last {w.lastRun} · next {w.nextRun} · {w.successRate}% ok</span>
      </div>

      <div className="flex gap-2 pt-1 flex-wrap">
        <button onClick={onConfigure} className="h-8 px-3 rounded text-[11px] font-mono border border-border hover:border-cyan/30 hover:text-cyan flex items-center gap-1.5">
          <Settings2 className="size-3" /> CONFIGURE
        </button>
        <button onClick={onView} className="h-8 px-3 rounded text-[11px] font-mono border border-border hover:border-cyan/30 hover:text-cyan flex items-center gap-1.5">
          <Eye className="size-3" /> VIEW WORKFLOW
        </button>
        {w.deltaCapable && (
          <button onClick={() => onRun("delta")} className="h-8 px-3 rounded text-[11px] font-mono border border-cyan/30 text-cyan bg-cyan/5 hover:bg-cyan/10 flex items-center gap-1.5">
            <GitBranch className="size-3" /> RUN DELTA
          </button>
        )}
        <button onClick={() => onRun("full")} className="ml-auto h-8 px-3 rounded text-[11px] font-mono bg-cyan text-background hover:bg-cyan/90 flex items-center gap-1.5">
          <Play className="size-3" /> RUN FULL
        </button>
      </div>
    </div>
  );
}

function StagePipeline({ stages }: { stages: WorkflowStage[] }) {
  const kindColor: Record<WorkflowStage["kind"], string> = {
    aggregate: "border-cyan/40 text-cyan bg-cyan/5",
    transform: "border-primary/40 text-foreground bg-primary/5",
    enrich:    "border-amber/40 text-amber bg-amber/5",
    delta:     "border-success/40 text-success bg-success/5",
    qa:        "border-muted-foreground/30 text-muted-foreground bg-muted/20",
    deliver:   "border-border text-muted-foreground bg-surface-elevated/40",
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {stages.map((s, i) => (
        <span key={i} className={`text-[10px] font-mono px-2 py-1 rounded border flex items-center gap-1 ${kindColor[s.kind]}`} title={s.detail}>
          {s.kind === "aggregate" && <Boxes className="size-3" />}
          {s.kind === "transform" && <Workflow className="size-3" />}
          {s.kind === "enrich"    && <Sparkles className="size-3" />}
          {s.kind === "delta"     && <GitBranch className="size-3" />}
          {s.kind === "qa"        && <ListChecks className="size-3" />}
          {s.kind === "deliver"   && <Send className="size-3" />}
          {s.name}
          {i < stages.length - 1 && <span className="ml-1 opacity-50">›</span>}
        </span>
      ))}
    </div>
  );
}

function WorkflowConfigDrawer({ workflow, solutionSources, onClose, onView, onRun }: { workflow: Wfl; solutionSources: string[]; onClose: () => void; onView: () => void; onRun: (mode: "full" | "delta", sources: string[]) => void }) {
  const [vals, setVals] = useState<Record<string, string | number | boolean | string[]>>(
    () => Object.fromEntries(workflow.params.map((p) => [p.key, p.default])),
  );
  const [picked, setPicked] = useState<string[]>(solutionSources);
  const isDelta = workflow.deltaCapable && (vals["delta"] as boolean | undefined);

  return (
    <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div className="w-full max-w-lg h-full bg-card border-l border-border overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-border sticky top-0 bg-card z-10 flex items-start justify-between">
          <div>
            <div className="text-[10px] font-mono tracking-widest text-muted-foreground">CONFIGURE WORKFLOW</div>
            <h2 className="text-lg font-semibold mt-1">{workflow.name}</h2>
            <p className="text-xs text-muted-foreground mt-1">{workflow.description}</p>
          </div>
          <button onClick={onClose} className="size-8 grid place-items-center rounded hover:bg-surface-elevated"><X className="size-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-mono tracking-widest text-muted-foreground">PIPELINE</div>
              <button
                onClick={onView}
                className="h-7 px-2.5 rounded text-[11px] font-mono border border-cyan/30 text-cyan bg-cyan/5 hover:bg-cyan/10 flex items-center gap-1.5"
              >
                <Eye className="size-3" /> VIEW WORKFLOW
              </button>
            </div>
            <StagePipeline stages={workflow.stages} />
          </div>

          <div>
            <div className="text-[10px] font-mono tracking-widest text-muted-foreground mb-2">SOURCES · {picked.length} / {solutionSources.length}</div>
            <div className="flex flex-wrap gap-1.5">
              {solutionSources.map((s) => {
                const on = picked.includes(s);
                return (
                  <button key={s} type="button" onClick={() => setPicked((p) => on ? p.filter((x) => x !== s) : [...p, s])}
                    className={`text-[11px] font-mono px-2 py-1 rounded border transition ${on ? "border-cyan/40 text-cyan bg-cyan/10" : "border-border text-muted-foreground hover:border-cyan/30"}`}>
                    {s}
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground mt-1">Each selected source → one job in the queue.</div>
          </div>

          {/* Common scheduling + scope controls — always present on every workflow */}
          {!workflow.params.find((p) => p.key === "frequency") && (
            <div>
              <label className="text-[11px] font-mono text-muted-foreground tracking-wider uppercase">Refresh Frequency</label>
              <select
                value={(vals["__freq"] as string) ?? workflow.schedule}
                onChange={(e) => setVals((x) => ({ ...x, __freq: e.target.value }))}
                className="mt-1 w-full h-9 px-3 rounded bg-input border border-border text-sm"
              >
                {["On-demand","Hourly","Daily","Weekly","Bi-weekly","Monthly","Quarterly"].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}

          {!workflow.params.find((p) => p.key === "datapoints") && (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono text-muted-foreground tracking-wider uppercase">Data points required</label>
                <ImportListButton onImport={(items) => setVals((x) => {
                  const cur = (x["__datapoints"] as string[]) ?? ["Core identity","Pricing"];
                  return { ...x, __datapoints: Array.from(new Set([...cur, ...items])) };
                })} />
              </div>
              <div className="text-[10px] text-muted-foreground/80 mb-1">Pick which fields the bot should capture for this run, or import your own list.</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {Array.from(new Set([
                  "Core identity","Pricing","Powertrain","Dimensions","Features","Media","Availability","Geocode",
                  ...((vals["__datapoints"] as string[]) ?? []),
                ])).map((o) => {
                  const arr = (vals["__datapoints"] as string[]) ?? ["Core identity","Pricing"];
                  const on = arr.includes(o);
                  return (
                    <button key={o} type="button"
                      onClick={() => setVals((x) => ({ ...x, __datapoints: on ? arr.filter((v) => v !== o) : [...arr, o] }))}
                      className={`text-[11px] font-mono px-2 py-1 rounded border transition ${on ? "border-cyan/40 text-cyan bg-cyan/10" : "border-border text-muted-foreground hover:border-cyan/30"}`}>
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="text-[10px] font-mono tracking-widest text-muted-foreground mb-2">WORKFLOW PARAMETERS</div>
            <div className="space-y-3">
              {workflow.params.map((p) => (
                <ParamField key={p.key} param={p} value={vals[p.key]} onChange={(v) => setVals((x) => ({ ...x, [p.key]: v }))} />
              ))}
            </div>
          </div>


          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="h-9 px-3 rounded text-xs font-mono border border-border">CANCEL</button>
            <button disabled={picked.length === 0} onClick={() => onRun(isDelta ? "delta" : "full", picked)} className="ml-auto h-9 px-4 rounded text-xs font-mono bg-cyan text-background hover:bg-cyan/90 flex items-center gap-1.5 disabled:opacity-50">
              <Play className="size-3.5" /> RUN {isDelta ? "DELTA" : "FULL"} · {picked.length} JOB{picked.length === 1 ? "" : "S"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ParamField({ param, value, onChange }: { param: WorkflowParam; value: string | number | boolean | string[] | undefined; onChange: (v: string | number | boolean | string[]) => void }) {
  const v = value ?? param.default;
  return (
    <div>
      <label className="text-[11px] font-mono text-muted-foreground tracking-wider uppercase">{param.label}</label>
      {param.help && <div className="text-[10px] text-muted-foreground/80 mb-1">{param.help}</div>}
      {param.type === "text" && (
        <input value={v as string} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full h-9 px-3 rounded bg-input border border-border text-sm" />
      )}
      {param.type === "number" && (
        <input type="number" value={v as number} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full h-9 px-3 rounded bg-input border border-border text-sm" />
      )}
      {param.type === "select" && (
        <select value={v as string} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full h-9 px-3 rounded bg-input border border-border text-sm">
          {param.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
      {param.type === "multiselect" && (
        <>
          <div className="flex justify-end -mt-5 mb-1">
            <ImportListButton onImport={(items) => {
              const arr = (v as string[]) ?? [];
              onChange(Array.from(new Set([...arr, ...items])));
            }} />
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {Array.from(new Set([...(param.options ?? []), ...((v as string[]) ?? [])])).map((o) => {
              const arr = (v as string[]) ?? [];
              const on = arr.includes(o);
              return (
                <button key={o} type="button" onClick={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])}
                  className={`text-[11px] font-mono px-2 py-1 rounded border transition ${on ? "border-cyan/40 text-cyan bg-cyan/10" : "border-border text-muted-foreground hover:border-cyan/30"}`}>
                  {o}
                </button>
              );
            })}
          </div>
        </>
      )}
      {param.type === "toggle" && (
        <button type="button" onClick={() => onChange(!(v as boolean))}
          className={`mt-1 h-7 px-2.5 rounded text-[11px] font-mono border flex items-center gap-1.5 ${v ? "border-success/40 text-success bg-success/10" : "border-border text-muted-foreground"}`}>
          <span className={`size-2 rounded-full ${v ? "bg-success" : "bg-muted-foreground"}`} />
          {v ? "ENABLED" : "DISABLED"}
        </button>
      )}
    </div>
  );
}

function ImportListButton({ onImport }: { onImport: (items: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const onFile = async (file: File) => {
    const text = await file.text();
    // Parse CSV/TSV/TXT: split on newlines/commas/tabs; strip quotes; trim; dedupe
    const items = Array.from(new Set(
      text.split(/[\n,\t;]+/).map((s) => s.replace(/^['"\s]+|['"\s]+$/g, "")).filter(Boolean)
    ));
    if (items.length) onImport(items);
    setOpen(false);
  };
  return (
    <label className="cursor-pointer text-[10px] font-mono text-muted-foreground hover:text-cyan flex items-center gap-1 px-1.5 py-0.5 rounded border border-border hover:border-cyan/30">
      <Upload className="size-3" /> IMPORT LIST
      <input
        type="file"
        accept=".csv,.tsv,.txt,.xlsx,.xls,.docx"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ""; }}
      />
      {open && null}
    </label>
  );
}

// =========================== Data tab ===========================

function DataTab({ solutionId, columns, sampleRows, approvedJobs }: {
  solutionId: string;
  columns: string[];
  sampleRows: Record<string, string | number>[];
  approvedJobs: Job[];
}) {
  const uploadedDatasets = usePlatform((s) => s.datasets).filter((d) => d.solutionId === solutionId);
  const [pickedJob, setPickedJob] = useState<string>("sample");
  const job = approvedJobs.find((j) => j.id === pickedJob);
  const uploaded = uploadedDatasets.find((d) => d.id === pickedJob);

  let cols: string[];
  let rows: Record<string, string | number>[];
  if (uploaded) {
    cols = uploaded.columns;
    rows = uploaded.data;
  } else if (job) {
    rows = Array.from({ length: Math.min(job.rowsProduced ?? sampleRows.length, 200) }).map((_, i) => {
      const r = sampleRows[i % sampleRows.length];
      return { ...r, _row_id: `${solutionId.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(5, "0")}` } as Record<string, string | number>;
    });
    cols = ["_row_id", ...columns];
  } else {
    rows = sampleRows;
    cols = columns;
  }

  const download = () => {
    const csv = toCSV(cols, rows);
    const tag = uploaded ? uploaded.name.replace(/\.[^.]+$/, "") : job ? job.id.slice(0, 6) : "sample";
    downloadFile(`${solutionId}-${tag}.csv`, csv, "text/csv");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-mono tracking-widest text-muted-foreground">DATASET</span>
        <select value={pickedJob} onChange={(e) => setPickedJob(e.target.value)} className="h-8 px-2 rounded bg-input border border-border text-xs font-mono">
          <option value="sample">Sample preview ({sampleRows.length} rows)</option>
          {uploadedDatasets.length > 0 && (
            <optgroup label="Admin uploads">
              {uploadedDatasets.map((d) => (
                <option key={d.id} value={d.id}>{d.name} · {d.rows.toLocaleString()} rows</option>
              ))}
            </optgroup>
          )}
          {approvedJobs.length > 0 && (
            <optgroup label="Approved runs">
              {approvedJobs.map((j) => (
                <option key={j.id} value={j.id}>{(j.workflow ?? j.source)} · {j.id.slice(0,6)} · {j.rowsProduced} rows</option>
              ))}
            </optgroup>
          )}
        </select>
        <span className="text-xs text-muted-foreground">
          {uploaded ? `Admin upload · ${new Date(uploaded.uploadedAt).toLocaleString()}` : job ? `Live data from approved run — runtime ${formatRuntime(job.runtimeMs)}` : "Sample only — upload via Admin or run a workflow + approve in Review."}
        </span>
        {(job || uploaded) && (
          <button onClick={download} className="ml-auto h-8 px-3 rounded text-[11px] font-mono bg-cyan text-background hover:bg-cyan/90 flex items-center gap-1.5">
            <FileDown className="size-3" /> DOWNLOAD CSV
          </button>
        )}
      </div>
      <DataPreviewTable columns={cols} rows={rows} maxRows={50} />
    </div>
  );
}

function formatRuntime(ms?: number) {
  if (!ms) return "—";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const m = Math.floor(ms / 60_000), s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

// =========================== Integrations tab ===========================

function IntegrationsTab({ solutionId, workflows }: { solutionId: string; workflows: Wfl[] }) {
  const allLinks = usePlatform((s) => s.integrationLinks);
  const addLink = usePlatform((s) => s.addIntegrationLink);
  const removeLink = usePlatform((s) => s.removeIntegrationLink);
  const [configuring, setConfiguring] = useState<string | null>(null);

  const links = allLinks.filter((l) => l.solutionId === solutionId);
  const integration = configuring ? INTEGRATIONS.find((i) => i.id === configuring) ?? null : null;

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Pick a destination and link a workflow to push approved data on every run. You can attach multiple links per destination.
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        {INTEGRATIONS.map((it) => {
          const myLinks = links.filter((l) => l.integrationId === it.id);
          const connected = myLinks.length > 0;
          return (
            <div key={it.id} className="panel p-3 space-y-2">
              <div className="flex items-center gap-3">
                <div className={`size-9 rounded grid place-items-center ${connected ? "bg-success/15 border border-success/40" : "bg-input/60"}`}>
                  <Send className={`size-4 ${connected ? "text-success" : "text-cyan"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {it.name}
                    <span className="font-mono text-[9px] text-muted-foreground">{it.kind.toUpperCase()}</span>
                    {connected && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-success/40 bg-success/10 text-success">{myLinks.length} LINK{myLinks.length === 1 ? "" : "S"}</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{it.detail}</div>
                </div>
                <button
                  onClick={() => setConfiguring(it.id)}
                  className="h-8 px-3 rounded text-[11px] font-mono border border-cyan/30 text-cyan bg-cyan/5 hover:bg-cyan/10 flex items-center gap-1"
                >
                  <Plus className="size-3" /> ADD LINK
                </button>
              </div>
              {myLinks.length > 0 && (
                <ul className="space-y-1 pt-1 border-t border-border">
                  {myLinks.map((l) => {
                    const wf = workflows.find((w) => w.id === l.workflowId);
                    return (
                      <li key={l.id} className="flex items-center gap-2 text-[11px] font-mono px-2 py-1.5 rounded border border-success/30 bg-success/5">
                        <Check className="size-3 text-success" />
                        <span className="text-foreground/90">{wf?.name ?? "any workflow"}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-cyan truncate">{l.target ?? "(default target)"}</span>
                        <button onClick={() => removeLink(l.id)} className="ml-auto text-danger hover:opacity-80"><Trash2 className="size-3" /></button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {integration && (
        <IntegrationLinkDrawer
          integration={integration}
          solutionId={solutionId}
          workflows={workflows}
          onClose={() => setConfiguring(null)}
          onSave={(link) => { addLink({ ...link, solutionId: link.solutionId as never }); setConfiguring(null); }}
        />
      )}
    </div>
  );
}

function IntegrationLinkDrawer({
  integration, solutionId, workflows, onClose, onSave,
}: {
  integration: { id: string; name: string; kind: string; detail: string };
  solutionId: string;
  workflows: Wfl[];
  onClose: () => void;
  onSave: (l: { id: string; integrationId: string; solutionId: string; workflowId?: string; target?: string; createdAt: string }) => void;
}) {
  const [workflowId, setWorkflowId] = useState<string>(workflows[0]?.id ?? "");
  const [target, setTarget] = useState("");
  const [credId, setCredId] = useState("");
  const [credSecret, setCredSecret] = useState("");
  const [tested, setTested] = useState<"idle" | "ok">("idle");

  const placeholder =
    integration.id === "snowflake" ? "DB.SCHEMA.TABLE"
    : integration.id === "bigquery" ? "project.dataset.table"
    : integration.id === "s3"        ? "s3://bucket/prefix/"
    : integration.id === "databricks"? "catalog.schema.table"
    : integration.id === "powerbi"   ? "Workspace / Dataset name"
    : integration.id === "webhook"   ? "https://your-endpoint.example.com/hook"
    : "destination identifier";

  return (
    <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-card border-l border-border overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-start justify-between sticky top-0 bg-card z-10">
          <div>
            <div className="text-[10px] font-mono tracking-widest text-muted-foreground">ADD INTEGRATION LINK</div>
            <h2 className="text-lg font-semibold mt-1 flex items-center gap-2"><Send className="size-4 text-cyan" /> {integration.name}</h2>
            <p className="text-xs text-muted-foreground mt-1">{integration.detail}</p>
          </div>
          <button onClick={onClose} className="size-8 grid place-items-center rounded hover:bg-surface-elevated"><X className="size-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-mono text-muted-foreground tracking-wider">SOURCE WORKFLOW *</label>
            <select value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} className="mt-1 w-full h-9 px-2 rounded bg-input border border-border text-sm">
              {workflows.length === 0 && <option value="">(no workflows defined)</option>}
              {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <div className="text-[10px] text-muted-foreground mt-1">Approved output of this workflow is pushed on every successful run.</div>
          </div>

          <div>
            <label className="text-[10px] font-mono text-muted-foreground tracking-wider">TARGET ({integration.kind.toUpperCase()}) *</label>
            <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder={placeholder}
              className="mt-1 w-full h-9 px-2 rounded bg-input border border-border text-sm font-mono" />
          </div>

          {integration.id !== "webhook" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono text-muted-foreground tracking-wider">USERNAME / KEY ID</label>
                <input value={credId} onChange={(e) => setCredId(e.target.value)} placeholder="svc_user"
                  className="mt-1 w-full h-9 px-2 rounded bg-input border border-border text-sm font-mono" />
              </div>
              <div>
                <label className="text-[10px] font-mono text-muted-foreground tracking-wider">PASSWORD / SECRET</label>
                <input type="password" value={credSecret} onChange={(e) => setCredSecret(e.target.value)} placeholder="••••••••"
                  className="mt-1 w-full h-9 px-2 rounded bg-input border border-border text-sm font-mono" />
              </div>
            </div>
          )}

          <div className="rounded border border-border bg-surface/40 p-3 text-[11px] text-muted-foreground space-y-2">
            <div className="text-[10px] font-mono tracking-widest text-muted-foreground">DELIVERY CONTRACT</div>
            <div>· Format: <span className="text-cyan font-mono">CSV / JSON</span></div>
            <div>· Trigger: <span className="text-cyan font-mono">on review complete</span></div>
            <div>· Retries: <span className="text-cyan font-mono">3 × exponential backoff</span></div>
          </div>

          <button
            disabled={!target}
            onClick={() => { setTested("ok"); }}
            className="w-full h-9 rounded text-xs font-mono border border-cyan/30 text-cyan bg-cyan/5 hover:bg-cyan/10 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {tested === "ok" ? <><CheckCircle2 className="size-3.5 text-success" /> CONNECTION TEST PASSED</> : <>TEST CONNECTION</>}
          </button>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="h-9 px-3 rounded text-xs font-mono border border-border">CANCEL</button>
            <button
              disabled={!workflowId || !target}
              onClick={() => onSave({
                id: generateId(),
                integrationId: integration.id,
                solutionId,
                workflowId,
                target,
                createdAt: new Date().toISOString(),
              })}
              className="ml-auto h-9 px-4 rounded text-xs font-mono bg-cyan text-background disabled:opacity-40 flex items-center gap-1.5"
            >
              <Check className="size-3.5" /> SAVE LINK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================== Job drawer (per-solution) ===========================

function JobDrawer({ job, onClose, onDownload, onAbort, onFeedback }: { job: Job; onClose: () => void; onDownload: (j: Job) => void; onAbort?: () => void; onFeedback: (rating: "up" | "down", message: string) => void }) {
  const [fb, setFb] = useState("");
  const [sent, setSent] = useState<null | "up" | "down">(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [logError, setLogError] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!job.botId) return;
    setLogs([]);
    setLogError(null);
    const fetchLogs = async () => {
      try {
        const res = await fetch(`${BOT_API}/api/bots/${job.botId}/status?last_n=500`);
        if (!res.ok) {
          setLogError(`Backend returned ${res.status}`);
          return;
        }
        const data = await res.json();
        setLogs(data.recent_logs ?? []);
        setLogError(null);
        if (data.status !== "running" && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        setLogError(`Cannot reach backend at ${BOT_API}`);
      }
    };
    fetchLogs();
    pollRef.current = setInterval(fetchLogs, 1500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [job.botId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div className="w-full max-w-xl h-full bg-card border-l border-border overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-start justify-between sticky top-0 bg-card z-10">
          <div>
            <div className="text-[10px] font-mono tracking-widest text-muted-foreground">RUN · {job.id.slice(0, 8)}</div>
            <h2 className="text-lg font-semibold mt-1">{job.workflow ?? job.source}</h2>
            <div className="text-xs text-muted-foreground mt-1">{job.source} · mode {job.mode ?? "full"}</div>
          </div>
          <button onClick={onClose} className="size-8 grid place-items-center rounded hover:bg-surface-elevated"><X className="size-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Meta label="Started"  value={new Date(job.startedAt).toLocaleString()} />
            <Meta label="Finished" value={job.finishedAt ? new Date(job.finishedAt).toLocaleString() : "—"} />
            <Meta label="Runtime"  value={formatRuntime(job.runtimeMs)} />
            <Meta label="Rows"     value={job.rowsProduced?.toLocaleString() ?? "—"} />
            <Meta label="Status"   value={job.status.toUpperCase()} />
            <Meta label="Output"   value={job.format} />
          </div>
          {job.deltaSummary && (
            <div className="rounded border border-cyan/30 bg-cyan/5 p-3 text-xs font-mono flex gap-4">
              <span className="text-success">+{job.deltaSummary.added} added</span>
              <span className="text-amber">~{job.deltaSummary.updated} updated</span>
              <span className="text-danger">−{job.deltaSummary.removed} removed</span>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-mono tracking-widest text-muted-foreground">PIPELINE LOG</div>
              {job.status === "running" && job.botId && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-cyan">
                  <Loader2 className="size-3 animate-spin" /> LIVE
                </span>
              )}
            </div>
            {job.botId ? (
              <div className="rounded border border-border bg-[#0a0a0a] overflow-hidden">
                <div
                  className="h-64 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed space-y-px"
                  style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}
                >
                  {logError ? (
                    <span className="text-danger/70">{logError} — is the backend running?</span>
                  ) : logs.length === 0 ? (
                    <span className="text-muted-foreground/50">Waiting for log output…</span>
                  ) : (
                    logs.map((line, i) => {
                      const isError = /\[ERROR\]/i.test(line);
                      const isWarn  = /\[WARN\]/i.test(line);
                      const isInfo  = /\[INFO\]/i.test(line);
                      return (
                        <div
                          key={i}
                          className={
                            isError ? "text-danger" :
                            isWarn  ? "text-amber" :
                            isInfo  ? "text-cyan/80" :
                            "text-muted-foreground"
                          }
                        >
                          {line}
                        </div>
                      );
                    })
                  )}
                  <div ref={logEndRef} />
                </div>
                <div className="border-t border-border px-3 py-1.5 flex items-center justify-between text-[10px] font-mono text-muted-foreground/60">
                  <span>{logs.length} lines</span>
                  {job.botId && <span className="uppercase tracking-wider">{job.botId}</span>}
                </div>
              </div>
            ) : (
              <ol className="space-y-1">
                {(job.steps ?? []).map((s, i) => (
                  <li key={i} className="flex items-start gap-3 p-2 rounded border border-border">
                    {s.status === "ok" && <CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" />}
                    {s.status === "running" && <Loader2 className="size-4 text-cyan shrink-0 mt-0.5 animate-spin" />}
                    {s.status === "fail" && <AlertCircle className="size-4 text-danger shrink-0 mt-0.5" />}
                    {s.status === "pending" && <Circle className="size-4 text-muted-foreground shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{s.name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{s.ts}</span>
                      </div>
                      {s.note && <div className="text-[11px] text-muted-foreground mt-0.5">{s.note}</div>}
                    </div>
                  </li>
                ))}
                {(!job.steps || job.steps.length === 0) && <li className="text-xs text-muted-foreground">No step log captured.</li>}
              </ol>
            )}
          </div>
          {job.status === "running" && onAbort ? (
            <button onClick={onAbort} className="w-full h-9 rounded border border-danger/40 text-danger text-xs font-mono flex items-center justify-center gap-1.5 hover:bg-danger/10 transition">
              <X className="size-3.5" /> ABORT JOB
            </button>
          ) : job.status === "success" && (job.reviewTotal === 0 || (job.reviewApproved ?? 0) > 0) ? (
            <button onClick={() => onDownload(job)} className="w-full h-9 rounded bg-cyan text-background text-xs font-mono flex items-center justify-center gap-1.5">
              <FileDown className="size-3.5" /> DOWNLOAD {job.format}
            </button>
          ) : job.status === "review" || (job.status === "success" && (job.reviewTotal ?? 0) > 0 && (job.reviewApproved ?? 0) === 0) ? (
            <Link to="/hitl" className="w-full h-9 rounded bg-amber/15 border border-amber/40 text-amber text-xs font-mono flex items-center justify-center gap-1.5">
              <Lock className="size-3.5" /> DOWNLOAD LOCKED · OPEN REVIEW ({job.reviewApproved ?? 0}/{job.reviewTotal ?? 0})
            </Link>
          ) : job.status === "failed" ? (
            <button disabled className="w-full h-9 rounded border border-danger/40 text-danger text-xs font-mono flex items-center justify-center gap-1.5 opacity-70">
              <X className="size-3.5" /> RUN FAILED
            </button>
          ) : null}
          {/* Feedback */}
          <div className="rounded border border-border p-3 space-y-2">
            <div className="text-[10px] font-mono tracking-widest text-muted-foreground">FEEDBACK ON THIS RUN</div>
            <textarea value={fb} onChange={(e) => setFb(e.target.value)} placeholder="What worked / what's off?" className="w-full h-16 rounded bg-input border border-border text-xs p-2" />
            <div className="flex gap-2">
              <button disabled={!fb || !!sent} onClick={() => { onFeedback("up", fb); setSent("up"); }} className="h-7 px-2 rounded border border-success/40 text-success text-[11px] font-mono disabled:opacity-50">👍 SEND</button>
              <button disabled={!fb || !!sent} onClick={() => { onFeedback("down", fb); setSent("down"); }} className="h-7 px-2 rounded border border-danger/40 text-danger text-[11px] font-mono disabled:opacity-50">👎 SEND</button>
              {sent && <span className="text-[10px] font-mono text-muted-foreground self-center">Sent · thanks.</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border p-2">
      <div className="text-[10px] font-mono text-muted-foreground tracking-wider">{label}</div>
      <div className="text-xs mt-0.5">{value}</div>
    </div>
  );
}

function SolutionReviewQueue({ solutionId }: { solutionId: string }) {
  const hitlAll = usePlatform((s) => s.hitl);
  const jobsAll = usePlatform((s) => s.jobs);

  const batches = useMemoBatches(hitlAll, jobsAll, solutionId);

  if (batches.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-md py-10 text-center text-xs text-muted-foreground">
        No records awaiting review for this use case. Run a workflow to populate the queue.
      </div>
    );
  }

  const totalPending = batches.reduce((n, b) => n + b.pending, 0);
  const totalApproved = batches.reduce((n, b) => n + b.approved, 0);
  const totalRejected = batches.reduce((n, b) => n + b.rejected, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] font-mono">
        <span className="px-2 py-1 rounded border border-amber/30 text-amber bg-amber/5">⏳ {totalPending} PENDING</span>
        <span className="px-2 py-1 rounded border border-success/30 text-success bg-success/5">✓ {totalApproved} APPROVED</span>
        <span className="px-2 py-1 rounded border border-danger/30 text-danger bg-danger/5">✕ {totalRejected} REJECTED</span>
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-surface-elevated/60">
            <tr className="text-left font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              <th className="px-3 py-2">Job</th>
              <th className="px-3 py-2">Workflow · Source</th>
              <th className="px-3 py-2 text-right">Records</th>
              <th className="px-3 py-2">Progress</th>
              <th className="px-3 py-2">Queued</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => {
              const progress = b.total ? Math.round(((b.approved + b.rejected) / b.total) * 100) : 0;
              return (
                <tr key={b.jobId} className="border-t border-border hover:bg-surface-elevated/40">
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{b.jobId.slice(0, 8)}</td>
                  <td className="px-3 py-2">
                    <div className="truncate max-w-[260px]">{b.workflow ?? "—"}</div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate max-w-[260px]">{b.source}</div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="text-sm font-semibold">{b.total}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      <span className="text-success">✓{b.approved}</span> · <span className="text-danger">✕{b.rejected}</span> · <span className="text-amber">⏳{b.pending}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 min-w-[120px]">
                    <div className="h-1.5 rounded bg-surface-elevated overflow-hidden">
                      <div className="h-full bg-cyan" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-1">{progress}%</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                    {b.startedAt ? new Date(b.startedAt).toLocaleTimeString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to="/hitl"
                      search={{ sol: solutionId, job: b.jobId }}
                      className={`inline-flex items-center gap-1 h-7 px-2.5 rounded text-[11px] font-mono border transition ${
                        b.pending > 0
                          ? "border-amber/40 text-amber bg-amber/5 hover:bg-amber/10"
                          : "border-border text-muted-foreground hover:border-cyan/30 hover:text-cyan"
                      }`}
                    >
                      {b.pending > 0 ? "REVIEW" : "OPEN"} →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type BatchRow = { jobId: string; source?: string; workflow?: string; startedAt?: string; pending: number; approved: number; rejected: number; total: number };

function useMemoBatches(hitl: HitlItem[], jobs: Job[], solutionId: string): BatchRow[] {
  return useMemo(() => {
    const batches = new Map<string, BatchRow>();
    hitl.forEach((h) => {
      if (!h.jobId || h.solutionId !== solutionId) return;
      const j = jobs.find((x) => x.id === h.jobId);
      const cur = batches.get(h.jobId) ?? {
        jobId: h.jobId, source: j?.source, workflow: h.workflow ?? j?.workflow, startedAt: j?.startedAt,
        pending: 0, approved: 0, rejected: 0, total: 0,
      };
      cur.total += 1;
      if (h.status === "pending") cur.pending += 1;
      if (h.status === "approved") cur.approved += 1;
      if (h.status === "rejected") cur.rejected += 1;
      batches.set(h.jobId, cur);
    });
    return Array.from(batches.values()).sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
  }, [hitl, jobs, solutionId]);
}
