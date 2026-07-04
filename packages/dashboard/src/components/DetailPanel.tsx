import type { DashboardData } from "../data/types.ts";
import { KIND_COLOR, relativeTime } from "../lib/format.ts";
import { neighborsOf } from "../lib/graph-layout.ts";
import { RiskBar, SeverityChip } from "./bits.tsx";

export function DetailPanel({
  data,
  selectedId,
  onSelect,
  onClose,
}: {
  data: DashboardData;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}): JSX.Element {
  const node = selectedId ? data.graph.nodes.find((n) => n.id === selectedId) ?? null : null;
  if (!selectedId || !node) {
    return (
      <div className="panel detail" style={{ color: "var(--text-dim)", fontSize: 13 }}>
        Select an identity to inspect its risk signals and connections.
      </div>
    );
  }

  const identity = data.identities.find((i) => i.id === selectedId) ?? null;
  const signals = data.signals.filter((s) => s.subjectRef === selectedId);
  const neighborIds = neighborsOf(data.graph.edges, selectedId);
  const neighbors = data.graph.nodes.filter((n) => neighborIds.has(n.id));

  return (
    <div className="panel detail">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="pill" style={{ fontSize: 15 }}>
          <span className="dot" style={{ background: KIND_COLOR[node.kind] }} />
          <strong>{node.label}</strong>
        </span>
        <button className="btn ghost" style={{ padding: "4px 10px" }} onClick={onClose}>✕</button>
      </div>

      <div style={{ margin: "14px 0" }}>
        <div className="kv"><span className="k">Kind</span><span>{node.kind}</span></div>
        {node.subtitle ? <div className="kv"><span className="k">Detail</span><span>{node.subtitle}</span></div> : null}
        {identity ? <div className="kv"><span className="k">Status</span><span>{identity.status}</span></div> : null}
        <div className="kv"><span className="k">Risk</span><RiskBar score={node.riskScore} /></div>
      </div>

      {signals.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>Risk signals</div>
          {signals.map((s) => (
            <div key={s.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13 }}>{s.scorer}</span>
                <SeverityChip severity={s.severity} />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{s.rationale}</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{relativeTime(s.iat, data.generatedAt)}</div>
            </div>
          ))}
        </div>
      ) : null}

      {neighbors.length > 0 ? (
        <div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>Connected ({neighbors.length})</div>
          {neighbors.map((n) => (
            <div
              key={n.id}
              className="pill"
              style={{ display: "flex", padding: "5px 0", cursor: "pointer" }}
              onClick={() => onSelect(n.id)}
            >
              <span className="dot" style={{ background: KIND_COLOR[n.kind] }} />
              {n.label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
