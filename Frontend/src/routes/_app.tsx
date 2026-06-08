import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Command as CommandIcon, LayoutGrid, Sparkles } from "lucide-react";
import { usePlatform } from "@/store/platform";
import { SOLUTIONS } from "@/data/solutions";
import { CAPABILITIES } from "@/data/capabilities";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground">
      <TopBar onOpenSearch={() => setSearchOpen(true)} />
      <SubNav />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const go = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  const staticPages = useMemo(
    () => [
      { label: "Solutions", icon: LayoutGrid, action: () => navigate({ to: "/" }) },
      { label: "Use-cases", icon: Sparkles, action: () => navigate({ to: "/capabilities" }) },
    ],
    [navigate],
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search solutions, use-cases, pages…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {staticPages.map((p) => (
            <CommandItem key={p.label} value={p.label} onSelect={() => go(p.action)}>
              <p.icon className="size-4 text-cyan" />
              <span>{p.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Solutions">
          {SOLUTIONS.map((s) => (
            <CommandItem
              key={s.id}
              value={`solution ${s.title} ${s.code} ${s.short}`}
              onSelect={() => go(() => navigate({ to: "/solutions/$id", params: { id: s.id } }))}
            >
              <s.icon className="size-4 text-cyan" />
              <span className="flex-1">{s.title}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{s.code}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Use-cases">
          {CAPABILITIES.map((c) => (
            <CommandItem
              key={c.id}
              value={`usecase ${c.title} ${c.oneLiner} ${c.customerProfile}`}
              onSelect={() => go(() => navigate({ to: "/capabilities/$id", params: { id: c.id } }))}
            >
              <c.icon className="size-4 text-cyan" />
              <span className="flex-1">{c.title}</span>
              <span className="font-mono text-[10px] text-muted-foreground">CASE</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function SubNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const onUseCases = path.startsWith("/capabilities");
  const onSolutions = !onUseCases;
  return (
    <div className="h-11 border-b border-border bg-surface/40 flex items-center px-5 gap-3">
      <div className="text-[10px] font-mono text-muted-foreground tracking-widest hidden md:block">
        {onSolutions ? "ACTIVATE · CONFIGURE · RUN · REVIEW · DELIVER" : "CUSTOMER ENGAGEMENTS · CASE STUDIES"}
      </div>
      <div className="ml-auto flex items-center gap-1 p-0.5 rounded-lg border border-border bg-card shadow-sm">
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
    </div>
  );
}

function TopBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const runningJobs = usePlatform((s) => s.jobs.filter((j) => j.status === "running").length);

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
          <div className="text-sm font-semibold tracking-tight">Automotive Intelligence</div>
        </div>
      </Link>

      {/* Search */}
      <div className="flex-1 flex items-center px-5 gap-3">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex-1 max-w-xl flex items-center gap-2 px-3 h-9 rounded-md border border-border bg-input/60 hover:border-primary/30 transition cursor-pointer text-left"
        >
          <CommandIcon className="size-3.5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Search solutions, use-cases, pages…</span>
          <kbd className="ml-auto font-mono text-[10px] text-muted-foreground px-1.5 py-0.5 rounded border border-border bg-background/60">⌘K</kbd>
        </button>

        <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success pulse-dot" />
          <span>{runningJobs} live job{runningJobs === 1 ? "" : "s"}</span>
        </div>
      </div>
    </header>
  );
}
