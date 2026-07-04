import { describe, expect, it, vi } from "vitest";
import { InMemoryDeadLetterQueue } from "../../dlq/dead-letter-queue.js";
import type { IdentityEventEnvelope } from "../../messages/envelope.js";
import { RiskEvaluationConsumer, type RiskEvalSummary } from "../consumer.js";

const SUMMARY: RiskEvalSummary = { findingCount: 1, signalsWritten: 1, scoresPersisted: 1 };

function event(tenantId: string): IdentityEventEnvelope {
  return {
    eventId: "e1",
    eventType: "identity.updated",
    timestamp: "2026-07-04T00:00:00Z",
    sourceAgent: "test",
    sourceSystemId: "sys",
    correlationId: "c1",
    tenantId,
    schemaVersion: "1.0",
    payload: {},
  };
}

// A controllable evaluate: each call returns a promise resolved manually.
function deferredEvaluate() {
  const resolvers: Array<() => void> = [];
  const fn = vi.fn().mockImplementation(
    () =>
      new Promise<RiskEvalSummary>((resolve) => {
        resolvers.push(() => resolve(SUMMARY));
      }),
  );
  return { fn, resolveNext: () => resolvers.shift()?.() };
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe("RiskEvaluationConsumer", () => {
  it("evaluates the tenant of an incoming event", async () => {
    const evaluate = vi.fn().mockResolvedValue(SUMMARY);
    const consumer = new RiskEvaluationConsumer({ evaluate });
    await consumer.handleEvent(event("t1"));
    expect(evaluate).toHaveBeenCalledExactlyOnceWith("t1");
  });

  it("coalesces a burst of events for one tenant into at most one follow-up run", async () => {
    const { fn: evaluate, resolveNext } = deferredEvaluate();
    const consumer = new RiskEvaluationConsumer({ evaluate });

    // Three events arrive for t1 while the first evaluation is still running.
    const p1 = consumer.handleEvent(event("t1"));
    const p2 = consumer.handleEvent(event("t1"));
    const p3 = consumer.handleEvent(event("t1"));
    await flush();

    // Only the first evaluation has started so far.
    expect(evaluate).toHaveBeenCalledTimes(1);

    resolveNext(); // finish run #1 → dirty flag triggers exactly one more run
    await flush();
    expect(evaluate).toHaveBeenCalledTimes(2);

    resolveNext(); // finish run #2
    await Promise.all([p1, p2, p3]);
    expect(evaluate).toHaveBeenCalledTimes(2); // 3 events coalesced into 2 runs
  });

  it("evaluates different tenants independently", async () => {
    const evaluate = vi.fn().mockResolvedValue(SUMMARY);
    const consumer = new RiskEvaluationConsumer({ evaluate });
    await Promise.all([consumer.handleEvent(event("t1")), consumer.handleEvent(event("t2"))]);
    expect(evaluate).toHaveBeenCalledWith("t1");
    expect(evaluate).toHaveBeenCalledWith("t2");
    expect(evaluate).toHaveBeenCalledTimes(2);
  });

  it("routes evaluation failures to the DLQ", async () => {
    const evaluate = vi.fn().mockRejectedValue(new Error("boom"));
    const dlq = new InMemoryDeadLetterQueue();
    const consumer = new RiskEvaluationConsumer({ evaluate, dlq, now: () => "2026-07-04T00:00:00Z" });

    await consumer.handleEvent(event("t1"));

    expect(dlq.size).toBe(1);
    expect(dlq.entries[0]?.source).toBe("risk-consumer");
    expect(dlq.entries[0]?.reason).toContain("boom");
  });

  it("DLQs an event with no tenantId without evaluating", async () => {
    const evaluate = vi.fn().mockResolvedValue(SUMMARY);
    const dlq = new InMemoryDeadLetterQueue();
    const consumer = new RiskEvaluationConsumer({ evaluate, dlq });
    await consumer.handleEvent(event(""));
    expect(evaluate).not.toHaveBeenCalled();
    expect(dlq.size).toBe(1);
  });

  it("throws instead of losing an event when no DLQ is configured", async () => {
    const evaluate = vi.fn().mockRejectedValue(new Error("boom"));
    const consumer = new RiskEvaluationConsumer({ evaluate });
    await expect(consumer.handleEvent(event("t1"))).rejects.toThrow();
  });
});
