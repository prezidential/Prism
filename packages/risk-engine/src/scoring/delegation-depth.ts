// Excessive delegation depth scorer.
//
// Authority that flows through many hops of delegation is authority far removed
// from the human principal who originally granted it. An identity sitting at the
// end of a deep — and especially transitive — delegation chain can act with
// borrowed privilege that no one is directly accountable for. This scorer flags
// the *receiving* identity of each delegation by how deep its deepest inbound
// chain runs.

import type { GraphClient } from "../client.js";
import { clamp01, esc, round2 } from "../client.js";
import type { RiskFinding, RiskScorer } from "../types.js";
import { CAEP_URI_BASE, severityForScore } from "../types.js";

// Delegation depth considered fully "normal". At or below this, depth alone
// contributes no risk; above it, risk ramps to 1.0 by MAX_DEPTH.
const SAFE_DEPTH = 1;
const MAX_DEPTH = 4;
// Transitive chains (the delegate may re-delegate) add this much on top.
const TRANSITIVE_BONUS = 0.2;

interface DelegationRow {
  toIdentityRef: string;
  toIdentityType: string;
  depth: number | null;
  isTransitive: boolean | null;
}

export const delegationDepthScorer: RiskScorer = {
  id: "delegation-depth",
  weight: 0.2,

  async score(client: GraphClient, tenantId: string): Promise<RiskFinding[]> {
    const t = esc(tenantId);
    const rows = await client.query<DelegationRow>(
      `SELECT toIdentityRef, toIdentityType, depth, isTransitive
       FROM Delegation
       WHERE tenantId = '${t}'
       ORDER BY depth DESC`,
    );

    // Aggregate per receiving identity: deepest chain + whether any is transitive.
    interface Agg {
      identityType: string;
      maxDepth: number;
      chainCount: number;
      anyTransitive: boolean;
    }
    const byIdentity = new Map<string, Agg>();

    for (const row of rows) {
      if (!row.toIdentityRef) continue;
      const depth = typeof row.depth === "number" ? row.depth : 0;
      const existing = byIdentity.get(row.toIdentityRef);
      if (existing) {
        existing.maxDepth = Math.max(existing.maxDepth, depth);
        existing.chainCount += 1;
        existing.anyTransitive = existing.anyTransitive || row.isTransitive === true;
      } else {
        byIdentity.set(row.toIdentityRef, {
          identityType: row.toIdentityType ?? "Unknown",
          maxDepth: depth,
          chainCount: 1,
          anyTransitive: row.isTransitive === true,
        });
      }
    }

    const findings: RiskFinding[] = [];
    for (const [identityId, agg] of byIdentity) {
      const depthComponent =
        agg.maxDepth <= SAFE_DEPTH
          ? 0
          : (agg.maxDepth - SAFE_DEPTH) / (MAX_DEPTH - SAFE_DEPTH);
      const score = clamp01(depthComponent + (agg.anyTransitive ? TRANSITIVE_BONUS : 0));

      // Only surface identities that carry meaningful delegation depth risk.
      if (score <= 0) continue;

      findings.push({
        scorer: "delegation-depth",
        identityId,
        identityType: agg.identityType,
        score: round2(score),
        severity: severityForScore(score),
        rationale:
          `Holds authority via a delegation chain ${agg.maxDepth} hop(s) deep` +
          (agg.anyTransitive ? " that is transitively re-delegable" : "") +
          ` (${agg.chainCount} inbound delegation(s)).`,
        caepEventType: "token-claims-change",
        eventTypeUri: `${CAEP_URI_BASE}/token-claims-change`,
        evidence: {
          maxDepth: agg.maxDepth,
          chainCount: agg.chainCount,
          transitive: agg.anyTransitive,
        },
      });
    }

    return findings;
  },
};
