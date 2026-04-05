import { describe, it, expect } from "vitest";
import { buildEnvelope, type IdentityEventEnvelope, type EventType } from "../envelope.js";

const baseFields: Omit<IdentityEventEnvelope<{ value: string }>, "eventId" | "schemaVersion"> = {
  eventType: "identity.discovered" as EventType,
  timestamp: "2026-04-05T00:00:00.000Z",
  sourceAgent: "okta-ingest-agent",
  sourceSystemId: "okta-dev",
  correlationId: "corr-001",
  tenantId: "prism-dev",
  payload: { value: "test" },
};

describe("buildEnvelope", () => {
  it("sets schemaVersion to '1.0' always", () => {
    const envelope = buildEnvelope(baseFields);
    expect(envelope.schemaVersion).toBe("1.0");
  });

  it("generates a non-empty UUID for eventId", () => {
    const envelope = buildEnvelope(baseFields);
    expect(typeof envelope.eventId).toBe("string");
    expect(envelope.eventId.length).toBeGreaterThan(0);
    // UUID v4 pattern
    expect(envelope.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("produces different eventId values on successive calls with identical inputs", () => {
    const envelope1 = buildEnvelope(baseFields);
    const envelope2 = buildEnvelope(baseFields);
    expect(envelope1.eventId).not.toBe(envelope2.eventId);
  });

  it("preserves all required fields from the input", () => {
    const envelope = buildEnvelope(baseFields);
    expect(envelope.eventType).toBe(baseFields.eventType);
    expect(envelope.timestamp).toBe(baseFields.timestamp);
    expect(envelope.sourceAgent).toBe(baseFields.sourceAgent);
    expect(envelope.sourceSystemId).toBe(baseFields.sourceSystemId);
    expect(envelope.correlationId).toBe(baseFields.correlationId);
    expect(envelope.tenantId).toBe(baseFields.tenantId);
    expect(envelope.payload).toEqual(baseFields.payload);
  });

  it("includes all required envelope fields in the output", () => {
    const envelope = buildEnvelope(baseFields);
    const requiredKeys: (keyof IdentityEventEnvelope)[] = [
      "eventId",
      "eventType",
      "timestamp",
      "sourceAgent",
      "sourceSystemId",
      "correlationId",
      "tenantId",
      "schemaVersion",
      "payload",
    ];
    for (const key of requiredKeys) {
      expect(envelope).toHaveProperty(key);
    }
  });
});
