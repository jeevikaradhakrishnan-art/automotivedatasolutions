import { Play, Globe } from "lucide-react";
import type { SolutionDef } from "@/data/solutions";

export function SourceBotList({
  solution,
  onRun,
}: {
  solution: SolutionDef;
  onRun: (sourceName: string) => void;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-2">
      {solution.sources.map((src) => (
        <div key={src.name} className="panel p-3 flex items-center gap-3">
          <div className="size-9 rounded bg-input/60 grid place-items-center">
            <Globe className="size-4 text-cyan" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{src.name}</div>
            <div className="text-[10px] font-mono text-muted-foreground truncate">{src.url}{src.region ? ` · ${src.region}` : ""}</div>
          </div>
          <button
            onClick={() => onRun(src.name)}
            className="h-8 px-3 rounded text-[11px] font-mono flex items-center gap-1.5 bg-cyan/10 border border-cyan/30 text-cyan hover:bg-cyan/20 transition"
          >
            <Play className="size-3" /> RUN
          </button>
        </div>
      ))}
    </div>
  );
}
