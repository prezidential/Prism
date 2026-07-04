// Risk API data layer — the query behind `GET /api/v1/risk/identities`.
//
// Returns identities at or above a risk threshold, highest first, each with the
// RiskSignals that contributed to its score. This reads the materialized state
// the evaluator wrote (identity.riskScore + RiskSignal vertices); it does not
// recompute. The HTTP route that exposes this lives in the Phase 5 API layer.

import type { GraphClient } from "../client.js";
import { clamp01, esc } from "../client.js";
import type { Severity } from "../types.js";
import { SEVERITY_RANK } from "../types.js";

// Identity vertex classes that carry a riskScore.
const IDENTITY_TYPES = [
  "HumanIdentity",
  "AgentIdentity",
  "NHIdentity",
  "ServiceAccount",
  "APIToken",
  "WorkloadIdentity",
] as const;

export interface RiskSignalSummary {
  signalId: string;
  scorer: string | null;
  caepEventType: string;
  score: number;
  severity: Severity;
  iat: string;
  rationale: string | null;
  resolvedAt: string | null;
}

export interface RiskIdentity {
  identityId: string;
  identityType: string;
  riskScore: number;
  status: string;
  signals: RiskSignalSummary[];
  signalCount: number;
  highestSeverity: Severity | null;
}

export interface GetRiskIdentitiesOptions {
  // Minimum riskScore to include. Default 0.0 (all).
  threshold?: number;
  // Cap on identities returned (after sorting). Default: no limit.
  limit?: number;
}

interface IdentityRow {
  id: string;
  nodeType: string;
  riskScore: number | null;
  status: string | null;
}

interface SignalRow {
  id: string;
  caepEventType: string | null;
  score: number | null;
  severity: string | null;
  iat: string | null;
  resolvedAt: string | null;
  eventPayload: unknown;
}

export async function getRiskIdentities(
  client: GraphClient,
  tenantId: string,
  options: GetRiskIdentitiesOptions = {},
): Promise<RiskIdentity[]> {
  const t = esc(tenantId);
  const threshold = clamp01(options.threshold ?? 0);

  // Gather risky identities across every identity vertex class.
  const identities: IdentityRow[] = [];
  for (const type of IDENTITY_TYPES) {
    const rows = await client.query<IdentityRow>(
      `SELECT id, nodeType, riskScore, status
       FROM ${type}
       WHERE tenantId = '${t}' AND riskScore >= ${threshold}
       ORDER BY riskScore DESC`,
    );
    identities.push(...rows);
  }
  identities.sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));

  const capped =
    typeof options.limit === "number" ? identities.slice(0, Math.max(0, options.limit)) : identities;

  const results: RiskIdentity[] = [];
  for (const identity of capped) {
    const signalRows = await client.query<SignalRow>(
      `SELECT id, caepEventType, score, severity, iat, resolvedAt, eventPayload
       FROM RiskSignal
       WHERE tenantId = '${t}' AND subjectRef = '${esc(identity.id)}'
       ORDER BY score DESC`,
    );

    const signals: RiskSignalSummary[] = signalRows.map((s) => {
      const payload =
        s.eventPayload && typeof s.eventPayload === "object"
          ? (s.eventPayload as Record<string, unknown>)
          : parsePayload(s.eventPayload);
      return {
        signalId: s.id,
        scorer: typeof payload["scorer"] === "string" ? (payload["scorer"] as string) : null,
        caepEventType: s.caepEventType ?? "",
        score: s.score ?? 0,
        severity: (s.severity as Severity) ?? "info",
        iat: s.iat ?? "",
        rationale:
          typeof payload["rationale"] === "string" ? (payload["rationale"] as string) : null,
        resolvedAt: s.resolvedAt ?? null,
      };
    });

    let highestSeverity: Severity | null = null;
    for (const s of signals) {
      if (highestSeverity === null || SEVERITY_RANK[s.severity] > SEVERITY_RANK[highestSeverity]) {
        highestSeverity = s.severity;
      }
    }

    results.push({
      identityId: identity.id,
      identityType: identity.nodeType,
      riskScore: identity.riskScore ?? 0,
      status: identity.status ?? "",
      signals,
      signalCount: signals.length,
      highestSeverity,
    });
  }

  return results;
}

// ArcadeDB may return an embedded map as a JSON string; tolerate both.
function parsePayload(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
