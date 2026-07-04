// CLI entrypoint for `npm run risk:evaluate`.
//
// Evaluates risk across the graph for a tenant and prints a ranked summary.
// Uses a self-contained ArcadeDB REST client so it runs under tsx without any
// cross-package build step.

import { randomUUID } from "node:crypto";
import type { GraphClient } from "../client.js";
import { evaluateRisk } from "../evaluate.js";

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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${this.auth}`,
      },
      body: JSON.stringify({ language: "sql", command: sql }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ArcadeDB request failed (HTTP ${res.status}): ${body}\nSQL: ${sql}`);
    }
    const data = (await res.json()) as { result: T[] };
    return data.result;
  }

  query<T = unknown>(sql: string): Promise<T[]> {
    return this.post<T>(this.queryUrl, sql);
  }

  command<T = unknown>(sql: string): Promise<T[]> {
    return this.post<T>(this.commandUrl, sql);
  }
}

async function main(): Promise<void> {
  const tenantId = process.env["TENANT_ID"] ?? process.argv[2] ?? "demo";
  const client = new RestGraphClient(
    process.env["ARCADEDB_URL"] ?? "http://localhost:2480",
    process.env["ARCADEDB_DB"] ?? "idem",
    process.env["ARCADEDB_USER"] ?? "root",
    process.env["ARCADEDB_PASS"] ?? "prism-dev-secret",
  );

  const result = await evaluateRisk(client, tenantId, {
    now: () => new Date().toISOString(),
    newId: () => randomUUID(),
  });

  console.log(`\nRisk evaluation for tenant "${tenantId}"`);
  console.log(
    `  findings: ${result.findingCount}  signals written: ${result.signalsWritten}  ` +
      `scores persisted: ${result.scoresPersisted}\n`,
  );
  console.log("Top identities by composite risk:");
  for (const profile of result.profiles.slice(0, 15)) {
    const scorers = profile.findings.map((f) => f.scorer).join(", ");
    console.log(
      `  ${profile.compositeScore.toFixed(2)}  [${profile.topSeverity ?? "-"}]  ` +
        `${profile.identityType} ${profile.identityId}  <- ${scorers}`,
    );
  }
  console.log("");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
