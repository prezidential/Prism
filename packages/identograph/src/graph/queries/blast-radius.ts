// blast-radius — if this identity is compromised, what is accessible?
// Traverses the graph outward from the identity through:
//   - HAS_ENTITLEMENT → Entitlement → Resource
//   - HAS_ACCESS → Resource
//   - DELEGATES_TO → other identities (transitive)
//   - SPAWNED → agent identities (if an agent spawned sub-agents)
// Returns a summary of all reachable resources, entitlements, and downstream identities.

import type { ArcadeClient } from "../../db/client.js";

export interface ReachableResource {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  sensitivity: string;
  via: "entitlement" | "direct-access";
  entitlementId: string | null;
}

export interface ReachableIdentity {
  identityId: string;
  identityType: string;
  via: "delegation" | "spawned";
  depth: number;
}

export interface BlastRadiusResult {
  identityId: string;
  identityType: string;
  reachableResources: ReachableResource[];
  reachableIdentities: ReachableIdentity[];
  totalResourceCount: number;
  totalIdentityCount: number;
  criticalResourceCount: number; // sensitivity = "restricted" | "confidential"
  privilegedEntitlementCount: number;
  blastRadiusScore: number; // 0.0–1.0 normalized risk contribution
}

export async function queryBlastRadius(
  client: ArcadeClient,
  tenantId: string,
  identityId: string,
): Promise<BlastRadiusResult> {
  const esc = (v: string) => v.replace(/'/g, "\\'");

  // Resolve identity type
  const identityTypeRows = await client.query<{ nodeType: string }>(
    `SELECT nodeType FROM V WHERE tenantId = '${esc(tenantId)}' AND id = '${esc(identityId)}' LIMIT 1`,
  );
  const identityType = identityTypeRows[0]?.nodeType ?? "Unknown";

  // Resources reachable via entitlements
  interface EntitlementResourceRow {
    entitlementId: string;
    resourceId: string | null;
    resourceName: string | null;
    resourceType: string | null;
    sensitivity: string | null;
    isPrivileged: boolean;
  }

  const entitlementResources = await client.query<EntitlementResourceRow>(`
    SELECT ent.id AS entitlementId, r.id AS resourceId, r.displayName AS resourceName,
           r.resourceType AS resourceType, r.sensitivity AS sensitivity, ent.isPrivileged AS isPrivileged
    FROM (
      MATCH
        {type: V, where: (tenantId = '${esc(tenantId)}' AND id = '${esc(identityId)}')}
        -HAS_ENTITLEMENT-> {type: Entitlement, where: (tenantId = '${esc(tenantId)}')} AS ent
      RETURN ent
    )
    LET r = (SELECT FROM Resource WHERE tenantId = '${esc(tenantId)}' AND id = ent.resourceRef LIMIT 1)[0]
  `.trim());

  // Resources reachable via direct HAS_ACCESS
  interface DirectAccessRow {
    resourceId: string;
    resourceName: string;
    resourceType: string;
    sensitivity: string;
  }

  const directResources = await client.query<DirectAccessRow>(`
    SELECT r.id AS resourceId, r.displayName AS resourceName,
           r.resourceType AS resourceType, r.sensitivity AS sensitivity
    FROM (
      MATCH
        {type: V, where: (tenantId = '${esc(tenantId)}' AND id = '${esc(identityId)}')}
        -HAS_ACCESS-> {type: Resource, where: (tenantId = '${esc(tenantId)}')} AS r
      RETURN r
    )
  `.trim());

  // Identities reachable via DELEGATES_TO
  interface DelegatedIdentityRow {
    toIdentityRef: string;
    toIdentityType: string;
    depth: number;
  }

  const delegatedIdentities = await client.query<DelegatedIdentityRow>(
    `SELECT toIdentityRef, toIdentityType, depth
     FROM Delegation
     WHERE tenantId = '${esc(tenantId)}' AND fromIdentityRef = '${esc(identityId)}'
     ORDER BY depth ASC`,
  );

  // Agent sub-identities via SPAWNED edges
  interface SpawnedRow {
    id: string;
    nodeType: string;
  }

  const spawnedAgents = await client.query<SpawnedRow>(`
    SELECT child.id AS id, child.nodeType AS nodeType
    FROM (
      MATCH
        {type: V, where: (tenantId = '${esc(tenantId)}' AND id = '${esc(identityId)}')}
        -SPAWNED-> {type: AgentIdentity, where: (tenantId = '${esc(tenantId)}')} AS child
      RETURN child
    )
  `.trim());

  // Build result
  const reachableResources: ReachableResource[] = [
    ...entitlementResources
      .filter((r) => r.resourceId !== null)
      .map((r) => ({
        resourceId: r.resourceId ?? "",
        resourceName: r.resourceName ?? "",
        resourceType: r.resourceType ?? "",
        sensitivity: r.sensitivity ?? "internal",
        via: "entitlement" as const,
        entitlementId: r.entitlementId,
      })),
    ...directResources.map((r) => ({
      resourceId: r.resourceId,
      resourceName: r.resourceName,
      resourceType: r.resourceType,
      sensitivity: r.sensitivity,
      via: "direct-access" as const,
      entitlementId: null,
    })),
  ];

  // Deduplicate by resourceId
  const seenResourceIds = new Set<string>();
  const dedupedResources = reachableResources.filter((r) => {
    if (seenResourceIds.has(r.resourceId)) return false;
    seenResourceIds.add(r.resourceId);
    return true;
  });

  const reachableIdentities: ReachableIdentity[] = [
    ...delegatedIdentities.map((d) => ({
      identityId: d.toIdentityRef,
      identityType: d.toIdentityType,
      via: "delegation" as const,
      depth: d.depth,
    })),
    ...spawnedAgents.map((a) => ({
      identityId: a.id,
      identityType: a.nodeType,
      via: "spawned" as const,
      depth: 1,
    })),
  ];

  const criticalCount = dedupedResources.filter(
    (r) => r.sensitivity === "restricted" || r.sensitivity === "confidential",
  ).length;

  const privilegedCount = entitlementResources.filter((r) => r.isPrivileged).length;

  // Normalize blast radius score: more resources + critical sensitivity = higher score
  const maxResources = 50;
  const blastRadiusScore = Math.min(
    1,
    (dedupedResources.length / maxResources) * 0.5 +
      (criticalCount / Math.max(dedupedResources.length, 1)) * 0.3 +
      (reachableIdentities.length / 10) * 0.2,
  );

  return {
    identityId,
    identityType,
    reachableResources: dedupedResources,
    reachableIdentities,
    totalResourceCount: dedupedResources.length,
    totalIdentityCount: reachableIdentities.length,
    criticalResourceCount: criticalCount,
    privilegedEntitlementCount: privilegedCount,
    blastRadiusScore: Math.round(blastRadiusScore * 100) / 100,
  };
}
