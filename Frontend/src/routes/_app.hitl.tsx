import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

const BOT_API = typeof window !== "undefined"
  ? ""
  : "http://localhost:8001";
import { useMemo, useState, useEffect, useRef, useCallback, memo } from "react";
import {
  Check, X, ClipboardCheck, Filter, FileText, Globe, Camera,
  ChevronLeft, ChevronRight, Info, Search, SkipForward, ArrowRight, Layers, Lock,
  ZoomIn, ZoomOut, Languages, Plus, MessageSquare, Sparkles, Keyboard,
  Activity, Gauge, ChevronDown, MapPin, Save, Circle, MousePointerClick,
} from "lucide-react";
import { usePlatform, type HitlItem, type HitlField, type HitlStatus, type Job } from "@/store/platform";
import { SOLUTIONS, getSolution } from "@/data/solutions";

type HitlSearch = { sol?: string; job?: string };

export const Route = createFileRoute("/_app/hitl")({
  validateSearch: (s: Record<string, unknown>): HitlSearch => ({
    sol: typeof s.sol === "string" ? s.sol : undefined,
    job: typeof s.job === "string" ? s.job : undefined,
  }),
  component: HitlPage,
});



function HitlPage() {
  const search = Route.useSearch();
  const hitl = usePlatform((s) => s.hitl);
  const jobs = usePlatform((s) => s.jobs);
  const resolve = usePlatform((s) => s.resolveHitl);
  const completeReview = usePlatform((s) => s.completeJobReview);
  const addFeedback = usePlatform((s) => s.addFeedback);

  const [solFilter, setSolFilter] = useState<string>(search.sol ?? "all");
  const [formatFilter, setFormatFilter] = useState<"all" | "html" | "pdf">("all");
  const [openJobId, setOpenJobId] = useState<string | null>(search.job ?? null);

  // Build batches grouped by jobId (review-stage jobs only)
  const batches = useMemo(() => {
    const map = new Map<string, { job: Job; items: HitlItem[]; previewKind: "html" | "pdf" | "screenshot" }>();
    hitl.forEach((h) => {
      if (!h.jobId) return;
      const found = jobs.find((j) => j.id === h.jobId);
      // If job no longer in store (e.g. seed hitl with legacy job IDs), create a placeholder so items remain reviewable
      const job: Job = found ?? {
        id: h.jobId,
        solutionId: h.solutionId ?? "unknown",
        source: h.workflow ?? "Archived job",
        workflow: h.workflow ?? "—",
        status: "review" as const,
        startedAt: h.createdAt ?? new Date().toISOString(),
        finishedAt: h.createdAt,
        format: "CSV" as const,
        rowsProduced: 0,
        reviewTotal: 0,
        reviewApproved: 0,
        reviewRejected: 0,
        runtimeMs: 0,
        mode: "delta" as const,
        steps: [],
      };
      const cur = map.get(h.jobId) ?? { job, items: [], previewKind: h.previewKind ?? "html" };
      cur.items.push(h);
      map.set(h.jobId, cur);
    });
    return Array.from(map.values())
      .filter((b) => solFilter === "all" || b.job.solutionId === solFilter)
      .filter((b) => formatFilter === "all" || b.previewKind === formatFilter)
      .sort((a, b) => new Date(b.job.startedAt).getTime() - new Date(a.job.startedAt).getTime());
  }, [hitl, jobs, solFilter, formatFilter]);

  const openBatch = openJobId ? batches.find((b) => b.job.id === openJobId) : null;

  if (openBatch) {
    return (
      <ValidationScreen
        job={openBatch.job}
        items={openBatch.items}
        previewKind={openBatch.previewKind}
        onBack={() => setOpenJobId(null)}
        onResolve={(id, status) => {
          resolve(id, status);
          // Also tell the backend if this is a real bot job
          const backendJobId = openBatch.job.botJobId;
          if (backendJobId) {
            fetch(`${BOT_API}/api/jobs/${backendJobId}/hitl/${id}?status=${status}`, { method: "PATCH" }).catch(() => {});
          }
        }}
        onComplete={() => {
          completeReview(openBatch.job.id);
          const backendJobId = openBatch.job.botJobId;
          if (backendJobId) {
            fetch(`${BOT_API}/api/jobs/${backendJobId}/submit-review`, { method: "POST" }).catch(() => {});
          }
        }}
        onFeedback={(rating, message) =>
          addFeedback({ id: crypto.randomUUID(), solutionId: openBatch.job.solutionId, workflow: openBatch.job.workflow, jobId: openBatch.job.id, rating, message, createdAt: new Date().toISOString() })
        }
      />
    );
  }

  // ---- Batch landing ----
  const pendingTotal = batches.reduce((n, b) => n + b.items.filter((i) => i.status === "pending").length, 0);
  const approvedTotal = batches.reduce((n, b) => n + b.items.filter((i) => i.status === "approved").length, 0);
  const rejectedTotal = batches.reduce((n, b) => n + b.items.filter((i) => i.status === "rejected").length, 0);

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] font-mono tracking-widest text-muted-foreground">XDAS · REVIEW · HITL</div>
          <h1 className="text-2xl font-semibold mt-1 tracking-tight flex items-center gap-2">
            <ClipboardCheck className="size-5 text-amber" /> Review Queue
          </h1>
          <p className="text-sm text-muted-foreground">
            Each card below is a <span className="text-cyan font-mono">job batch</span> awaiting human verification.
            Pick a batch tagged for the use case you own, validate record-by-record, then approve to unlock downloads.
          </p>
        </div>
        <div className="flex gap-2 text-[11px] font-mono">
          <Stat label="PENDING RECORDS"  value={pendingTotal} tone="amber" />
          <Stat label="APPROVED RECORDS" value={approvedTotal} tone="success" />
          <Stat label="REJECTED RECORDS" value={rejectedTotal} tone="danger" />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Filter className="size-3 text-muted-foreground" />
          <select value={solFilter} onChange={(e) => setSolFilter(e.target.value)} className="h-8 px-2 rounded bg-input border border-border text-xs">
            <option value="all">All use cases</option>
            {SOLUTIONS.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
          <select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value as "all" | "html" | "pdf")} className="h-8 px-2 rounded bg-input border border-border text-xs font-mono">
            <option value="all">All formats</option>
            <option value="html">HTML only</option>
            <option value="pdf">PDF only</option>
          </select>
        </div>
        <div className="ml-auto text-[10px] font-mono text-muted-foreground">{batches.length} BATCH{batches.length === 1 ? "" : "ES"}</div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface-elevated/60 text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Job</th>
                <th className="text-left px-3 py-2 font-medium">Workflow · Tag</th>
                <th className="text-left px-3 py-2 font-medium">Use Case</th>
                <th className="text-left px-3 py-2 font-medium">Source</th>
                <th className="text-right px-3 py-2 font-medium">Records</th>
                <th className="text-left px-3 py-2 font-medium">Progress</th>
                <th className="text-left px-3 py-2 font-medium">Validator</th>
                <th className="text-left px-3 py-2 font-medium">Queued</th>
                <th className="text-right px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b, i) => {
                const sol = getSolution(b.job.solutionId);
                const pending = b.items.filter((x) => x.status === "pending").length;
                const approved = b.items.filter((x) => x.status === "approved").length;
                const rejected = b.items.filter((x) => x.status === "rejected").length;
                const total = b.items.length;
                const progress = total ? Math.round(((approved + rejected) / total) * 100) : 0;
                const validators = ["E. Mercer","A. Kohli","R. Vega","S. Park","M. Chen"];
                const validator = validators[i % validators.length];
                const tag = pending > 0 ? `${pending} PENDING` : (progress === 100 ? "COMPLETE" : "IN-REVIEW");
                const tagTone = pending > 0 ? "border-amber/30 text-amber bg-amber/5" : (progress === 100 ? "border-success/30 text-success bg-success/5" : "border-cyan/30 text-cyan bg-cyan/5");
                return (
                  <tr key={b.job.id} onClick={() => setOpenJobId(b.job.id)}
                    className="border-t border-border hover:bg-surface-elevated/40 cursor-pointer transition">
                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{b.job.id}</td>
                    <td className="px-3 py-2.5">
                      <div className="text-sm font-medium">{b.job.workflow ?? sol?.title}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${tagTone}`}>{tag}</span>
                        <FormatTag kind={b.previewKind} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><UseCaseTag solId={b.job.solutionId} /></td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground truncate max-w-[160px]">{b.job.source}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-sm font-semibold">{total}</span>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        <span className="text-success">✓{approved}</span> · <span className="text-danger">✕{rejected}</span> · <span className="text-amber">⏳{pending}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 min-w-[120px]">
                      <div className="h-1.5 rounded bg-surface-elevated overflow-hidden">
                        <div className="h-full bg-cyan" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-1">{progress}%</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="size-5 rounded-full bg-cyan/20 border border-cyan/30 grid place-items-center text-[9px] font-mono text-cyan">
                          {validator.split(" ").map((p) => p[0]).join("")}
                        </span>
                        <span className="text-[11px] font-mono">{validator}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{timeAgo(b.job.startedAt)}</td>
                    <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2 justify-end">
                        <Link
                          to="/solutions/$id"
                          params={{ id: b.job.solutionId }}
                          search={{ tab: "jobs" }}
                          className="h-7 px-2 rounded text-[10px] font-mono border border-border text-muted-foreground hover:border-cyan/30 hover:text-cyan flex items-center gap-1 transition"
                          title="Go to Jobs page of this solution"
                        >
                          JOBS <ArrowRight className="size-2.5" />
                        </Link>
                        <button
                          onClick={() => setOpenJobId(b.job.id)}
                          className="h-7 px-2.5 rounded text-[10px] font-mono border border-cyan/40 text-cyan bg-cyan/5 hover:bg-cyan/10 flex items-center gap-1 transition"
                        >
                          {pending > 0 ? "REVIEW" : "OPEN"} <ArrowRight className="size-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {batches.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-12 text-center text-sm text-muted-foreground">
                  No jobs awaiting review. Run a workflow from a solution to populate the queue.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===================== Validation screen (LHS preview, RHS fields) =====================

function ValidationScreen({
  job, items, previewKind, onBack, onResolve, onComplete, onFeedback,
}: {
  job: Job;
  items: HitlItem[];
  previewKind: "html" | "pdf" | "screenshot";
  onBack: () => void;
  onResolve: (id: string, status: HitlStatus) => void;
  onComplete: () => void;
  onFeedback: (rating: "up" | "down", message: string) => void;
}) {
  const sol = getSolution(job.solutionId);
  void sol;
  const navigate = useNavigate();
  const [idx, setIdx] = useState<number>(() => {
    const firstPending = items.findIndex((i) => i.status === "pending");
    return firstPending === -1 ? 0 : firstPending;
  });
  const [confidenceFilter, setConfidenceFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [fieldQuery, setFieldQuery] = useState("");
  const [feedback, setFeedback] = useState("");
  const [sent, setSent] = useState(false);

  // Premium UI state
  const [zoom, setZoom] = useState(100);
  const [lhsSearch, setLhsSearch] = useState("");
  const [view, setView] = useState<"html" | "pdf" | "screenshot">(previewKind);
  const [language, setLanguage] = useState<"original" | "translated">("original");
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [openComment, setOpenComment] = useState<string | null>(null);
  const [extraFields, setExtraFields] = useState<{ name: string; value: string; group: string }[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [manualAnnot, setManualAnnot] = useState<Record<string, true>>({});
  const [confOverride, setConfOverride] = useState<Record<string, "high" | "medium" | "low">>({});
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; text: string; editable?: boolean } | null>(null);
  const [ctxQuery, setCtxQuery] = useState("");
  const [auditLog, setAuditLog] = useState<{ at: string; msg: string; tone: "cyan" | "success" | "danger" | "amber" }[]>(
    () => [{ at: new Date().toISOString(), msg: `Batch opened · ${items.length} records loaded from ${job.source}`, tone: "cyan" }]
  );
  const lhsRef = useRef<HTMLDivElement>(null);
  // Holds the actual iframe element for bot HTML items (set by BotHtmlViewer)
  const [botIframeEl, setBotIframeEl] = useState<HTMLIFrameElement | null>(null);

  const item = items[idx];
  const allFields = useMemo(() => {
    const base = (item.fields ?? []).map((f) => ({ ...f, value: edits[`${item.id}:${f.name}`] ?? f.value }));
    const extras = extraFields.map((e) => ({
      name: e.name,
      value: edits[`${item.id}:${e.name}`] ?? e.value,
      group: e.group,
      confidence: 100,
    }));
    return [...base, ...extras];
  }, [item, edits, extraFields]);

  const pushAudit = useCallback((msg: string, tone: "cyan" | "success" | "danger" | "amber" = "cyan") => {
    setAuditLog((l) => [{ at: new Date().toISOString(), msg, tone }, ...l].slice(0, 40));
  }, []);

  // Listen for postMessages from bot HTML iframe (annotation, dismiss, hover)
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "ANNOTATE_SELECTION") {
        const rect = botIframeEl?.getBoundingClientRect();
        setCtxMenu({
          x: (rect?.left ?? 0) + (e.data.x ?? 0),
          y: (rect?.top ?? 0) + (e.data.y ?? 0),
          text: e.data.text ?? "",
        });
        setCtxQuery("");
      }
      if (e.data.type === "IFRAME_CLICK") setCtxMenu(null);
      if (e.data.type === "FIELD_HOVER" && e.data.field) setSelectedField(e.data.field as string);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [botIframeEl]);

  // Sync selected field to iframe whenever it changes
  useEffect(() => {
    botIframeEl?.contentWindow?.postMessage({ type: "SELECT_FIELD", field: selectedField }, "*");
  }, [selectedField, botIframeEl]);

  const goNext = useCallback(() => setIdx((i) => Math.min(i + 1, items.length - 1)), [items.length]);
  const goPrev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  const handleApprove = useCallback(() => {
    onResolve(item.id, "approved");
    pushAudit(`Approved · ${item.recordName}`, "success");
    if (idx < items.length - 1) goNext();
  }, [item, idx, items.length, onResolve, pushAudit, goNext]);
  const handleReject = useCallback(() => {
    onResolve(item.id, "rejected");
    pushAudit(`Rejected · ${item.recordName}`, "danger");
    if (idx < items.length - 1) goNext();
  }, [item, idx, items.length, onResolve, pushAudit, goNext]);
  const handleSkip = useCallback(() => { pushAudit(`Skipped · ${item.recordName}`, "amber"); goNext(); }, [item, pushAudit, goNext]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "a" || e.key === "A") handleApprove();
      else if (e.key === "r" || e.key === "R") handleReject();
      else if (e.key === "s" || e.key === "S") handleSkip();
      else if (e.key === "ArrowRight" || e.key === "j") goNext();
      else if (e.key === "ArrowLeft" || e.key === "k") goPrev();
      else if (e.key === "?") setShowShortcuts((v) => !v);
      else if (e.key === "Escape") { setSelectedField(null); setShowShortcuts(false); setCtxMenu(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleApprove, handleReject, handleSkip, goNext, goPrev]);

  const pendingLeft = items.filter((i) => i.status === "pending").length;
  const approved = items.filter((i) => i.status === "approved").length;
  const rejected = items.filter((i) => i.status === "rejected").length;
  const completionPct = Math.round(((approved + rejected) / items.length) * 100);

  const confTier = (c: number) => (c >= 90 ? "high" : c >= 75 ? "medium" : "low");
  const tierOf = (f: { name: string; confidence: number }) =>
    confOverride[`${item.id}:${f.name}`] ?? confTier(f.confidence);
  const filtered = allFields
    .filter((f) => confidenceFilter === "all" || tierOf(f) === confidenceFilter)
    .filter((f) => !fieldQuery || f.name.toLowerCase().includes(fieldQuery.toLowerCase()) || f.value.toLowerCase().includes(fieldQuery.toLowerCase()));

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach((f) => {
      const key = f.group ?? "fields";
      const arr = map.get(key) ?? [];
      arr.push(f);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const dist = useMemo(() => {
    const h = allFields.filter((f) => tierOf(f) === "high").length;
    const m = allFields.filter((f) => tierOf(f) === "medium").length;
    const l = allFields.filter((f) => tierOf(f) === "low").length;
    const avg = allFields.length ? Math.round(allFields.reduce((s, f) => s + f.confidence, 0) / allFields.length) : 0;
    return { h, m, l, avg };
  }, [allFields]);

  const handleSelectField = (name: string) => {
    setSelectedField(name);
    pushAudit(`Located "${name}" on source`, "cyan");
    if (botIframeEl) {
      // Iframe case: postMessage tells the injected script to scroll + pulse
      botIframeEl.contentWindow?.postMessage({ type: "SCROLL_TO_FIELD", field: name }, "*");
    } else {
      // Synthetic HTML case: scroll in the parent DOM tree
      requestAnimationFrame(() => {
        const el = lhsRef.current?.querySelector(`[data-field="${CSS.escape(name)}"]`);
        if (el && "scrollIntoView" in el) (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  };

  const handleEdit = (fname: string, val: string) => {
    setEdits((e) => ({ ...e, [`${item.id}:${fname}`]: val }));
    // Also reflect change directly in extraFields so custom attributes update immediately
    setExtraFields((arr) => arr.some((x) => x.name === fname) ? arr.map((x) => x.name === fname ? { ...x, value: val } : x) : arr);
  };

  // View is locked to the source's native format (news=HTML, OEM/spec=HTML or PDF per record)
  void setView;

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-surface/40 via-background to-surface/20 relative">
      {/* Sticky top toolbar */}
      <div className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-xl px-4 py-2.5 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => navigate({ to: "/solutions/$id", params: { id: job.solutionId }, search: { tab: "review" } as Record<string, string> })}
          className="h-8 px-2.5 rounded-md text-[11px] font-mono border border-border hover:border-cyan/40 hover:bg-cyan/5 flex items-center gap-1 transition"
        >
          <ChevronLeft className="size-3" /> BATCHES
        </button>
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <UseCaseTag solId={job.solutionId} />
          <FormatTag kind={view} />
          <span className="text-muted-foreground">·</span>
          <span className="font-semibold text-foreground truncate max-w-[280px]">{item.recordName ?? item.summary}</span>
        </div>

        <div className="hidden md:flex items-center gap-2 ml-2">
          <div className="w-40 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan via-success to-success transition-all" style={{ width: `${completionPct}%` }} />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">{completionPct}% · {approved + rejected}/{items.length}</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => setShowShortcuts((v) => !v)} className="h-8 w-8 grid place-items-center rounded-md border border-border hover:border-cyan/30 transition" title="Keyboard shortcuts (?)">
            <Keyboard className="size-3.5" />
          </button>
          <div className="h-6 w-px bg-border mx-1" />
          <span className="text-[10px] font-mono text-muted-foreground">REC</span>
          <button onClick={goPrev} disabled={idx === 0} className="size-7 rounded-md border border-border grid place-items-center disabled:opacity-40 hover:border-cyan/30 transition"><ChevronLeft className="size-3" /></button>
          <span className="font-mono text-[11px] tabular-nums px-1">{idx + 1} / {items.length}</span>
          <button onClick={goNext} disabled={idx === items.length - 1} className="size-7 rounded-md border border-border grid place-items-center disabled:opacity-40 hover:border-cyan/30 transition"><ChevronRight className="size-3" /></button>
        </div>
      </div>

      {/* Two-panel: LHS preview, RHS fields */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-0 flex-1 min-h-[600px]">
        {/* ============ LHS ============ */}
        <div className="border-r border-border bg-surface/20 flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-border flex items-center gap-1.5 bg-card/60 backdrop-blur flex-wrap">
            <div className="flex items-center rounded-md border border-border px-2 h-7 text-[10px] font-mono">
              {view === "pdf"
                ? <span className="text-amber flex items-center gap-1"><FileText className="size-3" /> PDF</span>
                : <span className="text-cyan flex items-center gap-1"><Globe className="size-3" /> HTML</span>}
            </div>
            <div className="flex items-center rounded-md border border-border">
              <button onClick={() => setZoom((z) => Math.max(60, z - 10))} className="h-7 w-7 grid place-items-center hover:bg-surface-elevated transition"><ZoomOut className="size-3" /></button>
              <span className="text-[10px] font-mono px-1 tabular-nums w-10 text-center">{zoom}%</span>
              <button onClick={() => setZoom((z) => Math.min(160, z + 10))} className="h-7 w-7 grid place-items-center hover:bg-surface-elevated transition"><ZoomIn className="size-3" /></button>
            </div>
            {view === "pdf" && (
              <div className="flex items-center rounded-md border border-border">
                <button disabled className="h-7 w-7 grid place-items-center opacity-40"><ChevronLeft className="size-3" /></button>
                <span className="text-[10px] font-mono px-1">P 1/1</span>
                <button disabled className="h-7 w-7 grid place-items-center opacity-40"><ChevronRight className="size-3" /></button>
              </div>
            )}
            <div className="relative flex-1 min-w-[140px] max-w-[200px]">
              <Search className="size-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={lhsSearch}
                onChange={(e) => setLhsSearch(e.target.value)}
                placeholder="Find on source…"
                className="w-full h-7 pl-7 pr-2 rounded-md bg-input border border-border text-[11px] font-mono focus:border-cyan/40 outline-none transition"
              />
            </div>
            <button onClick={() => setLanguage((l) => l === "original" ? "translated" : "original")} className={`h-7 px-2 rounded-md text-[10px] font-mono border flex items-center gap-1 transition ${language === "translated" ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-border hover:border-cyan/30"}`}>
              <Languages className="size-3" /> {language === "original" ? "EN" : "↔ EN"}
            </button>
            <span className="ml-auto text-[10px] font-mono text-muted-foreground truncate max-w-[160px]">{item.recordName}.{view}</span>
          </div>


          {/* Compact legend bar (inline, doesn't overlap source) */}
          <div className="px-3 py-1.5 border-b border-border bg-card/40 flex items-center gap-2 text-[9px] font-mono flex-wrap">
            <span className="px-1.5 py-0.5 rounded bg-success/15 border border-success/40 text-success">● SELECTED</span>
            <span className="px-1.5 py-0.5 rounded bg-amber/15 border border-amber/40 text-amber">● AUTO-EXTRACTED</span>
            <span className="px-1.5 py-0.5 rounded bg-card border border-border text-muted-foreground flex items-center gap-1"><MousePointerClick className="size-2.5" /> RIGHT-CLICK ANY TEXT TO MANUALLY ANNOTATE</span>
          </div>

          <div
            className="flex-1 overflow-y-auto bg-[linear-gradient(135deg,oklch(0.96_0.005_220),oklch(0.97_0.008_180))] p-4 relative"
            ref={lhsRef}
            onContextMenu={(e) => {
              e.preventDefault();
              const sel = window.getSelection?.();
              const selectedText = sel?.toString().trim() ?? "";
              // Fallback: use the clicked element's text content if nothing is selected
              const clickedText = (e.target as HTMLElement).textContent?.trim() ?? "";
              const text = selectedText || clickedText;
              setCtxQuery("");
              setCtxMenu({ x: e.clientX, y: e.clientY, text, editable: !text });
            }}
          >
            <div style={{ zoom: (item.liveUrl || item.htmlFile || item.screenshotFile) ? undefined : `${zoom}%` }} className="transition-all">
              {(item.htmlFile && !item.htmlFile.startsWith("http")) && view === "html" ? (
                <BotHtmlViewer
                  key={item.id}
                  item={item}
                  allFields={allFields}
                  selectedField={selectedField}
                  onIframe={setBotIframeEl}
                />
              ) : item.screenshotFile && view === "html" ? (
                <ScreenshotViewer item={item} zoom={zoom} />
              ) : item.liveUrl && view === "html" ? (
                <BotHtmlViewer
                  key={item.id}
                  item={item}
                  allFields={allFields}
                  selectedField={selectedField}
                  onIframe={setBotIframeEl}
                />
              ) : (
                <SourceWithHighlights
                  solutionId={job.solutionId}
                  item={item}
                  view={view}
                  selectedField={selectedField}
                  search={lhsSearch}
                  language={language}
                />
              )}
            </div>
            {language === "translated" && (
              <div className="mt-4 p-3 rounded-lg border border-cyan/30 bg-cyan/5 text-[11px] font-mono text-cyan">
                <Languages className="size-3 inline mr-1" /> Translated view · auto-detected source language: Mandarin · structured values normalized to English on the right.
              </div>
            )}
          </div>
        </div>

        {/* ============ RHS ============ */}
        <div className="flex flex-col bg-card min-h-0">
          <div className="px-3 py-2 border-b border-border bg-card/80 backdrop-blur space-y-2 sticky top-0 z-10">
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles className="size-3.5 text-cyan" />
              <span className="text-[11px] font-semibold tracking-wide">Extracted attributes</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan/10 border border-cyan/30 text-cyan">{allFields.length} FIELDS</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                item.confidence >= 90 ? "bg-success/10 border-success/30 text-success"
                : item.confidence >= 75 ? "bg-amber/10 border-amber/30 text-amber"
                : "bg-danger/10 border-danger/30 text-danger"
              }`}>
                AI {item.confidence}%
              </span>
              <button
                onClick={() => {
                  const name = prompt("New attribute name?");
                  if (!name) return;
                  const value = prompt("Value?") ?? "";
                  const group = prompt("Group?", "custom") ?? "custom";
                  setExtraFields((f) => [...f, { name, value, group }]);
                  pushAudit(`Added attribute "${name}"`, "cyan");
                }}
                className="ml-auto h-7 px-2 rounded-md text-[10px] font-mono border border-cyan/30 text-cyan hover:bg-cyan/10 flex items-center gap-1 transition"
                title="Add attribute"
              >
                <Plus className="size-3" /> ADD
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex-1 relative">
                <Search className="size-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={fieldQuery}
                  onChange={(e) => setFieldQuery(e.target.value)}
                  placeholder="Search attribute name or value…"
                  className="w-full h-7 pl-7 pr-2 rounded-md bg-input border border-border text-[11px] font-mono focus:border-cyan/40 outline-none transition"
                />
              </div>
              <select
                value={confidenceFilter}
                onChange={(e) => setConfidenceFilter(e.target.value as "all" | "high" | "medium" | "low")}
                title="Filter by confidence"
                className={`h-7 px-2 rounded-md border text-[10px] font-mono font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-cyan/40 transition ${
                  confidenceFilter === "high"   ? "bg-success/15 border-success/40 text-success" :
                  confidenceFilter === "medium" ? "bg-amber/15 border-amber/40 text-amber" :
                  confidenceFilter === "low"    ? "bg-danger/15 border-danger/40 text-danger" :
                                                  "bg-cyan/10 border-cyan/30 text-cyan"
                }`}
              >
                <option value="all">● ALL · {allFields.length}</option>
                <option value="high">● HIGH CONFIDENCE · {dist.h}</option>
                <option value="medium">● MEDIUM CONFIDENCE · {dist.m}</option>
                <option value="low">● LOW CONFIDENCE · {dist.l}</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {grouped.map(([group, fields]) => {
              const isCollapsed = collapsed[group];
              const groupAvg = Math.round(fields.reduce((s, f) => s + f.confidence, 0) / fields.length);
              return (
                <div key={group} className="rounded-xl border border-border bg-gradient-to-b from-surface/30 to-surface-elevated/10 backdrop-blur-sm shadow-sm overflow-hidden">
                  <button
                    onClick={() => setCollapsed((c) => ({ ...c, [group]: !c[group] }))}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-elevated/40 transition"
                  >
                    <ChevronDown className={`size-3 text-muted-foreground transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                    <span className="text-[10px] font-semibold text-cyan tracking-widest uppercase">{group}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{fields.length}</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <Gauge className="size-3 text-muted-foreground" />
                      <span className={`text-[10px] font-mono ${groupAvg >= 90 ? "text-success" : groupAvg >= 75 ? "text-amber" : "text-danger"}`}>{groupAvg}% avg</span>
                    </div>
                  </button>
                  {!isCollapsed && (
                    <div className="px-2 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {fields.map((f) => {
                        const cKeyTier = `${item.id}:${f.name}`;
                        const tier = confOverride[cKeyTier] ?? confTier(f.confidence);
                        const ring = tier === "high" ? "border-l-success" : tier === "medium" ? "border-l-amber" : "border-l-danger";
                        const chipTone = tier === "high" ? "bg-success/15 text-success border-success/40" : tier === "medium" ? "bg-amber/15 text-amber border-amber/40" : "bg-danger/15 text-danger border-danger/40";
                        const isSelected = selectedField === f.name;
                        const cKey = `${item.id}:${f.name}`;
                        const hasComment = !!comments[cKey];
                        return (
                          <div
                            key={f.name}
                            onClick={() => handleSelectField(f.name)}
                            className={`group cursor-pointer rounded-lg border border-l-2 ${ring} bg-card hover:bg-surface-elevated/40 transition p-2.5 ${isSelected ? "ring-2 ring-cyan/60 shadow-md" : ""}`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase truncate flex items-center gap-1.5">
                                {(() => {
                                  const annotated = !!(f.value && String(f.value).trim());
                                  const isManual = !!manualAnnot[cKey];
                                  const title = !annotated
                                    ? "Not annotated · right-click value on source to annotate"
                                    : isManual
                                      ? "Manually annotated · click to locate on source"
                                      : "Auto-annotated · click to locate on source";
                                  return (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); if (annotated) handleSelectField(f.name); }}
                                      title={title}
                                      className={`grid place-items-center size-3.5 rounded-full border transition shrink-0 ${
                                        annotated
                                          ? "bg-success border-success shadow-[0_0_0_2px_rgba(34,197,94,0.18)] hover:scale-110"
                                          : "bg-transparent border-muted-foreground/40 hover:border-muted-foreground"
                                      } ${isSelected ? "ring-2 ring-cyan/60" : ""}`}
                                    >
                                      {annotated
                                        ? <span className="size-1.5 rounded-full bg-white" />
                                        : <Circle className="size-2 text-muted-foreground/50" />}
                                    </button>
                                  );
                                })()}
                                {f.name}
                              </div>
                              <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border ${chipTone}`}>{f.confidence}%</span>
                            </div>
                            <input
                              value={f.value}
                              onChange={(e) => handleEdit(f.name, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full text-sm font-mono mt-1 bg-transparent border-0 border-b border-transparent hover:border-border focus:border-cyan/40 outline-none px-0 py-0.5 transition"
                              placeholder="empty"
                            />
                            <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono">
                              <span className={`px-1.5 py-0.5 rounded ${tier === "high" ? "bg-success/10 text-success" : tier === "medium" ? "bg-amber/10 text-amber" : "bg-danger/10 text-danger"}`}>
                                {tier === "high" ? "✓ AI VERIFIED" : tier === "medium" ? "◐ REVIEW" : "⚠ LOW CONF"}
                              </span>
                              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition">
                                <button onClick={(e) => { e.stopPropagation(); handleSelectField(f.name); }} className="text-muted-foreground hover:text-cyan flex items-center gap-0.5">
                                  <MapPin className="size-2.5" /> LOCATE
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setOpenComment(openComment === cKey ? null : cKey); }} className={`flex items-center gap-0.5 ${hasComment ? "text-cyan" : "text-muted-foreground hover:text-cyan"}`}>
                                  <MessageSquare className="size-2.5" /> {hasComment ? "NOTE" : "+ NOTE"}
                                </button>
                              </div>
                            </div>
                            {openComment === cKey && (
                              <div className="mt-2 pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
                                <textarea
                                  value={comments[cKey] ?? ""}
                                  onChange={(e) => setComments((c) => ({ ...c, [cKey]: e.target.value }))}
                                  placeholder="Add inline note for this attribute…"
                                  className="w-full h-12 text-[11px] font-mono bg-input rounded p-1.5 border border-border focus:border-cyan/40 outline-none"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center text-[11px] font-mono text-muted-foreground py-10">
                No attributes match your filter.
              </div>
            )}

            <div className="rounded-xl border border-border p-3 space-y-2 bg-gradient-to-b from-surface/30 to-card">
              <div className="text-[10px] font-mono tracking-widest text-muted-foreground flex items-center gap-1.5"><MessageSquare className="size-3" /> FEEDBACK · THIS RECORD</div>
              <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Anything off in this record?" className="w-full h-14 rounded-md bg-input border border-border text-xs p-2 focus:border-cyan/40 outline-none" />
              <div className="flex gap-2">
                <button disabled={!feedback || sent} onClick={() => { onFeedback("up", feedback); setSent(true); }} className="h-7 px-2 rounded-md border border-success/40 text-success text-[11px] font-mono disabled:opacity-50 hover:bg-success/10 transition">👍 SEND</button>
                <button disabled={!feedback || sent} onClick={() => { onFeedback("down", feedback); setSent(true); }} className="h-7 px-2 rounded-md border border-danger/40 text-danger text-[11px] font-mono disabled:opacity-50 hover:bg-danger/10 transition">👎 SEND</button>
                {sent && <span className="text-[10px] font-mono text-muted-foreground self-center">Sent · thanks.</span>}
              </div>
            </div>
          </div>

          {/* Sticky action bar */}
          <div className="sticky bottom-0 border-t border-border px-3 py-2.5 flex items-center gap-2 bg-card/90 backdrop-blur-xl">
            <span className="text-[10px] font-mono text-muted-foreground hidden md:block">
              {item.status === "pending"
                ? <span className="flex items-center gap-1"><Activity className="size-3 text-amber animate-pulse" /> AI processed · awaiting decision</span>
                : <span className={item.status === "approved" ? "text-success" : "text-danger"}>{item.status.toUpperCase()} by {item.reviewer ?? "you"}</span>}
            </span>
            <button onClick={handleSkip} className="ml-auto h-8 px-3 rounded-md text-[11px] font-mono border border-border hover:border-cyan/30 hover:bg-cyan/5 flex items-center gap-1.5 transition">
              <SkipForward className="size-3" /> SKIP <kbd className="text-[9px] opacity-60">S</kbd>
            </button>
            <button onClick={handleReject} className="h-8 px-3 rounded-md text-[11px] font-mono border border-danger/40 text-danger hover:bg-danger/10 flex items-center gap-1.5 transition">
              <X className="size-3.5" /> REJECT <kbd className="text-[9px] opacity-60">R</kbd>
            </button>
            <button onClick={handleApprove} className="h-8 px-3 rounded-md text-[11px] font-mono bg-success/15 border border-success/40 text-success hover:bg-success/25 flex items-center gap-1.5 transition shadow-sm">
              <Check className="size-3.5" /> APPROVE & NEXT <kbd className="text-[9px] opacity-60">A</kbd>
            </button>
            <button
              disabled={pendingLeft > 0}
              onClick={() => {
                onComplete();
                navigate({ to: "/solutions/$id", params: { id: job.solutionId }, search: { tab: "jobs" } as Record<string, string> });
              }}
              className="h-8 px-3 rounded-md text-[11px] font-mono bg-gradient-to-r from-cyan to-cyan/90 text-white disabled:opacity-40 flex items-center gap-1.5 shadow-md hover:shadow-lg transition"
              title={pendingLeft > 0 ? `${pendingLeft} records still pending` : "Submit batch"}
            >
              {pendingLeft > 0 ? <Lock className="size-3" /> : <Save className="size-3" />}
              SUBMIT BATCH
            </button>
          </div>
        </div>
      </div>

      {/* ============ Right-click manual annotation menu ============ */}
      {ctxMenu && (() => {
        const W = 280, H = 340;
        const left = Math.min(ctxMenu.x, window.innerWidth - W - 8);
        const top = Math.min(ctxMenu.y, window.innerHeight - H - 8);
        const unannotated = allFields.filter((f) => !f.value || !String(f.value).trim());
        const annotated = allFields.filter((f) => f.value && String(f.value).trim());
        const q = ctxQuery.toLowerCase();
        const matches = (f: typeof allFields[number]) => !q || f.name.toLowerCase().includes(q) || (f.group ?? "").toLowerCase().includes(q);
        const pick = (fname: string) => {
          handleEdit(fname, ctxMenu.text);
          setManualAnnot((m) => ({ ...m, [`${item.id}:${fname}`]: true }));
          pushAudit(`Manually annotated "${fname}" ← "${ctxMenu.text.slice(0, 40)}${ctxMenu.text.length > 40 ? "…" : ""}"`, "success");
          setCtxMenu(null);
          setSelectedField(fname);
          // Confirm annotation in bot iframe (turns yellow → green)
          botIframeEl?.contentWindow?.postMessage({ type: "CONFIRM_FIELD", field: fname, value: ctxMenu.text }, "*");
        };
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }} />
            <div
              className="fixed z-50 w-[280px] rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col"
              style={{ left, top, maxHeight: H }}
            >
              <div className="px-3 py-2 border-b border-border bg-gradient-to-r from-cyan/10 to-transparent">
                <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-cyan">
                  <MousePointerClick className="size-3" /> ASSIGN TO ATTRIBUTE
                </div>
                {ctxMenu.editable ? (
                  <input
                    autoFocus
                    value={ctxMenu.text}
                    onChange={(e) => setCtxMenu((m) => m ? { ...m, text: e.target.value } : null)}
                    placeholder="Type value from screenshot…"
                    className="mt-1 w-full h-7 px-2 rounded-md bg-input border border-cyan/40 text-[11px] font-mono focus:outline-none"
                  />
                ) : (
                  <div className="text-[11px] font-mono mt-1 truncate text-foreground" title={ctxMenu.text}>
                    "{ctxMenu.text}"
                  </div>
                )}
              </div>
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="size-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    autoFocus
                    value={ctxQuery}
                    onChange={(e) => setCtxQuery(e.target.value)}
                    placeholder="Filter attributes…"
                    className="w-full h-7 pl-7 pr-2 rounded-md bg-input border border-border text-[11px] font-mono focus:border-cyan/40 outline-none"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {unannotated.filter(matches).length > 0 && (
                  <div className="px-3 py-1 text-[9px] font-mono tracking-widest text-muted-foreground uppercase">Unannotated · suggested</div>
                )}
                {unannotated.filter(matches).map((f) => (
                  <button
                    key={`u-${f.name}`}
                    onClick={() => pick(f.name)}
                    className="w-full text-left px-3 py-1.5 hover:bg-cyan/10 flex items-center gap-2 transition"
                  >
                    <Circle className="size-2.5 text-muted-foreground/60 shrink-0" />
                    <span className="text-[11px] font-mono truncate">{f.name}</span>
                    <span className="ml-auto text-[9px] font-mono text-muted-foreground">{f.group ?? "fields"}</span>
                  </button>
                ))}
                {annotated.filter(matches).length > 0 && (
                  <div className="px-3 py-1 mt-1 text-[9px] font-mono tracking-widest text-muted-foreground uppercase border-t border-border">Replace existing</div>
                )}
                {annotated.filter(matches).map((f) => (
                  <button
                    key={`a-${f.name}`}
                    onClick={() => pick(f.name)}
                    className="w-full text-left px-3 py-1.5 hover:bg-amber/10 flex items-center gap-2 transition"
                  >
                    <span className="size-2.5 rounded-full bg-success shrink-0" />
                    <span className="text-[11px] font-mono truncate">{f.name}</span>
                    <span className="ml-auto text-[9px] font-mono text-muted-foreground truncate max-w-[80px]">{String(f.value)}</span>
                  </button>
                ))}
                {allFields.filter(matches).length === 0 && (
                  <div className="text-center text-[10px] font-mono text-muted-foreground py-6">No attributes match.</div>
                )}
              </div>
              <div className="px-3 py-1.5 border-t border-border text-[9px] font-mono text-muted-foreground bg-surface/40">
                Pick an attribute to annotate the selected text · Esc to cancel
              </div>
            </div>
          </>
        );
      })()}




      {/* ============ Keyboard shortcuts modal ============ */}
      {showShortcuts && (
        <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm grid place-items-center p-4" onClick={() => setShowShortcuts(false)}>
          <div className="rounded-2xl border border-border bg-card shadow-2xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Keyboard className="size-4 text-cyan" />
              <span className="text-sm font-semibold tracking-tight">Keyboard shortcuts</span>
              <button onClick={() => setShowShortcuts(false)} className="ml-auto h-6 w-6 grid place-items-center hover:bg-surface-elevated rounded transition"><X className="size-3" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              {[
                ["A", "Approve & next"],
                ["R", "Reject"],
                ["S", "Skip"],
                ["→ / J", "Next record"],
                ["← / K", "Previous record"],
                ["?", "Toggle this panel"],
                ["Esc", "Clear selection"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 p-2 rounded border border-border bg-surface/30">
                  <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-[10px]">{k}</kbd>
                  <span className="text-muted-foreground">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Annotation script injected into bot HTML files ──────────────────────────
function injectAnnotationLayer(html: string): string {
  const layer = `
<style id="_hitl_css">
  .hitl-auto{background:rgba(245,158,11,0.32)!important;outline:2px solid rgba(245,158,11,0.8);outline-offset:1px;border-radius:3px;cursor:help;transition:all .15s}
  .hitl-confirmed{background:rgba(34,197,94,0.32)!important;outline:2px solid rgba(34,197,94,0.9);outline-offset:1px;border-radius:3px}
  .hitl-selected{background:rgba(34,197,94,0.5)!important;outline:2px solid #22c55e!important;box-shadow:0 0 0 3px rgba(34,197,94,0.25)}
  .hitl-mark:hover{filter:brightness(0.88)}
  @keyframes hitl-pulse{0%,100%{outline-width:2px;filter:brightness(1)}50%{outline-width:5px;filter:brightness(1.4)}}
  .hitl-pulse{animation:hitl-pulse 0.5s ease-in-out 3}
</style>
<script id="_hitl_js">
(function(){
  /* ── Visibility fix: force body/content visible regardless of Tesla CSS ── */
  function _forceVisible(){
    var b=document.body;
    if(!b)return;
    b.style.removeProperty('display');
    b.style.removeProperty('visibility');
    b.style.removeProperty('opacity');
    b.style.setProperty('display','block','important');
    b.style.setProperty('visibility','visible','important');
    b.style.setProperty('opacity','1','important');
    b.style.setProperty('overflow','auto','important');
    /* Remove loading/modal classes that Tesla CSS uses to hide content */
    ['coin-reloaded','async-hide','tds-modal--is-open'].forEach(function(c){
      document.documentElement.classList.remove(c);
      b.classList.remove(c);
    });
    /* Force all main Tesla configurator containers visible */
    var sel='#__next,.tds-site-wrapper,.tds-page-wrapper,.group-section--container,.option-widget--container,.tcl-page,[data-group-id]';
    document.querySelectorAll(sel).forEach(function(el){
      el.style.removeProperty('display');
      el.style.removeProperty('visibility');
      el.style.removeProperty('opacity');
      el.style.setProperty('display','block','important');
      el.style.setProperty('visibility','visible','important');
      el.style.setProperty('opacity','1','important');
    });
  }
  _forceVisible();
  document.addEventListener('DOMContentLoaded',_forceVisible);
  window.addEventListener('load',_forceVisible);
  /* Run once more after a short delay in case Tesla's CSS loads late */
  setTimeout(_forceVisible,800);
  setTimeout(_forceVisible,2000);

  var state={fields:[],confirmed:{},selected:null,loaded:false};
  function esc(s){return s.replace(/[.*+?^\${}()|[\\]\\\\]/g,'\\\\$&');}
  function applyAll(){
    document.querySelectorAll('.hitl-mark').forEach(function(el){
      var p=el.parentNode;if(p){var t=document.createTextNode(el.textContent||'');p.replaceChild(t,el);p.normalize();}
    });
    var toHL=state.fields.filter(function(f){return f.value&&f.value.length>=2;});
    if(!toHL.length)return;
    var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:function(n){
      var p=n.parentElement;
      if(!p)return NodeFilter.FILTER_REJECT;
      if(p.closest('#_hitl_css,#_hitl_js'))return NodeFilter.FILTER_REJECT;
      if(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT'].indexOf(p.tagName)>-1)return NodeFilter.FILTER_REJECT;
      var txt=(n.nodeValue||'').toLowerCase();
      return toHL.some(function(f){return txt.indexOf(f.value.toLowerCase())>-1;})?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
    }});
    var nodes=[];var n;while(n=walker.nextNode())nodes.push(n);
    nodes.forEach(function(node){
      var html=node.nodeValue||'';
      toHL.forEach(function(f){
        var re=new RegExp('('+esc(f.value)+')','gi');
        var cls=state.confirmed[f.name]?'hitl-confirmed':(f.name===state.selected?'hitl-selected':'hitl-auto');
        html=html.replace(re,'<mark class="hitl-mark '+cls+'" data-hitl="'+f.name+'" title="'+f.name+' · '+f.confidence+'%">$1</mark>');
      });
      var span=document.createElement('span');span.innerHTML=html;node.replaceWith(span);
    });
  }
  window.addEventListener('message',function(e){
    if(!e.data||!e.data.type)return;
    if(e.data.type==='INIT_HIGHLIGHT'){state.fields=e.data.fields||[];applyAll();}
    if(e.data.type==='SELECT_FIELD'){
      state.selected=e.data.field;
      document.querySelectorAll('.hitl-mark').forEach(function(el){
        el.classList.remove('hitl-selected');
        if(el.dataset.hitl===e.data.field)el.classList.add('hitl-selected');
      });
    }
    if(e.data.type==='CONFIRM_FIELD'){
      state.confirmed[e.data.field]=true;
      document.querySelectorAll('[data-hitl="'+e.data.field+'"]').forEach(function(el){
        el.classList.remove('hitl-auto');el.classList.add('hitl-confirmed');
      });
    }
    if(e.data.type==='SCROLL_TO_FIELD'){
      var targets=document.querySelectorAll('[data-hitl="'+e.data.field+'"]');
      var first=targets[0];
      if(first){
        first.scrollIntoView({behavior:'smooth',block:'center'});
        targets.forEach(function(el){
          el.classList.remove('hitl-pulse');
          void el.offsetWidth;
          el.classList.add('hitl-pulse');
        });
        setTimeout(function(){targets.forEach(function(el){el.classList.remove('hitl-pulse');});},1600);
      }
    }
  });
  document.addEventListener('contextmenu',function(e){
    var sel=window.getSelection?window.getSelection().toString().trim():'';
    if(sel&&sel.length>0){e.preventDefault();window.parent.postMessage({type:'ANNOTATE_SELECTION',text:sel,x:e.clientX,y:e.clientY},'*');}
  });
  document.addEventListener('click',function(){window.parent.postMessage({type:'IFRAME_CLICK'},'*');});
  document.addEventListener('mouseover',function(e){
    var el=e.target;if(el&&el.dataset&&el.dataset.hitl)window.parent.postMessage({type:'FIELD_HOVER',field:el.dataset.hitl},'*');
  });
})();
<\/script>`;
  if (html.includes("</head>")) return html.replace("</head>", layer + "</head>");
  if (html.includes("</body>")) return html.replace("</body>", layer + "</body>");
  return html + layer;
}

// ── Screenshot viewer: shows Playwright screenshot, supports zoom ─────────────
function ScreenshotViewer({ item, zoom }: { item: HitlItem; zoom: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-amber/30 bg-amber/5 text-[10px] font-mono text-amber">
        <Camera className="size-3 shrink-0" />
        <span>Screenshot preview — right-click anywhere to manually annotate a value</span>
        {item.liveUrl && (
          <a
            href={item.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto shrink-0 px-2 py-0.5 rounded bg-amber/20 hover:bg-amber/30 border border-amber/40 transition-colors"
          >
            Open Live ↗
          </a>
        )}
      </div>
      <div className="overflow-auto rounded border border-border" style={{ maxHeight: "66vh" }}>
        <img
          src={`${BOT_API}/api/screenshot/${encodeURIComponent(item.screenshotFile!)}`}
          alt={item.recordName ?? "screenshot"}
          style={{ width: "100%", transformOrigin: "top left", transform: `scale(${zoom / 100})` }}
          draggable={false}
          className="block"
        />
      </div>
    </div>
  );
}

// ── Detects Tesla records (liveUrl or recordName signals) ─────────────────────
function isTeslaItem(item: HitlItem): boolean {
  const url  = (item.liveUrl    ?? "").toLowerCase();
  const name = (item.recordName ?? "").toLowerCase();
  return url.includes("tesla.com") || name.includes("tesla") ||
    name.includes("model y") || name.includes("model 3") ||
    name.includes("model s") || name.includes("model x") ||
    name.includes("cybertruck");
}

// ── Fallback HTML built from extracted RHS fields (shown when live/local HTML is inaccessible) ──
function buildFieldsFallbackHtml(item: HitlItem): string {
  const isTesla = (item.liveUrl ?? "").includes("tesla") || (item.recordName ?? "").toLowerCase().includes("tesla") || (item.recordName ?? "").toLowerCase().includes("model y") || (item.recordName ?? "").toLowerCase().includes("cybertruck");
  const bg = isTesla ? "#171a20" : "#f8f9fa";
  const fg = isTesla ? "#fff" : "#111";
  const cardBg = isTesla ? "#1f2229" : "#fff";
  const borderColor = isTesla ? "#2a2d35" : "#dee2e6";
  const accent = isTesla ? "#e31937" : "#1c69d4";
  const mutedColor = isTesla ? "#aaa" : "#666";
  const groupBg = isTesla ? "#242830" : "#f0f4ff";
  const warnBg = isTesla ? "#2a2500" : "#fff3cd";
  const warnBorder = isTesla ? "#555" : "#ffc107";
  const warnFg = isTesla ? "#f59e0b" : "#856404";

  const groups: Record<string, HitlField[]> = {};
  (item.fields ?? []).forEach((f) => {
    const g = f.group ?? "fields";
    if (!groups[g]) groups[g] = [];
    groups[g].push(f);
  });

  let sectionsHtml = "";
  for (const [grp, fields] of Object.entries(groups)) {
    const rows = fields.map((f) => {
      const conf = f.confidence ?? 0;
      const confColor = conf >= 90 ? "#22c55e" : conf >= 75 ? "#f59e0b" : "#ef4444";
      return `<tr>
        <td style="padding:7px 12px;color:${mutedColor};font-size:12px;border-bottom:1px solid ${borderColor};white-space:nowrap">${f.name}</td>
        <td data-hitl="${f.name}" style="padding:7px 12px;font-size:13px;font-weight:500;border-bottom:1px solid ${borderColor};color:${fg}">${f.value || "—"}</td>
        <td style="padding:7px 12px;font-size:10px;color:${confColor};border-bottom:1px solid ${borderColor};text-align:right;font-family:monospace">${conf}%</td>
      </tr>`;
    }).join("");
    sectionsHtml += `<div style="margin-bottom:18px">
      <div style="font-size:10px;letter-spacing:3px;color:${accent};text-transform:uppercase;padding:7px 12px;background:${groupBg};border-radius:4px 4px 0 0;border:1px solid ${borderColor};border-bottom:none">${grp}</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid ${borderColor};border-radius:0 0 4px 4px;background:${cardBg}"><tbody>${rows}</tbody></table>
    </div>`;
  }

  const liveLink = item.liveUrl
    ? `<a href="${item.liveUrl}" target="_blank" rel="noopener" style="color:${accent};margin-left:10px;font-size:11px">Open Live ↗</a>`
    : "";

  const brandLabel = isTesla ? "TESLA" : (item.recordName?.split(" ")[0]?.toUpperCase() ?? "SOURCE");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${item.recordName ?? "Record"}</title>
<style>body{margin:0;padding:20px;font-family:${isTesla ? "'Gotham','Helvetica Neue'," : ""}Arial,sans-serif;background:${bg};color:${fg}}*{box-sizing:border-box}</style>
</head><body>
<div style="max-width:740px;margin:0 auto">
  <div style="background:${isTesla ? "#000" : accent};color:#fff;padding:12px 20px;border-radius:6px 6px 0 0;display:flex;align-items:center;justify-content:space-between">
    <span style="font-weight:700;font-size:14px;letter-spacing:${isTesla ? "5px" : "1px"}">${brandLabel}</span>
    <span style="font-size:11px;opacity:0.7">${item.recordName ?? ""}</span>
  </div>
  <div style="border:1px solid ${borderColor};border-top:none;border-radius:0 0 6px 6px;padding:16px;background:${cardBg}">
    <div style="margin-bottom:16px;padding:9px 12px;background:${warnBg};border:1px solid ${warnBorder};border-radius:4px;color:${warnFg};font-size:11px">
      ⚠ Live page not available — showing extracted data from AI analysis${liveLink}
    </div>
    ${sectionsHtml || '<p style="color:' + mutedColor + ';font-size:13px">No field data available.</p>'}
  </div>
</div>
</body></html>`;
}

// ── Rich Tesla configurator replica built from extracted fields ───────────────
function buildTeslaConfiguratorHtml(item: HitlItem): string {
  const fm: Record<string, string> = {};
  (item.fields ?? []).forEach((fi) => { if (fi.value) fm[fi.name] = fi.value; });

  const model      = fm["Model"] || fm["model"] || item.recordName?.replace(/Tesla\s*/i, "").split("—")[0].trim() || "Model";
  const region     = fm["Region"] || fm["Country"] || fm["country"] || "";
  const basePrice  = fm["Base price"] || fm["Cash price"] || "";
  const currency   = fm["Currency"] || "";
  const rangeVal   = fm["Range"] || fm["Range (converted)"] || "";
  const accel      = fm["Acceleration"] || fm["0-60 mph"] || "";
  const topSpeed   = fm["Top Speed"] || "";
  const seating    = fm["Seating"] || "";
  const cargo      = fm["Cargo"] || "";
  const drivetrain = fm["Drivetrain"] || "";
  const peakPower  = fm["Peak Power"] || "";
  const colorOpts  = fm["Color options"] || "";
  const wheelOpts  = fm["Wheel options"] || "";
  const interiorOpts = fm["Interior options"] || "";
  const autopilot  = fm["Autopilot"] || "";
  const chargeTime = fm["Charge time"] || "";
  const towing     = fm["Towing"] || "";
  const payload    = fm["Payload"] || "";
  const trimVariants = fm["Trim variants"] || "";
  const priceDate  = fm["Price date"] || "";
  const uid        = fm["UID"] || "";

  const allFields     = item.fields ?? [];
  const trimFields    = allFields.filter((f) => f.group === "trims");
  const leaseFields   = allFields.filter((f) => f.group === "lease");
  const financeFields = allFields.filter((f) => f.group === "finance");

  const accelField = fm["Acceleration"] ? "Acceleration" : "0-60 mph";
  const priceField = fm["Base price"]   ? "Base price"   : "Cash price";

  const perfTiles = [
    rangeVal  ? `<div class="perf-tile"><div class="perf-val" data-hitl="Range">${rangeVal}</div><div class="perf-lbl">Range</div></div>` : "",
    accel     ? `<div class="perf-tile"><div class="perf-val" data-hitl="${accelField}">${accel}<span class="perf-unit"> s</span></div><div class="perf-lbl">0&#x2013;60 mph</div></div>` : "",
    topSpeed  ? `<div class="perf-tile"><div class="perf-val" data-hitl="Top Speed">${topSpeed}</div><div class="perf-lbl">Top Speed</div></div>` : "",
  ].filter(Boolean).join("");

  const specRows = ([
    ["Drivetrain",    drivetrain,  "Drivetrain"],
    ["Peak Power",    peakPower,   "Peak Power"],
    ["Seating",       seating,     "Seating"],
    ["Cargo",         cargo,       "Cargo"],
    ["Towing",        towing,      "Towing"],
    ["Payload",       payload,     "Payload"],
    ["Charge time",   chargeTime,  "Charge time"],
    ["Trim variants", trimVariants,"Trim variants"],
  ] as [string, string, string][])
    .filter(([, v]) => v)
    .map(([label, val, field]) => `<tr><td class="sl">${label}</td><td class="sv" data-hitl="${field}">${val}</td></tr>`)
    .join("");

  const trimsHtml = trimFields.length ? `
    <div class="section">
      <div class="sh">Available Trims</div>
      <div class="trims-grid">
        ${trimFields.map((t) => `
          <div class="trim-card">
            <div class="trim-name" data-hitl="${t.name}">${t.name}</div>
            <div class="trim-detail">${t.value ?? ""}</div>
          </div>`).join("")}
      </div>
    </div>` : "";

  const optRows = [
    colorOpts    ? `<tr><td class="sl">Exterior Colors</td><td class="sv" data-hitl="Color options">${colorOpts}</td></tr>` : "",
    wheelOpts    ? `<tr><td class="sl">Wheels</td><td class="sv" data-hitl="Wheel options">${wheelOpts}</td></tr>` : "",
    interiorOpts ? `<tr><td class="sl">Interior</td><td class="sv" data-hitl="Interior options">${interiorOpts}</td></tr>` : "",
  ].filter(Boolean).join("");
  const optionsHtml = optRows ? `
    <div class="section">
      <div class="sh">Options</div>
      <table class="st"><tbody>${optRows}</tbody></table>
    </div>` : "";

  const leaseRows   = leaseFields.map((f) => `<tr><td class="sl">${f.name}</td><td class="sv" data-hitl="${f.name}">${f.value ?? ""}</td></tr>`).join("");
  const financeRows = financeFields.map((f) => `<tr><td class="sl">${f.name}</td><td class="sv" data-hitl="${f.name}">${f.value ?? ""}</td></tr>`).join("");
  const pricingRows = [
    basePrice  ? `<tr><td class="sl">${priceField === "Base price" ? "Base Price" : "Cash Price"}</td><td class="sv pv" data-hitl="${priceField}">${currency ? `<span data-hitl="Currency">${currency}</span> ` : ""}${basePrice}</td></tr>` : "",
    leaseRows,
    financeRows,
    priceDate  ? `<tr><td class="sl">Price Date</td><td class="sv" data-hitl="Price date">${priceDate}</td></tr>` : "",
  ].filter(Boolean).join("");
  const pricingHtml = pricingRows ? `
    <div class="section">
      <div class="sh">Pricing</div>
      <table class="st"><tbody>${pricingRows}</tbody></table>
    </div>` : "";

  const featuresRows = [
    autopilot  ? `<tr><td class="sl">Autopilot</td><td class="sv" data-hitl="Autopilot">${autopilot}</td></tr>` : "",
  ].filter(Boolean).join("");
  const featuresHtml = featuresRows ? `
    <div class="section">
      <div class="sh">Features</div>
      <table class="st"><tbody>${featuresRows}</tbody></table>
    </div>` : "";

  const hiddenFields = allFields
    .filter((f) => f.value)
    .map((f) => `<span data-hitl="${f.name}" style="display:none">${f.value}</span>`)
    .join("");

  const liveLinkHtml = item.liveUrl
    ? `<div style="text-align:center;padding:24px 0"><a href="${item.liveUrl}" target="_blank" rel="noopener" style="color:#e31937;font-size:11px;letter-spacing:3px;text-decoration:none">VIEW ON TESLA.COM &#x2197;</a></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tesla ${model}${region ? " — " + region : ""} · Configurator</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;background:#171a20;color:#fff;min-height:100vh}
a{color:#e31937;text-decoration:none}
.tnav{background:#000;height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 24px}
.tlogo{font-size:15px;font-weight:700;letter-spacing:6px;color:#fff}
.tnav-links{display:flex;gap:20px;font-size:12px;opacity:.7}
.hero{background:linear-gradient(160deg,#0a0a0a 0%,#111318 50%,#0e1018 100%);padding:48px 24px 32px;text-align:center;position:relative;overflow:hidden}
.hero::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 50% 25%,rgba(227,25,55,.07),transparent 60%)}
.hero-ey{font-size:10px;letter-spacing:4px;color:#888;text-transform:uppercase;margin-bottom:10px}
.hero-model{font-size:54px;font-weight:200;letter-spacing:-1px;line-height:1;position:relative}
.hero-sub{font-size:13px;color:#888;margin-top:6px}
.hero-price{font-size:20px;font-weight:500;margin-top:12px}
.hero-price .hp-val{color:#e31937}
.order-btn{display:inline-block;margin-top:20px;background:#e31937;color:#fff;font-size:13px;font-weight:600;padding:12px 40px;border-radius:4px;letter-spacing:1px;cursor:pointer}
.car-svg{display:block;margin:24px auto 0;width:68%;opacity:.18}
.ps{display:flex;justify-content:center;background:#1b1f27;border-top:1px solid #2a2d35;border-bottom:1px solid #2a2d35}
.perf-tile{flex:1;text-align:center;padding:22px 10px;border-right:1px solid #2a2d35}
.perf-tile:last-child{border-right:none}
.perf-val{font-size:28px;font-weight:300;letter-spacing:-.5px}
.perf-unit{font-size:14px;opacity:.7}
.perf-lbl{font-size:10px;letter-spacing:2px;color:#777;text-transform:uppercase;margin-top:5px}
.content{max-width:800px;margin:0 auto;padding:0 24px 48px}
.section{margin-top:32px}
.sh{font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#e31937;padding-bottom:8px;border-bottom:1px solid #2a2d35;margin-bottom:12px}
.st{width:100%;border-collapse:collapse}
.sl{padding:9px 0;font-size:13px;color:#777;width:48%;border-bottom:1px solid #1e2028}
.sv{padding:9px 0;font-size:13px;font-weight:500;border-bottom:1px solid #1e2028;text-align:right}
.pv{font-size:17px}
.trims-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
.trim-card{background:#1f2229;border:1px solid #2a2d35;border-radius:6px;padding:14px 16px}
.trim-name{font-size:14px;font-weight:600;margin-bottom:4px}
.trim-detail{font-size:11px;color:#777;line-height:1.6}
.footer{text-align:center;padding:32px 24px;border-top:1px solid #1e2028;color:#3a3d45;font-size:10px;margin-top:32px}
</style>
</head>
<body>
<nav class="tnav">
  <div class="tlogo" data-hitl="Brand">TESLA</div>
  <div class="tnav-links"><span>Models</span><span>Charging</span><span>Discover</span><span>Shop</span></div>
  <div style="font-size:11px;opacity:.4">Sign In</div>
</nav>
<div class="hero">
  <div class="hero-ey">TESLA${region ? ' &middot; <span data-hitl="Region">' + region + '</span>' : " CONFIGURATOR"}</div>
  <div class="hero-model" data-hitl="Model">${model}</div>
  ${fm["trim"] ? `<div class="hero-sub" data-hitl="trim">${fm["trim"]}</div>` : ""}
  ${basePrice ? `<div class="hero-price">From <span class="hp-val" data-hitl="${priceField}">${currency ? '<span data-hitl="Currency">' + currency + '</span> ' : ""}${basePrice}</span></div>` : ""}
  <div class="order-btn">Order Now</div>
  <svg class="car-svg" viewBox="0 0 500 100">
    <path d="M30 75 Q80 30 180 28 L290 28 Q380 28 430 65 L470 70 Q480 70 480 80 L30 80 Z" fill="#fff"/>
    <circle cx="140" cy="80" r="16" fill="#000"/><circle cx="140" cy="80" r="8" fill="#555"/>
    <circle cx="370" cy="80" r="16" fill="#000"/><circle cx="370" cy="80" r="8" fill="#555"/>
    <rect x="185" y="36" width="100" height="18" rx="3" fill="rgba(255,255,255,.45)"/>
  </svg>
</div>
${perfTiles ? `<div class="ps">${perfTiles}</div>` : ""}
<div class="content">
  ${specRows ? `<div class="section"><div class="sh">Specifications</div><table class="st"><tbody>${specRows}</tbody></table></div>` : ""}
  ${optionsHtml}
  ${trimsHtml}
  ${pricingHtml}
  ${featuresHtml}
  ${liveLinkHtml}
</div>
<div class="footer">
  &copy; ${new Date().getFullYear()} Tesla, Inc. &nbsp;&middot;&nbsp; Data captured for HITL review &nbsp;&middot;&nbsp; <span data-hitl="UID">${uid}</span>
</div>
<div style="display:none">${hiddenFields}</div>
</body>
</html>`;
}

// ── Bot HTML viewer: fetches, injects annotation layer, renders via srcdoc ───
function BotHtmlViewer({
  item, allFields, selectedField, onIframe,
}: {
  item: HitlItem;
  allFields: { name: string; value: string; confidence: number; group?: string }[];
  selectedField: string | null;
  onIframe: (el: HTMLIFrameElement | null) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcdoc, setSrcdoc] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  // Pass iframe element up so parent can postMessage to it
  useEffect(() => { onIframe(iframeRef.current); }, [loaded]); // eslint-disable-line

  // Fetch + inject on item change — prefer local HTML file; for Tesla use replica; fall back to proxy
  useEffect(() => {
    setLoaded(false);
    setSrcdoc("");
    const isLocal = item.htmlFile && !item.htmlFile.startsWith("http");
    // Tesla items: build rich configurator replica locally — never proxy live Tesla URLs
    if (!isLocal && isTeslaItem(item)) {
      setSrcdoc(injectAnnotationLayer(buildTeslaConfiguratorHtml(item)));
      return;
    }
    const sourceUrl = isLocal
      ? `${BOT_API}/api/html/${encodeURIComponent(item.htmlFile!)}`
      : item.liveUrl
        ? `${BOT_API}/api/proxy?url=${encodeURIComponent(item.liveUrl)}`
        : null;
    if (!sourceUrl) return;
    fetch(sourceUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((html) => setSrcdoc(injectAnnotationLayer(html)))
      .catch(() => setSrcdoc(injectAnnotationLayer(buildFieldsFallbackHtml(item))));
  }, [item.htmlFile, item.liveUrl, item.id]);

  // Send highlights when iframe is ready or fields change
  useEffect(() => {
    if (!loaded || !iframeRef.current) return;
    iframeRef.current.contentWindow?.postMessage({
      type: "INIT_HIGHLIGHT",
      fields: allFields.map((f) => ({ name: f.name, value: f.value ?? "", confidence: f.confidence })),
    }, "*");
  }, [allFields, loaded]);

  // Sync selected field to iframe
  useEffect(() => {
    if (!loaded || !iframeRef.current) return;
    iframeRef.current.contentWindow?.postMessage({ type: "SELECT_FIELD", field: selectedField }, "*");
  }, [selectedField, loaded]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 px-2 py-1 rounded border border-cyan/30 bg-cyan/5 text-[10px] font-mono text-cyan">
        <Globe className="size-3" />
        {item.htmlFile && !item.htmlFile.startsWith("http") ? (
          <span className="truncate text-amber">Local HTML: {item.htmlFile}</span>
        ) : isTeslaItem(item) ? (
          <span className="truncate text-amber">Configurator Replica · {item.recordName}</span>
        ) : (
          <span className="truncate">{item.liveUrl}</span>
        )}
        {item.uid && <span className="ml-auto shrink-0 text-muted-foreground">UID: {item.uid}</span>}
        {item.liveUrl && (
          <a
            href={item.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-2 py-0.5 rounded bg-cyan/20 hover:bg-cyan/30 text-cyan border border-cyan/40 transition-colors"
            title="Open live Tesla page"
          >
            Open Live ↗
          </a>
        )}
      </div>
      {srcdoc ? (
        <iframe
          ref={iframeRef}
          key={item.id}
          srcDoc={srcdoc}
          title={item.recordName ?? "source"}
          className="w-full border border-border rounded"
          style={{ height: "66vh", background: "#171a20" }}
          sandbox="allow-scripts"
          onLoad={() => { setLoaded(true); onIframe(iframeRef.current); }}
        />
      ) : (
        <div className="flex items-center justify-center h-40 text-[11px] font-mono text-muted-foreground border border-border rounded">
          Loading source HTML…
        </div>
      )}
    </div>
  );
}

// Memo-wrapped versions: custom equality keyed on item.id so text-walker DOM
// marks survive re-renders triggered by selectedField / other parent state changes.
const MemoRealisticHtml = memo(RealisticHtml,  (p, n) => p.item.id === n.item.id && p.solutionId === n.solutionId);
const MemoRealisticPdf  = memo(RealisticPdf,   (p, n) => p.item.id === n.item.id && p.solutionId === n.solutionId);

// ── Wraps the synthetic source renderer with field-highlight overlay ──────────
function SourceWithHighlights({
  solutionId, item, view, selectedField, search, language,
}: {
  solutionId: string;
  item: HitlItem;
  view: "html" | "pdf" | "screenshot";
  selectedField: string | null;
  search: string;
  language: "original" | "translated";
}) {
  void language;
  const fieldByValue = useMemo(() => {
    const m: Record<string, { name: string; conf: number }> = {};
    (item.fields ?? []).forEach((f) => { if (f.value) m[f.value.toLowerCase()] = { name: f.name, conf: f.confidence }; });
    return m;
  }, [item]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const root = wrapRef.current;
    const values = Object.keys(fieldByValue);
    if (values.length === 0) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        const txt = n.nodeValue?.toLowerCase() ?? "";
        if (!txt.trim()) return NodeFilter.FILTER_REJECT;
        const parent = n.parentElement as HTMLElement | null;
        if (parent?.dataset?.field) return NodeFilter.FILTER_REJECT;
        if (parent?.tagName === "INPUT" || parent?.tagName === "TEXTAREA" || parent?.tagName === "SCRIPT") return NodeFilter.FILTER_REJECT;
        return values.some((v) => txt.includes(v)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const toProcess: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) toProcess.push(n as Text);
    toProcess.forEach((node) => {
      let html = node.nodeValue ?? "";
      values.forEach((v) => {
        const meta = fieldByValue[v];
        const re = new RegExp(`(${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
        html = html.replace(re, `<mark data-field="${meta.name}" class="hitl-mark" style="background:rgba(245,158,11,0.3);color:inherit;padding:1px 3px;border-radius:3px;outline:2px solid rgba(245,158,11,0.7);outline-offset:1px;transition:all .2s;cursor:help" title="${meta.name} · ${meta.conf}%">$1</mark>`);
      });
      const span = document.createElement("span");
      span.innerHTML = html;
      node.replaceWith(span);
    });
  }, [fieldByValue, item.id, view]);

  useEffect(() => {
    if (!wrapRef.current) return;
    wrapRef.current.querySelectorAll<HTMLElement>("mark.hitl-mark").forEach((el) => {
      const isSel = el.dataset.field === selectedField;
      el.style.background = isSel ? "rgba(34,197,94,0.35)" : "rgba(245,158,11,0.3)";
      el.style.outlineColor = isSel ? "rgba(34,197,94,0.9)" : "rgba(245,158,11,0.7)";
      el.style.boxShadow = isSel ? "0 0 0 3px rgba(34,197,94,0.25)" : "none";
    });
  }, [selectedField]);

  // Highlight non-mark data-field elements (styled template elements + FieldsReference)
  useEffect(() => {
    if (!wrapRef.current) return;
    wrapRef.current.querySelectorAll<HTMLElement>("[data-field]:not(.hitl-mark)").forEach((el) => {
      el.style.removeProperty("background");
      el.style.removeProperty("outline");
      el.style.removeProperty("outline-offset");
      el.style.removeProperty("box-shadow");
      el.style.removeProperty("border-radius");
    });
    if (selectedField) {
      const el = wrapRef.current.querySelector<HTMLElement>(`[data-field="${CSS.escape(selectedField)}"]:not(.hitl-mark)`);
      if (el) {
        el.style.background = "rgba(34,197,94,0.25)";
        el.style.outline = "2px solid rgba(34,197,94,0.85)";
        el.style.outlineOffset = "2px";
        el.style.boxShadow = "0 0 0 4px rgba(34,197,94,0.18)";
        el.style.borderRadius = "3px";
      }
    }
  }, [selectedField]);

  const matchesSearch = !search || JSON.stringify(item).toLowerCase().includes(search.toLowerCase());

  return (
    <div ref={wrapRef} className={`transition ${matchesSearch ? "" : "opacity-40"}`}>
      {view === "pdf"
        ? <MemoRealisticPdf solutionId={solutionId} item={item} />
        : <MemoRealisticHtml solutionId={solutionId} item={item} />}
    </div>
  );
}

// ===================== shared small components =====================

function UseCaseTag({ solId }: { solId: string }) {
  const sol = getSolution(solId);
  if (!sol) return null;
  const Icon = sol.icon;
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-cyan/40 text-cyan bg-cyan/10 flex items-center gap-1">
      <Icon className="size-3" />
      {sol.code} · {sol.title.toUpperCase()}
    </span>
  );
}

function FormatTag({ kind }: { kind: "html" | "pdf" | "screenshot" }) {
  if (kind === "pdf") return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-amber/40 text-amber bg-amber/10 flex items-center gap-1"><FileText className="size-3" /> PDF</span>;
  if (kind === "screenshot") return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-violet/40 text-violet bg-violet/10 flex items-center gap-1"><Camera className="size-3" /> Screenshot</span>;
  return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-cyan/40 text-cyan bg-cyan/10 flex items-center gap-1"><Globe className="size-3" /> HTML</span>;
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "amber" | "success" | "danger" }) {
  const toneCls = tone === "amber" ? "border-amber/40 text-amber bg-amber/10" : tone === "success" ? "border-success/40 text-success bg-success/10" : "border-danger/40 text-danger bg-danger/10";
  return (
    <div className={`px-3 py-1.5 rounded border ${toneCls}`}>
      <div className="text-[9px] tracking-wider">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}


// ===================== Realistic source previews =====================

function fieldMap(item: HitlItem): Record<string, string> {
  const m: Record<string, string> = {};
  (item.fields ?? []).forEach((f) => { m[f.name] = f.value; });
  return m;
}

function RealisticHtml({ solutionId, item }: { solutionId: string; item: HitlItem }) {
  const f = fieldMap(item);
  if (solutionId === "oem-config")    return <OemConfiguratorPage f={f} item={item} />;
  if (solutionId === "vehicle-spec") return <VehicleBrandPage f={f} item={item} />;
  if (solutionId === "news")          return <NewsArticlePage f={f} item={item} />;
  if (solutionId === "ev-charging")   return <EvStationPage  f={f} item={item} />;
  if (solutionId === "dealer-inventory") return <DealerPage f={f} item={item} />;
  return <GenericSitePage f={f} item={item} />;
}

function RealisticPdf({ solutionId, item }: { solutionId: string; item: HitlItem }) {
  const f = fieldMap(item);
  if (solutionId === "plants") return <PlantDataSheetPdf f={f} item={item} />;
  return <VehicleSpecSheetPdf f={f} item={item} />;
}

/* ---------- HTML: OEM brand model page (BMW/Tesla style) ---------- */
function VehicleBrandPage({ f, item }: { f: Record<string, string>; item: HitlItem }) {
  const oem = f.oem || "BMW";
  const model = f.model || item.recordName?.split(" ")[0] || "iX1";
  const trim = f.trim || "xDrive30";
  const msrp = f.msrp || "$49,900";
  return (
    <div className="bg-white text-neutral-900 shadow-xl rounded overflow-hidden mx-auto max-w-[640px]">
      {/* top nav */}
      <div className="bg-black text-white text-[11px] px-4 h-9 flex items-center gap-4">
        <span data-field="oem" className="font-bold tracking-widest">{oem.toUpperCase()}</span>
        <span className="opacity-70">Models</span>
        <span className="opacity-70">Build</span>
        <span className="opacity-70">Shop</span>
        <span className="opacity-70">Owners</span>
        <span className="ml-auto opacity-70">EN · US</span>
      </div>
      {/* hero */}
      <div className="relative h-44 bg-gradient-to-br from-neutral-800 via-neutral-700 to-neutral-900 text-white p-5 flex flex-col justify-end">
        <div className="text-[10px] tracking-widest opacity-80">{new Date().getFullYear()} {oem.toUpperCase()}</div>
        <div data-field="model" className="text-3xl font-light leading-none mt-1">{model}</div>
        <div className="text-sm opacity-90 mt-1"><span data-field="trim">{trim}</span> · Starting at <span data-field="msrp">{msrp}</span></div>
        <div className="absolute right-5 bottom-5 flex gap-2">
          <button className="text-[10px] bg-white text-black px-3 py-1.5 rounded">Build Yours</button>
          <button className="text-[10px] border border-white px-3 py-1.5 rounded">Test Drive</button>
        </div>
      </div>
      {/* tab strip */}
      <div className="border-b text-[11px] flex gap-5 px-5 h-9 items-center text-neutral-600">
        <span className="border-b-2 border-black text-black h-9 flex items-center">Overview</span>
        <span>Specifications</span><span>Features</span><span>Gallery</span><span>Pricing</span>
      </div>
      {/* spec section */}
      <div className="p-5 space-y-4">
        <h2 className="text-base font-semibold">Performance & Powertrain</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
          {([
            ["Drivetrain", "drivetrain", f.drivetrain || "AWD"],
            ["Battery", "battery_kwh", `${f.battery_kwh || "—"} kWh`],
            ["Range (EPA est.)", "range_mi", `${f.range_mi || "—"} mi`],
            ["0–60 mph", "zero_to_sixty_s", `${f.zero_to_sixty_s || "—"} s`],
            ["Top speed", "", "130 mph (electronically limited)"],
            ["Charging (DC)", "", "Up to 145 kW"],
          ] as [string, string, string][]).map(([k, fn, v]) => (
            <div key={k} className="flex justify-between border-b border-dashed border-neutral-200 py-1">
              <span className="text-neutral-500">{k}</span><span data-field={fn || undefined} className="font-medium">{v}</span>
            </div>
          ))}
        </div>
        <h2 className="text-base font-semibold pt-3">Dimensions</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
          {([
            ["Length", "length_in", `${f.length_in || "—"} in`],
            ["Wheelbase", "wheelbase_in", `${f.wheelbase_in || "—"} in`],
            ["Curb weight", "", "4,365 lb"],
            ["Cargo (max)", "", "57.2 cu ft"],
          ] as [string, string, string][]).map(([k, fn, v]) => (
            <div key={k} className="flex justify-between border-b border-dashed border-neutral-200 py-1">
              <span className="text-neutral-500">{k}</span><span data-field={fn || undefined} className="font-medium">{v}</span>
            </div>
          ))}
        </div>
        <h2 className="text-base font-semibold pt-3">Standard Features</h2>
        <ul className="text-[12px] list-disc pl-5 space-y-1 text-neutral-700">
          <li>iDrive 8.5 with curved display (10.25" + 10.7")</li>
          <li>Driving Assistant Professional · adaptive cruise · lane keeping</li>
          <li>Heated front seats · 2-zone automatic climate control</li>
          <li>Wireless Apple CarPlay & Android Auto</li>
          <li>Panoramic moonroof</li>
        </ul>
        <h2 className="text-base font-semibold pt-3">Pricing</h2>
        <table className="w-full text-[12px] border-t border-neutral-200">
          <tbody>
            <tr className="border-b"><td className="py-2 text-neutral-500"><span data-field="trim">{trim}</span></td><td className="py-2 text-right font-semibold"><span data-field="msrp">{msrp}</span></td></tr>
            <tr className="border-b"><td className="py-2 text-neutral-500">Destination & handling</td><td className="py-2 text-right">$995</td></tr>
            <tr><td className="py-2 text-neutral-500">As shown</td><td className="py-2 text-right font-semibold">{msrp}</td></tr>
          </tbody>
        </table>
        <div className="h-8" />
        <div className="text-[10px] text-neutral-400 border-t pt-3">© {new Date().getFullYear()} {oem} of North America, LLC. Specifications are estimates and subject to change.</div>
        <FieldsReference item={item} />
      </div>
    </div>
  );
}

/* ---------- HTML: News article (Reuters/Automotive News style) ---------- */
function NewsArticlePage({ f, item }: { f: Record<string, string>; item: HitlItem }) {
  return (
    <div className="bg-white text-neutral-900 shadow-xl rounded overflow-hidden mx-auto max-w-[640px]">
      <div className="bg-[#fa6400] text-white px-4 h-9 flex items-center text-[11px] font-semibold tracking-widest">
        REUTERS · BUSINESS / AUTOS
      </div>
      <div className="px-5 h-9 flex items-center gap-4 text-[11px] text-neutral-600 border-b">
        <span>World</span><span>Markets</span><span className="text-black font-semibold">Autos</span><span>Tech</span><span>Sustainability</span>
      </div>
      <div className="p-5 space-y-4">
        <div data-field="published_at" className="text-[10px] tracking-widest text-neutral-500">AUTOMOTIVE · {f.published_at || new Date().toDateString()}</div>
        <h1 data-field="headline" className="text-2xl font-serif font-bold leading-tight">{item.summary}</h1>
        <div className="text-[11px] text-neutral-500 flex gap-3 border-b pb-3 flex-wrap items-center">
          <span data-field="publisher">{f.publisher || "Reuters Staff"}</span><span>·</span><span>4 min read</span><span>·</span>
          <span data-field="cluster">{f.cluster || "EV Supply"}</span>
          <span>·</span>
          <span data-field="sentiment" className={f.sentiment ? "px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-800 font-medium" : "text-neutral-400 text-[10px]"}>{f.sentiment || "—"}</span>
          <span>·</span>
          <span data-field="impact" className={f.impact ? "px-1.5 py-0.5 rounded text-[10px] bg-orange-100 text-orange-800 font-medium" : "text-neutral-400 text-[10px]"}>{f.impact || "—"}</span>
        </div>
        <div className="flex gap-4 flex-wrap text-[11px] text-neutral-500 pb-1 border-b">
          <span>OEM: <span data-field="primary_oem" className="font-medium text-neutral-800">{f.primary_oem || "—"}</span></span>
          <span>Region: <span data-field="region" className="font-medium text-neutral-800">{f.region || "—"}</span></span>
        </div>
        <div className="h-40 bg-gradient-to-br from-neutral-300 to-neutral-500 rounded grid place-items-center text-white text-xs italic">[ wire photo ]</div>
        <p className="text-[13px] leading-relaxed text-neutral-800 font-serif">
          {item.detail || "DETROIT — In a move that could reshape the global automotive supply chain, executives signaled a multi-year commitment to scale next-generation battery technologies, citing accelerating demand from fleet operators and tightening regulatory timelines across North America and Europe."}
        </p>
        <p className="text-[13px] leading-relaxed text-neutral-800 font-serif">
          The announcement comes amid a broader push by automakers to lock in raw-material supply ahead of an expected wave of new electric model launches in 2026 and 2027. Analysts at three major banks separately raised their full-year EV penetration forecasts within hours of the news.
        </p>
        <blockquote className="border-l-4 border-[#fa6400] pl-3 text-[13px] italic text-neutral-700">
          “This is a structural shift — not a quarter-to-quarter call,” said one industry analyst on the call.
        </blockquote>
        <p className="text-[13px] leading-relaxed text-neutral-800 font-serif">
          Shares moved on the disclosure during after-hours trading. Reporting by Reuters Autos Desk; editing by the markets team.
        </p>
        <div className="grid grid-cols-2 gap-3 pt-3 border-t">
          {["Tesla cuts Model Y MSRP", "GM reopens Orion Township", "BYD secures lithium offtake", "California ACC II letter"].map((t) => (
            <div key={t} className="text-[11px] text-neutral-700 hover:underline cursor-pointer">▸ {t}</div>
          ))}
        </div>
        <div className="text-[10px] text-neutral-400 pt-3 border-t">© {new Date().getFullYear()} Thomson Reuters. All rights reserved.</div>
        <FieldsReference item={item} />
      </div>
    </div>
  );
}

/* ---------- HTML: EV station detail page ---------- */
function EvStationPage({ f, item }: { f: Record<string, string>; item: HitlItem }) {
  return (
    <div className="bg-white text-neutral-900 shadow-xl rounded overflow-hidden mx-auto max-w-[640px]">
      <div className="bg-[#0a8f3c] text-white px-4 h-10 flex items-center font-semibold tracking-wide text-sm">⚡ ChargePoint · Station Locator</div>
      <div className="h-32 bg-[url('https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800')] bg-cover bg-center" />
      <div className="p-5 space-y-3">
        <h1 className="text-xl font-bold" data-field="station_name">{f.station_name || item.recordName}</h1>
        <div className="text-[12px] text-neutral-600"><span data-field="city">{f.city}</span>, <span data-field="state">{f.state}</span> · <span data-field="network">{f.network || "ChargePoint"}</span></div>
        <div className="grid grid-cols-2 gap-3 text-[12px] border-t pt-3">
          {([["Connector type", "type", f.type], ["Power", "power", f.power], ["Pricing", "pricing", f.pricing], ["Availability", "availability", f.availability], ["Network", "network", f.network], ["Open hours", "", "24/7"]] as [string, string, string][]).map(([k, fn, v]) => (
            <div key={k} className="flex justify-between border-b border-dashed py-1.5"><span className="text-neutral-500">{k}</span><span data-field={fn || undefined} className="font-medium">{v || "—"}</span></div>
          ))}
        </div>
        <div className="text-[12px] pt-3 leading-relaxed">{item.detail}</div>
        <div className="text-[10px] text-neutral-400 pt-4 border-t">© ChargePoint Inc.</div>
        <FieldsReference item={item} />
      </div>
    </div>
  );
}

/* ---------- HTML: Dealer rooftop page ---------- */
function DealerPage({ f, item }: { f: Record<string, string>; item: HitlItem }) {
  return (
    <div className="bg-white text-neutral-900 shadow-xl rounded overflow-hidden mx-auto max-w-[640px]">
      <div className="bg-[#0b3d91] text-white px-4 h-10 flex items-center font-semibold text-sm"><span data-field="dealer">{f.dealer || item.recordName}</span> · Authorized Dealer</div>
      <div className="p-5 space-y-3">
        <div className="text-[11px] text-neutral-500 tracking-widest">SHOWROOM</div>
        <h1 className="text-xl font-bold" data-field="dealer">{f.dealer || item.recordName}</h1>
        <div className="text-[12px] text-neutral-600"><span data-field="city">{f.city || "—"}</span> · <span data-field="oem">{f.oem || "Multi-OEM"}</span></div>
        <div className="grid grid-cols-2 gap-3 text-[12px] border-t pt-3">
          {([["Inventory", "inventory", f.inventory], ["Avg Days on Lot", "avg_dol", f.avg_dol], ["Sales velocity", "velocity", f.velocity], ["Insight", "insight", f.insight]] as [string, string, string][]).map(([k, fn, v]) => (
            <div key={k} className="flex justify-between border-b border-dashed py-1.5"><span className="text-neutral-500">{k}</span><span data-field={fn} className="font-medium">{v || "—"}</span></div>
          ))}
        </div>
        <FieldsReference item={item} />
      </div>
    </div>
  );
}

/* ---------- HTML: generic site page ---------- */
function GenericSitePage({ f, item }: { f: Record<string, string>; item: HitlItem }) {
  return (
    <div className="bg-white text-neutral-900 shadow-xl rounded p-5 mx-auto max-w-[640px]">
      <h1 className="text-lg font-semibold">{item.summary}</h1>
      <p className="text-[12px] text-neutral-700 mt-2 leading-relaxed">{item.detail}</p>
      <table className="mt-3 w-full text-[12px]">
        <tbody>
          {Object.entries(f).slice(0, 10).map(([k, v]) => (
            <tr key={k} className="border-t"><td className="py-1 text-neutral-500">{k}</td><td data-field={k} className="py-1 font-medium">{v}</td></tr>
          ))}
        </tbody>
      </table>
      <FieldsReference item={item} />
    </div>
  );
}

/* ---------- HTML: OEM Configurator (BMW / Tesla / Audi style build-and-price) ---------- */
function OemConfiguratorPage({ f, item }: { f: Record<string, string>; item: HitlItem }) {
  const oem = (f.oem || "BMW").toUpperCase();
  const model = f.model || item.recordName?.split(" ")[0] || "iX1";
  const trim = f.trim || "xDrive40";
  const msrp = f.msrp || "$52,400";
  const palette = oem.includes("TESLA")
    ? { nav: "#000", accent: "#cc0000", chip: "#171a20", hero: "linear-gradient(160deg,#0f0f0f,#1f2937)", brand: "TESLA" }
    : oem.includes("AUDI")
    ? { nav: "#000", accent: "#bb0a30", chip: "#f2f2f2", hero: "linear-gradient(160deg,#1a1a1a,#404040)", brand: "AUDI" }
    : { nav: "#fff", accent: "#1c69d4", chip: "#f4f4f4", hero: "linear-gradient(160deg,#0653b6,#001d6c)", brand: "BMW" };

  return (
    <div className="bg-white text-neutral-900 shadow-2xl rounded overflow-hidden mx-auto max-w-[680px] border border-neutral-200">
      {/* OEM top nav bar */}
      <div className="h-11 flex items-center px-5 text-[12px]" style={{ background: palette.nav, color: palette.nav === "#fff" ? "#000" : "#fff" }}>
        <span data-field="oem" className="font-black tracking-[0.2em] text-[14px]">{palette.brand}</span>
        <nav className="flex gap-5 ml-8 opacity-80">
          <span>Models</span><span className="font-semibold underline underline-offset-4">Build Your Own</span>
          <span>Shopping Tools</span><span>Owners</span>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-[10px] opacity-80"><span>📍 ZIP 94025</span><span>Sign In</span></div>
      </div>

      {/* Configurator hero — vehicle preview area */}
      <div className="relative h-52 text-white p-5 flex flex-col justify-end" style={{ background: palette.hero }}>
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.25),transparent_60%)]" />
        <div className="absolute right-6 top-5 flex gap-1.5">
          {["Exterior", "Interior", "360°", "VR"].map((t, i) => (
            <span key={t} className={`text-[10px] px-2 py-1 rounded ${i === 0 ? "bg-white text-black font-semibold" : "border border-white/40"}`}>{t}</span>
          ))}
        </div>
        <div className="relative">
          <div className="text-[10px] tracking-[0.25em] opacity-80">{new Date().getFullYear()} · {palette.brand} CONFIGURATOR</div>
          <div data-field="model" className="text-3xl font-light leading-none mt-2">{model}</div>
          <div className="text-sm opacity-90 mt-1"><span data-field="trim">{trim}</span> · from <span data-field="msrp" className="font-semibold">{msrp}</span></div>
        </div>
        {/* car silhouette */}
        <svg viewBox="0 0 400 80" className="absolute left-1/2 -translate-x-1/2 bottom-2 w-[70%] opacity-40">
          <path d="M20 60 Q60 25 140 25 L220 25 Q280 25 320 50 L380 55 Q390 55 390 65 L20 65 Z" fill="#fff" />
          <circle cx="110" cy="65" r="12" fill="#000" /><circle cx="110" cy="65" r="6" fill="#666" />
          <circle cx="300" cy="65" r="12" fill="#000" /><circle cx="300" cy="65" r="6" fill="#666" />
        </svg>
      </div>

      {/* Configurator stepper */}
      <div className="flex items-center justify-between px-5 h-11 border-b text-[11px] bg-neutral-50">
        {["Model", "Trim", "Exterior", "Interior", "Wheels", "Packages", "Summary"].map((s, i) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full grid place-items-center text-[10px] font-semibold text-white" style={{ background: i <= 1 ? palette.accent : "#bbb" }}>{i + 1}</span>
            <span className={i <= 1 ? "text-black font-semibold" : "text-neutral-500"}>{s}</span>
          </div>
        ))}
      </div>

      {/* Selected configuration table */}
      <div className="p-5 space-y-4">
        <div className="flex items-baseline justify-between border-b pb-2">
          <h2 className="text-base font-semibold">Your Configuration</h2>
          <button className="text-[11px] underline" style={{ color: palette.accent }}>Reset</button>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
          {([
            ["Model", "model", model],
            ["Trim", "trim", trim],
            ["Drivetrain", "drivetrain", f.drivetrain || "AWD"],
            ["Battery", "battery_kwh", `${f.battery_kwh || "81.5"} kWh`],
            ["Range (EPA est.)", "range_mi", `${f.range_mi || "307"} mi`],
            ["0–60 mph", "zero_to_sixty_s", `${f.zero_to_sixty_s || "4.6"} s`],
            ["Body length", "length_in", `${f.length_in || "—"} in`],
            ["Exterior color", "color", f.color || "Frozen Pure Grey Metallic"],
            ["Interior", "interior", f.interior || "Veganza Mocha"],
            ["Wheels", "wheels", f.wheels || '20" M Aerodynamic Bicolour'],
          ] as [string, string, string][]).map(([k, fn, v]) => (
            <div key={k} className="flex justify-between border-b border-dashed border-neutral-200 py-1.5">
              <span className="text-neutral-500">{k}</span><span data-field={fn} className="font-medium text-right ml-3">{v}</span>
            </div>
          ))}
        </div>

        <div className="rounded-lg p-3" style={{ background: palette.chip, color: palette.chip === "#171a20" ? "#fff" : undefined }}>
          <div className="text-[10px] tracking-widest opacity-70">PACKAGES INCLUDED</div>
          <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
            {["Premium Package · $2,800", "Driving Assistant Pro · $1,700", "Harman Kardon Audio · $875", "Sky Lounge Glass Roof · $1,200"].map((p) => (
              <div key={p} className="flex items-center gap-1"><span style={{ color: palette.accent }}>✓</span>{p}</div>
            ))}
          </div>
        </div>

        <table className="w-full text-[12px] border-t border-neutral-200">
          <tbody>
            <tr className="border-b"><td className="py-2 text-neutral-500">Base MSRP ({trim})</td><td className="py-2 text-right font-semibold">{msrp}</td></tr>
            <tr className="border-b"><td className="py-2 text-neutral-500">Options & packages</td><td className="py-2 text-right">$6,575</td></tr>
            <tr className="border-b"><td className="py-2 text-neutral-500">Destination & handling</td><td className="py-2 text-right">$995</td></tr>
            <tr><td className="py-2 font-semibold">Total as configured</td><td className="py-2 text-right font-bold text-base" style={{ color: palette.accent }}>$60,070</td></tr>
          </tbody>
        </table>

        <div className="flex gap-2 pt-2">
          <button className="flex-1 text-[12px] py-2.5 rounded text-white font-semibold" style={{ background: palette.accent }}>Save Configuration</button>
          <button className="flex-1 text-[12px] py-2.5 rounded border border-neutral-300 font-semibold">Find Dealer Inventory</button>
        </div>

        <div className="text-[10px] text-neutral-400 border-t pt-3">
          © {new Date().getFullYear()} {oem}. Configurator data captured for <span className="font-mono">{item.recordName}</span> · scraped from public build-and-price journey.
        </div>
        <FieldsReference item={item} />
      </div>
    </div>
  );
}

/* ---------- PDF: Vehicle spec sheet (Mercedes / BMW style) ---------- */
function VehicleSpecSheetPdf({ f, item }: { f: Record<string, string>; item: HitlItem }) {
  const oem = f.oem || "Mercedes-Benz";
  const model = f.model || item.recordName?.split(" ")[0] || "EQE";
  const trim = f.trim || "350 4MATIC";
  const brandColor = oem.toLowerCase().includes("ford") ? "#003478"
    : oem.toLowerCase().includes("bmw") ? "#1c69d4"
    : oem.toLowerCase().includes("audi") ? "#bb0a30"
    : oem.toLowerCase().includes("maruti") || oem.toLowerCase().includes("suzuki") ? "#e60012"
    : "#111";

  return (
    <div className="bg-white text-neutral-900 shadow-2xl mx-auto max-w-[640px] aspect-[1/1.414] flex flex-col text-[11px] border border-neutral-300 relative overflow-hidden">
      {/* Brochure cover band */}
      <div className="relative h-[34%] text-white p-6 flex flex-col" style={{ background: `linear-gradient(135deg, ${brandColor}, #111)` }}>
        <div className="flex items-center justify-between">
          <div className="text-[9px] tracking-[0.35em] opacity-80"><span data-field="oem">{oem.toUpperCase()}</span> · PRODUCT BROCHURE</div>
          <div className="text-[9px] tracking-[0.2em] opacity-80">MY{new Date().getFullYear()}</div>
        </div>
        <div className="mt-auto">
          <div data-field="model" className="text-5xl font-light leading-none">{model}</div>
          <div data-field="trim" className="text-base mt-1 opacity-90">{trim}</div>
          <div className="text-[10px] mt-2 opacity-70 italic">Engineered for the way you drive.</div>
        </div>
        {/* car silhouette */}
        <svg viewBox="0 0 400 90" className="absolute right-4 bottom-3 w-[55%] opacity-60">
          <path d="M20 65 Q60 25 150 25 L230 25 Q290 25 330 55 L380 60 Q390 60 390 70 L20 70 Z" fill="#fff" />
          <circle cx="115" cy="70" r="13" fill="#000" /><circle cx="115" cy="70" r="6" fill="#999" />
          <circle cx="305" cy="70" r="13" fill="#000" /><circle cx="305" cy="70" r="6" fill="#999" />
          <rect x="155" y="33" width="80" height="14" rx="3" fill="rgba(255,255,255,0.6)" />
        </svg>
      </div>

      {/* Spec body */}
      <div className="flex-1 p-6 flex flex-col">
        <div className="flex items-baseline justify-between border-b-2 pb-2" style={{ borderColor: brandColor }}>
          <div className="text-[10px] tracking-[0.25em] font-bold" style={{ color: brandColor }}>TECHNICAL SPECIFICATIONS</div>
          <div className="text-[9px] text-neutral-500">Ref. {item.recordName?.replace(/\s+/g, "-").toUpperCase()} · Rev. 03</div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-6 flex-1">
          <div>
            <SectionTitle>POWERTRAIN</SectionTitle>
            <PdfRow k="Drivetrain" v={f.drivetrain || "AWD"} field="drivetrain" />
            <PdfRow k="Battery capacity" v={`${f.battery_kwh || "—"} kWh`} field="battery_kwh" />
            <PdfRow k="Range (EPA est.)" v={`${f.range_mi || "—"} mi`} field="range_mi" />
            <PdfRow k="0–60 mph" v={`${f.zero_to_sixty_s || "—"} s`} field="zero_to_sixty_s" />
            <PdfRow k="Peak power" v="288 kW (385 hp)" />
            <PdfRow k="Peak torque" v="565 lb-ft" />

            <SectionTitle>CHARGING</SectionTitle>
            <PdfRow k="DC fast charge" v="170 kW (10–80% / 32 min)" />
            <PdfRow k="AC onboard" v="11 kW" />
            <PdfRow k="Connector" v="CCS Combo 1" />
          </div>
          <div>
            <SectionTitle>DIMENSIONS</SectionTitle>
            <PdfRow k="Length" v={`${f.length_in || "—"} in`} field="length_in" />
            <PdfRow k="Wheelbase" v={`${f.wheelbase_in || "—"} in`} field="wheelbase_in" />
            <PdfRow k="Width (w/ mirrors)" v="83.1 in" />
            <PdfRow k="Height" v="59.6 in" />
            <PdfRow k="Curb weight" v="5,597 lb" />
            <PdfRow k="Cargo (rear seats up)" v="15.0 cu ft" />

            <SectionTitle>PRICING</SectionTitle>
            <PdfRow k="MSRP" v={f.msrp || "—"} field="msrp" />
            <PdfRow k="Destination & delivery" v="$1,150" />
            <PdfRow k="As shown" v={f.msrp || "—"} />
          </div>
        </div>

        {/* Color swatches strip — brochure style */}
        <div className="mt-3 pt-3 border-t border-neutral-200">
          <div className="text-[9px] tracking-[0.25em] font-bold text-neutral-700 mb-2">AVAILABLE EXTERIOR COLORS</div>
          <div className="flex gap-2 items-center">
            {[
              ["#0a0a0a", "Jet Black"],
              ["#e5e7eb", "Glacier White"],
              ["#7a8a99", "Storm Grey"],
              ["#6b1d1d", "Sangria Red"],
              ["#1c3a5e", "Midnight Blue"],
              ["#8a7a4a", "Desert Bronze"],
            ].map(([c, n]) => (
              <div key={n} className="flex flex-col items-center gap-1">
                <div className="w-7 h-7 rounded-full border border-neutral-300 shadow-sm" style={{ background: c }} />
                <span className="text-[8px] text-neutral-500">{n}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded p-2.5 text-[10px]" style={{ background: `${brandColor}10`, border: `1px solid ${brandColor}40` }}>
            <div className="font-bold mb-1" style={{ color: brandColor }}>STANDARD EQUIPMENT</div>
            <ul className="list-disc pl-4 space-y-0.5 text-neutral-700">
              <li>Driver Assistance Package</li>
              <li>Premium audio · 14 speakers</li>
              <li>Heated/ventilated front seats</li>
              <li>Wireless Apple CarPlay / Android Auto</li>
            </ul>
          </div>
          <div className="rounded p-2.5 text-[10px]" style={{ background: "#fafafa", border: "1px solid #e5e5e5" }}>
            <div className="font-bold mb-1 text-neutral-800">SAFETY · NHTSA</div>
            <div className="flex items-center gap-1 mt-1">
              {[1,2,3,4,5].map((s) => (<span key={s} style={{ color: "#f5a623" }}>★</span>))}
              <span className="ml-1 text-neutral-500">Overall</span>
            </div>
            <ul className="list-disc pl-4 mt-1 space-y-0.5 text-neutral-700">
              <li>Auto emergency braking</li>
              <li>Blind-spot · rear cross-traffic</li>
              <li>Lane-keep assist · adaptive cruise</li>
            </ul>
          </div>
        </div>

        <div className="mt-auto pt-3 border-t text-[8.5px] text-neutral-500 flex justify-between">
          <span>© {new Date().getFullYear()} {oem}. Specifications subject to change without notice. EPA estimates pending final certification.</span>
          <span className="font-mono">Page 1 / 2</span>
        </div>
        <FieldsReference item={item} />
      </div>
    </div>
  );
}

/* ---------- PDF: Plant data sheet ---------- */
function PlantDataSheetPdf({ f, item }: { f: Record<string, string>; item: HitlItem }) {
  return (
    <div className="bg-white text-neutral-900 shadow-xl mx-auto max-w-[640px] aspect-[1/1.414] p-8 flex flex-col text-[11px]">
      <div className="flex items-start justify-between border-b-2 border-[#0b3d91] pb-3">
        <div>
          <div className="text-[9px] tracking-[0.3em] text-[#0b3d91]">PLANT REGISTRY · ENTITY SHEET</div>
          <div className="text-2xl font-semibold mt-1" data-field="plant_name">{f.plant_name || item.recordName}</div>
          <div className="text-[12px] text-neutral-600" data-field="supplier_group">{f.supplier_group || "ZF Friedrichshafen AG"}</div>
        </div>
        <div className="text-right text-[9px] text-neutral-500">
          <div>Ref. PLT-{(item.id || "").slice(0, 6).toUpperCase()}</div>
          <div>Compiled {new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6">
        <div>
          <SectionTitle>LOCATION</SectionTitle>
          <PdfRow k="Address" v={f.address_line1 || "1 Industriestrasse"} field="address_line1" />
          <PdfRow k="City" v={f.city || "Friedrichshafen"} field="city" />
          <PdfRow k="State / Province" v={f["state / province"] || f.state || "Baden-Württemberg"} field="state" />
          <PdfRow k="Country" v={f.country || "Germany"} field="country" />
          <PdfRow k="Latitude" v={f.latitude || "47.6779"} field="latitude" />
          <PdfRow k="Longitude" v={f.longitude || "9.4731"} field="longitude" />
        </div>
        <div>
          <SectionTitle>OPERATIONS</SectionTitle>
          <PdfRow k="Site type" v={f.site_type || "Manufacturing"} field="site_type" />
          <PdfRow k="Headcount" v={f.headcount || "—"} field="headcount" />
          <PdfRow k="Annual capacity" v={f.annual_capacity || "—"} field="annual_capacity" />
          <PdfRow k="Primary segment" v="Driveline systems" />
          <PdfRow k="Year established" v="1915" />
          <PdfRow k="Certifications" v="IATF 16949, ISO 14001" />
        </div>
      </div>

      <div className="mt-5">
        <SectionTitle>NOTES</SectionTitle>
        <p className="text-[10.5px] text-neutral-700 leading-relaxed">
          Site verified against corporate registry and OSM Nominatim admin boundaries. Administrative naming
          normalized per ISO 3166-2. Geocoded via Google Geocoding API with confidence band ≥ 0.93.
        </p>
      </div>

      <div className="mt-auto pt-4 border-t text-[9px] text-neutral-500 flex justify-between">
        <span>Sourced from corporate site & registry feeds. Subject to verification.</span>
        <span>Page 1 of 1</span>
      </div>
      <FieldsReference item={item} />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 mb-1 text-[9px] tracking-[0.25em] font-bold text-neutral-900 border-b border-neutral-300 pb-1">{children}</div>;
}
function PdfRow({ k, v, field }: { k: string; v: string; field?: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-dashed border-neutral-200">
      <span className="text-neutral-500">{k}</span>
      <span data-field={field} className="font-medium text-right ml-3 truncate" title={v}>{v}</span>
    </div>
  );
}

/* Universal fallback reference — renders every field from item.fields with its exact data-field
   so clicking ANY RHS attribute always locates its value in LHS, even for bot-extracted fields
   whose names don't match the styled template above. querySelector finds styled elements first
   (they appear earlier in the DOM), so this only acts as fallback for unknown field names. */
function FieldsReference({ item }: { item: HitlItem }) {
  const fields = item.fields ?? [];
  if (!fields.length) return null;
  return (
    <div className="mt-4 pt-3 border-t border-neutral-100">
      <div className="text-[8px] tracking-[0.25em] text-neutral-300 font-bold mb-1.5 uppercase">Extracted fields reference</div>
      <div className="grid grid-cols-2 gap-x-4">
        {fields.map((f) => (
          <div key={f.name} className="flex justify-between text-[10px] py-0.5 border-b border-dashed border-neutral-100">
            <span className="text-neutral-300 font-mono truncate mr-2">{f.name}</span>
            <span data-field={f.name} className="text-neutral-500 font-mono text-right truncate max-w-[140px]" title={f.value || "—"}>{f.value || "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

