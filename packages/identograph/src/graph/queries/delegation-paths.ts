// delegation-paths — full delegation chain from source to target.
// Traverses DELEGATES_TO edges up to a configurable max depth.
// Returns each hop in the delegation chain with scope and depth info.

import type { ArcadeClient } from "../../db/client.js";

export interface DelegationHop {
  fromId: string;
  fromType: string;
  toId: string;
  toType: string;
  scope: string[];
  grantedAt: string;
  expiresAt: string | null;
  depth: number;
}

export interface DelegationPathResult {
  sourceId: string;
  targetId: string | null;  // null means "all reachable targets"
  hops: DelegationHop[];
  totalDepth: number;
  isTransitiveChain: boolean;
  delegationIds: string[];
}

export async function queryDelegationPaths(
  client: ArcadeClient,
  tenantId: string,
  fromIdentityId: string,
  toIdentityId?: string,
  maxDepth = 5,
): Promise<DelegationPathResult[]> {
  const esc = (v: string) => v.replace(/'/g, "\\'");

  // Fetch Delegation vertices where fromIdentityRef matches, walking transitively
  const delegationSql = `
    SELECT id, fromIdentityRef, fromIdentityType, toIdentityRef, toIdentityType,
           scope, grantedAt, expiresAt, isTransitive, depth
    FROM Delegation
    WHERE tenantId = '${esc(tenantId)}'
      AND fromIdentityRef = '${esc(fromIdentityId)}'
      AND depth <= ${maxDepth}
    ORDER BY depth ASC
  `;

  interface DelegationRow {
    id: string;
    fromIdentityRef: string;
    fromIdentityType: string;
    toIdentityRef: string;
    toIdentityType: string;
    scope: string[];
    grantedAt: string;
    expiresAt: string | null;
    isTransitive: boolean;
    depth: number;
  }

  const delegations = await client.query<DelegationRow>(delegationSql);

  // If a target is specified, filter to paths that reach it
  const filtered = toIdentityId
    ? delegations.filter((d) => d.toIdentityRef === toIdentityId)
    : delegations;

  if (filtered.length === 0) return [];

  // Group into path results — each direct delegation is one result;
  // transitive chains are grouped by tracking the origin
  const results: DelegationPathResult[] = filtered.map((d) => ({
    sourceId: fromIdentityId,
    targetId: toIdentityId ?? d.toIdentityRef,
    hops: [
      {
        fromId: d.fromIdentityRef,
        fromType: d.fromIdentityType,
        toId: d.toIdentityRef,
        toType: d.toIdentityType,
        scope: Array.isArray(d.scope) ? d.scope : [],
        grantedAt: d.grantedAt,
        expiresAt: d.expiresAt ?? null,
        depth: d.depth,
      },
    ],
    totalDepth: d.depth,
    isTransitiveChain: d.isTransitive,
    delegationIds: [d.id],
  }));

  return results;
}
