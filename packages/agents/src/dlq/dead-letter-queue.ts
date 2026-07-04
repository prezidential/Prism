// Dead-letter queue.
//
// When processing an event fails terminally (after whatever retries the caller
// applies), the offending event is routed here instead of blocking the pipeline
// or being silently dropped. Shared by the risk-evaluation consumer and the
// ingestion pipeline.

export interface DeadLetterEntry {
  // Where the failure happened, e.g. "risk-consumer" | "aws-ingestor".
  source: string;
  // The original event/payload that failed, for replay.
  event: unknown;
  // Human-readable failure reason.
  reason: string;
  // ISO8601 time the entry was dead-lettered.
  failedAt: string;
}

export interface DeadLetterQueue {
  publish(entry: DeadLetterEntry): Promise<void>;
}

// In-memory DLQ — the default for tests and single-process runs. Production can
// swap in a Kafka-backed implementation of the same interface.
export class InMemoryDeadLetterQueue implements DeadLetterQueue {
  readonly entries: DeadLetterEntry[] = [];

  publish(entry: DeadLetterEntry): Promise<void> {
    this.entries.push(entry);
    return Promise.resolve();
  }

  get size(): number {
    return this.entries.length;
  }
}

// Helpers to build an entry with a stamped time.
export function deadLetter(
  source: string,
  event: unknown,
  reason: string,
  now: string,
): DeadLetterEntry {
  return { source, event, reason, failedAt: now };
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
