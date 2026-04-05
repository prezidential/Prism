import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSend = vi.fn().mockResolvedValue(undefined);
const mockProducerConnect = vi.fn().mockResolvedValue(undefined);
const mockProducerDisconnect = vi.fn().mockResolvedValue(undefined);

const mockProducerInstance = {
  connect: mockProducerConnect,
  disconnect: mockProducerDisconnect,
  send: mockSend,
};

const mockKafkaProducerFactory = vi.fn().mockReturnValue(mockProducerInstance);

vi.mock("kafkajs", () => {
  return {
    Kafka: class MockKafka {
      producer() {
        return mockKafkaProducerFactory();
      }
    },
  };
});

import { KafkaProducer } from "../producer.js";
import { TOPICS } from "../topics.js";
import { buildEnvelope } from "../../messages/envelope.js";

describe("KafkaProducer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockKafkaProducerFactory.mockReturnValue(mockProducerInstance);
    mockProducerConnect.mockResolvedValue(undefined);
    mockProducerDisconnect.mockResolvedValue(undefined);
    mockSend.mockResolvedValue(undefined);
  });

  it("connect() calls the underlying kafkajs producer connect() exactly once", async () => {
    const producer = new KafkaProducer({ brokers: ["localhost:9092"], clientId: "test" });
    await producer.connect();

    expect(mockProducerConnect).toHaveBeenCalledTimes(1);
  });

  it("publish() sends message to correct topic with JSON-serialized envelope value", async () => {
    const producer = new KafkaProducer({ brokers: ["localhost:9092"], clientId: "test" });
    await producer.connect();

    const envelope = buildEnvelope({
      eventType: "identity.discovered",
      timestamp: "2026-04-05T00:00:00.000Z",
      sourceAgent: "test-agent",
      sourceSystemId: "okta-dev",
      correlationId: "corr-001",
      tenantId: "prism-dev",
      payload: { hello: "world" },
    });

    await producer.publish(TOPICS.IDENTITY_EVENTS_RAW, envelope);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0]?.[0] as {
      topic: string;
      messages: Array<{ value: string }>;
    };
    expect(callArgs.topic).toBe(TOPICS.IDENTITY_EVENTS_RAW);
    expect(JSON.parse(callArgs.messages[0]?.value ?? "{}")).toEqual(envelope);
  });

  it("publish() uses opts.key as the Kafka message key", async () => {
    const producer = new KafkaProducer({ brokers: ["localhost:9092"], clientId: "test" });
    await producer.connect();

    const envelope = buildEnvelope({
      eventType: "identity.discovered",
      timestamp: "2026-04-05T00:00:00.000Z",
      sourceAgent: "test-agent",
      sourceSystemId: "okta-dev",
      correlationId: "corr-002",
      tenantId: "prism-dev",
      payload: {},
    });

    await producer.publish(TOPICS.IDENTITY_EVENTS_RAW, envelope, { key: "user-123" });

    const callArgs = mockSend.mock.calls[0]?.[0] as {
      messages: Array<{ key: string | undefined }>;
    };
    expect(callArgs.messages[0]?.key).toBe("user-123");
  });

  it("disconnect() calls the underlying kafkajs producer disconnect()", async () => {
    const producer = new KafkaProducer({ brokers: ["localhost:9092"], clientId: "test" });
    await producer.connect();
    await producer.disconnect();

    expect(mockProducerDisconnect).toHaveBeenCalledTimes(1);
  });

  it("publish() throws if called before connect()", async () => {
    const producer = new KafkaProducer({ brokers: ["localhost:9092"], clientId: "test" });

    const envelope = buildEnvelope({
      eventType: "identity.discovered",
      timestamp: "2026-04-05T00:00:00.000Z",
      sourceAgent: "test-agent",
      sourceSystemId: "okta-dev",
      correlationId: "corr-003",
      tenantId: "prism-dev",
      payload: {},
    });

    await expect(
      producer.publish(TOPICS.IDENTITY_EVENTS_RAW, envelope),
    ).rejects.toThrow();
  });
});
