// Composite risk aggregation.
//
// Each scorer emits independent findings about an identity. We combine them with
// a weighted noisy-OR: compromise risk compounds as more independent risk factors
// stack up, but the result stays bounded in [0, 1] and never exceeds certainty.
//
//   composite = 1 - Π_i (1 - weight_i * score_i)
//
// A single strong finding dominates; several moderate findings compound; and the
// weights let the agent-scope-deviation signal (the agentic-native concern) pull
// harder than, say, a shared entitlement.

import { clamp01, round2 } from "./client.js";
import type { IdentityRiskProfile, RiskFinding, RiskScorer } from "./types.js";
import { SEVERITY_RANK } from "./types.js";

// Build per-identity risk profiles from a flat list of findings.
export function aggregateFindings(
  findings: RiskFinding[],
  scorers: RiskScorer[],
): IdentityRiskProfile[] {
  const weightById = new Map(scorers.map((s) => [s.id, s.weight]));

  interface Bucket {
    identityType: string;
    findings: RiskFinding[];
  }
  const byIdentity = new Map<string, Bucket>();

  for (const f of findings) {
    const bucket = byIdentity.get(f.identityId);
    if (bucket) bucket.findings.push(f);
    else byIdentity.set(f.identityId, { identityType: f.identityType, findings: [f] });
  }

  const profiles: IdentityRiskProfile[] = [];
  for (const [identityId, bucket] of byIdentity) {
    let survival = 1; // Π (1 - weight*score)
    let topSeverity: IdentityRiskProfile["topSeverity"] = null;

    for (const f of bucket.findings) {
      const weight = weightById.get(f.scorer) ?? 0;
      survival *= 1 - clamp01(weight * f.score);
      if (topSeverity === null || SEVERITY_RANK[f.severity] > SEVERITY_RANK[topSeverity]) {
        topSeverity = f.severity;
      }
    }

    const compositeScore = round2(clamp01(1 - survival));
    // Stable, deterministic ordering of findings by descending score.
    const sortedFindings = [...bucket.findings].sort((a, b) => b.score - a.score);

    profiles.push({
      identityId,
      identityType: bucket.identityType,
      compositeScore,
      topSeverity,
      findings: sortedFindings,
    });
  }

  // Highest-risk identities first.
  profiles.sort((a, b) => b.compositeScore - a.compositeScore);
  return profiles;
}
