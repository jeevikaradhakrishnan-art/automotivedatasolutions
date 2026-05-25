import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Activity, Search, Upload, Trash2, Power, PowerOff, Edit3, Save, X,
  FileText, History, Database, Tag as TagIcon, Download, Plus, ExternalLink, Eye, ShieldAlert,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SOLUTIONS } from "@/data/solutions";
import { useSolutionOverrides, type SolutionOverride, type SolutionDatasetRow } from "@/hooks/useSolutionOverrides";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DataPreviewTable } from "@/components/solutions/DataPreviewTable";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/automotive-data-solutions-admin")({
  component: AdminConsole,
  head: () => ({ meta: [{ title: "ADS · Admin Console" }, { name: "robots", content: "noindex,nofollow" }] }),
});

interface ActivityRow { id: string; action: string; solution_id: string | null; details: Record<string, unknown>; created_at: string }

const BUCKET = "solution-assets";

async function logActivity(action: string, solution_id: string | null, details: Record<string, unknown> = {}) {
  await supabase.from("admin_activity_log").insert({ action, solution_id, details: details as never });
}

function AdminConsole() {
  const { overrides, loading } = useSolutionOverrides();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<SolutionDatasetRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [previewDs, setPreviewDs] = useState<SolutionDatasetRow | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; body: string; onConfirm: () => void } | null>(null);

  // Load datasets + activity, subscribe realtime
  useEffect(() => {
    const loadDs = async () => {
      const { data } = await supabase.from("solution_datasets").select("*").order("uploaded_at", { ascending: false });
      setDatasets((data ?? []) as unknown as SolutionDatasetRow[]);
    };
    const loadAct = async () => {
      const { data } = await supabase.from("admin_activity_log").select("*").order("created_at", { ascending: false }).limit(50);
      setActivity((data ?? []) as ActivityRow[]);
    };
    loadDs(); loadAct();
    const ch = supabase
      .channel("admin_console")
      .on("postgres_changes", { event: "*", schema: "public", table: "solution_datasets" }, loadDs)
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_activity_log" }, loadAct)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const merged = useMemo(() => {
    return SOLUTIONS.map((s) => {
      const o = overrides[s.id];
      return {
        id: s.id,
        code: s.code,
        baseTitle: s.title,
        baseDescription: s.short,
        title: o?.title ?? s.title,
        description: o?.description ?? s.short,
        enabled: o?.enabled ?? true,
        metrics: o?.metrics ?? [],
        tags: o?.tags ?? [],
        downloadAssets: o?.download_assets ?? [],
        sampleDatasets: o?.sample_datasets ?? [],
        updatedAt: o?.updated_at,
      };
    });
  }, [overrides]);

  const filtered = merged.filter((s) => {
    const q = query.toLowerCase();
    const matchQ = !q || s.title.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
    const matchS = statusFilter === "all" || (statusFilter === "enabled" ? s.enabled : !s.enabled);
    return matchQ && matchS;
  });

  const toggleEnabled = async (id: string, current: boolean) => {
    const next = !current;
    await upsertOverride(id, { enabled: next });
    await logActivity(next ? "solution.enabled" : "solution.disabled", id);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1500px] mx-auto px-6 py-3 flex items-center gap-4">
          <div className="size-9 rounded-md bg-gradient-to-br from-primary to-amber/70 grid place-items-center font-mono text-xs font-bold text-primary-foreground">A</div>
          <div className="leading-tight">
            <div className="font-mono text-[10px] tracking-widest text-muted-foreground">AUTOMOTIVE DATA SOLUTIONS</div>
            <h1 className="text-base font-semibold tracking-tight">Admin Console</h1>
          </div>
          <div className="ml-auto flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
            <ShieldAlert className="size-3.5 text-amber" />
            <span>UNLISTED · URL-ONLY ACCESS</span>
            <Link to="/" className="ml-3 inline-flex items-center gap-1 text-cyan hover:underline">
              <ExternalLink className="size-3" /> View public site
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-6 py-6 space-y-6">
        {/* Toolbar */}
        <div className="panel p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search solutions by title, code, description…" className="pl-9 h-9" />
          </div>
          <div className="flex items-center gap-1 p-0.5 rounded-md border border-border bg-card">
            {(["all", "enabled", "disabled"] as const).map((f) => (
              <button key={f} onClick={() => setStatusFilter(f)} className={`px-3 h-7 rounded text-xs font-mono ${statusFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground tracking-widest">
            {merged.filter((m) => m.enabled).length}/{merged.length} ENABLED
          </div>
        </div>

        {/* Solutions list */}
        <div className="space-y-3">
          {loading && <div className="panel p-8 text-center text-sm text-muted-foreground">Loading…</div>}
          {!loading && filtered.map((s) => {
            const dsForSol = datasets.filter((d) => d.solution_id === s.id);
            const isEditing = editing === s.id;
            return (
              <div key={s.id} className={`panel overflow-hidden transition ${!s.enabled ? "opacity-70" : ""}`}>
                <div className="px-5 py-4 flex items-start gap-4 border-b border-border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] tracking-widest text-muted-foreground">{s.code}</span>
                      {!s.enabled && <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-danger/10 text-danger border border-danger/30">HIDDEN FROM PUBLIC</span>}
                      {s.updatedAt && <span className="font-mono text-[10px] text-muted-foreground">· updated {new Date(s.updatedAt).toLocaleString()}</span>}
                    </div>
                    <h3 className="text-base font-semibold mt-0.5 truncate">{s.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                    {s.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {s.tags.map((t) => <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-surface-elevated">{t}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {s.enabled ? <Power className="size-3.5 text-success" /> : <PowerOff className="size-3.5 text-muted-foreground" />}
                      <Switch checked={s.enabled} onCheckedChange={() => toggleEnabled(s.id, s.enabled)} />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setEditing(isEditing ? null : s.id)}>
                      {isEditing ? <><X className="size-3.5" /> Close</> : <><Edit3 className="size-3.5" /> Edit</>}
                    </Button>
                  </div>
                </div>

                {isEditing && (
                  <EditPanel
                    solutionId={s.id}
                    initial={{
                      title: s.title, description: s.description, metrics: s.metrics, tags: s.tags,
                      downloadAssets: s.downloadAssets, sampleDatasets: s.sampleDatasets,
                    }}
                    onClose={() => setEditing(null)}
                  />
                )}

                {/* Datasets row */}
                <DatasetsRow
                  solutionId={s.id}
                  datasets={dsForSol}
                  onPreview={setPreviewDs}
                  onAskDelete={(d) =>
                    setConfirm({
                      title: "Delete dataset?",
                      body: `Remove ${d.file_name}? This cannot be undone.`,
                      onConfirm: async () => {
                        await supabase.storage.from(BUCKET).remove([d.storage_path]);
                        await supabase.from("solution_datasets").delete().eq("id", d.id);
                        await logActivity("dataset.deleted", d.solution_id, { file_name: d.file_name });
                        setConfirm(null);
                      },
                    })
                  }
                />
              </div>
            );
          })}
          {!loading && filtered.length === 0 && (
            <div className="panel p-10 text-center text-sm text-muted-foreground">No solutions match the current filters.</div>
          )}
        </div>

        {/* Activity */}
        <div className="panel">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Activity className="size-4 text-cyan" />
            <div className="text-sm font-semibold">Activity log</div>
            <div className="ml-auto text-[10px] font-mono text-muted-foreground">LAST 50</div>
          </div>
          {activity.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">No activity yet.</div>
          ) : (
            <ul className="divide-y divide-border max-h-96 overflow-auto">
              {activity.map((a) => (
                <li key={a.id} className="px-5 py-2.5 flex items-center gap-3 text-xs">
                  <History className="size-3.5 text-muted-foreground" />
                  <span className="font-mono text-[11px] text-cyan">{a.action}</span>
                  {a.solution_id && <span className="font-mono text-[10px] text-muted-foreground">· {a.solution_id}</span>}
                  {a.details && Object.keys(a.details).length > 0 && (
                    <span className="text-muted-foreground truncate">· {JSON.stringify(a.details)}</span>
                  )}
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground tabular-nums">{new Date(a.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* Preview dialog */}
      <Dialog open={!!previewDs} onOpenChange={(o) => !o && setPreviewDs(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{previewDs?.file_name}</DialogTitle>
            <DialogDescription>
              {previewDs?.row_count?.toLocaleString() ?? "—"} rows · {previewDs?.columns?.length ?? 0} columns · {previewDs?.mime_type}
            </DialogDescription>
          </DialogHeader>
          {previewDs?.preview && previewDs?.columns ? (
            <DataPreviewTable columns={previewDs.columns} rows={previewDs.preview as Record<string, string | number>[]} maxRows={25} />
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">Binary file — no tabular preview. <a className="text-cyan underline" target="_blank" rel="noreferrer" href={previewDs ? supabase.storage.from(BUCKET).getPublicUrl(previewDs.storage_path).data.publicUrl : "#"}>Download</a></div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm */}
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirm?.onConfirm()}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

async function upsertOverride(solution_id: string, patch: Partial<SolutionOverride>) {
  // Merge with existing
  const { data: existing } = await supabase.from("solution_overrides").select("*").eq("solution_id", solution_id).maybeSingle();
  const merged = { ...(existing ?? { solution_id, enabled: true }), ...patch, solution_id };
  const { error } = await supabase.from("solution_overrides").upsert(merged, { onConflict: "solution_id" });
  if (error) throw error;
}

/* ---------- Edit panel ---------- */
interface EditState {
  title: string;
  description: string;
  metrics: { label: string; value: string }[];
  tags: string[];
  downloadAssets: { label: string; url: string }[];
  sampleDatasets: { label: string; url: string }[];
}

function EditPanel({ solutionId, initial, onClose }: { solutionId: string; initial: EditState; onClose: () => void }) {
  const [state, setState] = useState<EditState>(initial);
  const [saving, setSaving] = useState(false);
  const [tagDraft, setTagDraft] = useState("");

  const save = async () => {
    setSaving(true);
    try {
      await upsertOverride(solutionId, {
        title: state.title, description: state.description,
        metrics: state.metrics, tags: state.tags,
        download_assets: state.downloadAssets, sample_datasets: state.sampleDatasets,
      });
      await logActivity("solution.content_updated", solutionId, { fields: ["title", "description", "metrics", "tags", "downloads", "samples"] });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="px-5 py-4 bg-surface/40 grid md:grid-cols-2 gap-5">
      <div className="space-y-3">
        <Field label="Title">
          <Input value={state.title} onChange={(e) => setState({ ...state, title: e.target.value })} />
        </Field>
        <Field label="Description">
          <Textarea rows={4} value={state.description} onChange={(e) => setState({ ...state, description: e.target.value })} />
        </Field>
        <Field label="Tags">
          <div className="flex flex-wrap gap-1 mb-2">
            {state.tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-surface-elevated">
                <TagIcon className="size-2.5" /> {t}
                <button onClick={() => setState({ ...state, tags: state.tags.filter((x) => x !== t) })}><X className="size-2.5" /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder="Add tag and press Enter"
              onKeyDown={(e) => { if (e.key === "Enter" && tagDraft.trim()) { setState({ ...state, tags: [...state.tags, tagDraft.trim()] }); setTagDraft(""); } }} />
          </div>
        </Field>
      </div>

      <div className="space-y-3">
        <Field label="Metrics">
          <ListEditor
            items={state.metrics}
            empty={{ label: "", value: "" }}
            onChange={(items) => setState({ ...state, metrics: items })}
            render={(it, set) => (
              <>
                <Input className="flex-1" placeholder="Label" value={it.label} onChange={(e) => set({ ...it, label: e.target.value })} />
                <Input className="w-32" placeholder="Value" value={it.value} onChange={(e) => set({ ...it, value: e.target.value })} />
              </>
            )}
          />
        </Field>

        <Field label="Download assets">
          <ListEditor
            items={state.downloadAssets}
            empty={{ label: "", url: "" }}
            onChange={(items) => setState({ ...state, downloadAssets: items })}
            render={(it, set) => (
              <>
                <Input className="flex-1" placeholder="Label" value={it.label} onChange={(e) => set({ ...it, label: e.target.value })} />
                <Input className="flex-1" placeholder="URL" value={it.url} onChange={(e) => set({ ...it, url: e.target.value })} />
              </>
            )}
          />
        </Field>

        <Field label="Sample datasets">
          <ListEditor
            items={state.sampleDatasets}
            empty={{ label: "", url: "" }}
            onChange={(items) => setState({ ...state, sampleDatasets: items })}
            render={(it, set) => (
              <>
                <Input className="flex-1" placeholder="Label" value={it.label} onChange={(e) => set({ ...it, label: e.target.value })} />
                <Input className="flex-1" placeholder="URL" value={it.url} onChange={(e) => set({ ...it, url: e.target.value })} />
              </>
            )}
          />
        </Field>
      </div>

      <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2 border-t border-border">
        <Button variant="outline" onClick={onClose}><X className="size-3.5" /> Cancel</Button>
        <Button onClick={save} disabled={saving}><Save className="size-3.5" /> {saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function ListEditor<T extends Record<string, string>>({
  items, empty, onChange, render,
}: {
  items: T[]; empty: T; onChange: (items: T[]) => void;
  render: (item: T, set: (it: T) => void) => React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {render(it, (next) => onChange(items.map((x, j) => (j === i ? next : x))))}
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="size-7 grid place-items-center rounded border border-border text-muted-foreground hover:text-danger hover:border-danger/40">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...items, { ...empty }])} className="text-[11px] font-mono text-cyan hover:underline inline-flex items-center gap-1">
        <Plus className="size-3" /> Add
      </button>
    </div>
  );
}

/* ---------- Datasets row ---------- */
function DatasetsRow({
  solutionId, datasets, onPreview, onAskDelete,
}: {
  solutionId: string;
  datasets: SolutionDatasetRow[];
  onPreview: (d: SolutionDatasetRow) => void;
  onAskDelete: (d: SolutionDatasetRow) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleUpload = async (file: File, replaceId?: string) => {
    setBusy(true);
    try {
      const path = `${solutionId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      // Tabular preview if possible
      let columns: string[] | null = null;
      let preview: Record<string, unknown>[] | null = null;
      let rowCount: number | null = null;
      const lower = file.name.toLowerCase();
      try {
        if (lower.endsWith(".json")) {
          const text = await file.text();
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            rowCount = parsed.length;
            columns = parsed[0] ? Object.keys(parsed[0]) : [];
            preview = parsed.slice(0, 25);
          }
        } else if (lower.endsWith(".csv") || lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
          const buf = await file.arrayBuffer();
          const wb = XLSX.read(buf, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];
          rowCount = rows.length;
          columns = rows[0] ? Object.keys(rows[0]) : [];
          preview = rows.slice(0, 25);
        }
      } catch { /* binary or unparseable */ }

      if (replaceId) {
        await supabase.from("solution_datasets").update({ is_active: false }).eq("id", replaceId);
      }
      // Mark prior active dataset for this solution inactive if this is the new active
      await supabase.from("solution_datasets").update({ is_active: false }).eq("solution_id", solutionId).eq("is_active", true);

      const { error: insErr } = await supabase.from("solution_datasets").insert({
        solution_id: solutionId, file_name: file.name, storage_path: path,
        mime_type: file.type || null, file_size: file.size,
        row_count: rowCount, columns, preview, is_active: true,
      });
      if (insErr) throw insErr;
      await logActivity(replaceId ? "dataset.replaced" : "dataset.uploaded", solutionId, { file_name: file.name, size: file.size });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const active = datasets.find((d) => d.is_active);
  const history = datasets.filter((d) => !d.is_active);

  return (
    <div className="px-5 py-3 bg-card/30 space-y-2">
      <div className="flex items-center gap-2">
        <Database className="size-3.5 text-cyan" />
        <div className="text-[11px] font-mono tracking-widest text-muted-foreground">DATASETS</div>
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls,.json,.pdf,image/*"
          className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
        <Button size="sm" variant="outline" className="ml-auto h-7" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload className="size-3" /> {busy ? "UPLOADING…" : active ? "REPLACE DATASET" : "UPLOAD DATASET"}
        </Button>
      </div>
      {active ? (
        <DatasetCard d={active} active onPreview={onPreview} onDelete={onAskDelete} />
      ) : (
        <div className="text-[11px] text-muted-foreground font-mono">No dataset uploaded yet.</div>
      )}
      {history.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-[11px] font-mono text-muted-foreground hover:text-foreground">
            History ({history.length})
          </summary>
          <div className="mt-2 space-y-1.5">
            {history.map((d) => <DatasetCard key={d.id} d={d} onPreview={onPreview} onDelete={onAskDelete} />)}
          </div>
        </details>
      )}
    </div>
  );
}

function DatasetCard({ d, active, onPreview, onDelete }: { d: SolutionDatasetRow; active?: boolean; onPreview: (d: SolutionDatasetRow) => void; onDelete: (d: SolutionDatasetRow) => void }) {
  const url = supabase.storage.from("solution-assets").getPublicUrl(d.storage_path).data.publicUrl;
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded border ${active ? "border-success/30 bg-success/5" : "border-border bg-surface-elevated/40"}`}>
      <FileText className="size-3.5 text-cyan" />
      <div className="flex-1 min-w-0">
        <div className="text-xs truncate">{d.file_name}</div>
        <div className="text-[10px] font-mono text-muted-foreground">
          {(d.file_size ?? 0).toLocaleString()} B · {d.row_count ? `${d.row_count.toLocaleString()} rows` : "binary"} · {new Date(d.uploaded_at).toLocaleString()}
        </div>
      </div>
      {active && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/30">ACTIVE</span>}
      <Button size="sm" variant="outline" className="h-7" onClick={() => onPreview(d)}><Eye className="size-3" /></Button>
      <a href={url} target="_blank" rel="noreferrer" className="size-7 grid place-items-center rounded border border-border text-muted-foreground hover:text-cyan hover:border-cyan/40"><Download className="size-3" /></a>
      <button onClick={() => onDelete(d)} className="size-7 grid place-items-center rounded border border-border text-muted-foreground hover:text-danger hover:border-danger/40"><Trash2 className="size-3" /></button>
    </div>
  );
}
