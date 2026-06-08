import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, Sparkles, ClipboardCheck, Shield, ExternalLink } from "lucide-react";
import { usePlatform } from "@/store/platform";

const nav = [
  { to: "/",             label: "Solutions",      icon: LayoutGrid,     code: "SOL", exact: true },
  { to: "/hitl",         label: "Review · HITL",  icon: ClipboardCheck, code: "QA"  },
  { to: "/capabilities", label: "Capabilities",   icon: Sparkles,       code: "CAP" },
];


export function Sidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const pending = usePlatform((s) => s.hitl.filter((h) => h.status === "pending").length);
  const runningJobs = usePlatform((s) => s.jobs.filter((j) => j.status === "running").length);

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-surface/60 backdrop-blur-xl flex flex-col">
      <div className="px-4 py-4 border-b border-border flex items-center gap-3">
        <div className="relative">
          <div className="size-9 rounded-md bg-gradient-to-br from-cyan to-primary/40 grid place-items-center font-mono text-[11px] font-bold text-background">
            X
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-success pulse-dot" />
        </div>
        <div className="leading-tight">
          <div className="font-mono text-[10px] text-muted-foreground tracking-widest">XDAS</div>
          <div className="text-sm font-semibold">Automotive Intelligence</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {nav.map((m) => {
          const active = m.exact
            ? path === m.to || path.startsWith("/solutions")
            : path === m.to || path.startsWith(m.to + "/");
          const badge = m.to === "/hitl" ? pending : 0;
          return (
            <Link
              key={m.to}
              to={m.to}
              className={`group flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition relative ${
                active ? "bg-cyan/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
              }`}
            >
              {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-cyan" />}
              <m.icon className={`size-4 ${active ? "text-cyan" : ""}`} />
              <span className="flex-1">{m.label}</span>
              {badge > 0 ? (
                <span className="font-mono text-[10px] px-1.5 rounded bg-amber/15 text-amber border border-amber/30">{badge}</span>
              ) : (
                <span className="font-mono text-[9px] text-muted-foreground/60">{m.code}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3 space-y-2">
        <a
          href="/admin"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-mono text-muted-foreground hover:text-cyan hover:bg-surface-elevated border border-dashed border-border hover:border-cyan/40 transition"
        >
          <Shield className="size-3.5" />
          <span className="flex-1">Lovable Admin</span>
          <ExternalLink className="size-3" />
        </a>
        <div className="panel p-3 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-muted-foreground">XDAS ENGINE</span>
            <span className="text-success flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-success pulse-dot" /> NOMINAL
            </span>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">6 solutions · {runningJobs} live job{runningJobs === 1 ? "" : "s"}</div>
        </div>
      </div>
    </aside>
  );
}
