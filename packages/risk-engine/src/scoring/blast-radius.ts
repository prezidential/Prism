// Blast radius scorer.
//
// If an identity is compromised, what can the attacker reach through it? An
// identity that fans out to many resources, much privileged access, and
// downstream identities (delegates, spawned sub-agents) is a high-value target
// whose compromise is catastrophic. This scorer estimates each identity's reach
// from its outbound entitlements, direct access, delegations, and spawned agents.

import type { GraphClient } from "../client.js";
import { clamp01, esc, round2 } from "../client.js";
import type { RiskFinding, RiskScorer } from "../types.js";
import { CAEP_URI_BASE, severityForScore } from "../types.js";
import { fetchEntitlementGrants } from "./shared.js";

// Reachable-resource count that saturates the resource component.
const MAX_RESOURCES = 25;
// Downstream-identity count that saturates the fan-out component.
const MAX_DOWNSTREAM = 10;
// Component weights (sum to 1.0).
const W_RESOURCES = 0.45;
const W_PRIVILEGE = 0.35;
const W_DOWNSTREAM = 0.2;

interface DirectAccessRow {
  identityId: string;
  identityType: string;
}
interface DownstreamRow {
  fromRef: string;
}

export const blastRadiusScorer: RiskScorer = {
  id: "blast-radius",
  weight: 0.15,

  async score(client: GraphClient, tenantId: string): Promise<RiskFinding[]> {
    const t = esc(tenantId);

    // 1. Entitlement grants (resources reachable via entitlements + privilege).
    const grants = await fetchEntitlementGrants(client, tenantId);

    // 2. Direct resource access via HAS_ACCESS.
    const directAccess = await client.query<DirectAccessRow>(
      `
      SELECT src.id AS identityId, src.nodeType AS identityType
      FROM (
        MATCH
          {type: V, where: (tenantId = '${t}')} AS src
          -HAS_ACCESS-> {type: Resource, where: (tenantId = '${t}')} AS r
        RETURN src
      )
    `.trim(),
    );

    // 3. Downstream identities via delegation.
    const delegations = await client.query<DownstreamRow>(
      `SELECT fromIdentityRef AS fromRef FROM Delegation WHERE tenantId = '${t}'`,
    );
    // 4. Downstream identities via SPAWNED edges.
    const spawned = await client.query<DownstreamRow>(
      `
      SELECT parent.id AS fromRef
      FROM (
        MATCH
          {type: V, where: (tenantId = '${t}')} AS parent
          -SPAWNED-> {type: AgentIdentity, where: (tenantId = '${t}')} AS child
        RETURN parent
      )
    `.trim(),
    );

    interface Agg {
      identityType: string;
      resources: number;
      privilegedResources: number;
      downstream: number;
    }
    const byIdentity = new Map<string, Agg>();
    const ensure = (id: string, type: string): Agg => {
      let a = byIdentity.get(id);
      if (!a) {
        a = { identityType: type, resources: 0, privilegedResources: 0, downstream: 0 };
        byIdentity.set(id, a);
      }
      return a;
    };

    for (const g of grants) {
      const a = ensure(g.identityId, g.identityType);
      a.resources += 1;
      if (g.isPrivileged) a.privilegedResources += 1;
    }
    for (const d of directAccess) {
      const a = ensure(d.identityId, d.identityType);
      a.resources += 1;
    }
    for (const d of [...delegations, ...spawned]) {
      if (!d.fromRef) continue;
      const a = byIdentity.get(d.fromRef);
      // Downstream fan-out counts even if the identity has no entitlements yet.
      if (a) a.downstream += 1;
      else ensure(d.fromRef, "Unknown").downstream += 1;
    }

    const findings: RiskFinding[] = [];
    for (const [identityId, agg] of byIdentity) {
      const resourceComponent = clamp01(agg.resources / MAX_RESOURCES);
      const privilegeComponent =
        agg.resources > 0 ? clamp01(agg.privilegedResources / agg.resources) : 0;
      const downstreamComponent = clamp01(agg.downstream / MAX_DOWNSTREAM);

      const score = clamp01(
        resourceComponent * W_RESOURCES +
          privilegeComponent * W_PRIVILEGE +
          downstreamComponent * W_DOWNSTREAM,
      );
      if (score <= 0) continue;

      findings.push({
        scorer: "blast-radius",
        identityId,
        identityType: agg.identityType,
        score: round2(score),
        severity: severityForScore(score),
        rationale:
          `Compromise reaches ${agg.resources} resource(s) ` +
          `(${agg.privilegedResources} privileged) and ${agg.downstream} downstream identit(y/ies).`,
        caepEventType: "risk-level-change",
        eventTypeUri: `${CAEP_URI_BASE}/risk-level-change`,
        evidence: {
          reachableResources: agg.resources,
          privilegedResources: agg.privilegedResources,
          downstreamIdentities: agg.downstream,
        },
      });
    }

    return findings;
  },
};
