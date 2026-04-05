import { describe, it, expect, vi, beforeEach, type MockInstance } from "vitest";

// Mock kafkajs before importing the producer
vi.mock("kafkajs", () => {
  const mockSend = vi.fn().mockResolvedValue(undefined);
  const mockConnect = vi.fn().mockResolvedValue(undefined);
  const mockDisconnect = vi.fn().mockResolvedValue(undefined);

  const mockProducer = {
    connect: mockConnect,
    disconnect: mockDisconnect,
    send: mockSend,
  };

  const MockKafka = vi.fn().mockImplementation(() => ({
    producer: vi.fn().mockReturnValue(mockProducer),
  }));

  return { Kafka: MockKafka };
});

import { KafkaProducer } from "../producer.js";
import { TOPICS } from "../topics.js";
import { buildEnvelope } from "../../messages/envelope.js";

// Access the mocked kafkajs internals
async function getMockProducer() {
  const kafkajs = await import("kafkajs");
  const KafkaMock = kafkajs.Kafka as unknown as ReturnType<typeof vi.fn>;
  const kafkaInstance = KafkaMock.mock.results[0]?.value as {
    producer: ReturnType<typeof vi.fn>;
  };
  return kafkaInstance.producer.mock.results[0]?.value as {
    connect: MockInstance;
    disconnect: MockInstance;
    send: MockInstance;
  };
}

describe("KafkaProducer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("connect() calls the underlying kafkajs producer connect() exactly once", async () => {
    const producer = new KafkaProducer({ brokers: ["localhost:9092"], clientId: "test" });
    await producer.connect();

    const mock = await getMockProducer();
    expect(mock.connect).toHaveBeenCalledTimes(1);
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

    const mock = await getMockProducer();
    expect(mock.send).toHaveBeenCalledTimes(1);
    const callArgs = mock.send.mock.calls[0]?.[0] as { topic: string; messages: Array<{ value: string }> };
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

    const mock = await getMockProducer();
    const callArgs = mock.send.mock.calls[0]?.[0] as {
      messages: Array<{ key: string | undefined }>;
    };
    expect(callArgs.messages[0]?.key).toBe("user-123");
  });

  it("disconnect() calls the underlying kafkajs producer disconnect()", async () => {
    const producer = new KafkaProducer({ brokers: ["localhost:9092"], clientId: "test" });
    await producer.connect();
    await producer.disconnect();

    const mock = await getMockProducer();
    expect(mock.disconnect).toHaveBeenCalledTimes(1);
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
