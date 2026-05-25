import { X, ExternalLink, AlertTriangle, Clock, TrendingUp, DollarSign, Target } from "lucide-react";
import type { NewsInsight } from "@/data/solutions";

const impactStyle = {
  High:   "border-danger/40 text-danger bg-danger/10",
  Medium: "border-amber/40 text-amber bg-amber/10",
  Low:    "border-success/40 text-success bg-success/10",
} as const;

export function InsightDetailModal({ insight, onClose }: { insight: NewsInsight | null; onClose: () => void }) {
  if (!insight) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[88vh] overflow-y-auto panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4 sticky top-0 bg-card z-10">
          <div className="min-w-0">
            <div className="text-[10px] font-mono tracking-widest text-muted-foreground">STRATEGIC INSIGHT · {insight.cluster.toUpperCase()}</div>
            <h2 className="text-lg font-semibold mt-1 leading-snug">{insight.headline}</h2>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${impactStyle[insight.impact]}`}>
                IMPACT · {insight.impact.toUpperCase()}
              </span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                insight.priority === "Immediate" ? "border-danger/40 text-danger bg-danger/10" : "border-cyan/30 text-cyan bg-cyan/10"
              }`}>
                {insight.priority === "Immediate" ? <><Clock className="inline size-2.5 -mt-0.5 mr-0.5" /> IMMEDIATE</> : "NON-IMMEDIATE"}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                CONFIDENCE · {insight.confidence}%
              </span>
            </div>
          </div>
          <button onClick={onClose} className="size-8 grid place-items-center rounded hover:bg-surface-elevated">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <Section icon={<AlertTriangle className="size-3.5 text-amber" />} title="Critical Business Impact">
            <p className="text-sm leading-relaxed">{insight.criticalImpact}</p>
          </Section>

          <Section icon={<Target className="size-3.5 text-cyan" />} title="Executive Summary">
            <p className="text-sm leading-relaxed">{insight.executiveSummary}</p>
          </Section>

          <div className="grid md:grid-cols-2 gap-3">
            <Section icon={<TrendingUp className="size-3.5 text-success" />} title="Revenue Opportunity">
              <p className="text-sm leading-relaxed">{insight.revenueOpportunity}</p>
            </Section>
            <Section icon={<DollarSign className="size-3.5 text-amber" />} title="Estimated Financial Impact">
              <p className="text-sm leading-relaxed">{insight.financialImpact}</p>
            </Section>
          </div>

          <div>
            <div className="text-[10px] font-mono tracking-widest text-muted-foreground mb-2">RECOMMENDED ACTIONS</div>
            <div className="grid md:grid-cols-3 gap-3">
              <ActionList title="Immediate" tone="danger" items={insight.immediateActions} />
              <ActionList title="Medium-Term" tone="amber" items={insight.mediumTermActions} />
              <ActionList title="Monitor" tone="cyan" items={insight.monitoring} />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono tracking-widest text-muted-foreground mb-2">SOURCE ARTICLES</div>
            <div className="space-y-1.5">
              {insight.sources.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded border border-border hover:border-cyan/30 hover:bg-surface-elevated/40 transition"
                >
                  <div className="min-w-0">
                    <div className="text-sm truncate">{s.title}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{s.outlet}</div>
                  </div>
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <div className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">{title}</div>
      </div>
      {children}
    </div>
  );
}

const toneCls = {
  danger: "border-danger/30 bg-danger/5",
  amber: "border-amber/30 bg-amber/5",
  cyan: "border-cyan/30 bg-cyan/5",
} as const;
const toneText = {
  danger: "text-danger",
  amber: "text-amber",
  cyan: "text-cyan",
} as const;

function ActionList({ title, tone, items }: { title: string; tone: keyof typeof toneCls; items: string[] }) {
  return (
    <div className={`rounded-md border p-3 ${toneCls[tone]}`}>
      <div className={`text-[10px] font-mono tracking-widest uppercase mb-2 ${toneText[tone]}`}>{title}</div>
      <ul className="space-y-1.5 text-xs">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2"><span className={`${toneText[tone]} mt-0.5`}>›</span><span>{it}</span></li>
        ))}
      </ul>
    </div>
  );
}
