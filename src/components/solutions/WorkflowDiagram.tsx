import type { WorkflowStage } from "@/store/platform";

/**
 * Renders a workflow pipeline as a node-graph in the same visual theme as
 * the platform's canvas designer (green input/output, blue bot nodes,
 * purple production/QA, dotted background, curved connectors).
 *
 * Layout: snake-flow across multiple rows so the diagram looks complex even
 * for longer pipelines (matches the reference Multi-Source workflow look).
 */

type NodeKind = "input" | "bot" | "transform" | "enrich" | "production" | "qa" | "output";

interface DiagramNode {
  id: string;
  label: string;
  kind: NodeKind;
}

function stageToKind(stage: WorkflowStage): NodeKind {
  if (stage.kind === "aggregate") return "bot";
  if (stage.kind === "transform") return "bot";
  if (stage.kind === "enrich") return "bot";
  if (stage.kind === "delta") return "bot";
  if (stage.kind === "qa") return "qa";
  if (stage.kind === "deliver") return "production";
  return "bot";
}

const COLORS: Record<NodeKind, { bg: string; icon: string }> = {
  input:      { bg: "#10b981", icon: "↓" },
  output:     { bg: "#10b981", icon: "↑" },
  bot:        { bg: "#5b8def", icon: "🤖" },
  transform:  { bg: "#5b8def", icon: "🤖" },
  enrich:     { bg: "#5b8def", icon: "🤖" },
  production: { bg: "#8b5cf6", icon: "▦" },
  qa:         { bg: "#8b5cf6", icon: "✓" },
};

export function WorkflowDiagram({ name, stages }: { name: string; stages: WorkflowStage[] }) {
  // Build full node list: input + stages + output
  const nodes: DiagramNode[] = [
    { id: "input", label: "Input", kind: "input" },
    ...stages.map((s, i) => ({
      id: `s${i}`,
      label: s.name,
      kind: stageToKind(s),
    })),
    { id: "output", label: "Output", kind: "output" },
  ];

  // Snake layout: 5 nodes per row, alternating direction
  const PER_ROW = 5;
  const NODE_W = 130;
  const NODE_H = 60;
  const GAP_X = 50;
  const GAP_Y = 90;
  const PAD_X = 40;
  const PAD_Y = 40;

  const positioned = nodes.map((n, i) => {
    const row = Math.floor(i / PER_ROW);
    const colInRow = i % PER_ROW;
    const reversed = row % 2 === 1;
    const col = reversed ? PER_ROW - 1 - colInRow : colInRow;
    const x = PAD_X + col * (NODE_W + GAP_X);
    const y = PAD_Y + row * (NODE_H + GAP_Y);
    return { ...n, x, y };
  });

  const rows = Math.ceil(nodes.length / PER_ROW);
  const width = PAD_X * 2 + PER_ROW * NODE_W + (PER_ROW - 1) * GAP_X;
  const height = PAD_Y * 2 + rows * NODE_H + (rows - 1) * GAP_Y + 20;

  return (
    <div className="w-full overflow-x-auto bg-[#f5f6f8] rounded-md border border-border">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[640px]" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#d1d5db" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#dots)" />

        {/* Title chip */}
        <g>
          <rect x={12} y={12} rx={4} ry={4} width={Math.min(name.length * 7 + 24, width - 24)} height={22} fill="#ffffff" stroke="#e5e7eb" />
          <text x={24} y={27} fontFamily="ui-sans-serif, system-ui" fontSize={11} fontWeight={600} fill="#374151">{name}</text>
        </g>

        {/* Connectors */}
        {positioned.slice(0, -1).map((n, i) => {
          const next = positioned[i + 1];
          const sameRow = Math.abs(n.y - next.y) < 1;
          const startX = n.x + NODE_W;
          const startY = n.y + NODE_H / 2;
          const endX = next.x;
          const endY = next.y + NODE_H / 2;

          let path: string;
          if (sameRow) {
            const midX = (startX + endX) / 2;
            path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
          } else {
            // Wrap around: go right off the row, down, then back
            const goingRight = next.x > n.x;
            if (goingRight) {
              path = `M ${startX} ${startY} L ${startX + 20} ${startY} L ${startX + 20} ${endY} L ${endX} ${endY}`;
            } else {
              const outX = n.x + NODE_W;
              path = `M ${outX} ${startY} L ${outX + 20} ${startY} L ${outX + 20} ${(startY + endY) / 2} L ${next.x - 20} ${(startY + endY) / 2} L ${next.x - 20} ${endY} L ${endX} ${endY}`;
            }
          }
          return (
            <g key={`c-${i}`}>
              <path d={path} stroke="#9ca3af" strokeWidth={1.5} fill="none" />
              <circle cx={startX} cy={startY} r={3} fill="#374151" />
              <circle cx={endX} cy={endY} r={3} fill="#374151" />
            </g>
          );
        })}

        {/* Nodes */}
        {positioned.map((n) => {
          const c = COLORS[n.kind];
          return (
            <g key={n.id}>
              <rect x={n.x} y={n.y} width={NODE_W} height={NODE_H} rx={8} ry={8} fill={c.bg} />
              <text x={n.x + NODE_W / 2} y={n.y + NODE_H / 2 + 8} textAnchor="middle" fontSize={22} fill="#ffffff">
                {c.icon}
              </text>
              {/* Label below */}
              <g>
                <rect
                  x={n.x - 6}
                  y={n.y + NODE_H + 6}
                  width={NODE_W + 12}
                  height={22}
                  rx={3}
                  ry={3}
                  fill="#ffffff"
                  stroke="#e5e7eb"
                />
                <text
                  x={n.x + NODE_W / 2}
                  y={n.y + NODE_H + 21}
                  textAnchor="middle"
                  fontSize={10}
                  fontFamily="ui-sans-serif, system-ui"
                  fill="#374151"
                >
                  {n.label.length > 22 ? n.label.slice(0, 20) + "…" : n.label}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
