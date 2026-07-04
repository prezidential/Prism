// AWS IAM ingestor.
//
// Pulls an IAM snapshot from an injected source, maps it into the Identograph,
// and upserts it via the shared reconcile-and-write engine. The source is
// injected so the ingestor is testable with a fixture; the live AWS SDK adapter
// (a thin implementation of AwsIamSource) is the only piece deferred.

import type { DeadLetterQueue } from "../dlq/dead-letter-queue.js";
import { applyMappedGraph, type GraphWriter, type IngestSummary } from "../ingest/graph-ops.js";
import { mapIamSnapshot, type AwsIamSource } from "./mapper.js";

export interface AwsIamIngestorDeps {
  source: AwsIamSource;
  writer: GraphWriter;
  tenantId: string;
  dlq?: DeadLetterQueue;
  now?: () => string;
}

export class AwsIamIngestor {
  constructor(private readonly deps: AwsIamIngestorDeps) {}

  async run(): Promise<IngestSummary> {
    const now = this.deps.now ?? (() => new Date().toISOString());
    const snapshot = await this.deps.source.fetchSnapshot();
    const mapped = mapIamSnapshot(snapshot, this.deps.tenantId, now());
    return applyMappedGraph(this.deps.writer, this.deps.tenantId, mapped, {
      source: "aws-ingestor",
      ...(this.deps.dlq ? { dlq: this.deps.dlq } : {}),
      now,
    });
  }
}
