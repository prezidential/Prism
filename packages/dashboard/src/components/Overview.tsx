import type { DashboardData } from "../data/types.ts";
import { countBySeverity } from "../lib/alerts.ts";
import { KIND_COLOR } from "../lib/format.ts";
import { RiskBar, SeverityChip } from "./bits.tsx";

export function Overview({
  data,
  onSelect,
}: {
  data: DashboardData;
  onSelect: (id: string) => void;
}): JSX.Element {
  const sev = countBySeverity(data.signals);
  const highRisk = data.identities.filter((i) => i.riskScore >= 0.55).length;
  const agentsOutOfScope = data.agents.filter((a) => a.outOfScopeCount > 0).length;
  const topRisks = [...data.identities].sort((a, b) => b.riskScore - a.riskScore).slice(0, 6);

  return (
    <div>
      <div className="stat-row">
        <div className="stat">
          <div className="label">Identities</div>
          <div className="value">{data.identities.length}</div>
        </div>
        <div className="stat">
          <div className="label">High risk</div>
          <div className="value" style={{ color: "var(--warn)" }}>{highRisk}</div>
        </div>
        <div className="stat">
          <div className="label">Critical signals</div>
          <div className="value" style={{ color: "var(--crit)" }}>{sev.critical}</div>
        </div>
        <div className="stat">
          <div className="label">Agents out of scope</div>
          <div className="value" style={{ color: "var(--crit)" }}>{agentsOutOfScope}</div>
        </div>
      </div>

      <div className="panel">
        <h2>Highest-risk identities</h2>
        <table>
          <thead>
            <tr>
              <th>Identity</th>
              <th>Type</th>
              <th className="num">Risk</th>
              <th className="num">Signals</th>
              <th>Top severity</th>
            </tr>
          </thead>
          <tbody>
            {topRisks.map((i) => (
              <tr key={i.id} className="clickable" onClick={() => onSelect(i.id)}>
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
