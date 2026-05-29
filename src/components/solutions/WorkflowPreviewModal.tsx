import { X } from "lucide-react";
import type { Workflow } from "@/store/platform";
import { WorkflowDiagram } from "./WorkflowDiagram";
import multipleSources from "@/assets/workflows/multiple-sources.png";
import automotiveRepair from "@/assets/workflows/automotive-repair.png";
import oemImg from "@/assets/workflows/oem.png";
import teslaImg from "@/assets/workflows/tesla.png";
import bmwImg from "@/assets/workflows/bmw.png";

/** Workflows that show a real reference screenshot instead of the generated SVG. */
const WORKFLOW_IMAGES: Record<string, { src: string; alt: string }> = {
  "w-news-1": { src: multipleSources,   alt: "Multi-source predictive insights pipeline" },
  "w-mfg-1":  { src: automotiveRepair,  alt: "Plant operations PDF/HTML extraction pipeline" },
  "w-cfg-1":  { src: oemImg,            alt: "OEM configurator extraction pipeline" },
  "w-cfg-2":  { src: teslaImg,          alt: "Tesla configurator pricing delta workflow" },
  "w-cfg-3":  { src: bmwImg,            alt: "BMW configurator launch watch workflow" },
};

export function WorkflowPreviewModal({ workflow, onClose }: { workflow: Workflow; onClose: () => void }) {
  const image = WORKFLOW_IMAGES[workflow.id];

  return (
    <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-md max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border flex items-start justify-between gap-4 sticky top-0 bg-card z-10">
          <div className="min-w-0">
            <div className="text-[10px] font-mono tracking-widest text-muted-foreground">WORKFLOW · DESIGN VIEW</div>
            <h2 className="text-lg font-semibold mt-1 truncate">{workflow.name}</h2>
            <p className="text-xs text-muted-foreground mt-1">{workflow.description}</p>
          </div>
          <button onClick={onClose} className="size-8 grid place-items-center rounded hover:bg-surface-elevated shrink-0">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {image ? (
            <div className="rounded-md border border-border overflow-hidden bg-[#f5f6f8]">
              <img src={image.src} alt={image.alt} className="w-full h-auto block" />
            </div>
          ) : (
            <WorkflowDiagram name={workflow.name} stages={workflow.stages} />
          )}

          <div className="text-[10px] font-mono text-muted-foreground tracking-wider">
            {workflow.schedule.toUpperCase()} · {workflow.sources} SOURCES · {workflow.successRate}% SUCCESS · {workflow.deltaCapable ? "DELTA-CAPABLE" : "FULL ONLY"}
          </div>
        </div>
      </div>
    </div>
  );
}
