import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Plus } from "lucide-react";
import type { SolutionDef } from "@/data/solutions";
import { usePlatform } from "@/store/platform";

export function SolutionCard({ s }: { s: SolutionDef }) {
  const subscribed = usePlatform((st) => st.subscriptions.includes(s.id));
  const toggle = usePlatform((st) => st.toggleSubscription);
  const Icon = s.icon;

  return (
    <div className="panel p-5 flex flex-col gap-3 hover:border-cyan/40 transition group">
      <div className="flex items-start justify-between">
        <div className="size-10 rounded-md bg-cyan/10 border border-cyan/30 grid place-items-center">
          <Icon className="size-5 text-cyan" />
        </div>
        <span
          className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
            s.type === "Data + Insights"
              ? "border-amber/40 text-amber bg-amber/10"
              : "border-cyan/30 text-cyan bg-cyan/5"
          }`}
        >
          {s.type.toUpperCase()}
        </span>
      </div>

      <div>
        <div className="text-[10px] font-mono tracking-widest text-muted-foreground">SOLUTION · {s.code}</div>
        <h3 className="text-base font-semibold mt-0.5">{s.title}</h3>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{s.short}</p>
      </div>

      <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground mt-auto pt-3 border-t border-border">
        <span>{s.sources.length} SOURCES</span>
        <span>·</span>
        <span>{s.formats.join(" / ")}</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={(e) => { e.preventDefault(); toggle(s.id); }}
          className={`flex-1 h-8 rounded text-xs font-mono flex items-center justify-center gap-1.5 border transition ${
            subscribed
              ? "bg-success/10 border-success/40 text-success"
              : "border-border text-muted-foreground hover:border-cyan/30 hover:text-foreground"
          }`}
        >
          {subscribed ? <><Check className="size-3" /> ACTIVATED</> : <><Plus className="size-3" /> ACTIVATE USE CASE</>}
        </button>
        <Link
          to="/solutions/$id"
          params={{ id: s.id }}
          className="h-8 px-3 rounded text-xs font-mono flex items-center gap-1.5 bg-cyan text-background hover:bg-cyan/90 transition"
        >
          OPEN <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
