import type { WorkflowStage } from "@/store/platform";

/**
 * Renders a workflow pipeline as a node-graph that visually replicates the
 * reference workflow designer screenshots (S&P Mobility / Multi-Source PEP):
 *   - dotted off-white canvas
 *   - green Input/Output squares with download/upload chevrons
 *   - blue bot squares with a white robot icon
 *   - teal ETL squares (Union All / Filter) for transforms
 *   - purple Production document + purple QC/QA shields
 *   - curved gray connectors with dot endpoints
 *   - white label chips below every node
 *   - right-hand chrome rail (BOTS / ETL / HITL / SOLUTIONS / INTEGRATION)
 *   - top breadcrumb (Design / Prototype / Publish)
 *
 * Each stage is expanded into multiple sub-nodes so even short pipelines look
 * dense and "real" — matching the reference's visual complexity.
 */

type NodeKind = "input" | "output" | "bot" | "etl" | "production" | "qc" | "qa";

interface DiagramNode {
  id: string;
  label: string;
  kind: NodeKind;
}

/** Expand a single workflow stage into multiple sub-nodes for visual density. */
function expandStage(stage: WorkflowStage, idx: number): DiagramNode[] {
  const baseId = `s${idx}`;
  const short = stage.name.length > 22 ? stage.name.slice(0, 20) + "…" : stage.name;
  switch (stage.kind) {
    case "aggregate":
      return [
        { id: `${baseId}-a1`, label: "Source Crawler", kind: "bot" },
        { id: `${baseId}-a2`, label: short, kind: "bot" },
        { id: `${baseId}-a3`, label: "Input Analyzer", kind: "bot" },
      ];
    case "transform":
      return [
        { id: `${baseId}-t1`, label: "Pre Processing", kind: "bot" },
        { id: `${baseId}-t2`, label: "Union All", kind: "etl" },
        { id: `${baseId}-t3`, label: short, kind: "bot" },
      ];
    case "enrich":
      return [
        { id: `${baseId}-e1`, label: "LLM Pre Processing", kind: "bot" },
        { id: `${baseId}-e2`, label: short, kind: "bot" },
        { id: `${baseId}-e3`, label: "Audit LLM", kind: "bot" },
        { id: `${baseId}-e4`, label: "LLM Post Processing", kind: "bot" },
      ];
    case "delta":
      return [
        { id: `${baseId}-d1`, label: "Filter", kind: "etl" },
        { id: `${baseId}-d2`, label: short, kind: "bot" },
      ];
    case "qa":
      return [
        { id: `${baseId}-q1`, label: "Production", kind: "production" },
        { id: `${baseId}-q2`, label: "QC", kind: "qc" },
        { id: `${baseId}-q3`, label: "QA", kind: "qa" },
      ];
    case "deliver":
      return [
        { id: `${baseId}-r1`, label: "Output Transformation", kind: "bot" },
      ];
    default:
      return [{ id: baseId, label: short, kind: "bot" }];
  }
}

const COLORS: Record<NodeKind, string> = {
  input:      "#10b981",
  output:     "#10b981",
  bot:        "#5b8def",
  etl:        "#14b8a6",
  production: "#a78bfa",
  qc:         "#a78bfa",
  qa:         "#a78bfa",
};

