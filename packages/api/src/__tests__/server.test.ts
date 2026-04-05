import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArcadeClient } from "../db/client.js";
import { buildServer } from "../server.js";

function makeMockDb(defaultRows: unknown[] = []): ArcadeClient {
  return {
    query: vi.fn().mockResolvedValue(defaultRows),
    escape: (v: string) => `'${v}'`,
  } as unknown as ArcadeClient;
}

describe("Fastify server", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Health check
  // -------------------------------------------------------------------------

  describe("GET /health", () => {
    it("returns 200 with status ok", async () => {
      const app = await buildServer(makeMockDb());
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ status: string; service: string }>();
      expect(body.status).toBe("ok");
      expect(body.service).toBe("@prism/api");
    });
  });

  // -------------------------------------------------------------------------
  // GraphQL introspection
  // -------------------------------------------------------------------------

  describe("POST /graphql - introspection", () => {
    it("responds to a basic introspection query", async () => {
      const app = await buildServer(makeMockDb());
      const res = await app.inject({
        method: "POST",
        url: "/graphql",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "{ __schema { queryType { name } } }",
        }),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { __schema: { queryType: { name: string } } } }>();
      expect(body.data.__schema.queryType.name).toBe("Query");
    });
  });

  // -------------------------------------------------------------------------
  // stats query
  // -------------------------------------------------------------------------

  describe("POST /graphql - stats query", () => {
    it("returns stats with the correct shape", async () => {
      // 8 count queries - one per node type
      let call = 0;
      const counts = [500, 200, 50, 12, 15, 120, 8, 10];
      const db = {
        query: vi.fn().mockImplementation(() =>
          Promise.resolve([{ count: counts[call++] ?? 0 }]),
        ),
        escape: (v: string) => `'${v}'`,
      } as unknown as ArcadeClient;

      const app = await buildServer(db);
      const res = await app.inject({
        method: "POST",
        url: "/graphql",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `{
            stats {
              tenantId
              humanCount
              serviceAccountCount
              agentCount
              applicationCount
              resourceCount
              roleCount
              groupCount
              orgUnitCount
            }
          }`,
        }),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{
        data: {
          stats: {
            tenantId: string;
            humanCount: number;
            serviceAccountCount: number;
          };
        };
      }>();
      expect(body.data.stats.humanCount).toBe(500);
      expect(body.data.stats.serviceAccountCount).toBe(200);
      expect(body.data.stats.agentCount).toBe(50);
    });
  });

  // -------------------------------------------------------------------------
  // humans query
  // -------------------------------------------------------------------------

  describe("POST /graphql - humans query", () => {
    it("returns the humans list", async () => {
      const mockHumans = [
        { id: "1", name: "Alice", nodeType: "HumanIdentity", tenantId: "prism-dev",
          status: "Active", riskScore: 0.1, lastActivity: null,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          tags: [], email: "alice@corp.example.com", employeeId: "EMP-001",
          jobTitle: "Engineer", department: "Engineering", location: "NYC",
          employmentType: "FTE", hireDate: "2020-01-01", externalIds: {} },
      ];
      const app = await buildServer(makeMockDb(mockHumans));

      const res = await app.inject({
        method: "POST",
        url: "/graphql",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "{ humans { id name email status } }",
        }),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { humans: Array<{ id: string; name: string }> } }>();
      expect(body.data.humans).toHaveLength(1);
      expect(body.data.humans[0]?.id).toBe("1");
      expect(body.data.humans[0]?.name).toBe("Alice");
    });
  });

  // -------------------------------------------------------------------------
  // agentIdentities query
  // -------------------------------------------------------------------------

  describe("POST /graphql - agentIdentities query", () => {
    it("returns the agents list", async () => {
      const mockAgents = [
        { id: "a1", agentType: "prism-ingest-agent", model: "claude-sonnet-4-6",
          nodeType: "AgentIdentity", tenantId: "prism-dev", status: "Active",
          riskScore: 0.2, lastActivity: null, createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(), tags: [], spawnedAt: new Date().toISOString(),
          maxLifetimeSeconds: 86400, credentialType: "OIDC",
          credentialRef: "vault/secret/agents/prism-dev/ingest-0", externalIds: {} },
      ];
      const app = await buildServer(makeMockDb(mockAgents));

      const res = await app.inject({
        method: "POST",
        url: "/graphql",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "{ agentIdentities { id agentType model status } }",
        }),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{
        data: { agentIdentities: Array<{ id: string; agentType: string }> };
      }>();
      expect(body.data.agentIdentities).toHaveLength(1);
      expect(body.data.agentIdentities[0]?.agentType).toBe("prism-ingest-agent");
    });
  });

  // -------------------------------------------------------------------------
  // GraphiQL UI
  // -------------------------------------------------------------------------

  describe("GET /graphiql", () => {
    it("serves the GraphiQL UI", async () => {
      const app = await buildServer(makeMockDb());
      const res = await app.inject({ method: "GET", url: "/graphiql" });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
    });
  });
});
