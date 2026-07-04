// Live wiring for the real-time risk-evaluation consumer (`npm run risk:consume`).
//
// This is the ONE file that reaches across to @prism/risk-engine. Because the
// monorepo runs on tsx/vitest and never builds package dist/, the import is by
// relative source path, and this file is excluded from the package's
// rootDir-constrained tsconfig (typechecked at the repo root). See tsconfig.json.

import { randomUUID } from "node:crypto";
import { evaluateRisk } from "../../../risk-engine/src/index.js";
import { InMemoryDeadLetterQueue } from "../dlq/dead-letter-queue.js";
import { KafkaConsumer } from "../kafka/consumer.js";
import { TOPICS } from "../kafka/topics.js";
import { RiskEvaluationConsumer, type RiskEvalSummary } from "./consumer.js";

interface GraphClient {
  query<T = unknown>(sql: string): Promise<T[]>;
  command<T = unknown>(sql: string): Promise<T[]>;
}

class RestGraphClient implements GraphClient {
  private readonly auth: string;
  private readonly queryUrl: string;
  private readonly commandUrl: string;

  constructor(url: string, database: string, user: string, password: string) {
    this.auth = Buffer.from(`${user}:${password}`).toString("base64");
    this.queryUrl = `${url}/api/v1/query/${database}`;
    this.commandUrl = `${url}/api/v1/command/${database}`;
  }

  private async post<T>(endpoint: string, sql: string): Promise<T[]> {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${this.auth}` },
      body: JSON.stringify({ language: "sql", command: sql }),
    });
    if (!res.ok) throw new Error(`ArcadeDB request failed (HTTP ${res.status}): ${await res.text()}`);
    return ((await res.json()) as { result: T[] }).result;
  }

  query<T = unknown>(sql: string): Promise<T[]> {
    return this.post<T>(this.queryUrl, sql);
  }
  command<T = unknown>(sql: string): Promise<T[]> {
    return this.post<T>(this.commandUrl, sql);
  }
}

export async function main(): Promise<void> {
  const client = new RestGraphClient(
    process.env["ARCADEDB_URL"] ?? "http://localhost:2480",
    process.env["ARCADEDB_DB"] ?? "idem",
    process.env["ARCADEDB_USER"] ?? "root",
    process.env["ARCADEDB_PASS"] ?? "prism-dev-secret",
  );

  const dlq = new InMemoryDeadLetterQueue();
  const consumer = new RiskEvaluationConsumer({
    dlq,
    evaluate: async (tenantId): Promise<RiskEvalSummary> => {
      const result = await evaluateRisk(client, tenantId, {
        now: () => new Date().toISOString(),
        newId: () => randomUUID(),
      });
      return {
        findingCount: result.findingCount,
        signalsWritten: result.signalsWritten,
        scoresPersisted: result.scoresPersisted,
      };
    },
    onEvaluated: (tenantId, s) => {
      // eslint-disable-next-line no-console
      console.error(
        `[risk-consumer] ${tenantId}: ${s.findingCount} findings, ${s.signalsWritten} signals`,
      );
    },
  });

  const kafka = new KafkaConsumer({
    brokers: (process.env["KAFKA_BROKERS"] ?? "localhost:9092").split(","),
    clientId: "prism-risk-consumer",
    groupId: "prism-risk-consumer",
  });

  await kafka.connect();
  await kafka.subscribe(TOPICS.IDENTITY_EVENTS_PROCESSED, async (envelope, ack) => {
    await consumer.handleEvent(envelope);
    await ack();
  });
  // eslint-disable-next-line no-console
  console.error("[risk-consumer] listening on", TOPICS.IDENTITY_EVENTS_PROCESSED);
}
