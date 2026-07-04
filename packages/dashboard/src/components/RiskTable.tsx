import { useMemo, useState } from "react";
import type { DashboardData, NodeKind } from "../data/types.ts";
import { KIND_COLOR } from "../lib/format.ts";
import {
  filterIdentities,
  sortIdentities,
  type SortDir,
  type SortKey,
} from "../lib/risk-table.ts";
import { RiskBar, SeverityChip } from "./bits.tsx";

const KINDS: Array<NodeKind | "all"> = ["all", "human", "agent", "nhi"];

export function RiskTable({
  data,
  selectedId,
  onSelect,
}: {
  data: DashboardData;
  selectedId: string | null;
  onSelect: (id: string) => void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<NodeKind | "all">("all");
  const [minRisk, setMinRisk] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("riskScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const rows = useMemo(
    () => sortIdentities(filterIdentities(data.identities, { query, kind, minRisk }), sortKey, sortDir),
    [data.identities, query, kind, minRisk, sortKey, sortDir],
  );

  const toggleSort = (key: SortKey): void => {
    if (key === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(key === "name" || key === "type" ? "asc" : "desc");
    }
  };

  const arrow = (key: SortKey): string => (key === sortKey ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div className="panel">
      <div className="controls">
        <input
          placeholder="Search identities…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, minWidth: 180 }}
        />
        <select value={kind} onChange={(e) => setKind(e.target.value as NodeKind | "all")}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k === "all" ? "All types" : k}
            </option>
          ))}
        </select>
        <select value={String(minRisk)} onChange={(e) => setMinRisk(Number(e.target.value))}>
          <option value="0">Any risk</option>
          <option value="0.35">≥ 0.35</option>
          <option value="0.55">≥ 0.55</option>
          <option value="0.75">≥ 0.75</option>
        </select>
      </div>
      <table>
        <thead>
          <tr>
            <th onClick={() => toggleSort("name")}>Identity{arrow("name")}</th>
            <th onClick={() => toggleSort("type")}>Type{arrow("type")}</th>
            <th className="num" onClick={() => toggleSort("riskScore")}>Risk{arrow("riskScore")}</th>
            <th className="num" onClick={() => toggleSort("signalCount")}>Signals{arrow("signalCount")}</th>
            <th>Top severity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr
              key={i.id}
              className={`clickable${i.id === selectedId ? " selected" : ""}`}
              onClick={() => onSelect(i.id)}
            >
              <td>
                <span className="pill">
                  <span className="dot" style={{ background: KIND_COLOR[i.kind] }} />
                  {i.name}
                </span>
              </td>
              <td style={{ color: "var(--text-dim)" }}>{i.type}</td>
              <td className="num"><RiskBar score={i.riskScore} /></td>
              <td className="num">{i.signalCount}</td>
              <td>{i.topSeverity ? <SeverityChip severity={i.topSeverity} /> : "—"}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ color: "var(--text-dim)", textAlign: "center", padding: 24 }}>
                No identities match these filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