/** Inline SVG icons rendered inside each node, mimicking the reference. */
function NodeIcon({ kind, cx, cy }: { kind: NodeKind; cx: number; cy: number }) {
  const s = 18; // half-extent
  switch (kind) {
    case "input":
      return (
        <g stroke="#fff" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={`M ${cx} ${cy - s + 4} L ${cx} ${cy + s - 8}`} />
          <path d={`M ${cx - 7} ${cy + s - 14} L ${cx} ${cy + s - 8} L ${cx + 7} ${cy + s - 14}`} />
          <path d={`M ${cx - 10} ${cy + s - 2} L ${cx + 10} ${cy + s - 2}`} />
        </g>
      );
    case "output":
      return (
        <g stroke="#fff" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={`M ${cx} ${cy + s - 8} L ${cx} ${cy - s + 6}`} />
          <path d={`M ${cx - 7} ${cy - s + 12} L ${cx} ${cy - s + 6} L ${cx + 7} ${cy - s + 12}`} />
          <path d={`M ${cx - 10} ${cy + s - 2} L ${cx + 10} ${cy + s - 2}`} />
        </g>
      );
    case "bot":
      return (
        <g fill="#fff">
          {/* antenna */}
          <circle cx={cx} cy={cy - 14} r={1.6} />
          <rect x={cx - 0.6} y={cy - 13} width={1.2} height={4} />
          {/* head */}
          <rect x={cx - 11} y={cy - 9} width={22} height={16} rx={3} />
          {/* eyes */}
          <circle cx={cx - 4} cy={cy - 1} r={1.6} fill="#5b8def" />
          <circle cx={cx + 4} cy={cy - 1} r={1.6} fill="#5b8def" />
          {/* mouth */}
          <rect x={cx - 5} y={cy + 3} width={10} height={1.6} rx={0.8} fill="#5b8def" />
          {/* base */}
          <rect x={cx - 8} y={cy + 8} width={16} height={3} rx={1} />
        </g>
      );
    case "etl":
      return (
        <g fill="#fff" stroke="#fff" strokeWidth={1.6}>
          <circle cx={cx - 5} cy={cy - 3} r={5} fill="none" />
          <circle cx={cx + 5} cy={cy + 3} r={5} fill="none" />
        </g>
      );
    case "production":
      return (
        <g fill="#fff">
          <rect x={cx - 9} y={cy - 10} width={18} height={20} rx={1.5} />
          <rect x={cx - 6} y={cy - 6} width={12} height={1.5} fill="#a78bfa" />
          <rect x={cx - 6} y={cy - 2} width={12} height={1.5} fill="#a78bfa" />
          <rect x={cx - 6} y={cy + 2} width={8}  height={1.5} fill="#a78bfa" />
        </g>
      );
    case "qc":
    case "qa":
      return (
        <g fill="#fff">
          {/* shield */}
          <path
            d={`M ${cx} ${cy - 11}
                L ${cx + 9} ${cy - 7}
                L ${cx + 9} ${cy + 2}
                Q ${cx + 9} ${cy + 9}, ${cx} ${cy + 12}
                Q ${cx - 9} ${cy + 9}, ${cx - 9} ${cy + 2}
                L ${cx - 9} ${cy - 7} Z`}
          />
          {kind === "qc" ? (
            <path
              d={`M ${cx - 4} ${cy + 1} L ${cx - 1} ${cy + 4} L ${cx + 5} ${cy - 3}`}
              stroke="#a78bfa" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round"
            />
          ) : (
            <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={8} fontWeight={700} fill="#a78bfa">QA</text>
          )}
        </g>
      );
  }
}

