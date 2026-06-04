/**
 * XWorkflowView — renders a faithful replica of the X-platform workflow
 * designer screenshots supplied for the EV-charging and Plant-operations
 * (Inventory) workflows.
 *
 * Layout mirrors the screenshots exactly:
 *   Row 1  →  Input + bot chain  (left-to-right)
 *   Row 2  →  bot chain + QA + Output  (left-to-right, below row 1)
 *   A rectangular outline box wraps both rows to show the snake-path flow.
 */

interface NodeDef {
  label: string;
  type: "input" | "bot" | "qa" | "output";
}

interface WorkflowDef {
  title: string;
  row1: NodeDef[];
  row2: NodeDef[];
}

/* ─── colour map ─────────────────────────────────────────────────── */
const NODE_BG: Record<NodeDef["type"], string> = {
  input:  "#16A34A",
  output: "#16A34A",
  bot:    "#4B6BFB",
  qa:     "#7C3AED",
};

/* ─── SVG icons (inline, no external dependency) ─────────────────── */
function BotIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="9" width="18" height="13" rx="2" />
      <path d="M9 9V7a3 3 0 0 1 6 0v2" />
      <circle cx="9" cy="15" r="1.5" fill="white" stroke="none" />
      <circle cx="15" cy="15" r="1.5" fill="white" stroke="none" />
      <path d="M12 3v2M8 22v-2M16 22v-2" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
function QaIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
      <line x1="11" y1="8" x2="11" y2="11" />
      <line x1="11" y1="14" x2="11.01" y2="14" strokeWidth="2.5" />
    </svg>
  );
}

function NodeIcon({ type }: { type: NodeDef["type"] }) {
  if (type === "input")  return <DownloadIcon />;
  if (type === "output") return <UploadIcon />;
  if (type === "qa")     return <QaIcon />;
  return <BotIcon />;
}

/* ─── Single node box ─────────────────────────────────────────────── */
const BOX = 70; // px — node box size
const GAP = 46; // px — horizontal gap between nodes

function Node({ label, type }: NodeDef) {
  return (
    <div className="flex flex-col items-center" style={{ minWidth: BOX }}>
      {/* Connection dot — left */}
      <div className="relative">
        <div
          className="flex items-center justify-center rounded-lg shadow-md"
          style={{ width: BOX, height: BOX, background: NODE_BG[type], flexShrink: 0 }}
        >
          <NodeIcon type={type} />
        </div>
        {/* left connector dot */}
        <span
          className="absolute top-1/2 -translate-y-1/2 -left-[5px] size-[9px] rounded-full bg-gray-900"
        />
        {/* right connector dot */}
        <span
          className="absolute top-1/2 -translate-y-1/2 -right-[5px] size-[9px] rounded-full bg-gray-900"
        />
      </div>
      <div
        className="mt-2 text-center font-medium text-gray-800 leading-tight"
        style={{ fontSize: 11, maxWidth: BOX + 20 }}
      >
        {label}
      </div>
    </div>
  );
}

