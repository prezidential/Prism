// Dormant (unused) entitlement scorer.
//
// An identity that holds privileged entitlements but has not been active for a
// long time is standing, unwatched attack surface: the access is live, but no
// one is exercising or observing it. This scorer flags identities by how long
// they have been dormant weighted by the privilege they still hold.

import type { GraphClient } from "../client.js";
import { clamp01, round2 } from "../client.js";
import type { RiskFinding, RiskScorer } from "../types.js";
import { CAEP_URI_BASE, severityForScore } from "../types.js";
import { daysBetween, fetchEntitlementGrants } from "./shared.js";

// Dormancy below this many days is not risky at all.
const GRACE_DAYS = 30;
// Dormancy at or beyond this many days maxes out the dormancy component.
const MAX_DORMANT_DAYS = 180;

export interface DormantEntitlementScorerOptions {
  // "Now" used to measure dormancy. Injected for deterministic scoring/tests.
  now: string;
}

export function createDormantEntitlementScorer(
  options: DormantEntitlementScorerOptions,
): RiskScorer {
  const now = options.now;

  return {
    id: "dormant-entitlement",
    weight: 0.2,

    async score(client: GraphClient, tenantId: string): Promise<RiskFinding[]> {
      const grants = await fetchEntitlementGrants(client, tenantId);

      interface Agg {
        identityType: string;
        lastActivity: string | null;
        privilegedCount: number;
        totalCount: number;
        weightSum: number;
      }
      const byIdentity = new Map<string, Agg>();

      for (const g of grants) {
        const existing = byIdentity.get(g.identityId);
        if (existing) {
          existing.privilegedCount += g.isPrivileged ? 1 : 0;
          existing.totalCount += 1;
          existing.weightSum += g.isPrivileged ? g.riskWeight : 0;
        } else {
          byIdentity.set(g.identityId, {
            identityType: g.identityType,
            lastActivity: g.lastActivity,
            privilegedCount: g.isPrivileged ? 1 : 0,
            totalCount: 1,
            weightSum: g.isPrivileged ? g.riskWeight : 0,
          });
        }
      }

      const findings: RiskFinding[] = [];
      for (const [identityId, agg] of byIdentity) {
        // Only privileged holdings constitute dormant-access risk.
        if (agg.privilegedCount === 0) continue;

        const dormantDays = daysBetween(agg.lastActivity, now);
        if (dormantDays <= GRACE_DAYS) continue;

        const dormancy = clamp01(
          (dormantDays - GRACE_DAYS) / (MAX_DORMANT_DAYS - GRACE_DAYS),
        );
        // Privilege multiplier: average risk weight of the privileged grants,
        // floored so any privileged-but-unweighted grant still counts.
        const avgWeight = agg.weightSum / agg.privilegedCount;
        const privilege = clamp01(Math.max(0.5, avgWeight));
        const score = clamp01(dormancy * privilege);
        if (score <= 0) continue;

        findings.push({
          scorer: "dormant-entitlement",
          identityId,
          identityType: agg.identityType,
          score: round2(score),
          severity: severityForScore(score),
          rationale:
            `Dormant for ${dormantDays} day(s) while holding ${agg.privilegedCount} ` +
            `privileged entitlement(s).`,
          caepEventType: "risk-level-change",
          eventTypeUri: `${CAEP_URI_BASE}/risk-level-change`,
          evidence: {
            dormantDays,
            lastActivity: agg.lastActivity,
            privilegedCount: agg.privilegedCount,
            totalEntitlements: agg.totalCount,
          },
        });
      }

      return findings;
    },
  };
}
