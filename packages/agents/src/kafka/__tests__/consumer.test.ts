import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IdentityEventEnvelope } from "../../messages/envelope.js";

// We capture the eachMessage handler here so tests can invoke it
let capturedEachMessage:
  | ((ctx: {
      topic: string;
      partition: number;
      message: { value: Buffer | null; offset: string };
    }) => Promise<void>)
  | null = null;

const mockCommitOffsets = vi.fn().mockResolvedValue(undefined);
const mockRun = vi.fn().mockImplementation(
  async (opts: {
    autoCommit: boolean;
    eachMessage: (ctx: {
      topic: string;
      partition: number;
      message: { value: Buffer | null; offset: string };
    }) => Promise<void>;
  }) => {
    capturedEachMessage = opts.eachMessage;
  },
);
const mockSubscribeConsumer = vi.fn().mockResolvedValue(undefined);
const mockConsumerConnect = vi.fn().mockResolvedValue(undefined);
const mockConsumerDisconnect = vi.fn().mockResolvedValue(undefined);

const mockConsumerInstance = {
  connect: mockConsumerConnect,
  disconnect: mockConsumerDisconnect,
  subscribe: mockSubscribeConsumer,
  run: mockRun,
  commitOffsets: mockCommitOffsets,
};

const mockKafkaConsumerFactory = vi.fn().mockReturnValue(mockConsumerInstance);

vi.mock("kafkajs", () => {
  return {
    Kafka: class MockKafka {
      consumer(_opts: { groupId: string }) {
        return mockKafkaConsumerFactory();
      }
    },
  };
});

import { KafkaConsumer } from "../consumer.js";
import { TOPICS } from "../topics.js";

describe("KafkaConsumer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedEachMessage = null;
    mockKafkaConsumerFactory.mockReturnValue(mockConsumerInstance);
    mockConsumerConnect.mockResolvedValue(undefined);
    mockConsumerDisconnect.mockResolvedValue(undefined);
    mockSubscribeConsumer.mockResolvedValue(undefined);
    mockCommitOffsets.mockResolvedValue(undefined);
    mockRun.mockImplementation(
      async (opts: {
        autoCommit: boolean;
        eachMessage: (ctx: {
          topic: string;
          partition: number;
          message: { value: Buffer | null; offset: string };
        }) => Promise<void>;
      }) => {
        capturedEachMessage = opts.eachMessage;
      },
    );
  });

  it("subscribe() calls the underlying kafkajs consumer.run()", async () => {
    const consumer = new KafkaConsumer({
      brokers: ["localhost:9092"],
      clientId: "test",
      groupId: "test-group",
    });
    await consumer.connect();
    await consumer.subscribe(TOPICS.IDENTITY_EVENTS_RAW, vi.fn());

    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it("message handler deserializes JSON before calling the user-provided handler", async () => {
    const consumer = new KafkaConsumer({
      brokers: ["localhost:9092"],
      clientId: "test",
      groupId: "test-group",
    });
    await consumer.connect();

    const userHandler = vi.fn().mockResolvedValue(undefined);
    await consumer.subscribe(TOPICS.IDENTITY_EVENTS_RAW, userHandler);

    const envelope: IdentityEventEnvelope<{ userId: string }> = {
      eventId: "evt-001",
      eventType: "identity.discovered",
      timestamp: "2026-04-05T00:00:00.000Z",
      sourceAgent: "test-agent",
      sourceSystemId: "okta-dev",
      correlationId: "corr-001",
      tenantId: "prism-dev",
      schemaVersion: "1.0",
      payload: { userId: "u1" },
    };

    if (capturedEachMessage === null) throw new Error("eachMessage not captured");

    await capturedEachMessage({
      topic: TOPICS.IDENTITY_EVENTS_RAW,
      partition: 0,
      message: { value: Buffer.from(JSON.stringify(envelope)), offset: "5" },
    });

    expect(userHandler).toHaveBeenCalledTimes(1);
    const [receivedEnvelope] = userHandler.mock.calls[0] as [
      IdentityEventEnvelope<unknown>,
      () => Promise<void>,
    ];
    expect(receivedEnvelope).toEqual(envelope);
  });

  it("ack callback calls commitOffsets for the specific message", async () => {
    const consumer = new KafkaConsumer({
      brokers: ["localhost:9092"],
      clientId: "test",
      groupId: "test-group",
    });
    await consumer.connect();

    let capturedAck: (() => Promise<void>) | undefined;
    const userHandler = vi.fn().mockImplementation(
      async (_env: IdentityEventEnvelope<unknown>, ack: () => Promise<void>) => {
        capturedAck = ack;
      },
    );

    await consumer.subscribe(TOPICS.IDENTITY_EVENTS_RAW, userHandler);

    if (capturedEachMessage === null) throw new Error("eachMessage not captured");

    const envelope: IdentityEventEnvelope<unknown> = {
      eventId: "evt-002",
      eventType: "identity.discovered",
      timestamp: "2026-04-05T00:00:00.000Z",
      sourceAgent: "test-agent",
      sourceSystemId: "okta-dev",
      correlationId: "corr-002",
      tenantId: "prism-dev",
      schemaVersion: "1.0",
      payload: {},
    };

    await capturedEachMessage({
      topic: TOPICS.IDENTITY_EVENTS_RAW,
      partition: 2,
      message: { value: Buffer.from(JSON.stringify(envelope)), offset: "10" },
    });

    expect(capturedAck).toBeDefined();
    await capturedAck!();

    expect(mockCommitOffsets).toHaveBeenCalledTimes(1);
    const commitCall = mockCommitOffsets.mock.calls[0]?.[0] as Array<{
      topic: string;
      partition: number;
      offset: string;
    }>;
    expect(commitCall[0]?.topic).toBe(TOPICS.IDENTITY_EVENTS_RAW);
    expect(commitCall[0]?.partition).toBe(2);
    expect(commitCall[0]?.offset).toBe("11");
  });

  it("does NOT commit offset if handler throws", async () => {
    const consumer = new KafkaConsumer({
      brokers: ["localhost:9092"],
      clientId: "test",
      groupId: "test-group",
    });
    await consumer.connect();

    const throwingHandler = vi.fn().mockRejectedValue(new Error("handler error"));
    await consumer.subscribe(TOPICS.IDENTITY_EVENTS_RAW, throwingHandler);

    if (capturedEachMessage === null) throw new Error("eachMessage not captured");

    const envelope: IdentityEventEnvelope<unknown> = {
      eventId: "evt-003",
      eventType: "identity.discovered",
      timestamp: "2026-04-05T00:00:00.000Z",
      sourceAgent: "test-agent",
      sourceSystemId: "okta-dev",
      correlationId: "corr-003",
      tenantId: "prism-dev",
      schemaVersion: "1.0",
      payload: {},
    };

    await expect(
      capturedEachMessage({
        topic: TOPICS.IDENTITY_EVENTS_RAW,
        partition: 0,
        message: { value: Buffer.from(JSON.stringify(envelope)), offset: "20" },
      }),
    ).rejects.toThrow("handler error");

    expect(mockCommitOffsets).not.toHaveBeenCalled();
  });
});
