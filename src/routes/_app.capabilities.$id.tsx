import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Download, CheckCircle2 } from "lucide-react";
import { getCapability } from "@/data/capabilities";
import { DataPreviewTable } from "@/components/solutions/DataPreviewTable";
import { downloadFile, toCSV } from "@/store/platform";

export const Route = createFileRoute("/_app/capabilities/$id")({ component: CapabilityDetail });

function CapabilityDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const c = getCapability(id);

  if (!c) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Case not found.</p>
        <button onClick={() => navigate({ to: "/capabilities" })} className="mt-3 text-cyan text-sm">Back</button>
      </div>
    );
  }

  const Icon = c.icon;
  const handleDownload = () => {
    const csv = toCSV(c.outputColumns, c.sampleRows);
    downloadFile(`${c.id}-sample.csv`, csv, "text/csv");
  };

  return (
    <div className="p-5 space-y-5 max-w-6xl mx-auto">
      <Link to="/capabilities" className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft className="size-3" /> ALL USE-CASES
      </Link>

      {/* Hero */}
      <div className={`panel p-6 relative overflow-hidden`}>
        <div className={`absolute -top-20 -right-20 w-80 h-80 rounded-full bg-gradient-to-br ${c.accent} opacity-50 blur-3xl`} />
        <div className="relative flex items-start gap-4 flex-wrap">
          <div className="size-14 rounded-md bg-cyan/10 border border-cyan/30 grid place-items-center shrink-0">
            <Icon className="size-7 text-cyan" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono tracking-widest text-muted-foreground">CASE STUDY</div>
            <h1 className="text-2xl font-semibold tracking-tight mt-1">{c.title}</h1>
            <div className="text-xs font-mono text-muted-foreground mt-2">CUSTOMER · {c.customerProfile}</div>
            <p className="text-sm text-foreground/90 mt-3 max-w-3xl leading-relaxed">{c.oneLiner}</p>
          </div>
          <button
            onClick={handleDownload}
            className="shrink-0 h-9 px-3 rounded text-xs font-mono bg-cyan text-background hover:bg-cyan/90 flex items-center gap-1.5"
          >
            <Download className="size-3.5" /> DOWNLOAD SAMPLE
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {c.metrics.map((m) => (
          <div key={m.label} className="panel p-4">
            <div className="text-2xl font-semibold text-cyan">{m.value}</div>
            <div className="text-[11px] font-mono text-muted-foreground mt-1 tracking-wider uppercase">{m.label}</div>
            {m.sub && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{m.sub}</div>}
          </div>
        ))}
      </div>

      {/* Problem + Solution */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="panel p-5">
          <div className="text-[10px] font-mono tracking-widest text-amber">PROBLEM STATEMENT</div>
          <p className="text-sm text-foreground/90 mt-2 leading-relaxed">{c.problem}</p>
        </div>
        <div className="panel p-5">
          <div className="text-[10px] font-mono tracking-widest text-success">SOLUTION DELIVERED</div>
          <ul className="mt-2 space-y-2">
            {c.solution.map((s, i) => (
              <li key={i} className="text-sm text-foreground/90 leading-relaxed flex gap-2">
                <CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Approach pipeline */}
      <div className="panel p-5">
        <div className="text-[10px] font-mono tracking-widest text-muted-foreground">APPROACH</div>
        <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {c.approach.map((p, i) => (
            <div key={i} className="rounded border border-border bg-surface/40 p-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] size-6 rounded grid place-items-center bg-cyan/10 border border-cyan/30 text-cyan">{String(i + 1).padStart(2, "0")}</span>
                <div className="text-sm font-semibold">{p.phase}</div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{p.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sample data */}
      <div className="space-y-2">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] font-mono tracking-widest text-muted-foreground">SAMPLE OUTPUT</div>
            <div className="text-sm text-muted-foreground">A preview of the deliverable shape — download for the full sample CSV.</div>
          </div>
          <button onClick={handleDownload} className="h-8 px-3 rounded text-[11px] font-mono border border-cyan/30 text-cyan hover:bg-cyan/10 flex items-center gap-1.5">
            <Download className="size-3" /> DOWNLOAD CSV
          </button>
        </div>
        <DataPreviewTable columns={c.outputColumns} rows={c.sampleRows} maxRows={10} />
      </div>

      {c.placeholder && (
        <div className="panel p-3 text-[11px] font-mono text-amber border-amber/40 bg-amber/5">
          Placeholder content — to be updated with the customer-supplied case details.
        </div>
      )}
    </div>
  );
}
