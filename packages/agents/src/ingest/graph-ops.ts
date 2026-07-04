// Shared ingestion primitives: a provider-agnostic "mapped graph" plus the
// reconcile-and-write engine that applies it. Both the AWS IAM ingestor and the
// demo-provisioner bridge normalize their source into a MappedGraph and hand it
// to `applyMappedGraph`, which upserts (idempotent on re-run) and dead-letters
// per-item failures instead of aborting the whole batch.

import { deadLetter, errorMessage, type DeadLetterQueue } from "../dlq/dead-letter-queue.js";

export interface GraphVertexUpsert {
  type: string; // vertex class, e.g. "NHIdentity" | "Entitlement"
  externalId: string; // stable anchor value (arn, seedId, ...)
  externalIdField: string; // vertex field the anchor is stored in (default "id")
  props: Record<string, unknown>;
}

export interface GraphEdgeUpsert {
  edgeType: string; // e.g. "HAS_ENTITLEMENT"
  fromType: string;
  toType: string;
  fromExternalId: string; // resolved to a vertex RID at apply time
  toExternalId: string;
  props?: Record<string, unknown>;
}

export interface MappedGraph {
  vertices: GraphVertexUpsert[];
  edges: GraphEdgeUpsert[];
}

// The subset of ArcadeGraphWriteService the ingestion engine needs. Declared
// structurally so tests can supply a mock writer.
export interface GraphWriter {
  upsertVertex(
    type: string,
    tenantId: string,
    externalId: string,
    externalIdField: string,
    props: Record<string, unknown>,
  ): Promise<{ nodeId: string; created: boolean }>;
  upsertEdge(
    edgeType: string,
    fromType: string,
    fromId: string,
    toType: string,
    toId: string,
    props: Record<string, unknown>,
    tenantId: string,
  ): Promise<void>;
}

export interface IngestSummary {
  verticesUpserted: number;
  created: number;
  updated: number;
  edgesUpserted: number;
  deadLettered: number;
}

export interface ApplyOptions {
  source: string; // DLQ source label, e.g. "aws-ingestor"
  dlq?: DeadLetterQueue;
  now?: () => string;
}

// Apply a mapped graph: upsert vertices, then edges, resolving edge endpoints by
// external id. Idempotent — re-running against the same source updates in place
// rather than duplicating. Per-item failures are dead-lettered (or thrown if no
// DLQ is configured) so one bad record does not sink the batch.
export async function applyMappedGraph(
  writer: GraphWriter,
  tenantId: string,
  mapped: MappedGraph,
  options: ApplyOptions,
): Promise<IngestSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const ridByExternalId = new Map<string, string>();
  const summary: IngestSummary = {
    verticesUpserted: 0,
    created: 0,
    updated: 0,
    edgesUpserted: 0,
    deadLettered: 0,
  };

  const fail = async (event: unknown, reason: string): Promise<void> => {
    summary.deadLettered += 1;
    if (!options.dlq) throw new Error(`${options.source}: ${reason}`);
    await options.dlq.publish(deadLetter(options.source, event, reason, now()));
  };

  for (const vertex of mapped.vertices) {
    try {
      const result = await writer.upsertVertex(
        vertex.type,
        tenantId,
        vertex.externalId,
        vertex.externalIdField,
        vertex.props,
      );
      ridByExternalId.set(vertex.externalId, result.nodeId);
      summary.verticesUpserted += 1;
      if (result.created) summary.created += 1;
      else summary.updated += 1;
    } catch (err) {
      await fail(vertex, errorMessage(err));
    }
  }

  for (const edge of mapped.edges) {
    const fromRid = ridByExternalId.get(edge.fromExternalId);
    const toRid = ridByExternalId.get(edge.toExternalId);
    if (!fromRid || !toRid) {
      await fail(edge, `unresolved edge endpoint (${edge.fromExternalId} -> ${edge.toExternalId})`);
      continue;
    }
    try {
      await writer.upsertEdge(
        edge.edgeType,
        edge.fromType,
        fromRid,
        edge.toType,
        toRid,
        edge.props ?? {},
        tenantId,
      );
      summary.edgesUpserted += 1;
    } catch (err) {
      await fail(edge, errorMessage(err));
    }
  }

  return summary;
}
