// RiskSignal writer.
//
// Materializes each risk finding as a RiskSignal vertex in the Identograph,
// shaped as an SSF/CAEP Security Event Token (SET). The Phase 1 risk-surface
// traversal reads these back by `subjectRef`, closing the loop: scorers derive
// risk from the graph, and the derived risk becomes part of the graph.

import type { GraphClient } from "./client.js";
import type { RiskFinding } from "./types.js";

// The component that issues these signals (SET `iss` claim).
const ISSUER = "prism-risk-engine";

export interface SignalWriterDeps {
  // Monotonic-ish clock, injected for deterministic output/tests.
  now(): string; // ISO8601
  // Unique id factory for vertex id + jti, injected for determinism/tests.
  newId(): string;
}

// Escape a JS value into a SQL literal for inline embedding.
function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    return `[${value.map((v) => sqlLiteral(v)).join(", ")}]`;
  }
  if (typeof value === "object") {
    return `'${JSON.stringify(value).replace(/'/g, "\\'")}'`;
  }
  return `'${String(value).replace(/'/g, "\\'")}'`;
}

// Write a single finding as a RiskSignal vertex. Returns the new signal id.
export async function writeSignal(
  client: GraphClient,
  tenantId: string,
  finding: RiskFinding,
  deps: SignalWriterDeps,
): Promise<string> {
  const id = deps.newId();
  const iat = deps.now();

  const props: Record<string, unknown> = {
    id,
    tenantId,
    nodeType: "RiskSignal",
    externalIds: {},
    createdAt: iat,
    updatedAt: iat,
    status: "Active",
    riskScore: finding.score,
    lastActivity: iat,
    tags: ["risk-engine", finding.scorer],
    metadata: {},
    // SSF SET envelope
    jti: deps.newId(),
    iss: ISSUER,
    iat,
    // Subject
    subjectRef: finding.identityId,
    subjectType: finding.identityType,
    // CAEP classification
    caepEventType: finding.caepEventType,
    eventTypeUri: finding.eventTypeUri,
    // Derived risk
    score: finding.score,
    severity: finding.severity,
    // Payload
    eventPayload: {
      scorer: finding.scorer,
      rationale: finding.rationale,
      ...finding.evidence,
    },
  };

  const entries = Object.entries(props).filter(([, v]) => v !== undefined);
  const cols = entries.map(([k]) => `\`${k}\``).join(", ");
  const vals = entries.map(([, v]) => sqlLiteral(v)).join(", ");
  await client.command(`INSERT INTO RiskSignal (${cols}) VALUES (${vals})`);

  return id;
}

// Write many findings, returning the number of signals materialized.
export async function writeSignals(
  client: GraphClient,
  tenantId: string,
  findings: RiskFinding[],
  deps: SignalWriterDeps,
): Promise<number> {
  let written = 0;
  for (const finding of findings) {
    await writeSignal(client, tenantId, finding, deps);
    written += 1;
  }
  return written;
}
