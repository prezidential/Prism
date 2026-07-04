import type { DashboardData } from "../data/types.ts";
import { buildAlertFeed, countBySeverity } from "../lib/alerts.ts";
import { relativeTime, SEVERITY_COLOR } from "../lib/format.ts";
import { SeverityChip } from "./bits.tsx";

export function AlertFeed({
  data,
  onSelect,
}: {
  data: DashboardData;
  onSelect: (id: string) => void;
}): JSX.Element {
  const feed = buildAlertFeed(data.signals);
  const counts = countBySeverity(data.signals);

  return (
    <div>
      <div className="stat-row">
        <div className="stat">
          <div className="label">Critical</div>
          <div className="value" style={{ color: SEVERITY_COLOR.critical }}>{counts.critical}</div>
        </div>
        <div className="stat">
          <div className="label">Warning</div>
          <div className="value" style={{ color: SEVERITY_COLOR.warning }}>{counts.warning}</div>
        </div>
        <div className="stat">
          <div className="label">Info</div>
          <div className="value" style={{ color: SEVERITY_COLOR.info }}>{counts.info}</div>
        </div>
      </div>

      {feed.map((s) => (
        <div
          className="alert"
          key={s.id}
          style={{ borderLeftColor: SEVERITY_COLOR[s.severity], cursor: "pointer" }}
          onClick={() => onSelect(s.subjectRef)}
        >
          <div style={{ flex: 1 }}>
            <div className="title">
              {s.subjectName} <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>· {s.scorer}</span>
            </div>
            <div className="meta">{s.rationale}</div>
          </div>
          <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
            <SeverityChip severity={s.severity} />
            <div className="meta" style={{ marginTop: 4 }}>{relativeTime(s.iat, data.generatedAt)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
