import type { WorkflowStage } from "@/store/platform";

/**
 * SVG workflow diagram that visually replicates the reference PEP designer
 * screenshots: small rounded-square nodes (blue bots, teal ETL, purple
 * production/QC, green I/O), white label chips beneath each node, thin gray
 * ORTHOGONAL connectors with dot endpoints that route AROUND nodes (never
 * through them), a dotted off-white canvas, a top action bar (Design /
 * Prototype / Publish + CLONE / SAVE / SAVE & NEXT), and a vertical right
 * rail (search, BOTS, ETL, HITL, SOLUTIONS).
 */

type NodeKind = "input" | "output" | "bot" | "etl-union" | "etl-filter" | "production" | "qc" | "qa";

interface DiagramNode {
  id: string;
  label: string;
  kind: NodeKind;
}

function expandStage(stage: WorkflowStage, idx: number): DiagramNode[] {
  const baseId = `s${idx}`;
  const short = (s: string) => (s.length > 22 ? s.slice(0, 20) + "…" : s);
  const name = short(stage.name);
  switch (stage.kind) {
    case "aggregate":
      return [
        { id: `${baseId}-a1`, label: "Source Crawler",  kind: "bot" },
        { id: `${baseId}-a2`, label: name,              kind: "bot" },
        { id: `${baseId}-a3`, label: "Input Analyzer",  kind: "bot" },
      ];
    case "transform":
      return [
        { id: `${baseId}-t1`, label: "Pre Processing",  kind: "bot" },
        { id: `${baseId}-t2`, label: "Union All",       kind: "etl-union" },
        { id: `${baseId}-t3`, label: name,              kind: "bot" },
      ];
    case "enrich":
      return [
        { id: `${baseId}-e1`, label: "LLM Pre Processing",  kind: "bot" },
        { id: `${baseId}-e2`, label: name,                  kind: "bot" },
        { id: `${baseId}-e3`, label: "Audit LLM",           kind: "bot" },
        { id: `${baseId}-e4`, label: "LLM Post Processing", kind: "bot" },
      ];
    case "delta":
      return [
        { id: `${baseId}-d1`, label: "Filter", kind: "etl-filter" },
        { id: `${baseId}-d2`, label: name,     kind: "bot" },
      ];
    case "qa":
      return [
        { id: `${baseId}-q1`, label: "Production",    kind: "production" },
        { id: `${baseId}-q2`, label: "Validation - QC", kind: "qc" },
      ];
    case "deliver":
      return [{ id: `${baseId}-r1`, label: "Output Transformation", kind: "bot" }];
    default:
      return [{ id: baseId, label: name, kind: "bot" }];
  }
}

const COLOR: Record<NodeKind, string> = {
  input:        "#2bbf6e",
  output:       "#2bbf6e",
  bot:          "#7ab8f5",
  "etl-union":  "#3ec9b8",
  "etl-filter": "#3ec9b8",
  production:   "#b39ce0",
  qc:           "#b39ce0",
  qa:           "#b39ce0",
};

