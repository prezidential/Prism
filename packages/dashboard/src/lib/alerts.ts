// Alert-feed derivation — pure and testable.

import type { RiskSignalView, Severity } from "../data/types.ts";
import { SEVERITY_RANK } from "./format.ts";

// Newest first; ties broken by severity (critical before warning before info).
export function buildAlertFeed(signals: RiskSignalView[]): RiskSignalView[] {
  return [...signals].sort((a, b) => {
    const timeCmp = Date.parse(b.iat) - Date.parse(a.iat);
    if (!Number.isNaN(timeCmp) && timeCmp !== 0) return timeCmp;
    return SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
  });
}

export function countBySeverity(signals: RiskSignalView[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { info: 0, warning: 0, critical: 0 };
  for (const s of signals) counts[s.severity] += 1;
  return counts;
}
