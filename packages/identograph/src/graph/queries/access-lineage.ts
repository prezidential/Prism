// access-lineage — who has access to what, and through what chain.
// Returns all resources reachable from an identity via HAS_ENTITLEMENT → Entitlement → Resource
// and direct HAS_ACCESS edges, including the intermediate entitlement nodes.

import type { ArcadeClient } from "../../db/client.js";

export interface AccessLineageResult {
  identityId: string;
  identityType: string;
  entitlementId: string;
  entitlementName: string;
  entitlementType: string;
  isPrivileged: boolean;
  resourceId: string | null;
  resourceName: string | null;
  resourceType: string | null;
  grantedAt: string;
  expiresAt: string | null;
  accessLevel: string | null;
}

export async function queryAccessLineage(
  client: ArcadeClient,
  tenantId: string,
  identityId: string,
): Promise<AccessLineageResult[]> {
  const esc = (v: string) => v.replace(/'/g, "\\'");

  // Fetch entitlements granted to this identity via HAS_ENTITLEMENT edges
  const sql = `
    SELECT
      '${esc(identityId)}' AS identityId,
      e.nodeType AS identityType,
      ent.id AS entitlementId,
      ent.displayName AS entitlementName,
      ent.entitlementType AS entitlementType,
      ent.isPrivileged AS isPrivileged,
      r.id AS resourceId,
      r.displayName AS resourceName,
      r.resourceType AS resourceType,
      edge.grantedAt AS grantedAt,
      edge.expiresAt AS expiresAt,
      null AS accessLevel
    FROM (
      MATCH
        {type: V, where: (tenantId = '${esc(tenantId)}' AND id = '${esc(identityId)}')} AS e
        -HAS_ENTITLEMENT-> {type: Entitlement, where: (tenantId = '${esc(tenantId)}')} AS ent
      RETURN e, ent, $matched.HAS_ENTITLEMENT AS edge
    )
    LET r = (SELECT FROM Resource WHERE tenantId = '${esc(tenantId)}' AND id = ent.resourceRef LIMIT 1)[0]
  `.trim();

  const rows = await client.query<AccessLineageResult>(sql);

  // Also fetch direct HAS_ACCESS edges to resources
  const directSql = `
    SELECT
      '${esc(identityId)}' AS identityId,
      src.nodeType AS identityType,
      null AS entitlementId,
      null AS entitlementName,
      null AS entitlementType,
      false AS isPrivileged,
      r.id AS resourceId,
      r.displayName AS resourceName,
      r.resourceType AS resourceType,
      edge.grantedAt AS grantedAt,
      edge.expiresAt AS expiresAt,
      edge.accessLevel AS accessLevel
    FROM (
      MATCH
        {type: V, where: (tenantId = '${esc(tenantId)}' AND id = '${esc(identityId)}')} AS src
        -HAS_ACCESS-> {type: Resource, where: (tenantId = '${esc(tenantId)}')} AS r
      RETURN src, r, $matched.HAS_ACCESS AS edge
    )
  `.trim();

  const directRows = await client.query<AccessLineageResult>(directSql);
  return [...rows, ...directRows];
}
