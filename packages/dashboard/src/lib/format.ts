// Small pure formatting/derivation helpers shared across views.

import type { Severity } from "../data/types.ts";

export type RiskBand = "low" | "moderate" | "elevated" | "high" | "critical";

export function riskBand(score: number): RiskBand {
  if (score >= 0.75) return "critical";
  if (score >= 0.55) return "high";
  if (score >= 0.35) return "elevated";
  if (score >= 0.15) return "moderate";
  return "low";
}

export function formatScore(score: number): string {
  return score.toFixed(2);
}

export const SEVERITY_RANK: Record<Severity, number> = { info: 0, warning: 1, critical: 2 };

// Color tokens (used inline so the SVG graph and cards stay in one palette).
export const KIND_COLOR: Record<string, string> = {
  human: "#4f9df0",
  agent: "#b47cf0",
  nhi: "#f0a54f",
  entitlement: "#e0507a",
  resource: "#4fd0b0",
};

export const SEVERITY_COLOR: Record<Severity, string> = {
  info: "#5b6b7a",
  warning: "#e0a63c",
  critical: "#e0507a",
};

export const RISK_BAND_COLOR: Record<RiskBand, string> = {
  low: "#3fae86",
  moderate: "#7ec86a",
  elevated: "#e0c34f",
  high: "#e0913c",
  critical: "#e0507a",
};

// Relative time like "3m ago" / "2h ago" / "5d ago". `nowIso` is injectable so
// this stays pure and testable.
export function relativeTime(iso: string, nowIso?: string): string {
  const then = Date.parse(iso);
  const now = nowIso ? Date.parse(nowIso) : Date.now();
  if (Number.isNaN(then) || Number.isNaN(now)) return iso;
  const sec = Math.max(0, Math.round((now - then) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}
