import { describe, it, expect, vi, beforeEach } from "vitest";
import { CorrelationEngine, type CorrelationCandidate } from "../engine.js";
import type { ArcadeClient } from "@prism/identograph/dist/db/client.js";

function makeMockDb(queryResults: Record<string, Array<{ id: string }>>): ArcadeClient {
  const mock = {
    query: vi.fn().mockImplementation(async (sql: string) => {
      // Match the SQL to determine which result to return
      for (const [key, result] of Object.entries(queryResults)) {
        if (sql.includes(key)) {
          return result;
        }
      }
      return [];
    }),
    command: vi.fn(),
    insertVertex: vi.fn(),
    insertEdge: vi.fn(),
    count: vi.fn(),
    escape: vi.fn(),
  } as unknown as ArcadeClient;
  return mock;
}

describe("CorrelationEngine", () => {
  const tenantId = "prism-dev";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns exact_email match when query returns a user with matching email", async () => {
    const db = makeMockDb({
      "alice@example.com": [{ id: "node-001" }],
    });
    const engine = new CorrelationEngine(db, tenantId);

    const result = await engine.correlate({
      email: "alice@example.com",
      sourceSystemId: "okta-dev",
      externalId: "okta-user-1",
    });

    expect(result.matched).toBe(true);
    expect(result.matchType).toBe("exact_email");
    expect(result.existingNodeId).toBe("node-001");
    expect(result.confidence).toBe(1.0);
  });

  it("returns exact_employee_id when email misses but employeeId matches", async () => {
    const db = makeMockDb({
      "EMP-999": [{ id: "node-002" }],
    });
    const engine = new CorrelationEngine(db, tenantId);

    const result = await engine.correlate({
      email: "nobody@example.com",
      employeeId: "EMP-999",
      sourceSystemId: "okta-dev",
      externalId: "okta-user-2",
    });

    expect(result.matched).toBe(true);
    expect(result.matchType).toBe("exact_employee_id");
    expect(result.existingNodeId).toBe("node-002");
    expect(result.confidence).toBe(1.0);
  });

  it("returns exact_sso_subject when email and employeeId miss but ssoSubject matches", async () => {
    const db = makeMockDb({
      "bob@sso.example.com": [{ id: "node-003" }],
    });
    const engine = new CorrelationEngine(db, tenantId);

    const result = await engine.correlate({
      email: "nobody@example.com",
      employeeId: "EMP-000",
      ssoSubject: "bob@sso.example.com",
      sourceSystemId: "okta-dev",
      externalId: "okta-user-3",
    });

    expect(result.matched).toBe(true);
    expect(result.matchType).toBe("exact_sso_subject");
    expect(result.existingNodeId).toBe("node-003");
    expect(result.confidence).toBe(1.0);
  });

  it("returns no_match when all queries return empty arrays", async () => {
    const db = makeMockDb({});
    const engine = new CorrelationEngine(db, tenantId);

    const result = await engine.correlate({
      email: "ghost@example.com",
      employeeId: "EMP-404",
      ssoSubject: "ghost@sso.example.com",
      sourceSystemId: "okta-dev",
      externalId: "okta-user-ghost",
    });

    expect(result.matched).toBe(false);
    expect(result.matchType).toBe("no_match");
    expect(result.existingNodeId).toBeUndefined();
    expect(result.confidence).toBe(0.0);
  });

  it("short-circuits on first match - does not query for employeeId if email matched", async () => {
    const mockQuery = vi.fn().mockResolvedValue([{ id: "node-001" }]);
    const db = { query: mockQuery } as unknown as ArcadeClient;
    const engine = new CorrelationEngine(db, tenantId);

    const candidate: CorrelationCandidate = {
      email: "alice@example.com",
      employeeId: "EMP-001",
      sourceSystemId: "okta-dev",
      externalId: "okta-1",
    };

    const result = await engine.correlate(candidate);

    expect(result.matched).toBe(true);
    expect(result.matchType).toBe("exact_email");
    // Only one query should have been made (email match short-circuits)
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("existingNodeId is the id field from the ArcadeDB result", async () => {
    const db = makeMockDb({
      "charlie@example.com": [{ id: "arcade-vertex-xyz" }],
    });
    const engine = new CorrelationEngine(db, tenantId);

    const result = await engine.correlate({
      email: "charlie@example.com",
      sourceSystemId: "okta-dev",
      externalId: "okta-charlie",
    });

    expect(result.existingNodeId).toBe("arcade-vertex-xyz");
  });

  it("confidence is 1.0 when matched", async () => {
    const db = makeMockDb({
      "match@example.com": [{ id: "node-match" }],
    });
    const engine = new CorrelationEngine(db, tenantId);

    const result = await engine.correlate({
      email: "match@example.com",
      sourceSystemId: "okta-dev",
      externalId: "okta-match",
    });

    expect(result.confidence).toBe(1.0);
  });

  it("confidence is 0.0 when not matched", async () => {
    const db = makeMockDb({});
    const engine = new CorrelationEngine(db, tenantId);

    const result = await engine.correlate({
      email: "nobody@example.com",
      sourceSystemId: "okta-dev",
      externalId: "okta-nobody",
    });

    expect(result.confidence).toBe(0.0);
  });
});
