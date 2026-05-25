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
  Map as MapIcon,
  Layers,
  Radar,
  Send,
  Globe,
  Crosshair,
  Flag,
  Rss,
  Webhook,
  FileInput,
  ClipboardCheck,
  FileCheck2,
  Bot,
  ShoppingCart,
  Tag,
  Hash,
  MessageCircle,
  Smile,
  PackageSearch,
  Wrench,
  TableProperties,
  Truck,
  Gauge,
  Bell,
  Mailbox,
  Compass,
  Filter,
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

        {/* APPROACH WORKFLOW — pictorial flow */}
        <section>
          <SectionHeading eyebrow="THE JOURNEY" title="From signal to deliverable" />
          <PictorialFlow capabilityId={c.id} steps={c.approach} />
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

// ---------- Pictorial flow ----------

type LucideIconType = typeof Database;

type FlowNode = { icon: LucideIconType; chapter: string; tint: string };

const FLOW_BY_CAPABILITY: Record<string, FlowNode[]> = {
  "fleet-polygon": [
    { icon: Compass,     chapter: "The Scout",     tint: "from-cyan/30 to-cyan/5" },
    { icon: MapIcon,     chapter: "The Cartographer", tint: "from-violet-400/30 to-violet-400/5" },
    { icon: Layers,      chapter: "The Translator", tint: "from-emerald-400/30 to-emerald-400/5" },
    { icon: ShieldCheck, chapter: "The Inspector",  tint: "from-amber-400/30 to-amber-400/5" },
    { icon: Send,        chapter: "The Courier",    tint: "from-rose-400/30 to-rose-400/5" },
  ],
  "dealer-verification": [
    { icon: Radar,    chapter: "The Listener",  tint: "from-cyan/30 to-cyan/5" },
    { icon: Crosshair,chapter: "The Matcher",   tint: "from-violet-400/30 to-violet-400/5" },
    { icon: Flag,     chapter: "The Referee",   tint: "from-amber-400/30 to-amber-400/5" },
    { icon: Webhook,  chapter: "The Broadcaster", tint: "from-emerald-400/30 to-emerald-400/5" },
  ],
  "incentives-rebates": [
    { icon: FileInput,      chapter: "The Brief",      tint: "from-cyan/30 to-cyan/5" },
    { icon: Globe,          chapter: "The Recon",      tint: "from-violet-400/30 to-violet-400/5" },
    { icon: ClipboardCheck, chapter: "The Blueprint",  tint: "from-sky-400/30 to-sky-400/5" },
    { icon: Bot,            chapter: "The Build",      tint: "from-emerald-400/30 to-emerald-400/5" },
    { icon: FileCheck2,     chapter: "The Audit",      tint: "from-amber-400/30 to-amber-400/5" },
    { icon: Mailbox,        chapter: "The Drop",       tint: "from-rose-400/30 to-rose-400/5" },
  ],
  "rental-pricing": [
    { icon: ShoppingCart, chapter: "The Shopper",  tint: "from-cyan/30 to-cyan/5" },
    { icon: Tag,          chapter: "The Decoder",  tint: "from-violet-400/30 to-violet-400/5" },
    { icon: Gauge,        chapter: "The Index",    tint: "from-emerald-400/30 to-emerald-400/5" },
    { icon: Bell,         chapter: "The Sentry",   tint: "from-amber-400/30 to-amber-400/5" },
    { icon: Send,         chapter: "The Dispatch", tint: "from-rose-400/30 to-rose-400/5" },
  ],
  "auto-fitment": [
    { icon: FileInput,       chapter: "The Intake",   tint: "from-cyan/30 to-cyan/5" },
    { icon: PackageSearch,   chapter: "The Sleuth",   tint: "from-violet-400/30 to-violet-400/5" },
    { icon: Wrench,          chapter: "The Mapper",   tint: "from-sky-400/30 to-sky-400/5" },
    { icon: TableProperties, chapter: "The Forge",    tint: "from-emerald-400/30 to-emerald-400/5" },
    { icon: ShieldCheck,     chapter: "The Audit",    tint: "from-amber-400/30 to-amber-400/5" },
    { icon: Truck,           chapter: "The Hand-off", tint: "from-rose-400/30 to-rose-400/5" },
  ],
  "components-market-research": [
    { icon: Crosshair,    chapter: "The Question",  tint: "from-cyan/30 to-cyan/5" },
    { icon: Globe,        chapter: "The Field",     tint: "from-violet-400/30 to-violet-400/5" },
    { icon: Hash,         chapter: "The Signals",   tint: "from-sky-400/30 to-sky-400/5" },
    { icon: Filter,       chapter: "The Distill",   tint: "from-emerald-400/30 to-emerald-400/5" },
    { icon: Smile,        chapter: "The Mood",      tint: "from-amber-400/30 to-amber-400/5" },
    { icon: Rss,          chapter: "The Briefing",  tint: "from-rose-400/30 to-rose-400/5" },
  ],
};

