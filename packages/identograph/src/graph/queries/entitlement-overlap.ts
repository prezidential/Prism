// entitlement-overlap — cross-identity entitlement overlap detection.
// Finds pairs of identities that share one or more of the same privileged entitlements.
// High overlap between unrelated identities is a separation-of-duties (SoD) risk.

import type { ArcadeClient } from "../../db/client.js";

export interface OverlappingIdentity {
  identityId: string;
  identityType: string;
}

export interface SharedEntitlement {
  entitlementId: string;
  entitlementName: string;
  entitlementType: string;
  isPrivileged: boolean;
  riskWeight: number;
}

export interface EntitlementOverlapResult {
  identityA: OverlappingIdentity;
  identityB: OverlappingIdentity;
  sharedEntitlements: SharedEntitlement[];
  overlapCount: number;
  combinedRiskWeight: number; // sum of riskWeight for shared privileged entitlements
  isSoDViolation: boolean;    // true if both hold the same privileged entitlement
}

export async function queryEntitlementOverlap(
  client: ArcadeClient,
  tenantId: string,
  privilegedOnly = false,
): Promise<EntitlementOverlapResult[]> {
  const esc = (v: string) => v.replace(/'/g, "\\'");

  // Fetch all HAS_ENTITLEMENT edges with identity and entitlement details
  interface GrantRow {
    identityId: string;
    identityType: string;
    entitlementId: string;
    entitlementName: string;
    entitlementType: string;
    isPrivileged: boolean;
    riskWeight: number;
  }

  const privilegedClause = privilegedOnly ? "AND ent.isPrivileged = true" : "";

  const grants = await client.query<GrantRow>(`
    SELECT
      src.id AS identityId,
      src.nodeType AS identityType,
      ent.id AS entitlementId,
      ent.displayName AS entitlementName,
      ent.entitlementType AS entitlementType,
      ent.isPrivileged AS isPrivileged,
      ent.riskWeight AS riskWeight
    FROM (
      MATCH
        {type: V, where: (tenantId = '${esc(tenantId)}')} AS src
        -HAS_ENTITLEMENT-> {type: Entitlement, where: (tenantId = '${esc(tenantId)}' ${privilegedClause})} AS ent
      RETURN src, ent
    )
  `.trim());

  // Group grants by entitlementId → list of identities that hold it
  const entitlementToIdentities = new Map<string, { identity: OverlappingIdentity; entitlement: SharedEntitlement }[]>();

  for (const grant of grants) {
    const existing = entitlementToIdentities.get(grant.entitlementId) ?? [];
    existing.push({
      identity: { identityId: grant.identityId, identityType: grant.identityType },
      entitlement: {
        entitlementId: grant.entitlementId,
        entitlementName: grant.entitlementName,
        entitlementType: grant.entitlementType,
        isPrivileged: grant.isPrivileged,
        riskWeight: grant.riskWeight,
      },
    });
    entitlementToIdentities.set(grant.entitlementId, existing);
  }

  // Find identity pairs that share entitlements
  const pairMap = new Map<string, {
    identityA: OverlappingIdentity;
    identityB: OverlappingIdentity;
    sharedEntitlements: SharedEntitlement[];
  }>();

  for (const [, holders] of entitlementToIdentities) {
    if (holders.length < 2) continue;

    // Enumerate all pairs
    for (let i = 0; i < holders.length; i++) {
      for (let j = i + 1; j < holders.length; j++) {
        const a = holders[i];
        const b = holders[j];
        if (!a || !b) continue;

        // Stable pair key: sort ids lexicographically
        const [first, second] = [a.identity.identityId, b.identity.identityId].sort();
        const pairKey = `${first}::${second}`;

        const existing = pairMap.get(pairKey) ?? {
          identityA: first === a.identity.identityId ? a.identity : b.identity,
          identityB: first === a.identity.identityId ? b.identity : a.identity,
          sharedEntitlements: [],
        };
        existing.sharedEntitlements.push(a.entitlement);
        pairMap.set(pairKey, existing);
      }
    }
  }

  // Build results
  const results: EntitlementOverlapResult[] = [];
  for (const pair of pairMap.values()) {
    const combinedRiskWeight = pair.sharedEntitlements.reduce((sum, e) => sum + (e.riskWeight ?? 0), 0);
    const isSoDViolation = pair.sharedEntitlements.some((e) => e.isPrivileged);

    results.push({
      identityA: pair.identityA,
      identityB: pair.identityB,
      sharedEntitlements: pair.sharedEntitlements,
      overlapCount: pair.sharedEntitlements.length,
      combinedRiskWeight: Math.round(combinedRiskWeight * 100) / 100,
      isSoDViolation,
    });
  }

  // Sort by combined risk weight descending
  results.sort((a, b) => b.combinedRiskWeight - a.combinedRiskWeight);
  return results;
}