/* ─── Row of nodes with connecting lines ──────────────────────────── */
function NodeRow({ nodes }: { nodes: NodeDef[] }) {
  return (
    <div className="flex items-start">
      {nodes.map((n, i) => (
        <div key={i} className="flex items-center">
          <Node {...n} />
          {i < nodes.length - 1 && (
            <div
              className="bg-gray-900"
              style={{ width: GAP, height: 2, marginBottom: 22, flexShrink: 0 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Main workflow view ──────────────────────────────────────────── */
export function XWorkflowView({ workflow }: { workflow: WorkflowDef }) {
  const { row1, row2, title } = workflow;

  return (
    <div
      className="relative overflow-auto"
      style={{
        background: "#F8F9FC",
        backgroundImage:
          "radial-gradient(circle, #CBD5E1 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* ── top UI bar (mimics X-platform header) ── */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-4"
        style={{ height: 48 }}
      >
        <span className="rounded bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">X</span>
        <span className="text-sm font-medium text-gray-700">{title}</span>
        <div className="ml-auto flex items-center gap-2 text-xs font-medium">
          <span className="rounded border border-gray-300 px-3 py-1 text-gray-600">Run Config</span>
          <span className="rounded border border-gray-300 px-3 py-1 text-gray-600">Clone</span>
          <span className="rounded border border-gray-300 px-3 py-1 text-gray-600">Save</span>
          <span className="rounded bg-emerald-500 px-3 py-1 text-white">Save &amp; Next →</span>
        </div>
      </div>

      {/* ── breadcrumb ── */}
      <div className="flex items-center gap-6 border-b border-gray-100 bg-white px-4 py-2 text-xs text-gray-500">
        <span className="font-semibold text-emerald-600">① Design</span>
        <span>② Prototype</span>
        <span>③ Publish</span>
      </div>

      {/* ── canvas ── */}
      <div className="relative p-10" style={{ minHeight: 360 }}>
        {/* Wrap outline box */}
        <div
          className="absolute rounded-xl border-2 border-gray-300"
          style={{
            top: 36,
            left: 36,
            right: 36,
            bottom: 36,
          }}
        />

        {/* Row 1 */}
        <div className="relative z-10 mb-10 pl-8">
          <NodeRow nodes={row1} />
        </div>

        {/* Row 2 */}
        <div className="relative z-10 pl-8">
          <NodeRow nodes={row2} />
        </div>
      </div>

      {/* ── right sidebar (icons only, static) ── */}
      <div
        className="absolute right-0 top-0 flex flex-col items-center gap-5 border-l border-gray-200 bg-white px-2 py-4"
        style={{ top: 96, bottom: 0, position: "absolute" }}
      >
        {[
          { label: "BOTS",     color: "#4B6BFB" },
          { label: "ETL",      color: "#16A34A" },
          { label: "HITL",     color: "#F59E0B" },
          { label: "DOMAIN",   color: "#F59E0B" },
          { label: "SOLUTIONS",color: "#EF4444" },
          { label: "INTEGRATION", color: "#1D4ED8" },
        ].map(({ label, color }) => (
          <div key={label} className="flex flex-col items-center gap-1" style={{ fontSize: 8, color }}>
            <div className="size-6 rounded bg-gray-100 grid place-items-center">
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><circle cx="8" cy="8" r="6" /></svg>
            </div>
            <span className="font-bold tracking-wider">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Pre-built workflow definitions matching the screenshots ──────── */
export const EV_WORKFLOW: WorkflowDef = {
  title: "EV Charging Network Workflow",
  row1: [
    { label: "Input",                          type: "input"  },
    { label: "Source Discovery Bot",           type: "bot"    },
    { label: "Charging Station Discovery Bot", type: "bot"    },
    { label: "Infrastructure Data\nExtraction Bot", type: "bot" },
  ],
  row2: [
    { label: "Data Normalization Bot",  type: "bot"    },
    { label: "Repository Comparison Bot", type: "bot"  },
    { label: "Data Enrichment Bot",     type: "bot"    },
    { label: "QA",                      type: "qa"     },
    { label: "Output",                  type: "output" },
  ],
};

export const INVENTORY_WORKFLOW: WorkflowDef = {
  title: "Plant Operations Inventory Workflow",
  row1: [
    { label: "Input",                          type: "input" },
    { label: "T&C Compliance Bot",             type: "bot"   },
    { label: "Inventory Discovery Bot",        type: "bot"   },
    { label: "VIN Detection &\nValidation Bot",type: "bot"   },
    { label: "Data Aggregation Bot",           type: "bot"   },
  ],
  row2: [
    { label: "Vehicle Qualification Bot", type: "bot"    },
    { label: "Segmentation Bot",          type: "bot"    },
    { label: "Inventory Comparison Bot",  type: "bot"    },
    { label: "QA",                        type: "qa"     },
    { label: "Output",                    type: "output" },
  ],
};