const FALLBACK_FLOW: FlowNode[] = [
  { icon: Database,    chapter: "The Source",   tint: "from-cyan/30 to-cyan/5" },
  { icon: Search0Icon, chapter: "The Search",   tint: "from-violet-400/30 to-violet-400/5" },
  { icon: Cpu,         chapter: "The Engine",   tint: "from-sky-400/30 to-sky-400/5" },
  { icon: ShieldCheck, chapter: "The Gate",     tint: "from-emerald-400/30 to-emerald-400/5" },
  { icon: LineChart,   chapter: "The Insight",  tint: "from-amber-400/30 to-amber-400/5" },
  { icon: Send,        chapter: "The Delivery", tint: "from-rose-400/30 to-rose-400/5" },
];

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

function PictorialFlow({
  capabilityId,
  steps,
}: {
  capabilityId: string;
  steps: { phase: string; detail: string }[];
}) {
  const flow = FLOW_BY_CAPABILITY[capabilityId] ?? FALLBACK_FLOW;

  return (
    <div className="relative rounded-2xl border border-border bg-gradient-to-br from-surface/60 via-background to-surface-elevated/40 p-6 md:p-10 overflow-hidden">
      {/* Atmospheric bg */}
      <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
      <div className="absolute -top-20 left-1/3 w-72 h-72 rounded-full bg-cyan/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 right-10 w-72 h-72 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

      {/* DESKTOP — horizontal zigzag flow */}
      <div className="relative hidden lg:block">
        {/* Straight line connector */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px pointer-events-none">
          <div className="h-px w-full bg-[linear-gradient(to_right,transparent,hsl(var(--border))_8%,hsl(var(--border))_92%,transparent)]" />
          <div className="absolute inset-0 h-px w-full bg-[repeating-linear-gradient(to_right,transparent_0,transparent_6px,rgba(34,211,238,0.55)_6px,rgba(34,211,238,0.55)_12px)] opacity-70" />
        </div>

        <ol
          className="relative grid gap-4"
          style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        >
          {steps.map((step, i) => {
            const node = flow[i] ?? FALLBACK_FLOW[i % FALLBACK_FLOW.length];
            const StepIcon = node.icon;
            const offset = i % 2 === 0 ? "lg:-translate-y-6" : "lg:translate-y-6";
            return (
              <li key={i} className={`group relative flex flex-col items-center text-center ${offset}`}>
                {/* Chapter marker */}
                <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground/70 mb-2">
                  CH · {ROMAN[i] ?? i + 1}
                </div>

                {/* Illustrated node */}
                <div className="relative">
                  <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${node.tint} blur-xl scale-125 group-hover:scale-150 transition`} />
                  <div className="relative size-20 rounded-full border border-cyan/30 bg-gradient-to-br from-surface-elevated to-surface grid place-items-center shadow-[0_8px_24px_-12px_rgba(0,255,255,0.35)] group-hover:border-cyan/60 transition">
                    <StepIcon className="size-8 text-cyan" strokeWidth={1.5} />
                  </div>
                  <span className="absolute -top-1 -right-1 size-6 rounded-full bg-background border border-cyan/40 text-[10px] font-mono text-cyan grid place-items-center">
                    {i + 1}
                  </span>
                </div>

                {/* Chapter title — creative */}
                <div className="mt-4 text-sm font-semibold tracking-tight italic text-foreground">
                  {node.chapter}
                </div>
                {/* Actual phase */}
                <div className="text-[11px] font-mono uppercase tracking-widest text-cyan/80 mt-0.5">
                  {step.phase}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed max-w-[180px]">
                  {step.detail}
                </p>
              </li>
            );
          })}
        </ol>
      </div>

      {/* MOBILE / TABLET — vertical storyboard */}
      <ol className="relative lg:hidden space-y-5 pl-6">
        <div className="absolute left-[26px] top-2 bottom-2 w-px bg-gradient-to-b from-transparent via-cyan/40 to-transparent" />
        {steps.map((step, i) => {
          const node = flow[i] ?? FALLBACK_FLOW[i % FALLBACK_FLOW.length];
          const StepIcon = node.icon;
          return (
            <li key={i} className="relative flex gap-4">
              <div className="relative shrink-0">
                <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${node.tint} blur-md scale-125`} />
                <div className="relative size-14 rounded-full border border-cyan/30 bg-gradient-to-br from-surface-elevated to-surface grid place-items-center">
                  <StepIcon className="size-6 text-cyan" strokeWidth={1.5} />
                </div>
                <span className="absolute -top-1 -right-1 size-5 rounded-full bg-background border border-cyan/40 text-[9px] font-mono text-cyan grid place-items-center">
                  {i + 1}
                </span>
              </div>
              <div className="flex-1 pt-1">
                <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground/70">
                  CH · {ROMAN[i] ?? i + 1}
                </div>
                <div className="text-sm font-semibold italic">{node.chapter}</div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-cyan/80 mt-0.5">
                  {step.phase}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {step.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

