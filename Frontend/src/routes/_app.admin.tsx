import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Activity, Search, Upload, Trash2, Power, PowerOff, Edit3, Save, X,
  FileText, History, Database, Tag as TagIcon, Download, Plus, ExternalLink, Eye, ShieldAlert, GripVertical,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SOLUTIONS, type SolutionId } from "@/data/solutions";
import { useSolutionOverrides, type SolutionOverride, type SolutionDatasetRow } from "@/hooks/useSolutionOverrides";
import { usePlatform } from "@/store/platform";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DataPreviewTable } from "@/components/solutions/DataPreviewTable";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/admin")({ component: AdminPage });

interface ActivityRow {
  id: string;
  action: string;
  solution_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const BUCKET = "solution-assets";

async function logActivity(action: string, solution_id: string | null, details: Record<string, unknown> = {}) {
  await supabase.from("admin_activity_log").insert({ action, solution_id, details: details as never });
}

async function upsertOverride(solution_id: string, patch: Partial<SolutionOverride>) {
  const { data: existing } = await supabase
    .from("solution_overrides")
    .select("*")
    .eq("solution_id", solution_id)
    .maybeSingle();
  const merged = { ...(existing ?? { solution_id, enabled: true }), ...patch, solution_id };
  const { error } = await supabase
    .from("solution_overrides")
    .upsert(merged as never, { onConflict: "solution_id" });
  if (error) throw error;
}

function AdminPage() {
  const { overrides, loading } = useSolutionOverrides();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<SolutionDatasetRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [previewDs, setPreviewDs] = useState<SolutionDatasetRow | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; body: string; onConfirm: () => void } | null>(null);

  const solutionOrder = usePlatform((s) => s.solutionOrder);
  const setSolutionOrder = usePlatform((s) => s.setSolutionOrder);
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const isFilterActive = !!query || statusFilter !== "all";

