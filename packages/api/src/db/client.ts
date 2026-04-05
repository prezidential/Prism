// ArcadeDB REST client for the API package.
// Mirrors packages/identograph/src/db/client.ts - shared logic, separate package instance.

export interface ArcadeConfig {
  url: string;
  database: string;
  user: string;
  password: string;
}

export function defaultConfig(): ArcadeConfig {
  return {
    url: process.env["ARCADEDB_URL"] ?? "http://localhost:2480",
    database: process.env["ARCADEDB_DB"] ?? "prism",
    user: process.env["ARCADEDB_USER"] ?? "root",
    password: process.env["ARCADEDB_PASS"] ?? "prism-dev-secret",
  };
}

export interface QueryResult<T = unknown> {
  result: T[];
}

export class ArcadeClient {
  private readonly auth: string;
  private readonly queryUrl: string;

  constructor(config: ArcadeConfig) {
    this.auth = Buffer.from(`${config.user}:${config.password}`).toString("base64");
    this.queryUrl = `${config.url}/api/v1/query/${config.database}`;
  }

  async query<T = unknown>(sql: string): Promise<T[]> {
    const res = await fetch(this.queryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${this.auth}`,
      },
      body: JSON.stringify({ language: "sql", command: sql }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ArcadeDB query failed (HTTP ${res.status}): ${body}`);
    }

    const data = (await res.json()) as QueryResult<T>;
    return data.result;
  }

  // Escape a string value for safe inline SQL embedding
  escape(value: string): string {
    return `'${value.replace(/'/g, "\\'")}'`;
  }
}