export function WorkflowDiagram({ name, stages }: { name: string; stages: WorkflowStage[] }) {
  // Build expanded node list: Input → all stage expansions → Output
  const nodes: DiagramNode[] = [
    { id: "input", label: "Input", kind: "input" },
    ...stages.flatMap((s, i) => expandStage(s, i)),
    { id: "output", label: "Output", kind: "output" },
  ];

  // Snake layout
  const PER_ROW = 6;
  const NODE = 52;
  const GAP_X = 60;
  const GAP_Y = 100;
  const PAD_X = 64;
  const PAD_Y = 80;
  const RAIL_W = 64;

  const positioned = nodes.map((n, i) => {
    const row = Math.floor(i / PER_ROW);
    const colInRow = i % PER_ROW;
    const reversed = row % 2 === 1;
    const col = reversed ? PER_ROW - 1 - colInRow : colInRow;
    const x = PAD_X + col * (NODE + GAP_X);
    const y = PAD_Y + row * (NODE + GAP_Y);
    return { ...n, x, y, row, col };
  });

  const rows = Math.ceil(nodes.length / PER_ROW);
  const innerW = PAD_X * 2 + PER_ROW * NODE + (PER_ROW - 1) * GAP_X;
  const width = innerW + RAIL_W;
  const height = PAD_Y + rows * NODE + (rows - 1) * GAP_Y + 80;

  const railIcons = [
    { label: "BOTS",        color: "#5b8def", glyph: "🤖" },
    { label: "ETL",         color: "#14b8a6", glyph: "⥃"  },
    { label: "HITL",        color: "#a78bfa", glyph: "👥" },
    { label: "SOLUTIONS",   color: "#f59e0b", glyph: "✦"  },
    { label: "INTEGRATION", color: "#3b82f6", glyph: "⚙"  },
  ];

  return (
    <div className="w-full overflow-x-auto bg-[#f5f6f8] rounded-md border border-border">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto min-w-[820px]"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="wf-dots" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#d1d5db" />
          </pattern>
          <filter id="wf-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#000" floodOpacity="0.12" />
          </filter>
        </defs>
        <rect width={innerW} height={height} fill="url(#wf-dots)" />

        {/* Top breadcrumb chrome */}
        <g transform={`translate(${innerW / 2 - 130}, 18)`}>
          <g>
            <circle cx={0} cy={10} r={9} fill="#10b981" />
            <path d="M -4 10 L -1 13 L 5 7" stroke="#fff" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <text x={0} y={36} textAnchor="middle" fontSize={9} fontWeight={600} fill="#10b981">Design</text>
          </g>
          <line x1={14} y1={10} x2={106} y2={10} stroke="#d1d5db" strokeWidth={1} />
          <g transform="translate(120, 0)">
            <circle cx={0} cy={10} r={9} fill="none" stroke="#cbd5e1" strokeWidth={1.4} />
            <text x={0} y={13} textAnchor="middle" fontSize={9} fontWeight={600} fill="#94a3b8">2</text>
            <text x={0} y={36} textAnchor="middle" fontSize={9} fill="#94a3b8">Prototype</text>
          </g>
          <line x1={134} y1={10} x2={226} y2={10} stroke="#d1d5db" strokeWidth={1} />
          <g transform="translate(240, 0)">
            <circle cx={0} cy={10} r={9} fill="none" stroke="#cbd5e1" strokeWidth={1.4} />
            <text x={0} y={13} textAnchor="middle" fontSize={9} fontWeight={600} fill="#94a3b8">3</text>
            <text x={0} y={36} textAnchor="middle" fontSize={9} fill="#94a3b8">Publish</text>
          </g>
        </g>

        {/* Title chip top-left */}
        <g>
          <rect x={14} y={14} rx={4} ry={4} width={Math.min(name.length * 6.5 + 28, innerW / 2)} height={26} fill="#ffffff" stroke="#e5e7eb" />
          <text x={26} y={31} fontFamily="ui-sans-serif, system-ui" fontSize={11} fontWeight={600} fill="#374151">
            {name}
          </text>
        </g>

        {/* Connectors */}
        {positioned.slice(0, -1).map((n, i) => {
          const next = positioned[i + 1];
          const sameRow = n.row === next.row;
          const cxStart = n.x + NODE;
          const cyStart = n.y + NODE / 2;
          const cxEnd = next.x;
          const cyEnd = next.y + NODE / 2;

          let path: string;
          if (sameRow) {
            const midX = (cxStart + cxEnd) / 2;
            path = `M ${cxStart} ${cyStart} C ${midX} ${cyStart}, ${midX} ${cyEnd}, ${cxEnd} ${cyEnd}`;
          } else {
            // wrap to next row: exit right edge, drop down, re-enter
            const outX = innerW - 30;
            const dropY = (cyStart + cyEnd) / 2;
            path =
              `M ${cxStart} ${cyStart} ` +
              `C ${outX - 30} ${cyStart}, ${outX} ${cyStart}, ${outX} ${dropY} ` +
              `C ${outX} ${cyEnd}, ${next.x - 30} ${cyEnd}, ${cxEnd} ${cyEnd}`;
          }
          return (
            <g key={`c-${i}`}>
              <path d={path} stroke="#9ca3af" strokeWidth={1.4} fill="none" />
              <circle cx={cxStart} cy={cyStart} r={2.6} fill="#4b5563" />
              <circle cx={cxEnd}   cy={cyEnd}   r={2.6} fill="#4b5563" />
            </g>
          );
        })}

        {/* Nodes */}
        {positioned.map((n) => {
          const fill = COLORS[n.kind];
          const cx = n.x + NODE / 2;
          const cy = n.y + NODE / 2;
          return (
            <g key={n.id}>
              <rect
                x={n.x}
                y={n.y}
                width={NODE}
                height={NODE}
                rx={8}
                ry={8}
                fill={fill}
                filter="url(#wf-shadow)"
              />
              <NodeIcon kind={n.kind} cx={cx} cy={cy} />
              {/* label chip */}
              <g>
                <rect
                  x={n.x - 22}
                  y={n.y + NODE + 8}
                  width={NODE + 44}
                  height={22}
                  rx={3}
                  ry={3}
                  fill="#ffffff"
                  stroke="#e5e7eb"
                />
                <text
                  x={cx}
                  y={n.y + NODE + 23}
                  textAnchor="middle"
                  fontSize={9.5}
                  fontFamily="ui-sans-serif, system-ui"
                  fill="#374151"
                >
                  {n.label.length > 22 ? n.label.slice(0, 20) + "…" : n.label}
                </text>
              </g>
            </g>
          );
        })}

        {/* Right-hand chrome rail */}
        <g transform={`translate(${innerW}, 0)`}>
          <rect x={0} y={0} width={RAIL_W} height={height} fill="#ffffff" stroke="#e5e7eb" />
          {/* search */}
          <g transform="translate(32, 30)">
            <circle cx={0} cy={0} r={7} fill="none" stroke="#94a3b8" strokeWidth={1.4} />
            <line x1={5} y1={5} x2={10} y2={10} stroke="#94a3b8" strokeWidth={1.4} />
          </g>
          {railIcons.map((r, i) => (
            <g key={r.label} transform={`translate(32, ${72 + i * 56})`}>
              <rect x={-14} y={-12} width={28} height={24} rx={4} fill={`${r.color}15`} />
              <text x={0} y={4} textAnchor="middle" fontSize={14} fill={r.color}>{r.glyph}</text>
              <text x={0} y={22} textAnchor="middle" fontSize={7} fontWeight={700} fill={r.color} letterSpacing={0.5}>
                {r.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
