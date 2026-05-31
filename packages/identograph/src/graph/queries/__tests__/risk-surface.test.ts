import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArcadeClient } from "../../../db/client.js";
import { queryRiskSurface } from "../risk-surface.js";

const CONFIG = { url: "http://localhost:2480", database: "idem", user: "root", password: "secret" };

function mockFetch(...responses: unknown[]) {
  let call = 0;
  return vi.fn().mockImplementation(() => {
    const response = responses[Math.min(call++, responses.length - 1)];
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => response,
      text: async () => JSON.stringify(response),
    });
  });
}

describe("queryRiskSurface()", () => {
  let client: ArcadeClient;

  beforeEach(() => {
    client = new ArcadeClient(CONFIG);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns identities above the threshold with their signals", async () => {
    const riskyIdentity = { id: "nh-1", nodeType: "NHIdentity", riskScore: 0.85, status: "Active" };
    const signal = {
      id: "sig-1",
      jti: "jti-1",
      caepEventType: "credential-change",
      eventTypeUri: "https://schemas.openid.net/secevent/caep/event-type/credential-change",
      score: 0.85,
      severity: "critical",
      iat: "2026-05-31T00:00:00Z",
      resolvedAt: null,
    };

    // 6 identity type queries: first returns the risky identity, rest return empty
    // Then 1 signal query for the risky identity
    vi.stubGlobal(
      "fetch",
      mockFetch(
        { result: [riskyIdentity] }, // HumanIdentity
        { result: [] },              // AgentIdentity
        { result: [] },              // NHIdentity (already covered by HumanIdentity mock above)
        { result: [] },              // ServiceAccount
        { result: [] },              // APIToken
        { result: [] },              // WorkloadIdentity
        { result: [signal] },        // RiskSignal for nh-1
      ),
    );

    const results = await queryRiskSurface(client, "t1", 0.7);

    expect(results).toHaveLength(1);
    expect(results[0]?.identityId).toBe("nh-1");
    expect(results[0]?.riskScore).toBe(0.85);
    expect(results[0]?.signals).toHaveLength(1);
    expect(results[0]?.highestSeverity).toBe("critical");
  });

  it("returns empty array when no identities exceed threshold", async () => {
    // All 6 identity type queries return empty
    vi.stubGlobal("fetch", mockFetch({ result: [] }));

    const results = await queryRiskSurface(client, "t1", 0.9);
    expect(results).toHaveLength(0);
  });

  it("clamps threshold to 0–1 range", async () => {
    const mockFetchFn = mockFetch({ result: [] });
    vi.stubGlobal("fetch", mockFetchFn);

    // threshold = 1.5 should be clamped to 1.0
    await queryRiskSurface(client, "t1", 1.5);

    const [, init] = mockFetchFn.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { command: string };
    expect(body.command).toContain("riskScore >= 1");
  });
});
