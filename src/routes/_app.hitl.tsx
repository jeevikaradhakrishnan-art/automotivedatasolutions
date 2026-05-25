import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  Check, X, ClipboardCheck, Filter, FileText, Globe,
  ChevronLeft, ChevronRight, Info, Search, SkipForward, ArrowRight, Layers, Lock,
  ZoomIn, ZoomOut, Languages, Plus, MessageSquare, Sparkles, Keyboard, History,
  Activity, Gauge, ChevronDown, MapPin, Save, CircleDot, Circle, MousePointerClick,
} from "lucide-react";
import { usePlatform, type HitlItem, type HitlStatus, type Job } from "@/store/platform";
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
    const map = new Map<string, { job: Job; items: HitlItem[]; previewKind: "html" | "pdf" }>();
    hitl.forEach((h) => {
      if (!h.jobId) return;
      const job = jobs.find((j) => j.id === h.jobId);
      if (!job) return;
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
        onResolve={resolve}
        onComplete={() => { completeReview(openBatch.job.id); setOpenJobId(null); }}
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
          <Stat label="PENDING"  value={pendingTotal} tone="amber" />
          <Stat label="APPROVED" value={approvedTotal} tone="success" />
          <Stat label="REJECTED" value={rejectedTotal} tone="danger" />
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
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-cyan text-[11px] font-mono flex items-center gap-1 justify-end">
                        {pending > 0 ? "REVIEW" : "OPEN"} <ArrowRight className="size-3" />
                      </span>
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
  previewKind: "html" | "pdf";
  onBack: () => void;
  onResolve: (id: string, status: HitlStatus) => void;
  onComplete: () => void;
  onFeedback: (rating: "up" | "down", message: string) => void;
}) {
  const sol = getSolution(job.solutionId);
  void sol;
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
  const [view, setView] = useState<"html" | "pdf">(previewKind);
  const [language, setLanguage] = useState<"original" | "translated">("original");
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [openComment, setOpenComment] = useState<string | null>(null);
  const [extraFields, setExtraFields] = useState<{ name: string; value: string; group: string }[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [manualAnnot, setManualAnnot] = useState<Record<string, true>>({});
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const [ctxQuery, setCtxQuery] = useState("");
  const [auditLog, setAuditLog] = useState<{ at: string; msg: string; tone: "cyan" | "success" | "danger" | "amber" }[]>(
    () => [{ at: new Date().toISOString(), msg: `Batch opened · ${items.length} records loaded from ${job.source}`, tone: "cyan" }]
  );
  const lhsRef = useRef<HTMLDivElement>(null);

  const item = items[idx];
  const allFields = useMemo(() => {
    const base = (item.fields ?? []).map((f) => ({ ...f, value: edits[`${item.id}:${f.name}`] ?? f.value }));
    const extras = extraFields.map((e) => ({ name: e.name, value: e.value, group: e.group, confidence: 100 }));
    return [...base, ...extras];
  }, [item, edits, extraFields]);

  const pushAudit = useCallback((msg: string, tone: "cyan" | "success" | "danger" | "amber" = "cyan") => {
    setAuditLog((l) => [{ at: new Date().toISOString(), msg, tone }, ...l].slice(0, 40));
  }, []);

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
      else if (e.key === "Escape") { setSelectedField(null); setShowShortcuts(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleApprove, handleReject, handleSkip, goNext, goPrev]);

  const pendingLeft = items.filter((i) => i.status === "pending").length;
  const approved = items.filter((i) => i.status === "approved").length;
  const rejected = items.filter((i) => i.status === "rejected").length;
  const completionPct = Math.round(((approved + rejected) / items.length) * 100);

  const confTier = (c: number) => (c >= 90 ? "high" : c >= 75 ? "medium" : "low");
  const filtered = allFields
    .filter((f) => confidenceFilter === "all" || confTier(f.confidence) === confidenceFilter)
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
    const h = allFields.filter((f) => confTier(f.confidence) === "high").length;
    const m = allFields.filter((f) => confTier(f.confidence) === "medium").length;
    const l = allFields.filter((f) => confTier(f.confidence) === "low").length;
    const avg = allFields.length ? Math.round(allFields.reduce((s, f) => s + f.confidence, 0) / allFields.length) : 0;
    return { h, m, l, avg };
  }, [allFields]);

  const handleSelectField = (name: string) => {
    setSelectedField(name);
    pushAudit(`Located "${name}" on source`, "cyan");
    requestAnimationFrame(() => {
      const el = lhsRef.current?.querySelector(`[data-field="${CSS.escape(name)}"]`);
      if (el && "scrollIntoView" in el) (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const handleEdit = (fname: string, val: string) => {
    setEdits((e) => ({ ...e, [`${item.id}:${fname}`]: val }));
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-surface/40 via-background to-surface/20 relative">
      {/* Sticky top toolbar */}
      <div className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-xl px-4 py-2.5 flex items-center gap-3 shadow-sm">
        <button onClick={onBack} className="h-8 px-2.5 rounded-md text-[11px] font-mono border border-border hover:border-cyan/40 hover:bg-cyan/5 flex items-center gap-1 transition">
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
          <button onClick={() => setShowAudit((v) => !v)} className={`h-8 px-2 rounded-md text-[10px] font-mono border flex items-center gap-1 transition ${showAudit ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-border hover:border-cyan/30"}`} title="Audit trail">
            <History className="size-3" /> AUDIT
          </button>
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
            <div className="flex items-center rounded-md border border-border overflow-hidden">
              <button onClick={() => setView("html")} className={`h-7 px-2 text-[10px] font-mono flex items-center gap-1 transition ${view === "html" ? "bg-cyan/10 text-cyan" : "text-muted-foreground hover:bg-surface-elevated"}`}>
                <Globe className="size-3" /> HTML
              </button>
              <button onClick={() => setView("pdf")} className={`h-7 px-2 text-[10px] font-mono flex items-center gap-1 transition ${view === "pdf" ? "bg-amber/10 text-amber" : "text-muted-foreground hover:bg-surface-elevated"}`}>
                <FileText className="size-3" /> PDF
              </button>
            </div>
            <div className="flex items-center rounded-md border border-border">
              <button onClick={() => setZoom((z) => Math.max(60, z - 10))} className="h-7 w-7 grid place-items-center hover:bg-surface-elevated transition"><ZoomOut className="size-3" /></button>
              <span className="text-[10px] font-mono px-1 tabular-nums w-10 text-center">{zoom}%</span>
              <button onClick={() => setZoom((z) => Math.min(160, z + 10))} className="h-7 w-7 grid place-items-center hover:bg-surface-elevated transition"><ZoomIn className="size-3" /></button>
            </div>
            <div className="flex items-center rounded-md border border-border">
              <button disabled className="h-7 w-7 grid place-items-center opacity-40"><ChevronLeft className="size-3" /></button>
              <span className="text-[10px] font-mono px-1">P 1/1</span>
              <button disabled className="h-7 w-7 grid place-items-center opacity-40"><ChevronRight className="size-3" /></button>
            </div>
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

          <div
            className="flex-1 overflow-y-auto bg-[linear-gradient(135deg,oklch(0.96_0.005_220),oklch(0.97_0.008_180))] p-4 relative"
            ref={lhsRef}
            onContextMenu={(e) => {
              const sel = window.getSelection?.();
              const text = sel?.toString().trim() ?? "";
              if (!text) return;
              e.preventDefault();
              setCtxQuery("");
              setCtxMenu({ x: e.clientX, y: e.clientY, text });
            }}
          >
            <div className="absolute top-3 right-6 z-10 flex flex-col gap-1 text-[9px] font-mono">
              <span className="px-1.5 py-0.5 rounded bg-success/15 border border-success/40 text-success backdrop-blur">● SELECTED</span>
              <span className="px-1.5 py-0.5 rounded bg-amber/15 border border-amber/40 text-amber backdrop-blur">● AUTO-EXTRACTED</span>
              <span className="px-1.5 py-0.5 rounded bg-card/80 border border-border text-muted-foreground backdrop-blur flex items-center gap-1"><MousePointerClick className="size-2.5" /> RIGHT-CLICK TO ANNOTATE</span>
            </div>
            <div style={{ zoom: `${zoom}%` }} className="transition-all">
              <SourceWithHighlights
                solutionId={job.solutionId}
                item={item}
                view={view}
                selectedField={selectedField}
                search={lhsSearch}
                language={language}
              />
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
              <div className="flex items-center rounded-md border border-border overflow-hidden text-[10px] font-mono">
                {(["all", "high", "medium", "low"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setConfidenceFilter(t)}
                    className={`h-7 px-2 transition ${
                      confidenceFilter === t
                        ? t === "high" ? "bg-success/15 text-success" : t === "medium" ? "bg-amber/15 text-amber" : t === "low" ? "bg-danger/15 text-danger" : "bg-cyan/15 text-cyan"
                        : "text-muted-foreground hover:bg-surface-elevated"
                    }`}
                  >
                    {t === "all" ? "ALL" : t === "high" ? `H·${dist.h}` : t === "medium" ? `M·${dist.m}` : `L·${dist.l}`}
                  </button>
                ))}
              </div>
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
                        const tier = confTier(f.confidence);
                        const ring = tier === "high" ? "border-l-success" : tier === "medium" ? "border-l-amber" : "border-l-danger";
                        const chipTone = tier === "high" ? "bg-success/15 text-success border-success/30" : tier === "medium" ? "bg-amber/15 text-amber border-amber/30" : "bg-danger/15 text-danger border-danger/30";
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
              onClick={onComplete}
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
                <div className="text-[11px] font-mono mt-1 truncate text-foreground" title={ctxMenu.text}>
                  “{ctxMenu.text}”
                </div>
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




      {/* ============ Audit trail drawer ============ */}
      {showAudit && (
        <div className="fixed top-16 right-4 z-30 w-80 max-h-[70vh] rounded-xl border border-border bg-card/90 backdrop-blur-xl shadow-2xl flex flex-col">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <History className="size-3.5 text-cyan" />
            <span className="text-[11px] font-semibold tracking-wide">Audit trail · activity</span>
            <button onClick={() => setShowAudit(false)} className="ml-auto h-6 w-6 grid place-items-center hover:bg-surface-elevated rounded transition"><X className="size-3" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {auditLog.map((a, i) => (
              <div key={i} className="flex gap-2 text-[10px] font-mono p-1.5 rounded hover:bg-surface-elevated/40">
                <span className={`mt-1 size-1.5 rounded-full shrink-0 ${
                  a.tone === "success" ? "bg-success" : a.tone === "danger" ? "bg-danger" : a.tone === "amber" ? "bg-amber" : "bg-cyan"
                }`} />
                <div className="flex-1">
                  <div className="text-foreground">{a.msg}</div>
                  <div className="text-muted-foreground">{new Date(a.at).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

// Wraps the realistic source renderer with field-highlighting overlay using data-field attrs.
function SourceWithHighlights({
  solutionId, item, view, selectedField, search, language,
}: {
  solutionId: string;
  item: HitlItem;
  view: "html" | "pdf";
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
        html = html.replace(re, `<mark data-field="${meta.name}" class="hitl-mark" style="background:rgba(245,158,11,0.15);color:inherit;padding:1px 3px;border-radius:3px;border-bottom:2px solid rgba(245,158,11,0.6);transition:all .2s;cursor:help" title="${meta.name} · ${meta.conf}%">$1</mark>`);
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
      el.style.background = isSel ? "rgba(34,197,94,0.28)" : "rgba(245,158,11,0.15)";
      el.style.borderColor = isSel ? "rgba(34,197,94,0.9)" : "rgba(245,158,11,0.6)";
      el.style.boxShadow = isSel ? "0 0 0 2px rgba(34,197,94,0.35)" : "none";
    });
  }, [selectedField]);

  const matchesSearch = !search || JSON.stringify(item).toLowerCase().includes(search.toLowerCase());

  return (
    <div ref={wrapRef} className={`transition ${matchesSearch ? "" : "opacity-40"}`}>
      {view === "pdf"
        ? <RealisticPdf solutionId={solutionId} item={item} />
        : <RealisticHtml solutionId={solutionId} item={item} />}
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

function FormatTag({ kind }: { kind: "html" | "pdf" }) {
  return kind === "pdf"
    ? <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-amber/40 text-amber bg-amber/10 flex items-center gap-1"><FileText className="size-3" /> PDF</span>
    : <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-cyan/40 text-cyan bg-cyan/10 flex items-center gap-1"><Globe className="size-3" /> HTML</span>;
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

// Suppress unused import warning until Link is used elsewhere
void Link;

// ===================== Realistic source previews =====================

function fieldMap(item: HitlItem): Record<string, string> {
  const m: Record<string, string> = {};
  (item.fields ?? []).forEach((f) => { m[f.name] = f.value; });
  return m;
}

function RealisticHtml({ solutionId, item }: { solutionId: string; item: HitlItem }) {
  const f = fieldMap(item);
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
        <span className="font-bold tracking-widest">{oem.toUpperCase()}</span>
        <span className="opacity-70">Models</span>
        <span className="opacity-70">Build</span>
        <span className="opacity-70">Shop</span>
        <span className="opacity-70">Owners</span>
        <span className="ml-auto opacity-70">EN · US</span>
      </div>
      {/* hero */}
      <div className="relative h-44 bg-gradient-to-br from-neutral-800 via-neutral-700 to-neutral-900 text-white p-5 flex flex-col justify-end">
        <div className="text-[10px] tracking-widest opacity-80">{new Date().getFullYear()} {oem.toUpperCase()}</div>
        <div className="text-3xl font-light leading-none mt-1">{model}</div>
        <div className="text-sm opacity-90 mt-1">{trim} · Starting at {msrp}</div>
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
          {[
            ["Drivetrain", f.drivetrain || "AWD"],
            ["Battery", `${f.battery_kwh || "—"} kWh`],
            ["Range (EPA est.)", `${f.range_mi || "—"} mi`],
            ["0–60 mph", `${f.zero_to_sixty_s || "—"} s`],
            ["Top speed", "130 mph (electronically limited)"],
            ["Charging (DC)", "Up to 145 kW"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-dashed border-neutral-200 py-1">
              <span className="text-neutral-500">{k}</span><span className="font-medium">{v}</span>
            </div>
          ))}
        </div>
        <h2 className="text-base font-semibold pt-3">Dimensions</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
          {[
            ["Length", `${f.length_in || "—"} in`],
            ["Wheelbase", `${f.wheelbase_in || "—"} in`],
            ["Curb weight", "4,365 lb"],
            ["Cargo (max)", "57.2 cu ft"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-dashed border-neutral-200 py-1">
              <span className="text-neutral-500">{k}</span><span className="font-medium">{v}</span>
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
            <tr className="border-b"><td className="py-2 text-neutral-500">{trim}</td><td className="py-2 text-right font-semibold">{msrp}</td></tr>
            <tr className="border-b"><td className="py-2 text-neutral-500">Destination & handling</td><td className="py-2 text-right">$995</td></tr>
            <tr><td className="py-2 text-neutral-500">As shown</td><td className="py-2 text-right font-semibold">{msrp}</td></tr>
          </tbody>
        </table>
        <div className="h-8" />
        <div className="text-[10px] text-neutral-400 border-t pt-3">© {new Date().getFullYear()} {oem} of North America, LLC. Specifications are estimates and subject to change.</div>
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
        <div className="text-[10px] tracking-widest text-neutral-500">AUTOMOTIVE · {new Date().toDateString()}</div>
        <h1 className="text-2xl font-serif font-bold leading-tight">{item.summary}</h1>
        <div className="text-[11px] text-neutral-500 flex gap-3 border-b pb-3">
          <span>By Reuters Staff</span><span>·</span><span>4 min read</span><span>·</span><span>{f.cluster || "EV Supply"}</span>
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
        <h1 className="text-xl font-bold">{f.station_name || item.recordName}</h1>
        <div className="text-[12px] text-neutral-600">{f.city}, {f.state} · {f.network || "ChargePoint"}</div>
        <div className="grid grid-cols-2 gap-3 text-[12px] border-t pt-3">
          {[["Connector type", f.type], ["Power", f.power], ["Pricing", f.pricing], ["Availability", f.availability], ["Network", f.network], ["Open hours", "24/7"]].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-dashed py-1.5"><span className="text-neutral-500">{k}</span><span className="font-medium">{v || "—"}</span></div>
          ))}
        </div>
        <div className="text-[12px] pt-3 leading-relaxed">{item.detail}</div>
        <div className="text-[10px] text-neutral-400 pt-4 border-t">© ChargePoint Inc.</div>
      </div>
    </div>
  );
}

/* ---------- HTML: Dealer rooftop page ---------- */
function DealerPage({ f, item }: { f: Record<string, string>; item: HitlItem }) {
  return (
    <div className="bg-white text-neutral-900 shadow-xl rounded overflow-hidden mx-auto max-w-[640px]">
      <div className="bg-[#0b3d91] text-white px-4 h-10 flex items-center font-semibold text-sm">{f.dealer || item.recordName} · Authorized Dealer</div>
      <div className="p-5 space-y-3">
        <div className="text-[11px] text-neutral-500 tracking-widest">SHOWROOM</div>
        <h1 className="text-xl font-bold">{f.dealer || item.recordName}</h1>
        <div className="text-[12px] text-neutral-600">{f.city || "—"} · {f.oem || "Multi-OEM"}</div>
        <div className="grid grid-cols-2 gap-3 text-[12px] border-t pt-3">
          {[["Inventory", f.inventory], ["Avg Days on Lot", f.avg_dol], ["Sales velocity", f.velocity], ["Insight", f.insight]].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-dashed py-1.5"><span className="text-neutral-500">{k}</span><span className="font-medium">{v || "—"}</span></div>
          ))}
        </div>
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
            <tr key={k} className="border-t"><td className="py-1 text-neutral-500">{k}</td><td className="py-1 font-medium">{v}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- PDF: Vehicle spec sheet (Mercedes / BMW style) ---------- */
function VehicleSpecSheetPdf({ f, item }: { f: Record<string, string>; item: HitlItem }) {
  const oem = f.oem || "Mercedes-Benz";
  const model = f.model || item.recordName?.split(" ")[0] || "EQE";
  const trim = f.trim || "350 4MATIC";
  return (
    <div className="bg-white text-neutral-900 shadow-xl mx-auto max-w-[640px] aspect-[1/1.414] p-8 flex flex-col text-[11px]">
      <div className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <div className="text-[9px] tracking-[0.3em] text-neutral-500">PRODUCT DATA SHEET</div>
          <div className="text-2xl font-light mt-1">{oem}</div>
          <div className="text-base font-semibold">{model} <span className="font-light">{trim}</span></div>
        </div>
        <div className="text-right text-[9px] text-neutral-500">
          <div>Ref. {item.recordName?.replace(/\s+/g, "-").toUpperCase()}</div>
          <div>Effective {new Date().getFullYear()}</div>
          <div>Doc rev. 03</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6">
        <div>
          <SectionTitle>POWERTRAIN</SectionTitle>
          <PdfRow k="Drivetrain" v={f.drivetrain || "AWD"} />
          <PdfRow k="Battery capacity" v={`${f.battery_kwh || "—"} kWh`} />
          <PdfRow k="Range (EPA est.)" v={`${f.range_mi || "—"} mi`} />
          <PdfRow k="0–60 mph" v={`${f.zero_to_sixty_s || "—"} s`} />
          <PdfRow k="Peak power" v="288 kW (385 hp)" />
          <PdfRow k="Peak torque" v="565 lb-ft" />

          <SectionTitle>CHARGING</SectionTitle>
          <PdfRow k="DC fast charge" v="170 kW (10–80% in 32 min)" />
          <PdfRow k="AC onboard" v="11 kW" />
          <PdfRow k="Connector" v="CCS Combo 1 (NACS adapter)" />
        </div>
        <div>
          <SectionTitle>DIMENSIONS</SectionTitle>
          <PdfRow k="Length" v={`${f.length_in || "—"} in`} />
          <PdfRow k="Wheelbase" v={`${f.wheelbase_in || "—"} in`} />
          <PdfRow k="Width (w/ mirrors)" v="83.1 in" />
          <PdfRow k="Height" v="59.6 in" />
          <PdfRow k="Curb weight" v="5,597 lb" />
          <PdfRow k="Cargo (rear seats up)" v="15.0 cu ft" />

          <SectionTitle>PRICING</SectionTitle>
          <PdfRow k="MSRP" v={f.msrp || "—"} />
          <PdfRow k="Destination & delivery" v="$1,150" />
          <PdfRow k="Available equipment" v="See option list, p. 2" />
        </div>
      </div>

      <div className="mt-5">
        <SectionTitle>STANDARD EQUIPMENT (SELECTED)</SectionTitle>
        <div className="grid grid-cols-2 text-[10.5px] gap-x-6">
          <ul className="list-disc pl-4 space-y-0.5 text-neutral-800">
            <li>MBUX hyperscreen · 56" curved glass</li>
            <li>Driver Assistance Package</li>
            <li>Burmester® 3D surround sound</li>
            <li>Heated/ventilated front seats</li>
          </ul>
          <ul className="list-disc pl-4 space-y-0.5 text-neutral-800">
            <li>Air balance package · 4-zone climate</li>
            <li>Panoramic roof</li>
            <li>Wireless Apple CarPlay / Android Auto</li>
            <li>360° camera with surround view</li>
          </ul>
        </div>
      </div>

      <div className="mt-auto pt-4 border-t text-[9px] text-neutral-500 flex justify-between">
        <span>© {new Date().getFullYear()} {oem} USA, LLC. Specifications subject to change without notice.</span>
        <span>Page 1 of 1</span>
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
          <div className="text-2xl font-semibold mt-1">{f.plant_name || item.recordName}</div>
          <div className="text-[12px] text-neutral-600">{f.supplier_group || "ZF Friedrichshafen AG"}</div>
        </div>
        <div className="text-right text-[9px] text-neutral-500">
          <div>Ref. PLT-{(item.id || "").slice(0, 6).toUpperCase()}</div>
          <div>Compiled {new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6">
        <div>
          <SectionTitle>LOCATION</SectionTitle>
          <PdfRow k="Address" v={f.address_line1 || "1 Industriestrasse"} />
          <PdfRow k="City" v={f.city || "Friedrichshafen"} />
          <PdfRow k="State / Province" v={f["state / province"] || f.state || "Baden-Württemberg"} />
          <PdfRow k="Country" v={f.country || "Germany"} />
          <PdfRow k="Latitude" v={f.latitude || "47.6779"} />
          <PdfRow k="Longitude" v={f.longitude || "9.4731"} />
        </div>
        <div>
          <SectionTitle>OPERATIONS</SectionTitle>
          <PdfRow k="Production site" v="Yes" />
          <PdfRow k="Primary segment" v="Driveline systems" />
          <PdfRow k="Headcount" v="~9,200" />
          <PdfRow k="Year established" v="1915" />
          <PdfRow k="Certifications" v="IATF 16949, ISO 14001" />
          <PdfRow k="Customer of record" v="VW Group, BMW, Daimler Truck" />
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
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 mb-1 text-[9px] tracking-[0.25em] font-bold text-neutral-900 border-b border-neutral-300 pb-1">{children}</div>;
}
function PdfRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-dashed border-neutral-200">
      <span className="text-neutral-500">{k}</span>
      <span className="font-medium text-right ml-3 truncate" title={v}>{v}</span>
    </div>
  );
}

