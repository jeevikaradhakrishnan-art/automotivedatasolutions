import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Command, ChevronDown, LayoutGrid, Sparkles } from "lucide-react";
import { usePlatform } from "@/store/platform";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

function AppShell() {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground">
      <TopBar />
      <SubNav />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

function SubNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const onUseCases = path.startsWith("/capabilities");
  const onSolutions = !onUseCases;
  return (
    <div className="h-11 border-b border-border bg-surface/40 flex items-center px-5 gap-3">
      <div className="flex items-center gap-1 p-0.5 rounded-lg border border-border bg-card shadow-sm">
        <Link
          to="/"
          className={`flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium transition ${
            onSolutions ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
          }`}
        >
          <LayoutGrid className="size-3.5" /> Solutions
        </Link>
        <Link
          to="/capabilities"
          className={`flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium transition ${
            onUseCases ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
          }`}
        >
          <Sparkles className="size-3.5" /> Use-cases
        </Link>
      </div>
      <div className="ml-auto text-[10px] font-mono text-muted-foreground tracking-widest hidden md:block">
        {onSolutions ? "ACTIVATE · CONFIGURE · RUN · REVIEW · DELIVER" : "CUSTOMER ENGAGEMENTS · CASE STUDIES"}
      </div>
    </div>
  );
}

function TopBar() {
  const [time, setTime] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);
  const runningJobs = usePlatform((s) => s.jobs.filter((j) => j.status === "running").length);

  useEffect(() => {
    const tick = () => setTime(new Date().toUTCString().split(" ")[4]);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);


  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-xl flex items-stretch shadow-sm">
      {/* Brand */}
      <Link to="/" className="px-5 flex items-center gap-3 border-r border-border hover:bg-surface/60 transition">
        <div className="relative">
          <div className="size-8 rounded-md bg-gradient-to-br from-primary to-amber/70 grid place-items-center font-mono text-[11px] font-bold text-primary-foreground shadow-sm">
            X
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-success pulse-dot" />
        </div>
        <div className="leading-tight">
          <div className="font-mono text-[9px] text-muted-foreground tracking-widest">XDAS</div>
          <div className="text-sm font-semibold tracking-tight">Mobility Intelligence</div>
        </div>
      </Link>

      {/* Search */}
      <div className="flex-1 flex items-center px-5 gap-3">
        <div className="flex-1 max-w-xl flex items-center gap-2 px-3 h-9 rounded-md border border-border bg-input/60 hover:border-primary/30 transition cursor-text">
          <Command className="size-3.5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Search solutions, workflows, jobs…</span>
          <kbd className="ml-auto font-mono text-[10px] text-muted-foreground px-1.5 py-0.5 rounded border border-border bg-background/60">⌘K</kbd>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success pulse-dot" />
          <span>{runningJobs} live job{runningJobs === 1 ? "" : "s"}</span>
        </div>
      </div>

      {/* User + segmented nav below */}
      <div className="flex flex-col border-l border-border">
        <div className="h-14 flex items-center gap-2 px-3">
          <span suppressHydrationWarning className="text-[10px] font-mono text-muted-foreground tabular-nums w-[58px] text-right">{time ? `${time} UTC` : ""}</span>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="h-9 pl-2 pr-2 flex items-center gap-2 rounded-md border border-border hover:border-primary/30 transition relative"
          >
            <div className="size-6 rounded bg-gradient-to-br from-primary to-amber/70 grid place-items-center text-[10px] font-bold text-primary-foreground">EM</div>
            <div className="text-xs leading-tight text-left">
              <div className="font-medium">E. Mercer</div>
              <div className="text-[10px] text-muted-foreground font-mono">DATA OPS</div>
            </div>
            <ChevronDown className={`size-3.5 text-muted-foreground transition ${menuOpen ? "rotate-180" : ""}`} />
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 panel py-1 z-50 text-xs text-left" onClick={(e) => e.stopPropagation()}>
                <div className="px-3 py-2 border-b border-border">
                  <div className="font-medium">E. Mercer</div>
                  <div className="text-[10px] font-mono text-muted-foreground">data-ops@xdas.io</div>
                </div>
                <button className="w-full text-left px-3 py-1.5 hover:bg-surface-elevated">Account settings</button>
                <button className="w-full text-left px-3 py-1.5 hover:bg-surface-elevated">Preferences</button>
                <div className="border-t border-border my-1" />
                <button className="w-full text-left px-3 py-1.5 hover:bg-surface-elevated text-danger">Sign out</button>
              </div>
            )}
          </button>
        </div>
      </div>

      {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />}
    </header>
  );
}