function NodeIcon({ kind, cx, cy }: { kind: NodeKind; cx: number; cy: number }) {
  switch (kind) {
    case "input":
      return (
        <g stroke="#fff" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={`M ${cx} ${cy - 8} L ${cx} ${cy + 3}`} />
          <path d={`M ${cx - 4} ${cy - 1} L ${cx} ${cy + 3} L ${cx + 4} ${cy - 1}`} />
          <path d={`M ${cx - 6} ${cy + 7} L ${cx + 6} ${cy + 7}`} />
        </g>
      );
    case "output":
      return (
        <g stroke="#fff" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={`M ${cx} ${cy + 3} L ${cx} ${cy - 8}`} />
          <path d={`M ${cx - 4} ${cy - 4} L ${cx} ${cy - 8} L ${cx + 4} ${cy - 4}`} />
          <path d={`M ${cx - 6} ${cy + 7} L ${cx + 6} ${cy + 7}`} />
        </g>
      );
    case "bot":
      return (
        <g fill="#fff">
          <circle cx={cx} cy={cy - 9} r={1} />
          <rect x={cx - 0.4} y={cy - 8.5} width={0.8} height={2.5} />
          <rect x={cx - 7} y={cy - 6} width={14} height={10} rx={2} />
          <circle cx={cx - 2.5} cy={cy - 1} r={1} fill="#4f9cf9" />
          <circle cx={cx + 2.5} cy={cy - 1} r={1} fill="#4f9cf9" />
          <rect x={cx - 3} y={cy + 1.5} width={6} height={1} rx={0.5} fill="#4f9cf9" />
          <rect x={cx - 5} y={cy + 5} width={10} height={2} rx={0.6} />
        </g>
      );
    case "etl-union":
      return (
        <g fill="none" stroke="#fff" strokeWidth={1.6}>
          <rect x={cx - 6} y={cy - 6} width={8} height={8} rx={1.2} />
          <rect x={cx - 2} y={cy - 2} width={8} height={8} rx={1.2} />
        </g>
      );
    case "etl-filter":
      return (
        <g fill="#fff" stroke="#fff" strokeWidth={1.4} strokeLinejoin="round">
          <path d={`M ${cx - 7} ${cy - 6} L ${cx + 7} ${cy - 6} L ${cx + 1.5} ${cy + 1} L ${cx + 1.5} ${cy + 7} L ${cx - 1.5} ${cy + 5} L ${cx - 1.5} ${cy + 1} Z`} />
        </g>
      );
    case "production":
      return (
        <g fill="#fff">
          <rect x={cx - 6} y={cy - 7} width={12} height={14} rx={1.2} />
          <rect x={cx - 4} y={cy - 4} width={8} height={1.2} fill="#a78bfa" />
          <rect x={cx - 4} y={cy - 1} width={8} height={1.2} fill="#a78bfa" />
          <rect x={cx - 4} y={cy + 2} width={5} height={1.2} fill="#a78bfa" />
        </g>
      );
    case "qc":
    case "qa":
      return (
        <g fill="#fff">
          <path
            d={`M ${cx} ${cy - 8}
                L ${cx + 6} ${cy - 5}
                L ${cx + 6} ${cy + 1}
                Q ${cx + 6} ${cy + 6}, ${cx} ${cy + 8}
                Q ${cx - 6} ${cy + 6}, ${cx - 6} ${cy + 1}
                L ${cx - 6} ${cy - 5} Z`}
          />
          <path
            d={`M ${cx - 2.5} ${cy + 0.5} L ${cx - 0.5} ${cy + 2.5} L ${cx + 3} ${cy - 1.5}`}
            stroke="#a78bfa" strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round"
          />
        </g>
      );
  }
}

