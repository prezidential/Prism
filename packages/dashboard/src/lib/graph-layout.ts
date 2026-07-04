// Deterministic layout for the Identograph visualization.
//
// A force simulation would be non-deterministic and hard to test; instead nodes
// are placed in vertical lanes by kind (identities on the left, the resources
// they can reach on the right), which also reads as a clean access-flow diagram.

import type { GraphEdge, GraphNode, NodeKind } from "../data/types.ts";

export interface Point {
  x: number;
  y: number;
}

export interface LayoutOptions {
  width: number;
  height: number;
  padding?: number;
  // Horizontal space reserved on the right so the last lane's node labels fit.
  labelReserve?: number;
}

// Lane order left → right; mirrors the direction access flows.
const LANE_ORDER: NodeKind[] = ["human", "agent", "nhi", "entitlement", "resource"];

export function computeLayout(
  nodes: GraphNode[],
  options: LayoutOptions,
): Map<string, Point> {
  const padding = options.padding ?? 60;
  const labelReserve = options.labelReserve ?? 0;
  const usableW = Math.max(options.width - padding * 2 - labelReserve, 1);
  const usableH = Math.max(options.height - padding * 2, 1);

  const lanes = LANE_ORDER.filter((kind) => nodes.some((n) => n.kind === kind));
  const laneX = new Map<NodeKind, number>();
  lanes.forEach((kind, i) => {
    const x = lanes.length === 1 ? padding + usableW / 2 : padding + (usableW * i) / (lanes.length - 1);
    laneX.set(kind, x);
  });

  const positions = new Map<string, Point>();
  for (const kind of lanes) {
    const inLane = nodes.filter((n) => n.kind === kind);
    const x = laneX.get(kind) ?? padding;
    inLane.forEach((node, i) => {
      const y =
        inLane.length === 1
          ? padding + usableH / 2
          : padding + (usableH * i) / (inLane.length - 1);
      positions.set(node.id, { x, y });
    });
  }
  return positions;
}

// Ids directly connected to `id` in either direction.
export function neighborsOf(edges: GraphEdge[], id: string): Set<string> {
  const out = new Set<string>();
  for (const e of edges) {
    if (e.from === id) out.add(e.to);
    if (e.to === id) out.add(e.from);
  }
  return out;
}

// Node radius scales with risk so high-risk nodes read as larger/heavier.
export function nodeRadius(riskScore: number): number {
  return 10 + Math.round(Math.max(0, Math.min(1, riskScore)) * 12);
}
