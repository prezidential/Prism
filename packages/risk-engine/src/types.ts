// Core risk-engine domain types.
//
// The risk engine reduces the Identograph to a set of per-identity risk
// findings, aggregates them into a composite score, and materializes CAEP
// RiskSignal vertices. These types are the contract every scorer implements.

// Severity mirrors @prism/identograph SignalSeverity, redeclared locally so the
// risk engine does not depend on that package's build output.
export type Severity = "info" | "warning" | "critical";

// CAEP event type mirrors @prism/identograph CaepEventType.
export type CaepEventType =
  | "session-revoked"
  | "session-established"
  | "credential-change"
  | "token-claims-change"
  | "assurance-level-change"
  | "device-compliance-change"
  | "risk-level-change";

// Stable identifier for each scoring algorithm.
export type RiskScorerId =
  | "delegation-depth"
  | "dormant-entitlement"
  | "agent-scope-deviation"
  | "entitlement-overlap"
  | "blast-radius";

// A single risk finding about one identity, produced by one scorer.
export interface RiskFinding {
  scorer: RiskScorerId;
  identityId: string;
  identityType: string;
  score: number; // 0.0–1.0 normalized contribution
  severity: Severity;
  rationale: string; // human-readable explanation
  caepEventType: CaepEventType;
  eventTypeUri: string;
  evidence: Record<string, unknown>; // scorer-specific supporting data
}

// A scorer inspects the Identograph and returns findings for the identities it
// flags. Scorers must be pure functions of the graph — no batch state, no rules
// engine — per the platform's "there is only the graph" principle.
export interface RiskScorer {
  id: RiskScorerId;
  // Relative weight of this scorer in the composite aggregation (0.0–1.0).
  weight: number;
  score(client: import("./client.js").GraphClient, tenantId: string): Promise<RiskFinding[]>;
}

// All findings for a single identity, plus the aggregated composite score.
export interface IdentityRiskProfile {
  identityId: string;
  identityType: string;
  compositeScore: number; // 0.0–1.0
  topSeverity: Severity | null;
  findings: RiskFinding[];
}

// Result of a full evaluation pass over a tenant's graph.
export interface EvaluationResult {
  tenantId: string;
  profiles: IdentityRiskProfile[];
  findingCount: number;
  signalsWritten: number;
  scoresPersisted: number;
}

// Options controlling an evaluation pass.
export interface EvaluateOptions {
  // Findings at or above this score materialize a RiskSignal. Default 0.4.
  signalThreshold?: number;
  // When true, write each identity's compositeScore back to its vertex. Default true.
  persistScores?: boolean;
  // Restrict evaluation to this set of scorers. Default: all.
  scorers?: RiskScorer[];
}

// The CAEP event-type URI namespace used for materialized signals.
export const CAEP_URI_BASE = "https://schemas.openid.net/secevent/caep/event-type";

// Map a normalized score to a severity band.
export function severityForScore(score: number): Severity {
  if (score >= 0.75) return "critical";
  if (score >= 0.4) return "warning";
  return "info";
}

// Order severities for "highest wins" comparisons.
export const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};
