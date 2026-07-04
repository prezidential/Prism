// Risk evaluation orchestrator.
//
// Runs every scorer over a tenant's Identograph, aggregates the findings into
// per-identity composite scores, materializes RiskSignal vertices for findings
// above the signal threshold, and (by default) writes each identity's composite
// score back onto its vertex so the API/dashboard can read it directly.

import { aggregateFindings } from "./aggregate.js";
import type { GraphClient } from "./client.js";
import { esc } from "./client.js";
import { createBehavioralAnomalyScorer } from "./anomaly/behavioral-baseline.js";
import { agentScopeDeviationScorer } from "./scoring/agent-scope-deviation.js";
import { blastRadiusScorer } from "./scoring/blast-radius.js";
import { delegationDepthScorer } from "./scoring/delegation-depth.js";
import { createDormantEntitlementScorer } from "./scoring/dormant-entitlement.js";
import { entitlementOverlapScorer } from "./scoring/entitlement-overlap.js";
import type { SignalWriterDeps } from "./signal-writer.js";
import { writeSignals } from "./signal-writer.js";
import type { EvaluateOptions, EvaluationResult, RiskFinding, RiskScorer } from "./types.js";

export type EvaluateDeps = SignalWriterDeps;

// Build the default scorer set. The dormant scorer needs a clock, so this is a
// factory rather than a static constant.
export function createDefaultScorers(now: string): RiskScorer[] {
  return [
    delegationDepthScorer,
    createDormantEntitlementScorer({ now }),
    agentScopeDeviationScorer,
    entitlementOverlapScorer,
    blastRadiusScorer,
    createBehavioralAnomalyScorer({ now }),
  ];
}

// Persist a composite score back onto an identity vertex.
async function persistScore(
  client: GraphClient,
  tenantId: string,
  identityType: string,
  identityId: string,
  score: number,
  now: string,
): Promise<boolean> {
  // Guard against an unresolved vertex type from a dangling reference.
  if (!identityType || identityType === "Unknown") return false;
  await client.command(
    `UPDATE ${identityType} SET riskScore = ${score}, updatedAt = '${esc(now)}'
     WHERE tenantId = '${esc(tenantId)}' AND id = '${esc(identityId)}'`,
  );
  return true;
}

// Run a full evaluation pass over one tenant's graph.
export async function evaluateRisk(
  client: GraphClient,
  tenantId: string,
  deps: EvaluateDeps,
  options: EvaluateOptions = {},
): Promise<EvaluationResult> {
  const signalThreshold = options.signalThreshold ?? 0.4;
  const persistScores = options.persistScores ?? true;
  const scorers = options.scorers ?? createDefaultScorers(deps.now());

  // 1. Run every scorer. Failures in one scorer must not sink the whole pass.
  const allFindings: RiskFinding[] = [];
  for (const scorer of scorers) {
    const findings = await scorer.score(client, tenantId);
    allFindings.push(...findings);
  }

  // 2. Aggregate into per-identity profiles.
  const profiles = aggregateFindings(allFindings, scorers);

  // 3. Materialize signals for findings above the threshold.
  const signalWorthy = allFindings.filter((f) => f.score >= signalThreshold);
  const signalsWritten = await writeSignals(client, tenantId, signalWorthy, deps);

  // 4. Persist composite scores back onto identity vertices.
  let scoresPersisted = 0;
  if (persistScores) {
    for (const profile of profiles) {
      const ok = await persistScore(
        client,
        tenantId,
        profile.identityType,
        profile.identityId,
        profile.compositeScore,
        deps.now(),
      );
      if (ok) scoresPersisted += 1;
    }
  }

  return {
    tenantId,
    profiles,
    findingCount: allFindings.length,
    signalsWritten,
    scoresPersisted,
  };
}
