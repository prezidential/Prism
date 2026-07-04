// Cross-identity entitlement overlap (separation-of-duties) scorer.
//
// When two distinct identities hold the same *privileged* entitlement, that is a
// separation-of-duties (SoD) concern: sensitive capability is duplicated where it
// should be uniquely held and accountable. This scorer flags every identity that
// shares one or more privileged entitlements with another identity, scored by the
// combined risk weight of the shared privileged access.

import type { GraphClient } from "../client.js";
import { clamp01, round2 } from "../client.js";
import type { RiskFinding, RiskScorer } from "../types.js";
import { CAEP_URI_BASE, severityForScore } from "../types.js";
import { fetchEntitlementGrants } from "./shared.js";

// Combined shared privileged risk weight that maxes out the score.
const MAX_COMBINED_WEIGHT = 2.0;

export const entitlementOverlapScorer: RiskScorer = {
  id: "entitlement-overlap",
  weight: 0.15,

  async score(client: GraphClient, tenantId: string): Promise<RiskFinding[]> {
    const grants = await fetchEntitlementGrants(client, tenantId);

    // Group privileged grants by entitlement → holders.
    interface Holder {
      identityId: string;
      identityType: string;
    }
    interface EntitlementInfo {
      name: string;
      riskWeight: number;
      holders: Holder[];
    }
    const byEntitlement = new Map<string, EntitlementInfo>();

    for (const g of grants) {
      if (!g.isPrivileged) continue;
      const info = byEntitlement.get(g.entitlementId);
      if (info) {
        info.holders.push({ identityId: g.identityId, identityType: g.identityType });
      } else {
        byEntitlement.set(g.entitlementId, {
          name: g.entitlementName,
          riskWeight: g.riskWeight,
          holders: [{ identityId: g.identityId, identityType: g.identityType }],
        });
      }
    }

    // Accumulate per-identity: shared privileged entitlements and weight.
    interface Agg {
      identityType: string;
      sharedEntitlements: string[];
      weightSum: number;
      coHolders: Set<string>;
    }
    const byIdentity = new Map<string, Agg>();

    for (const [entitlementId, info] of byEntitlement) {
      // Distinct holders only — an identity granted twice is not an SoD issue.
      const distinct = new Map<string, Holder>();
      for (const h of info.holders) distinct.set(h.identityId, h);
      if (distinct.size < 2) continue;

      const ids = [...distinct.keys()];
      for (const holder of distinct.values()) {
        const agg = byIdentity.get(holder.identityId) ?? {
          identityType: holder.identityType,
          sharedEntitlements: [],
          weightSum: 0,
          coHolders: new Set<string>(),
        };
        agg.sharedEntitlements.push(info.name || entitlementId);
        agg.weightSum += info.riskWeight;
        for (const other of ids) {
          if (other !== holder.identityId) agg.coHolders.add(other);
        }
        byIdentity.set(holder.identityId, agg);
      }
    }

    const findings: RiskFinding[] = [];
    for (const [identityId, agg] of byIdentity) {
      const score = clamp01(agg.weightSum / MAX_COMBINED_WEIGHT);
      if (score <= 0) continue;

      findings.push({
        scorer: "entitlement-overlap",
        identityId,
        identityType: agg.identityType,
        score: round2(score),
        severity: severityForScore(score),
        rationale:
          `Shares ${agg.sharedEntitlements.length} privileged entitlement(s) with ` +
          `${agg.coHolders.size} other identit(y/ies) — separation-of-duties concern.`,
        caepEventType: "risk-level-change",
        eventTypeUri: `${CAEP_URI_BASE}/risk-level-change`,
        evidence: {
          sharedEntitlements: agg.sharedEntitlements,
          coHolderCount: agg.coHolders.size,
          combinedRiskWeight: round2(agg.weightSum),
        },
      });
    }

    return findings;
  },
};
