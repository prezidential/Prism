import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { IdentityEventEnvelope } from "../../messages/envelope.js";
import type { OktaUserPayload } from "../../messages/okta.js";

// We mock all external dependencies before importing the agent
vi.mock("../client.js", () => {
  class MockOktaClient {
    listUsers = vi.fn().mockImplementation(async function* () {
      yield {
        id: "okta-001",
        status: "ACTIVE",
        created: "2024-01-01T00:00:00.000Z",
        lastUpdated: "2024-06-01T00:00:00.000Z",
        profile: {
          login: "test@example.com",
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          displayName: "Test User",
        },
      };
    });
    getUser = vi.fn();
    getUserGroups = vi.fn();
    listGroups = vi.fn();
    listGroupMembers = vi.fn();
  }
  return { OktaClient: vi.fn().mockImplementation(class extends MockOktaClient {}) };
});

vi.mock("../../kafka/producer.js", () => {
  return {
    KafkaProducer: vi.fn().mockImplementation(class {
      connect = vi.fn().mockResolvedValue(undefined);
      disconnect = vi.fn().mockResolvedValue(undefined);
      publish = vi.fn().mockResolvedValue(undefined);
    }),
  };
});

vi.mock("../../graph/write-service.js", () => {
  return {
    ArcadeGraphWriteService: vi.fn().mockImplementation(class {
      upsertVertex = vi.fn().mockResolvedValue({ nodeId: "#1:0", created: true });
      upsertEdge = vi.fn().mockResolvedValue(undefined);
      findByExternalId = vi.fn().mockResolvedValue(null);
    }),
  };
});

// Mock fastify to avoid starting real server
vi.mock("fastify", () => {
  return {
    default: vi.fn().mockReturnValue({
      register: vi.fn().mockResolvedValue(undefined),
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      log: { error: vi.fn(), info: vi.fn() },
    }),
  };
});

// Import after mocks
const { OktaIngestAgent } = await import("../agent.js");

const testConfig = {
  tenantId: "prism-dev",
  sourceSystemId: "okta-dev",
  okta: {
    domain: "dev-test.okta.com",
    token: "ssws-test-token",
  },
  kafka: {
    brokers: ["localhost:9092"],
    clientId: "test-agent",
  },
  arcadedb: {
    url: "http://localhost:2480",
    db: "prism",
    user: "root",
    pass: "secret",
  },
  syncIntervalMs: 999_999_999, // very long - won't fire in tests
};

describe("OktaIngestAgent", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("healthCheck", () => {
    it("returns { healthy: true } when Okta client returns users", async () => {
      const agent = new OktaIngestAgent(testConfig);
      const result = await agent.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.details).toBeDefined();
    });

    it("returns { healthy: false } when Okta client throws", async () => {
      const { OktaClient } = await import("../client.js");
      vi.mocked(OktaClient).mockImplementationOnce(class {
        listUsers = vi.fn().mockImplementation(async function* () {
          throw new Error("Okta unreachable");
          // eslint-disable-next-line no-unreachable
          yield undefined as never;
        });
        getUser = vi.fn();
        getUserGroups = vi.fn();
        listGroups = vi.fn();
        listGroupMembers = vi.fn();
      });

      const agent = new OktaIngestAgent(testConfig);
      const result = await agent.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.details["error"]).toBeDefined();
    });
  });

  describe("start", () => {
    it("connects Kafka and calls runFullDiscovery", async () => {
      const agent = new OktaIngestAgent(testConfig);

      // We can spy on runFullDiscovery via start()
      await agent.start();

      const { KafkaProducer } = await import("../../kafka/producer.js");
      const producerInstance = vi.mocked(KafkaProducer).mock.results[0]?.value as {
        connect: ReturnType<typeof vi.fn>;
        publish: ReturnType<typeof vi.fn>;
      };

      expect(producerInstance.connect).toHaveBeenCalledOnce();
      // Full sync should have published at least one event
      expect(producerInstance.publish).toHaveBeenCalled();

      await agent.stop();
    });
  });

  describe("stop", () => {
    it("sets state to terminated and disconnects Kafka", async () => {
      const agent = new OktaIngestAgent(testConfig);
      await agent.start();
      await agent.stop();

      expect(agent.status().state).toBe("terminated");

      const { KafkaProducer } = await import("../../kafka/producer.js");
      const producerInstance = vi.mocked(KafkaProducer).mock.results[0]?.value as {
        disconnect: ReturnType<typeof vi.fn>;
      };
      expect(producerInstance.disconnect).toHaveBeenCalledOnce();
    });
  });

  describe("handleWebhookEvent", () => {
    it("calls upsertVertex on ArcadeGraphWriteService for identity.discovered", async () => {
      const agent = new OktaIngestAgent(testConfig);
      // Connect kafka so publish doesn't fail
      const { KafkaProducer } = await import("../../kafka/producer.js");
      const producerInstance = vi.mocked(KafkaProducer).mock.results[0]?.value as {
        connect: ReturnType<typeof vi.fn>;
        publish: ReturnType<typeof vi.fn>;
      };
      await producerInstance.connect();

      const mockEnvelope: IdentityEventEnvelope<OktaUserPayload> = {
        eventId: "evt-001",
        eventType: "identity.discovered",
        timestamp: "2024-06-01T00:00:00.000Z",
        sourceAgent: "okta-ingest-agent",
        sourceSystemId: "okta-dev",
        correlationId: "okta-usr-001",
        tenantId: "prism-dev",
        schemaVersion: "1.0",
        payload: {
          sourceId: "okta-usr-001",
          login: "test@example.com",
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          displayName: "Test User",
          status: "ACTIVE",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-06-01T00:00:00.000Z",
          rawProfile: {},
        },
      };

      await agent.handleWebhookEvent(mockEnvelope as IdentityEventEnvelope);

      const { ArcadeGraphWriteService } = await import("../../graph/write-service.js");
      const graphInstance = vi.mocked(ArcadeGraphWriteService).mock.results[0]?.value as {
        upsertVertex: ReturnType<typeof vi.fn>;
      };

      expect(graphInstance.upsertVertex).toHaveBeenCalledWith(
        "HumanIdentity",
        "prism-dev",
        "okta-usr-001",
        "externalIds.okta",
        expect.objectContaining({ email: "test@example.com" }),
      );
    });
  });

  describe("status", () => {
    it("reports sourceSystemId correctly", () => {
      const agent = new OktaIngestAgent(testConfig);
      expect(agent.status().sourceSystemId).toBe("okta-dev");
    });

    it("reports initializing state before start", () => {
      const agent = new OktaIngestAgent(testConfig);
      expect(agent.status().state).toBe("initializing");
    });
  });
});
