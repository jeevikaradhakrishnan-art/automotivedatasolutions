import { useEffect, useState } from "react";
import { Command, ChevronDown } from "lucide-react";

export function TopBar() {
  const [time, setTime] = useState<string>("");
  useEffect(() => {
    const tick = () => setTime(new Date().toUTCString().split(" ")[4]);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <header className="h-14 border-b border-border bg-background/70 backdrop-blur-xl flex items-stretch">
      <div className="flex-1 flex items-center px-5 gap-2">
        <div className="flex-1 max-w-2xl flex items-center gap-2 px-3 h-9 rounded-md border border-border bg-input/40 hover:border-cyan/30 transition cursor-text">
          <Command className="size-3.5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Search solutions, workflows, jobs, datasets…</span>
          <kbd className="ml-auto font-mono text-[10px] text-muted-foreground px-1.5 py-0.5 rounded border border-border">⌘K</kbd>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 border-l border-border">
        <span suppressHydrationWarning className="text-[10px] font-mono text-muted-foreground tabular-nums w-[58px] text-right">{time ? `${time} UTC` : ""}</span>
        <div className="h-9 pl-2 pr-1 flex items-center gap-2 rounded-md border border-border">
          <div className="size-6 rounded bg-gradient-to-br from-cyan to-amber/60 grid place-items-center text-[10px] font-bold text-background">EM</div>
          <div className="text-xs leading-tight">
            <div className="font-medium">E. Mercer</div>
            <div className="text-[10px] text-muted-foreground font-mono">DATA OPS</div>
          </div>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </div>
      </div>
    </header>
  );
}
