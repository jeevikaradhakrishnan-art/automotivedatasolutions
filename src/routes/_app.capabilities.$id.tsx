import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Download,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Database,
  Cpu,
  ShieldCheck,
  LineChart,
  Building2,
  FileSpreadsheet,
  Search as Search0Icon,
} from "lucide-react";
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
    <div className="min-h-full bg-gradient-to-b from-background via-background to-surface-elevated/40">
      <div className="max-w-7xl mx-auto p-5 md:p-8 space-y-12">
        <Link to="/capabilities" className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="size-3" /> ALL USE-CASES
        </Link>

        {/* HERO */}
        <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface-elevated via-surface to-background">
          {/* Decorative grid + glows */}
          <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
          <div className={`absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full bg-gradient-to-br ${c.accent} opacity-60 blur-3xl pointer-events-none`} />
          <div className="absolute -bottom-24 -left-20 w-72 h-72 rounded-full bg-cyan/10 blur-3xl pointer-events-none" />

          <div className="relative grid md:grid-cols-2 gap-8 p-8 md:p-12 items-center">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono tracking-widest px-2 py-1 rounded border border-cyan/40 bg-cyan/10 text-cyan">CASE STUDY</span>
                {c.industryTag && (
                  <span className="text-[10px] font-mono tracking-widest px-2 py-1 rounded border border-border bg-surface/60 text-muted-foreground">
                    {c.industryTag.toUpperCase()}
                  </span>
                )}
              </div>

              <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05] bg-gradient-to-br from-foreground via-foreground to-cyan/80 bg-clip-text text-transparent">
                {c.title}
              </h1>

              <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl">
                {c.oneLiner}
              </p>

              <div className="flex items-center gap-2 pt-1 text-xs font-mono text-muted-foreground">
                <Building2 className="size-3.5 text-cyan" />
                <span>{c.customerProfile}</span>
              </div>

              {/* Floating KPI badges */}
              <div className="flex flex-wrap gap-2 pt-3">
                {c.metrics.slice(0, 3).map((m) => (
                  <div
                    key={m.label}
                    className="px-3 py-1.5 rounded-full border border-cyan/30 bg-cyan/5 backdrop-blur text-[11px] font-mono flex items-center gap-2"
                  >
                    <span className="text-cyan font-semibold">{m.value}</span>
                    <span className="text-muted-foreground">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero illustration */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-cyan/20 via-primary/10 to-transparent rounded-2xl blur-2xl" />
              <div className="relative rounded-xl overflow-hidden border border-cyan/20 shadow-2xl bg-surface">
                <img
                  src={c.image}
                  alt={c.title}
                  width={1024}
                  height={640}
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent pointer-events-none" />
                {/* Floating icon badge */}
                <div className="absolute top-4 left-4 size-12 rounded-xl bg-background/80 backdrop-blur border border-cyan/30 grid place-items-center shadow-lg">
                  <Icon className="size-6 text-cyan" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* IMPACT METRICS */}
        <section>
          <SectionHeading eyebrow="MEASURABLE IMPACT" title="Outcomes delivered" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {c.metrics.map((m, i) => {
              const Icons = [LineChart, Sparkles, ShieldCheck, Cpu];
              const KpiIcon = Icons[i % Icons.length];
              return (
                <div
                  key={m.label}
                  className="group relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-surface to-surface-elevated p-5 hover:border-cyan/40 transition"
                >
                  <div className="absolute -top-10 -right-10 size-32 rounded-full bg-gradient-to-br from-cyan/20 to-transparent opacity-50 group-hover:opacity-100 blur-2xl transition" />
                  <div className="relative">
                    <KpiIcon className="size-5 text-cyan/70 mb-3" />
                    <div className="text-3xl md:text-4xl font-semibold bg-gradient-to-br from-cyan to-primary bg-clip-text text-transparent">
                      {m.value}
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground mt-2 tracking-wider uppercase">
                      {m.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* PROBLEM + SOLUTION */}
        <section className="grid md:grid-cols-5 gap-5">
          <div className="md:col-span-2 relative overflow-hidden rounded-xl border border-amber/30 bg-gradient-to-br from-amber/5 to-transparent p-6">
            <div className="absolute -top-12 -right-12 size-40 rounded-full bg-amber/10 blur-2xl" />
            <div className="relative space-y-3">
              <div className="flex items-center gap-2">
                <div className="size-9 rounded-lg bg-amber/15 border border-amber/40 grid place-items-center">
                  <AlertTriangle className="size-4 text-amber" />
                </div>
                <div className="text-[10px] font-mono tracking-widest text-amber">THE CHALLENGE</div>
              </div>
              <h3 className="text-lg font-semibold">Problem statement</h3>
              <p className="text-sm text-foreground/90 leading-relaxed">{c.problem}</p>
            </div>
          </div>

          <div className="md:col-span-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-lg bg-success/10 border border-success/40 grid place-items-center">
                <Sparkles className="size-4 text-success" />
              </div>
              <div className="text-[10px] font-mono tracking-widest text-success">SOLUTION DELIVERED</div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {c.solution.map((s, i) => (
                <div
                  key={i}
                  className="group rounded-xl border border-border bg-surface/60 p-4 hover:border-success/40 hover:bg-success/[0.03] transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-success/10 border border-success/30 grid place-items-center shrink-0 group-hover:scale-110 transition">
                      <CheckCircle2 className="size-4 text-success" />
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed">{s}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* APPROACH WORKFLOW */}
        <section>
          <SectionHeading eyebrow="HOW IT WORKS" title="End-to-end approach" />
          <div className="relative">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {c.approach.map((p, i) => {
                const StepIcons = [Database, Search0Icon, Cpu, ShieldCheck, LineChart, ArrowRight];
                const StepIcon = StepIcons[i % StepIcons.length];
                return (
                  <div key={i} className="relative">
                    <div className="group relative h-full rounded-xl border border-border bg-gradient-to-br from-surface to-surface-elevated p-4 hover:border-cyan/40 transition overflow-hidden">
                      <div className="absolute -top-8 -right-8 size-24 rounded-full bg-cyan/5 blur-xl group-hover:bg-cyan/15 transition" />
                      <div className="relative">
                        <div className="flex items-center justify-between mb-3">
                          <div className="size-9 rounded-lg bg-cyan/10 border border-cyan/30 grid place-items-center">
                            <StepIcon className="size-4 text-cyan" />
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            STEP {String(i + 1).padStart(2, "0")}
                          </span>
                        </div>
                        <div className="text-sm font-semibold">{p.phase}</div>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{p.detail}</p>
                      </div>
                    </div>
                    {/* Connector */}
                    {i < c.approach.length - 1 && (
                      <div className="hidden xl:block absolute top-1/2 -right-2 translate-x-full -translate-y-1/2 text-cyan/40 pointer-events-none">
                        <ArrowRight className="size-4" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SAMPLE DATA + DOWNLOAD */}
        <section>
          <SectionHeading eyebrow="DELIVERABLE PREVIEW" title="What you receive" />
          <div className="grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 rounded-xl border border-border bg-surface/40 p-4 overflow-hidden">
              <div className="text-[10px] font-mono tracking-widest text-muted-foreground mb-2">SAMPLE OUTPUT · {c.outputColumns.length} FIELDS</div>
              <DataPreviewTable columns={c.outputColumns} rows={c.sampleRows} maxRows={10} />
            </div>

            <div className="rounded-xl border border-cyan/30 bg-gradient-to-br from-cyan/10 via-primary/5 to-transparent p-6 flex flex-col">
              <div className="size-12 rounded-xl bg-cyan/15 border border-cyan/40 grid place-items-center">
                <FileSpreadsheet className="size-6 text-cyan" />
              </div>
              <div className="text-[10px] font-mono tracking-widest text-cyan mt-4">DOWNLOAD SAMPLE</div>
              <h4 className="text-lg font-semibold mt-1">Get the sample CSV</h4>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                A representative snapshot of the deliverable — schema, columns and a handful of rows so your team can validate the shape.
              </p>
              <div className="mt-3 flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
                <span className="px-2 py-0.5 rounded bg-surface border border-border">.CSV</span>
                <span>·</span>
                <span>{c.sampleRows.length} rows</span>
                <span>·</span>
                <span>{c.outputColumns.length} cols</span>
              </div>
              <button
                onClick={handleDownload}
                className="mt-auto pt-5 group"
              >
                <span className="h-11 w-full rounded-lg bg-cyan text-background font-mono text-xs tracking-wider flex items-center justify-center gap-2 hover:bg-cyan/90 transition group-hover:gap-3">
                  <Download className="size-4" /> DOWNLOAD SAMPLE CSV
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* CTA STRIP */}
        <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-cyan/10 via-primary/10 to-background p-6 md:p-8">
          <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono tracking-widest text-cyan">READY WHEN YOU ARE</div>
              <h3 className="text-xl md:text-2xl font-semibold mt-1">Run this use-case on your data</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                Spin up the workflow, point it at your sources and ship review-gated results into your stack — typically within a sprint.
              </p>
            </div>
            <Link
              to="/capabilities"
              className="shrink-0 h-11 px-5 rounded-lg bg-foreground text-background font-mono text-xs tracking-wider flex items-center gap-2 hover:opacity-90 transition"
            >
              EXPLORE MORE USE-CASES <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        {c.placeholder && (
          <div className="rounded-lg border border-amber/40 bg-amber/5 p-3 text-[11px] font-mono text-amber">
            Placeholder content — to be updated with the customer-supplied case details.
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-5">
      <div className="text-[10px] font-mono tracking-widest text-cyan">{eyebrow}</div>
      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mt-1">{title}</h2>
    </div>
  );
}


