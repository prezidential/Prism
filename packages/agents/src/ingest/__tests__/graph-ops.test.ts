import { describe, expect, it, vi } from "vitest";
import { InMemoryDeadLetterQueue } from "../../dlq/dead-letter-queue.js";
import { applyMappedGraph, type GraphWriter, type MappedGraph } from "../graph-ops.js";

function mockWriter(failVertexIds = new Set<string>()): GraphWriter & {
  upsertVertex: ReturnType<typeof vi.fn>;
  upsertEdge: ReturnType<typeof vi.fn>;
} {
  const seen = new Set<string>();
  return {
    upsertVertex: vi.fn(
      async (_type: string, _t: string, externalId: string) => {
        if (failVertexIds.has(externalId)) throw new Error(`write failed for ${externalId}`);
        const created = !seen.has(externalId);
        seen.add(externalId);
        return { nodeId: `#12:${externalId}`, created };
      },
    ),
    upsertEdge: vi.fn(async () => undefined),
  };
}

const graph: MappedGraph = {
  vertices: [
    { type: "NHIdentity", externalId: "u1", externalIdField: "id", props: { displayName: "u1" } },
    { type: "Entitlement", externalId: "p1", externalIdField: "id", props: { displayName: "p1" } },
  ],
  edges: [
    {
      edgeType: "HAS_ENTITLEMENT",
      fromType: "NHIdentity",
      toType: "Entitlement",
      fromExternalId: "u1",
      toExternalId: "p1",
    },
  ],
};

describe("applyMappedGraph", () => {
  it("upserts vertices and resolves edge endpoints by external id", async () => {
    const writer = mockWriter();
    const summary = await applyMappedGraph(writer, "t1", graph, { source: "test" });

    expect(summary).toMatchObject({ verticesUpserted: 2, created: 2, edgesUpserted: 1, deadLettered: 0 });
    expect(writer.upsertEdge).toHaveBeenCalledWith(
      "HAS_ENTITLEMENT",
      "NHIdentity",
      "#12:u1",
      "Entitlement",
      "#12:p1",
      {},
      "t1",
    );
  });

  it("is idempotent across re-runs (created first, updated second)", async () => {
    const writer = mockWriter();
    const first = await applyMappedGraph(writer, "t1", graph, { source: "test" });
    const second = await applyMappedGraph(writer, "t1", graph, { source: "test" });
    expect(first.created).toBe(2);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(2);
  });

  it("dead-letters a failed vertex and the edges that depended on it", async () => {
    const writer = mockWriter(new Set(["p1"]));
    const dlq = new InMemoryDeadLetterQueue();
    const summary = await applyMappedGraph(writer, "t1", graph, { source: "aws-ingestor", dlq });

    // p1 vertex failed → 1 DLQ; the u1->p1 edge is unresolved → 1 more DLQ.
    expect(summary.deadLettered).toBe(2);
    expect(summary.edgesUpserted).toBe(0);
    expect(dlq.size).toBe(2);
    expect(dlq.entries.every((e) => e.source === "aws-ingestor")).toBe(true);
  });

  it("throws on failure when no DLQ is configured", async () => {
    const writer = mockWriter(new Set(["u1"]));
    await expect(applyMappedGraph(writer, "t1", graph, { source: "test" })).rejects.toThrow();
  });

  it("dead-letters an edge with an unknown endpoint", async () => {
    const writer = mockWriter();
    const dlq = new InMemoryDeadLetterQueue();
    const g: MappedGraph = {
      vertices: [{ type: "NHIdentity", externalId: "u1", externalIdField: "id", props: {} }],
      edges: [
        {
          edgeType: "HAS_ENTITLEMENT",
          fromType: "NHIdentity",
          toType: "Entitlement",
          fromExternalId: "u1",
          toExternalId: "missing",
        },
      ],
    };
    const summary = await applyMappedGraph(writer, "t1", g, { source: "test", dlq });
    expect(summary.edgesUpserted).toBe(0);
    expect(summary.deadLettered).toBe(1);
    expect(dlq.entries[0]?.reason).toContain("unresolved");
  });
});
