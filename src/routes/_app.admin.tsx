import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, Trash2, FileSpreadsheet } from "lucide-react";
import { SOLUTIONS, type SolutionId } from "@/data/solutions";
import { usePlatform, type Dataset } from "@/store/platform";
import { DataPreviewTable } from "@/components/solutions/DataPreviewTable";

export const Route = createFileRoute("/_app/admin")({ component: AdminPage });

function AdminPage() {
  const datasets = usePlatform((s) => s.datasets);
  const addDataset = usePlatform((s) => s.addDataset);
  const removeDataset = usePlatform((s) => s.removeDataset);
  const [target, setTarget] = useState<SolutionId>("ev-charging");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Dataset | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      let rows: Record<string, string | number>[] = [];
      let cols: string[] = [];
      if (file.name.endsWith(".json")) {
        const parsed = JSON.parse(new TextDecoder().decode(buf));
        rows = Array.isArray(parsed) ? parsed : [];
        cols = rows[0] ? Object.keys(rows[0]) : [];
      } else {
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, string | number>[];
        cols = rows[0] ? Object.keys(rows[0]) : [];
      }
      const ds: Dataset = {
        id: crypto.randomUUID(),
        solutionId: target,
        name: file.name,
        uploadedAt: new Date().toISOString(),
        rows: rows.length,
        columns: cols,
        data: rows,
      };
      addDataset(ds);
      setPreview(ds);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="p-5 space-y-5">
      <div>
        <div className="text-[10px] font-mono tracking-widest text-muted-foreground">XDAS · ADMIN</div>
        <h1 className="text-2xl font-semibold mt-1 tracking-tight">Admin Console</h1>
        <p className="text-sm text-muted-foreground">Upload reference datasets, manage tenant config, and audit pipeline credentials. Uploads stay scoped here for QA — they do not auto-replace solution outputs.</p>
      </div>

      <div className="panel p-4">
        <div className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase mb-3">Upload dataset</div>
        <div className="flex gap-3 flex-wrap items-center">
          <label className="text-xs font-mono text-muted-foreground">SOLUTION</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as SolutionId)}
            className="h-9 px-3 rounded bg-input border border-border text-sm"
          >
            {SOLUTIONS.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="h-9 px-3 rounded bg-cyan text-background text-xs font-mono flex items-center gap-1.5 hover:bg-cyan/90 disabled:opacity-50"
          >
            <Upload className="size-3.5" /> {busy ? "PARSING…" : "UPLOAD FILE"}
          </button>
          <span className="text-[10px] font-mono text-muted-foreground">Accepts CSV · XLSX · JSON</span>
        </div>
      </div>

      <div className="panel">
        <div className="px-4 py-3 border-b border-border">
          <div className="text-sm font-semibold">Uploaded datasets</div>
          <div className="text-[10px] font-mono text-muted-foreground tracking-wider">{datasets.length} TOTAL</div>
        </div>
        {datasets.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">No datasets uploaded yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {datasets.map((d) => {
              const sol = SOLUTIONS.find((s) => s.id === d.solutionId);
              return (
                <div key={d.id} className="px-4 py-3 flex items-center gap-3 hover:bg-surface-elevated/40">
                  <FileSpreadsheet className="size-4 text-cyan" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{d.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {sol?.title} · {d.rows.toLocaleString()} rows · {d.columns.length} cols · {new Date(d.uploadedAt).toLocaleString()}
                    </div>
                  </div>
                  <button onClick={() => setPreview(d)} className="h-7 px-2 text-[11px] font-mono rounded border border-border hover:border-cyan/30 hover:text-cyan">
                    PREVIEW
                  </button>
                  <button onClick={() => removeDataset(d.id)} className="size-7 grid place-items-center rounded border border-border text-muted-foreground hover:text-danger hover:border-danger/40">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {preview && (
        <div className="panel p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">Preview</div>
              <div className="text-sm font-semibold">{preview.name}</div>
            </div>
            <button onClick={() => setPreview(null)} className="text-xs font-mono text-muted-foreground hover:text-foreground">CLOSE</button>
          </div>
          <DataPreviewTable columns={preview.columns} rows={preview.data} maxRows={25} />
        </div>
      )}
    </div>
  );
}
