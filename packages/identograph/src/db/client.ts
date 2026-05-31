// Thin ArcadeDB REST client using Node 20 built-in fetch.
// Shared by migrations, seed scripts, and the API layer.

export interface ArcadeConfig {
  url: string;
  database: string;
  user: string;
  password: string;
}

export function defaultConfig(): ArcadeConfig {
  return {
    url: process.env["ARCADEDB_URL"] ?? "http://localhost:2480",
    database: process.env["ARCADEDB_DB"] ?? "idem",
    user: process.env["ARCADEDB_USER"] ?? "root",
    password: process.env["ARCADEDB_PASS"] ?? "prism-dev-secret",
  };
}

interface ArcadeResponse<T = unknown> {
  result: T[];
}

export class ArcadeClient {
  private readonly auth: string;
  private readonly commandUrl: string;
  private readonly queryUrl: string;

  constructor(private readonly config: ArcadeConfig) {
    this.auth = Buffer.from(`${config.user}:${config.password}`).toString("base64");
    this.commandUrl = `${config.url}/api/v1/command/${config.database}`;
    this.queryUrl = `${config.url}/api/v1/query/${config.database}`;
  }

  // Execute a write or DDL command (SQL, Gremlin, or Cypher). Returns result rows.
  async command<T = unknown>(sql: string, language = "sql"): Promise<T[]> {
    const res = await fetch(this.commandUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${this.auth}`,
      },
      body: JSON.stringify({ language, command: sql }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ArcadeDB command failed (HTTP ${res.status}): ${body}\nSQL: ${sql}`);
    }

    const data = (await res.json()) as ArcadeResponse<T>;
    return data.result;
  }

  // Execute a read-only query. Returns result rows.
  async query<T = unknown>(sql: string, language = "sql"): Promise<T[]> {
    const res = await fetch(this.queryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${this.auth}`,
      },
      body: JSON.stringify({ language, command: sql }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ArcadeDB query failed (HTTP ${res.status}): ${body}\nSQL: ${sql}`);
    }

    const data = (await res.json()) as ArcadeResponse<T>;
    return data.result;
  }

  // Insert a vertex and return it.
  async insertVertex<T = unknown>(type: string, props: Record<string, unknown>): Promise<T> {
    const entries = Object.entries(props).filter(([, v]) => v !== undefined && v !== null);
    const cols = entries.map(([k]) => `\`${k}\``).join(", ");
    const vals = entries.map(([, v]) => this.sqlLiteral(v)).join(", ");
    const sql = `INSERT INTO ${type} (${cols}) VALUES (${vals}) RETURN @this`;
    const rows = await this.command<T>(sql);
    const first = rows[0];
    if (first === undefined) throw new Error(`INSERT into ${type} returned no record`);
    return first;
  }

  // Insert an edge between two vertices identified by their `id` property.
  async insertEdge(
    edgeType: string,
    fromType: string,
    fromId: string,
    toType: string,
    toId: string,
    props: Record<string, unknown> = {},
    tenantId: string,
  ): Promise<void> {
    const propsWithBase = { ...props, tenantId, edgeType };
    const entries = Object.entries(propsWithBase).filter(([, v]) => v !== undefined && v !== null);
    const setParts = entries.map(([k, v]) => `\`${k}\` = ${this.sqlLiteral(v)}`).join(", ");
    const setClause = entries.length > 0 ? `SET ${setParts}` : "";

    const sql = `
      CREATE EDGE ${edgeType}
        FROM (SELECT FROM ${fromType} WHERE tenantId = ${this.sqlLiteral(tenantId)} AND id = ${this.sqlLiteral(fromId)})
        TO   (SELECT FROM ${toType}   WHERE tenantId = ${this.sqlLiteral(tenantId)} AND id = ${this.sqlLiteral(toId)})
        ${setClause}
    `.trim();

    await this.command(sql);
  }

  // Count rows in a vertex type for a given tenant.
  async count(type: string, tenantId: string): Promise<number> {
    const rows = await this.query<{ count: number }>(
      `SELECT count(*) as count FROM ${type} WHERE tenantId = ${this.sqlLiteral(tenantId)}`,
    );
    return rows[0]?.count ?? 0;
  }

  // Escape a string value for safe inline SQL embedding.
  escape(value: string): string {
    return `'${value.replace(/'/g, "\\'")}'`;
  }

  private sqlLiteral(value: unknown): string {
    if (value === null || value === undefined) return "null";
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return value ? "true" : "false";
    if (Array.isArray(value)) {
      return `[${value.map((v) => this.sqlLiteral(v)).join(", ")}]`;
    }
    if (typeof value === "object") {
      return `'${JSON.stringify(value).replace(/'/g, "\\'")}'`;
    }
    return `'${String(value).replace(/'/g, "\\'")}'`;
  }
}
