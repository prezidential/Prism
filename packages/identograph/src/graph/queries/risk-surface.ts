// risk-surface — all identities above a risk threshold with their contributing signals.
// Queries all identity vertex types for riskScore >= threshold,
// then fetches the RiskSignals linked to each identity.

import type { ArcadeClient } from "../../db/client.js";
import type { CaepEventType, SignalSeverity } from "../../schema/enums.js";

export interface ContributingSignal {
  signalId: string;
  jti: string;
  caepEventType: CaepEventType;
  eventTypeUri: string;
  score: number;
  severity: SignalSeverity;
  iat: string;
  resolvedAt: string | null;
}

export interface RiskSurfaceResult {
  identityId: string;
  identityType: string;
  riskScore: number;
  status: string;
  signals: ContributingSignal[];
  signalCount: number;
  highestSeverity: SignalSeverity | null;
}

// Identity vertex types that carry riskScore
const IDENTITY_TYPES = [
  "HumanIdentity",
  "AgentIdentity",
  "NHIdentity",
  "ServiceAccount",
  "APIToken",
  "WorkloadIdentity",
] as const;

export async function queryRiskSurface(
  client: ArcadeClient,
  tenantId: string,
  threshold: number,
): Promise<RiskSurfaceResult[]> {
  const esc = (v: string) => v.replace(/'/g, "\\'");
  const t = Math.max(0, Math.min(1, threshold));

  interface IdentityRow {
    id: string;
    nodeType: string;
    riskScore: number;
    status: string;
  }

  // Query each identity type and union the results
  const identityRows: IdentityRow[] = [];
  for (const type of IDENTITY_TYPES) {
    const rows = await client.query<IdentityRow>(
      `SELECT id, nodeType, riskScore, status
       FROM ${type}
       WHERE tenantId = '${esc(tenantId)}' AND riskScore >= ${t}
       ORDER BY riskScore DESC`,
    );
    identityRows.push(...rows);
  }

  // Sort combined results by riskScore descending
  identityRows.sort((a, b) => b.riskScore - a.riskScore);

  interface SignalRow {
    id: string;
    jti: string;
    caepEventType: string;
    eventTypeUri: string;
    score: number;
    severity: string;
    iat: string;
    resolvedAt: string | null;
  }

  // For each risky identity, fetch contributing RiskSignals
  const results: RiskSurfaceResult[] = [];
  for (const identity of identityRows) {
    const signals = await client.query<SignalRow>(
      `SELECT id, jti, caepEventType, eventTypeUri, score, severity, iat, resolvedAt
       FROM RiskSignal
       WHERE tenantId = '${esc(tenantId)}' AND subjectRef = '${esc(identity.id)}'
       ORDER BY score DESC`,
    );

    const severityOrder: Record<string, number> = { critical: 2, warning: 1, info: 0 };
    const highestSeverity =
      signals.length > 0
        ? (signals.reduce((best, s) =>
            (severityOrder[s.severity] ?? 0) > (severityOrder[best.severity] ?? 0) ? s : best,
          ).severity as SignalSeverity)
        : null;

    results.push({
      identityId: identity.id,
      identityType: identity.nodeType,
      riskScore: identity.riskScore,
      status: identity.status,
      signals: signals.map((s) => ({
        signalId: s.id,
        jti: s.jti,
        caepEventType: s.caepEventType as CaepEventType,
        eventTypeUri: s.eventTypeUri,
        score: s.score,
        severity: s.severity as SignalSeverity,
        iat: s.iat,
        resolvedAt: s.resolvedAt ?? null,
      })),
      signalCount: signals.length,
      highestSeverity,
    });
  }

  return results;
}
