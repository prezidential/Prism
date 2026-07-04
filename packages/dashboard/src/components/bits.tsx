// Small shared presentational helpers.

import type { Severity } from "../data/types.ts";
import {
  formatScore,
  RISK_BAND_COLOR,
  riskBand,
  SEVERITY_COLOR,
} from "../lib/format.ts";

export function RiskBar({ score }: { score: number }): JSX.Element {
  const color = RISK_BAND_COLOR[riskBand(score)];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span className="riskbar">
        <span style={{ width: `${Math.round(score * 100)}%`, background: color }} />
      </span>
      <span style={{ color, fontVariantNumeric: "tabular-nums", fontSize: 12 }}>
        {formatScore(score)}
      </span>
    </span>
  );
}

export function SeverityChip({ severity }: { severity: Severity }): JSX.Element {
  const color = SEVERITY_COLOR[severity];
  return (
    <span className="chip" style={{ background: `${color}22`, color }}>
      {severity}
    </span>
  );
}

export function Dot({ color }: { color: string }): JSX.Element {
  return <span className="dot" style={{ background: color }} />;
}
