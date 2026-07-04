import type { DashboardData } from "../data/types.ts";
import { KIND_COLOR } from "../lib/format.ts";
import { computeLayout, neighborsOf, nodeRadius } from "../lib/graph-layout.ts";
import { Dot } from "./bits.tsx";

const W = 940;
const H = 560;

const KIND_LABEL: Record<string, string> = {
  human: "Human",
  agent: "Agent",
  nhi: "Non-human",
  entitlement: "Entitlement",
  resource: "Resource",
};

export function IdentographGraph({
  data,
  selectedId,
  onSelect,
}: {
  data: DashboardData;
  selectedId: string | null;
  onSelect: (id: string) => void;
}): JSX.Element {
  const { nodes, edges } = data.graph;
  const pos = computeLayout(nodes, { width: W, height: H, labelReserve: 130 });
  const highlighted = selectedId ? neighborsOf(edges, selectedId) : null;

  const isDim = (id: string): boolean =>
    highlighted !== null && id !== selectedId && !highlighted.has(id);

  return (
    <div>
      <div className="graph-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Identograph">
          {edges.map((e, i) => {
            const a = pos.get(e.from);
            const b = pos.get(e.to);
            if (!a || !b) return null;
            const active = selectedId !== null && (e.from === selectedId || e.to === selectedId);
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={active ? "var(--accent)" : "var(--border)"}
                strokeWidth={active ? 2 : 1}
                opacity={selectedId && !active ? 0.25 : 0.8}
              />
            );
          })}
          {nodes.map((n) => {
            const p = pos.get(n.id);
            if (!p) return null;
            const r = nodeRadius(n.riskScore);
            const dim = isDim(n.id);
            const selected = n.id === selectedId;
            return (
              <g
                key={n.id}
                className="graph-node"
                transform={`translate(${p.x},${p.y})`}
                opacity={dim ? 0.28 : 1}
                onClick={() => onSelect(n.id)}
              >
                <circle
                  r={r}
                  fill={KIND_COLOR[n.kind]}
                  stroke={selected ? "#fff" : "var(--bg)"}
                  strokeWidth={selected ? 3 : 2}
                />
                <text x={r + 6} y={4}>
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="graph-legend">
        {Object.keys(KIND_LABEL).map((k) => (
          <span key={k} className="pill">
            <Dot color={KIND_COLOR[k] ?? "#888"} /> {KIND_LABEL[k]}
          </span>
        ))}
        <span className="pill" style={{ marginLeft: "auto" }}>
          node size ∝ risk · click to trace access
        </span>
      </div>
    </div>
  );
}
