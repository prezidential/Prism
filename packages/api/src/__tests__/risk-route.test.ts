import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArcadeClient } from "../db/client.js";
import type { RiskQueryFn } from "../routes/risk.js";
import { buildServer } from "../server.js";

function makeMockDb(): ArcadeClient {
  return {
    query: vi.fn().mockResolvedValue([]),
    escape: (v: string) => `'${v}'`,
  } as unknown as ArcadeClient;
}

describe("GET /api/v1/risk/identities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns identities from the injected risk query", async () => {
    const riskQuery: RiskQueryFn = vi
      .fn()
      .mockResolvedValue([{ identityId: "a1", riskScore: 0.9 }]);
    const app = await buildServer(makeMockDb(), { riskQuery });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/risk/identities?tenantId=t1",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { tenantId: string; count: number; identities: unknown[] };
    expect(body.tenantId).toBe("t1");
    expect(body.count).toBe(1);
    expect(riskQuery).toHaveBeenCalledWith("t1", {});
  });

  it("forwards threshold and limit to the risk query", async () => {
    const riskQuery: RiskQueryFn = vi.fn().mockResolvedValue([]);
    const app = await buildServer(makeMockDb(), { riskQuery });

    await app.inject({
      method: "GET",
      url: "/api/v1/risk/identities?tenantId=t1&threshold=0.5&limit=10",
    });

    expect(riskQuery).toHaveBeenCalledWith("t1", { threshold: 0.5, limit: 10 });
  });

  it("400s when tenantId is missing", async () => {
    const app = await buildServer(makeMockDb(), { riskQuery: vi.fn() });
    const res = await app.inject({ method: "GET", url: "/api/v1/risk/identities" });
    expect(res.statusCode).toBe(400);
  });

  it("400s on an out-of-range threshold", async () => {
    const app = await buildServer(makeMockDb(), { riskQuery: vi.fn() });
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/risk/identities?tenantId=t1&threshold=2",
    });
    expect(res.statusCode).toBe(400);
  });

  it("501s when no risk query is configured", async () => {
    const app = await buildServer(makeMockDb());
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/risk/identities?tenantId=t1",
    });
    expect(res.statusCode).toBe(501);
  });
});
