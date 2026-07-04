// @prism/risk-engine — Phase 3
//
// Graph-traversal risk scoring and anomaly detection over the Identograph.
// There are no rule engines and no batch jobs here — every score is a pure
// function of the graph.

// Client surface + helpers
export type { GraphClient } from "./client.js";
export { clamp01, round2 } from "./client.js";

// Domain types
export type {
  Severity,
  CaepEventType,
  RiskScorerId,
  RiskFinding,
  RiskScorer,
  IdentityRiskProfile,
  EvaluationResult,
  EvaluateOptions,
} from "./types.js";
export { CAEP_URI_BASE, severityForScore, SEVERITY_RANK } from "./types.js";

// Scorers
export { delegationDepthScorer } from "./scoring/delegation-depth.js";
export {
  createDormantEntitlementScorer,
  type DormantEntitlementScorerOptions,
} from "./scoring/dormant-entitlement.js";
export { agentScopeDeviationScorer } from "./scoring/agent-scope-deviation.js";
export { entitlementOverlapScorer } from "./scoring/entitlement-overlap.js";
export { blastRadiusScorer } from "./scoring/blast-radius.js";
export {
  detectAnomalies,
  createBehavioralAnomalyScorer,
  type BehavioralAnomalyOptions,
} from "./anomaly/behavioral-baseline.js";
export {
  fetchEntitlementGrants,
  daysBetween,
  type EntitlementGrant,
} from "./scoring/shared.js";

// Aggregation
export { aggregateFindings } from "./aggregate.js";

// Signal writer
export {
  writeSignal,
  writeSignals,
  type SignalWriterDeps,
} from "./signal-writer.js";

// Orchestrator
export {
  evaluateRisk,
  createDefaultScorers,
  type EvaluateDeps,
} from "./evaluate.js";

// Risk query API
export {
  getRiskIdentities,
  type RiskIdentity,
  type RiskSignalSummary,
  type GetRiskIdentitiesOptions,
} from "./api/risk-identities.js";