export function WorkflowDiagram({ name, stages }: { name: string; stages: WorkflowStage[] }) {
  const nodes: DiagramNode[] = [
    { id: "input", label: "Input", kind: "input" },
    ...stages.flatMap((s, i) => expandStage(s, i)),
    { id: "output", label: "Output", kind: "output" },
  ];

  // Layout constants
  const NODE = 40;
  const GAP_X = 64;
  const GAP_Y = 90;
  const PAD_X = 70;
  const PAD_TOP = 80;
  const RAIL_W = 56;
  const PER_ROW = 6;

  const rows = Math.ceil(nodes.length / PER_ROW);

  // Snake layout: even rows L→R, odd rows R→L
  const positioned = nodes.map((n, i) => {
    const row = Math.floor(i / PER_ROW);
    const colInRow = i % PER_ROW;
    const reversed = row % 2 === 1;
    const col = reversed ? PER_ROW - 1 - colInRow : colInRow;
    const x = PAD_X + col * (NODE + GAP_X);
    const y = PAD_TOP + row * (NODE + GAP_Y);
    return { ...n, x, y, row, col, reversed };
  });

  const innerW = PAD_X * 2 + PER_ROW * NODE + (PER_ROW - 1) * GAP_X;
  const width = innerW + RAIL_W;
  const height = PAD_TOP + rows * NODE + (rows - 1) * GAP_Y + 70;

  return (
    <div className="w-full overflow-x-auto bg-[#f5f6f8] rounded-md border border-border">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto min-w-[820px]"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="wf-dots" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="0.7" fill="#d1d5db" />
          </pattern>
        </defs>

        {/* Top action bar */}
        <rect x={0} y={0} width={innerW} height={48} fill="#ffffff" />
        <line x1={0} y1={48} x2={innerW} y2={48} stroke="#e5e7eb" />
        {/* Title chip */}
        <text x={18} y={30} fontSize={12} fontWeight={600} fill="#111827" fontFamily="ui-sans-serif, system-ui">
          {name}
        </text>
        {/* Breadcrumb */}
        <g transform={`translate(${innerW / 2 - 110}, 16)`}>
          <circle cx={0} cy={8} r={8} fill="#22c55e" />
          <path d="M -3 8 L -1 10 L 4 5" stroke="#fff" strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <text x={0} y={32} textAnchor="middle" fontSize={9} fontWeight={600} fill="#22c55e">Design</text>
          <line x1={12} y1={8} x2={92} y2={8} stroke="#d1d5db" />
          <g transform="translate(104, 0)">
            <circle cx={0} cy={8} r={8} fill="none" stroke="#cbd5e1" strokeWidth={1.2} />
            <text x={0} y={11} textAnchor="middle" fontSize={8} fontWeight={600} fill="#94a3b8">2</text>
            <text x={0} y={32} textAnchor="middle" fontSize={9} fill="#94a3b8">Prototype</text>
          </g>
          <line x1={116} y1={8} x2={196} y2={8} stroke="#d1d5db" />
          <g transform="translate(208, 0)">
            <circle cx={0} cy={8} r={8} fill="none" stroke="#cbd5e1" strokeWidth={1.2} />
            <text x={0} y={11} textAnchor="middle" fontSize={8} fontWeight={600} fill="#94a3b8">3</text>
            <text x={0} y={32} textAnchor="middle" fontSize={9} fill="#94a3b8">Publish</text>
          </g>
        </g>
        {/* Action buttons */}
        <g transform={`translate(${innerW - 220}, 12)`}>
          <rect x={0} y={0} width={56} height={22} rx={3} fill="#fff" stroke="#22c55e" />
          <text x={28} y={15} textAnchor="middle" fontSize={9} fontWeight={700} fill="#22c55e">CLONE</text>
          <rect x={64} y={0} width={56} height={22} rx={3} fill="#fff" stroke="#22c55e" />
          <text x={92} y={15} textAnchor="middle" fontSize={9} fontWeight={700} fill="#22c55e">SAVE</text>
          <rect x={128} y={0} width={92} height={22} rx={3} fill="#22c55e" />
          <text x={170} y={15} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff">SAVE &amp; NEXT ›</text>
        </g>

        {/* Canvas */}
        <rect x={0} y={48} width={innerW} height={height - 48} fill="url(#wf-dots)" />

        {/* Zoom controls */}
        <g transform={`translate(${innerW - 110}, 60)`}>
          <rect x={0} y={0} width={26} height={22} rx={3} fill="#fff" stroke="#e5e7eb" />
          <text x={13} y={16} textAnchor="middle" fontSize={12} fill="#6b7280">−</text>
          <rect x={30} y={0} width={26} height={22} rx={3} fill="#fff" stroke="#e5e7eb" />
          <text x={43} y={15} textAnchor="middle" fontSize={10} fill="#6b7280">⛶</text>
          <rect x={60} y={0} width={26} height={22} rx={3} fill="#fff" stroke="#e5e7eb" />
          <text x={73} y={16} textAnchor="middle" fontSize={12} fill="#6b7280">+</text>
        </g>

        {/* Orthogonal connectors that route AROUND nodes */}
        {positioned.slice(0, -1).map((n, i) => {
          const next = positioned[i + 1];
          const sameRow = n.row === next.row;
          const dir = n.reversed ? -1 : 1; // travel direction along the row
          const startX = n.x + (dir === 1 ? NODE : 0);
          const startY = n.y + NODE / 2;
          const endX = next.x + (dir === 1 ? 0 : NODE);
          const endY = next.y + NODE / 2;

          let path: string;
          if (sameRow) {
            // straight short hop
            path = `M ${startX} ${startY} L ${endX} ${endY}`;
          } else {
            // wrap to next row: exit horizontally past the row edge, drop down
            // through the LABEL GAP (between this row's labels and the next row's
            // nodes), then come back horizontally to the next node.
            const edgeX = dir === 1 ? startX + GAP_X / 2 : startX - GAP_X / 2;
            const dropY = n.y + NODE + 44; // below this row's label chip
            path =
              `M ${startX} ${startY} ` +
              `L ${edgeX} ${startY} ` +
              `L ${edgeX} ${dropY} ` +
              `L ${endX + (dir === 1 ? -GAP_X / 2 : GAP_X / 2)} ${dropY} ` +
              `L ${endX + (dir === 1 ? -GAP_X / 2 : GAP_X / 2)} ${endY} ` +
              `L ${endX} ${endY}`;
          }

          return (
            <g key={`c-${i}`}>
              <path d={path} stroke="#9ca3af" strokeWidth={1.1} fill="none" />
              <circle cx={startX} cy={startY} r={2} fill="#4b5563" />
              <circle cx={endX}   cy={endY}   r={2} fill="#4b5563" />
            </g>
          );
        })}

        {/* Nodes (drawn AFTER connectors so they sit on top, never under) */}
        {positioned.map((n) => {
          const fill = COLOR[n.kind];
          const cx = n.x + NODE / 2;
          const cy = n.y + NODE / 2;
          return (
            <g key={n.id}>
              <rect x={n.x} y={n.y} width={NODE} height={NODE} rx={5} ry={5} fill={fill} />
              <NodeIcon kind={n.kind} cx={cx} cy={cy} />
              <g>
                <rect
                  x={n.x - 28}
                  y={n.y + NODE + 6}
                  width={NODE + 56}
                  height={18}
                  rx={2.5}
                  ry={2.5}
                  fill="#ffffff"
                  stroke="#e5e7eb"
                />
                <text
                  x={cx}
                  y={n.y + NODE + 18}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontFamily="ui-sans-serif, system-ui"
                  fill="#374151"
                >
                  {n.label}
                </text>
              </g>
            </g>
          );
        })}

        {/* Right rail */}
        <g transform={`translate(${innerW}, 0)`}>
          <rect x={0} y={0} width={RAIL_W} height={height} fill="#ffffff" stroke="#e5e7eb" />
          {/* search */}
          <g transform="translate(28, 64)">
            <circle cx={0} cy={0} r={6} fill="none" stroke="#94a3b8" strokeWidth={1.2} />
            <line x1={4} y1={4} x2={9} y2={9} stroke="#94a3b8" strokeWidth={1.2} />
          </g>
          {[
            { label: "BOTS",      color: "#4f9cf9", kind: "bot" as const },
            { label: "ETL",       color: "#2ec4b6", kind: "etl-union" as const },
            { label: "HITL",      color: "#a78bfa", kind: "qc" as const },
            { label: "SOLUTIONS", color: "#f59e0b", kind: "production" as const },
          ].map((r, i) => (
            <g key={r.label} transform={`translate(28, ${110 + i * 56})`}>
              <rect x={-12} y={-12} width={24} height={24} rx={3} fill={r.color} />
              <g transform="translate(0,0)">
                {/* tiny icon centered */}
                <NodeIcon kind={r.kind} cx={0} cy={0} />
              </g>
              <text x={0} y={22} textAnchor="middle" fontSize={7} fontWeight={700} fill={r.color} letterSpacing={0.4}>
                {r.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
