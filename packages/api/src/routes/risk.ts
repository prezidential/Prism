// REST routes for risk data.
//
// The actual risk query lives in @prism/risk-engine. To keep this route in the
// api package's rootDir-constrained compile (and unit-testable without a live
// graph), the query is INJECTED as `RiskQueryFn` rather than imported here. The
// real function is wired in the process entrypoint (`index.ts`).

import type { FastifyInstance } from "fastify";

// Injected risk query — returns identities at/above a threshold, highest first.
// Shape is intentionally a passthrough (`unknown[]`) so this module stays
// decoupled from risk-engine's concrete types.
export type RiskQueryFn = (
  tenantId: string,
  options: { threshold?: number; limit?: number },
) => Promise<unknown[]>;

interface RiskQueryString {
  tenantId?: string;
  threshold?: string;
  limit?: string;
}

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function registerRiskRoutes(app: FastifyInstance, riskQuery?: RiskQueryFn): void {
  app.get("/api/v1/risk/identities", async (request, reply) => {
    const q = request.query as RiskQueryString;

    const tenantId = q.tenantId?.trim();
    if (!tenantId) {
      return reply.code(400).send({ error: "query parameter `tenantId` is required" });
    }

    if (!riskQuery) {
      return reply
        .code(501)
        .send({ error: "risk query is not configured on this server instance" });
    }

    const threshold = parseNumber(q.threshold);
    if (threshold !== undefined && (threshold < 0 || threshold > 1)) {
      return reply.code(400).send({ error: "`threshold` must be between 0 and 1" });
    }

    const limit = parseNumber(q.limit);
    if (limit !== undefined && limit < 1) {
      return reply.code(400).send({ error: "`limit` must be >= 1" });
    }

    const identities = await riskQuery(tenantId, {
      ...(threshold !== undefined ? { threshold } : {}),
      ...(limit !== undefined ? { limit: Math.floor(limit) } : {}),
    });

    return reply.send({ tenantId, count: identities.length, identities });
  });
}