  useEffect(() => {
    const loadDs = async () => {
      const { data } = await supabase
        .from("solution_datasets")
        .select("*")
        .order("uploaded_at", { ascending: false });
      setDatasets((data ?? []) as unknown as SolutionDatasetRow[]);
    };
    const loadAct = async () => {
      const { data } = await supabase
        .from("admin_activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      setActivity((data ?? []) as ActivityRow[]);
    };
    loadDs();
    loadAct();
    const ch = supabase
      .channel("admin_page")
      .on("postgres_changes", { event: "*", schema: "public", table: "solution_datasets" }, loadDs)
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_activity_log" }, loadAct)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const merged = useMemo(() => {
    const items = SOLUTIONS.map((s) => {
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
    return solutionOrder
      .map((id) => items.find((s) => s.id === id))
      .filter(Boolean) as typeof items;
  }, [overrides, solutionOrder]);

  const filtered = merged.filter((s) => {
    const q = query.toLowerCase();
    const matchQ =
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q);
    const matchS =
      statusFilter === "all" ||
      (statusFilter === "enabled" ? s.enabled : !s.enabled);
    return matchQ && matchS;
  });

  const toggleEnabled = async (id: string, current: boolean) => {
    const next = !current;
    await upsertOverride(id, { enabled: next });
    await logActivity(next ? "solution.enabled" : "solution.disabled", id);
  };

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-gradient-to-br from-primary to-amber/70 grid place-items-center font-mono text-xs font-bold text-primary-foreground">
              A
            </div>
            <div className="leading-tight">
              <div className="font-mono text-[10px] tracking-widest text-muted-foreground">
                AUTOMOTIVE DATA SOLUTIONS
              </div>
              <h1 className="text-xl font-semibold tracking-tight">Admin Console</h1>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
          <ShieldAlert className="size-3.5 text-amber" />
          <span>UNLISTED · URL-ONLY ACCESS</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="panel p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search solutions by title, code, description…"
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-md border border-border bg-card">
          {(["all", "enabled", "disabled"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 h-7 rounded text-xs font-mono ${
                statusFilter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
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
        {!isFilterActive && (
          <p className="text-[10px] font-mono text-muted-foreground tracking-widest pl-1">
            DRAG TO REORDER · ORDER REFLECTS ON HOME PAGE
          </p>
        )}
        {loading && (
          <div className="panel p-8 text-center text-sm text-muted-foreground">Loading…</div>
        )}
        {!loading &&
          filtered.map((s, idx) => {
            const dsForSol = datasets.filter((d) => d.solution_id === s.id);
            const isEditing = editing === s.id;
            const isDragTarget = !isFilterActive && dragOverIdx === idx && dragIdx.current !== null && dragIdx.current !== idx;
            return (
              <div
                key={s.id}
                draggable={!isFilterActive}
                onDragStart={() => { dragIdx.current = idx; }}
                onDragOver={(e) => { e.preventDefault(); if (!isFilterActive) setDragOverIdx(idx); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = dragIdx.current;
                  if (from === null || from === idx || isFilterActive) { dragIdx.current = null; setDragOverIdx(null); return; }
                  const next = [...solutionOrder];
                  const [moved] = next.splice(from, 1);
                  next.splice(idx, 0, moved);
                  setSolutionOrder(next as SolutionId[]);
                  dragIdx.current = null;
                  setDragOverIdx(null);
                }}
                onDragEnd={() => { dragIdx.current = null; setDragOverIdx(null); }}
                className={`panel overflow-hidden transition select-none ${!s.enabled ? "opacity-70" : ""} ${isDragTarget ? "border-cyan/50 ring-1 ring-cyan/20" : ""}`}
              >
                <div className="px-4 py-4 flex items-start gap-3 border-b border-border">
                  {!isFilterActive && (
                    <GripVertical className="size-5 text-muted-foreground/60 mt-0.5 shrink-0 cursor-grab active:cursor-grabbing" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
                        {s.code}
                      </span>
                      {!s.enabled && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-danger/10 text-danger border border-danger/30">
                          HIDDEN FROM PUBLIC
                        </span>
                      )}
                      {s.updatedAt && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          · updated {new Date(s.updatedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold mt-0.5 truncate">{s.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                    {s.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {s.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-surface-elevated"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {s.enabled ? (
                        <Power className="size-3.5 text-success" />
                      ) : (
                        <PowerOff className="size-3.5 text-muted-foreground" />
                      )}
                      <Switch
                        checked={s.enabled}
                        onCheckedChange={() => toggleEnabled(s.id, s.enabled)}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(isEditing ? null : s.id)}
                    >
                      {isEditing ? (
                        <>
                          <X className="size-3.5" /> Close
                        </>
                      ) : (
                        <>
                          <Edit3 className="size-3.5" /> Edit
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {isEditing && (
                  <EditPanel
                    solutionId={s.id}
                    initial={{
                      title: s.title,
                      description: s.description,
                      metrics: s.metrics,
                      tags: s.tags,
                      downloadAssets: s.downloadAssets,
                      sampleDatasets: s.sampleDatasets,
                    }}
                    onClose={() => setEditing(null)}
                  />
                )}

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
                        await supabase
                          .from("solution_datasets")
                          .delete()
                          .eq("id", d.id);
                        await logActivity("dataset.deleted", d.solution_id, {
                          file_name: d.file_name,
                        });
                        setConfirm(null);
                      },
                    })
                  }
                />
              </div>
            );
          })}
        {!loading && filtered.length === 0 && (
          <div className="panel p-10 text-center text-sm text-muted-foreground">
            No solutions match the current filters.
          </div>
        )}
      </div>

      {/* Activity log */}
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
                {a.solution_id && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    · {a.solution_id}
                  </span>
                )}
                {a.details && Object.keys(a.details).length > 0 && (
                  <span className="text-muted-foreground truncate">
                    · {JSON.stringify(a.details)}
                  </span>
                )}
                <span className="ml-auto font-mono text-[10px] text-muted-foreground tabular-nums">
                  {new Date(a.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Preview dialog */}
      <Dialog open={!!previewDs} onOpenChange={(o) => !o && setPreviewDs(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{previewDs?.file_name}</DialogTitle>
            <DialogDescription>
              {previewDs?.row_count?.toLocaleString() ?? "—"} rows ·{" "}
              {previewDs?.columns?.length ?? 0} columns · {previewDs?.mime_type}
            </DialogDescription>
          </DialogHeader>
          {previewDs?.preview && previewDs?.columns ? (
            <DataPreviewTable
              columns={previewDs.columns}
              rows={previewDs.preview as Record<string, string | number>[]}
              maxRows={25}
            />
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Binary file — no tabular preview.{" "}
              <a
                className="text-cyan underline"
                target="_blank"
                rel="noreferrer"
                href={
                  previewDs
                    ? supabase.storage
                        .from(BUCKET)
                        .getPublicUrl(previewDs.storage_path).data.publicUrl
                    : "#"
                }
              >
                Download
              </a>
            </div>
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
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => confirm?.onConfirm()}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Edit panel ─────────────────────────────────────────────────── */
interface EditState {
  title: string;
  description: string;
  metrics: { label: string; value: string }[];
  tags: string[];
  downloadAssets: { label: string; url: string }[];
  sampleDatasets: { label: string; url: string }[];
}

function EditPanel({
  solutionId,
  initial,
  onClose,
}: {
  solutionId: string;
  initial: EditState;
  onClose: () => void;
}) {
  const [form, setForm] = useState<EditState>(initial);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await upsertOverride(solutionId, {
        title: form.title,
        description: form.description,
        metrics: form.metrics,
        tags: form.tags,
        download_assets: form.downloadAssets,
        sample_datasets: form.sampleDatasets,
      });
      await logActivity("solution.updated", solutionId, { title: form.title });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-5 py-4 space-y-4 bg-surface-elevated/30 border-b border-border">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted-foreground tracking-widest">TITLE</label>
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted-foreground tracking-widest">TAGS (comma-separated)</label>
          <Input
            value={form.tags.join(", ")}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                tags: e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              }))
            }
            placeholder="e.g. EV, Real-time, HITL"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-mono text-muted-foreground tracking-widest">DESCRIPTION</label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={3}
        />
      </div>

      <KvEditor
        label="KEY METRICS"
        icon={<Database className="size-3" />}
        items={form.metrics}
        kKey="label"
        vKey="value"
        onChange={(items) => setForm((f) => ({ ...f, metrics: items as { label: string; value: string }[] }))}
      />
      <KvEditor
        label="DOWNLOAD ASSETS"
        icon={<Download className="size-3" />}
        items={form.downloadAssets}
        kKey="label"
        vKey="url"
        onChange={(items) =>
          setForm((f) => ({ ...f, downloadAssets: items as { label: string; url: string }[] }))
        }
      />
      <KvEditor
        label="SAMPLE DATASETS"
        icon={<FileText className="size-3" />}
        items={form.sampleDatasets}
        kKey="label"
        vKey="url"
        onChange={(items) =>
          setForm((f) => ({ ...f, sampleDatasets: items as { label: string; url: string }[] }))
        }
      />

      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="size-3.5" /> {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function KvEditor({
  label,
  icon,
  items,
  kKey,
  vKey,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  items: Record<string, string>[];
  kKey: string;
  vKey: string;
  onChange: (items: Record<string, string>[]) => void;
}) {
  const add = () => onChange([...items, { [kKey]: "", [vKey]: "" }]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i: number, k: string, v: string) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground tracking-widest">
        {icon} {label}
      </div>
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <Input
            className="h-8 text-xs"
            placeholder={kKey}
            value={it[kKey] ?? ""}
            onChange={(e) => update(i, kKey, e.target.value)}
          />
          <Input
            className="h-8 text-xs flex-1"
            placeholder={vKey}
            value={it[vKey] ?? ""}
            onChange={(e) => update(i, vKey, e.target.value)}
          />
          <button
            onClick={() => remove(i)}
            className="size-8 grid place-items-center rounded border border-border text-muted-foreground hover:text-danger hover:border-danger/40"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="h-7 px-3 text-[11px] font-mono rounded border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-cyan/40 flex items-center gap-1"
      >
        <Plus className="size-3" /> Add row
      </button>
    </div>
  );
}

/* ─── Datasets row ───────────────────────────────────────────────── */
function DatasetsRow({
  solutionId,
  datasets,
  onPreview,
  onAskDelete,
}: {
  solutionId: string;
  datasets: SolutionDatasetRow[];
  onPreview: (d: SolutionDatasetRow) => void;
  onAskDelete: (d: SolutionDatasetRow) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${solutionId}/${Date.now()}_${file.name}`;
      await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });

      let preview: Record<string, string | number>[] = [];
      let columns: string[] = [];
      let rowCount = 0;
      if (ext === "json") {
        const text = await file.text();
        const arr = JSON.parse(text);
        if (Array.isArray(arr)) {
          rowCount = arr.length;
          columns = arr[0] ? Object.keys(arr[0]) : [];
          preview = arr.slice(0, 25);
        }
      } else if (["csv", "xlsx", "xls"].includes(ext)) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, string | number>[];
        rowCount = rows.length;
        columns = rows[0] ? Object.keys(rows[0]) : [];
        preview = rows.slice(0, 25);
      }

      await supabase.from("solution_datasets").insert({
        solution_id: solutionId,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || `application/${ext}`,
        file_size: file.size,
        row_count: rowCount,
        columns,
        preview,
      } as never);
      await logActivity("dataset.uploaded", solutionId, { file_name: file.name });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="px-5 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono tracking-widest text-muted-foreground flex items-center gap-1">
          <Database className="size-3" /> DATASETS
          <span className="ml-1 px-1 rounded bg-surface-elevated">{datasets.length}</span>
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.json,.pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="h-7 px-2.5 text-[11px] font-mono rounded border border-border hover:border-cyan/40 hover:text-cyan flex items-center gap-1 disabled:opacity-50"
          >
            <Upload className="size-3" /> {uploading ? "Uploading…" : "Upload dataset"}
          </button>
          {datasets.length > 0 && (
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="h-7 px-2.5 text-[11px] font-mono rounded border border-border hover:border-amber/40 hover:text-amber flex items-center gap-1 disabled:opacity-50"
            >
              <Upload className="size-3" /> Replace dataset
            </button>
          )}
        </div>
      </div>

      {datasets.length === 0 ? (
        <div className="text-[11px] text-muted-foreground py-1">No datasets uploaded.</div>
      ) : (
        <div className="space-y-1.5">
          {datasets.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-3 p-2.5 rounded border border-border bg-surface-elevated/30 text-xs"
            >
              <FileText className="size-3.5 text-cyan shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{d.file_name}</div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {d.row_count?.toLocaleString() ?? "—"} rows ·{" "}
                  {d.columns?.length ?? 0} cols ·{" "}
                  {d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : "—"} ·{" "}
                  {new Date(d.uploaded_at).toLocaleString()}
                </div>
              </div>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/30">
                ACTIVE
              </span>
              <button
                onClick={() => onPreview(d)}
                className="size-7 grid place-items-center rounded border border-border hover:border-cyan/30 hover:text-cyan"
              >
                <Eye className="size-3.5" />
              </button>
              <button
                onClick={() => onAskDelete(d)}
                className="size-7 grid place-items-center rounded border border-border text-muted-foreground hover:text-danger hover:border-danger/40"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
