// Real-time risk-evaluation consumer.
//
// The risk engine is a library; this is the "active running system" that drives
// it. As identity events flow through the pipeline, this consumer re-evaluates
// the affected tenant's risk in near-real time — no cron, no manual command.
//
// The evaluator is INJECTED (typed structurally) so this module stays decoupled
// from @prism/risk-engine's build output and is fully unit-testable. The live
// wiring — Kafka + the real evaluateRisk — lives in `entrypoint.ts`.

import type { IdentityEventEnvelope } from "../messages/envelope.js";
import {
  deadLetter,
  errorMessage,
  type DeadLetterQueue,
} from "../dlq/dead-letter-queue.js";

// Minimal shape of a risk-engine evaluation result the consumer cares about.
export interface RiskEvalSummary {
  findingCount: number;
  signalsWritten: number;
  scoresPersisted: number;
}

export type EvaluateFn = (tenantId: string) => Promise<RiskEvalSummary>;

export interface RiskConsumerDeps {
  evaluate: EvaluateFn;
  dlq?: DeadLetterQueue;
  now?: () => string;
  onEvaluated?: (tenantId: string, summary: RiskEvalSummary) => void;
}

// Coalesces bursts of events per tenant: while an evaluation for a tenant is in
// flight, further events for that tenant set a "dirty" flag that triggers exactly
// one more evaluation when the current one finishes. This keeps a storm of edits
// to one tenant from launching a storm of redundant full re-evaluations.
export class RiskEvaluationConsumer {
  private readonly evaluate: EvaluateFn;
  private readonly dlq: DeadLetterQueue | undefined;
  private readonly now: () => string;
  private readonly onEvaluated: ((tenantId: string, summary: RiskEvalSummary) => void) | undefined;

  private readonly inFlight = new Map<string, Promise<void>>();
  private readonly dirty = new Set<string>();

  constructor(deps: RiskConsumerDeps) {
    this.evaluate = deps.evaluate;
    this.dlq = deps.dlq;
    this.now = deps.now ?? (() => new Date().toISOString());
    this.onEvaluated = deps.onEvaluated;
  }

  // Handle one identity event: schedule a risk re-evaluation for its tenant.
  // Resolves once any evaluation triggered by this event has settled, so a
  // caller can safely ack the Kafka offset afterward.
  async handleEvent(envelope: IdentityEventEnvelope): Promise<void> {
    const tenantId = envelope.tenantId;
    if (!tenantId) {
      await this.toDlq(envelope, "event has no tenantId");
      return;
    }

    const existing = this.inFlight.get(tenantId);
    if (existing) {
      // An evaluation is already running for this tenant; mark it dirty so a
      // fresh pass runs after it, then wait for the chain to drain.
      this.dirty.add(tenantId);
      await existing;
      return;
    }

    const run = this.runChain(tenantId, envelope);
    this.inFlight.set(tenantId, run);
    await run;
  }

  private async runChain(tenantId: string, envelope: IdentityEventEnvelope): Promise<void> {
    try {
      do {
        this.dirty.delete(tenantId);
        const summary = await this.evaluate(tenantId);
        this.onEvaluated?.(tenantId, summary);
      } while (this.dirty.has(tenantId));
    } catch (err) {
      await this.toDlq(envelope, errorMessage(err));
    } finally {
      this.inFlight.delete(tenantId);
      this.dirty.delete(tenantId);
    }
  }

  private async toDlq(event: unknown, reason: string): Promise<void> {
    if (!this.dlq) {
      throw new Error(`risk-consumer: ${reason}`);
    }
    await this.dlq.publish(deadLetter("risk-consumer", event, reason, this.now()));
  }
}
