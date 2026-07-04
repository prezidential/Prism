// Sort/filter logic for the identity risk table — pure and testable.

import type { IdentitySummary, NodeKind } from "../data/types.ts";

export type SortKey = "name" | "type" | "riskScore" | "signalCount";
export type SortDir = "asc" | "desc";

export interface TableFilter {
  query?: string;
  kind?: NodeKind | "all";
  minRisk?: number;
}

export function filterIdentities(
  identities: IdentitySummary[],
  filter: TableFilter,
): IdentitySummary[] {
  const q = filter.query?.trim().toLowerCase() ?? "";
  const minRisk = filter.minRisk ?? 0;
  const kind = filter.kind && filter.kind !== "all" ? filter.kind : null;

  return identities.filter((i) => {
    if (i.riskScore < minRisk) return false;
    if (kind && i.kind !== kind) return false;
    if (q && !(`${i.name} ${i.type} ${i.detail ?? ""}`.toLowerCase().includes(q))) return false;
    return true;
  });
}

export function sortIdentities(
  identities: IdentitySummary[],
  key: SortKey,
  dir: SortDir,
): IdentitySummary[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...identities].sort((a, b) => {
    let cmp: number;
    if (key === "name" || key === "type") {
      cmp = a[key].localeCompare(b[key]);
    } else {
      cmp = a[key] - b[key];
    }
    // Stable tiebreak by name so ordering is deterministic.
    if (cmp === 0) cmp = a.name.localeCompare(b.name);
    return cmp * factor;
  });
}
