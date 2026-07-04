// Shared graph reads used by more than one scorer.

import type { GraphClient } from "../client.js";
import { esc } from "../client.js";

// A single HAS_ENTITLEMENT grant flattened to identity + entitlement fields.
export interface EntitlementGrant {
  identityId: string;
  identityType: string;
  lastActivity: string | null;
  entitlementId: string;
  entitlementName: string;
  isPrivileged: boolean;
  riskWeight: number;
}

interface GrantRow {
  identityId: string;
  identityType: string;
  lastActivity: string | null;
  entitlementId: string;
  entitlementName: string | null;
  isPrivileged: boolean | null;
  riskWeight: number | null;
}

// Fetch every HAS_ENTITLEMENT grant in a tenant, flattened for scoring.
export async function fetchEntitlementGrants(
  client: GraphClient,
  tenantId: string,
): Promise<EntitlementGrant[]> {
  const t = esc(tenantId);
  const rows = await client.query<GrantRow>(
    `
    SELECT
      src.id AS identityId,
      src.nodeType AS identityType,
      src.lastActivity AS lastActivity,
      ent.id AS entitlementId,
      ent.displayName AS entitlementName,
      ent.isPrivileged AS isPrivileged,
      ent.riskWeight AS riskWeight
    FROM (
      MATCH
        {type: V, where: (tenantId = '${t}')} AS src
        -HAS_ENTITLEMENT-> {type: Entitlement, where: (tenantId = '${t}')} AS ent
      RETURN src, ent
    )
  `.trim(),
  );

  return rows.map((r) => ({
    identityId: r.identityId,
    identityType: r.identityType,
    lastActivity: r.lastActivity ?? null,
    entitlementId: r.entitlementId,
    entitlementName: r.entitlementName ?? "",
    isPrivileged: r.isPrivileged ?? false,
    riskWeight: typeof r.riskWeight === "number" ? r.riskWeight : 0,
  }));
}

// Number of whole days between two ISO timestamps (>= 0). Returns 0 if either
// timestamp is missing or unparseable.
export function daysBetween(fromIso: string | null, toIso: string): number {
  if (!fromIso) return 0;
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  const ms = to - from;
  if (ms <= 0) return 0;
  return Math.floor(ms / 86_400_000);
}
