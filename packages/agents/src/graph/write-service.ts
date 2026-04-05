// ArcadeDB graph write service - transactional upserts for identity nodes and edges

export interface UpsertResult {
  nodeId: string;
  created: boolean; // true = new node, false = updated
}

interface ArcadeCommandResponse {
  result: Array<Record<string, unknown>>;
}

function escapeString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function buildSetClause(props: Record<string, unknown>): string {
  return Object.entries(props)
    .map(([key, val]) => {
      if (typeof val === "string") {
        return `${key} = '${escapeString(val)}'`;
      }
      if (val === null || val === undefined) {
        return `${key} = null`;
      }
      if (typeof val === "boolean" || typeof val === "number") {
        return `${key} = ${val}`;
      }
      return `${key} = '${escapeString(JSON.stringify(val))}'`;
    })
    .join(", ");
}

function buildInsertClause(props: Record<string, unknown>): string {
  const keys = Object.keys(props);
  const values = Object.values(props).map((val) => {
    if (typeof val === "string") return `'${escapeString(val)}'`;
    if (val === null || val === undefined) return "null";
    if (typeof val === "boolean" || typeof val === "number") return String(val);
    return `'${escapeString(JSON.stringify(val))}'`;
  });
  return `(${keys.join(", ")}) VALUES (${values.join(", ")})`;
}

export class ArcadeGraphWriteService {
  private readonly baseUrl: string;

  constructor(
    private readonly config: {
      url: string;
      db: string;
      user: string;
      pass: string;
    },
  ) {
    this.baseUrl = config.url;
  }

  private get authHeader(): string {
    const encoded = Buffer.from(`${this.config.user}:${this.config.pass}`).toString("base64");
    return `Basic ${encoded}`;
  }

  private async command(sql: string): Promise<ArcadeCommandResponse> {
    const url = `${this.baseUrl}/api/v1/command/${this.config.db}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authHeader,
      },
      body: JSON.stringify({ language: "sql", command: sql }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ArcadeDB command failed (${response.status}): ${text}`);
    }

    return (await response.json()) as ArcadeCommandResponse;
  }

  private async beginTransaction(): Promise<string> {
    const url = `${this.baseUrl}/api/v1/begin/${this.config.db}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to begin transaction (${response.status}): ${text}`);
    }
    const sessionId = response.headers.get("arcadedb-session-id");
    if (!sessionId) {
      throw new Error("No session ID returned from ArcadeDB BEGIN");
    }
    return sessionId;
  }

  private async commitTransaction(sessionId: string): Promise<void> {
    const url = `${this.baseUrl}/api/v1/commit/${this.config.db}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "arcadedb-session-id": sessionId,
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to commit transaction (${response.status}): ${text}`);
    }
  }

  private async rollbackTransaction(sessionId: string): Promise<void> {
    const url = `${this.baseUrl}/api/v1/rollback/${this.config.db}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "arcadedb-session-id": sessionId,
      },
    });
    if (!response.ok) {
      // Swallow rollback errors - we're already in an error state
      console.error(`Rollback failed (${response.status})`);
    }
  }

  private async commandInSession(sql: string, sessionId: string): Promise<ArcadeCommandResponse> {
    const url = `${this.baseUrl}/api/v1/command/${this.config.db}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authHeader,
        "arcadedb-session-id": sessionId,
      },
      body: JSON.stringify({ language: "sql", command: sql }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ArcadeDB command failed (${response.status}): ${text}`);
    }

    return (await response.json()) as ArcadeCommandResponse;
  }

  async findByExternalId(
    type: string,
    tenantId: string,
    externalIdField: string,
    externalId: string,
  ): Promise<{ id: string } | null> {
    const sql = `SELECT @rid as id FROM ${type} WHERE tenantId = '${escapeString(tenantId)}' AND ${externalIdField} = '${escapeString(externalId)}' LIMIT 1`;
    const result = await this.command(sql);
    const first = result.result[0];
    if (!first) return null;
    const id = first["id"];
    if (typeof id !== "string") return null;
    return { id };
  }

  async upsertVertex(
    type: string,
    tenantId: string,
    externalId: string,
    externalIdField: string,
    props: Record<string, unknown>,
  ): Promise<UpsertResult> {
    const sessionId = await this.beginTransaction();
    try {
      // Check if node exists
      const selectSql = `SELECT @rid as id FROM ${type} WHERE tenantId = '${escapeString(tenantId)}' AND ${externalIdField} = '${escapeString(externalId)}' LIMIT 1`;
      const selectResult = await this.commandInSession(selectSql, sessionId);
      const existing = selectResult.result[0];

      let nodeId: string;
      let created: boolean;

      if (existing) {
        const existingId = existing["id"];
        if (typeof existingId !== "string") {
          throw new Error("Existing node has no valid RID");
        }
        nodeId = existingId;
        created = false;

        // Update existing node
        if (Object.keys(props).length > 0) {
          const setClause = buildSetClause(props);
          const updateSql = `UPDATE ${type} SET ${setClause} WHERE @rid = ${nodeId}`;
          await this.commandInSession(updateSql, sessionId);
        }
      } else {
        created = true;

        // Insert new node
        const allProps: Record<string, unknown> = {
          tenantId,
          [externalIdField]: externalId,
          ...props,
        };
        const insertClause = buildInsertClause(allProps);
        const insertSql = `INSERT INTO ${type} ${insertClause} RETURN @rid as id`;
        const insertResult = await this.commandInSession(insertSql, sessionId);
        const inserted = insertResult.result[0];
        if (!inserted) {
          throw new Error("INSERT did not return a record");
        }
        const id = inserted["id"];
        if (typeof id !== "string") {
          throw new Error("INSERT did not return valid RID");
        }
        nodeId = id;
      }

      await this.commitTransaction(sessionId);
      return { nodeId, created };
    } catch (err) {
      await this.rollbackTransaction(sessionId);
      throw err;
    }
  }

  async upsertEdge(
    edgeType: string,
    fromType: string,
    fromId: string,
    toType: string,
    toId: string,
    props: Record<string, unknown>,
    tenantId: string,
  ): Promise<void> {
    // Check if edge already exists
    const checkSql = `SELECT @rid FROM ${edgeType} WHERE out = ${fromId} AND in = ${toId} AND tenantId = '${escapeString(tenantId)}' LIMIT 1`;
    const checkResult = await this.command(checkSql);
    const existing = checkResult.result[0];

    if (existing) {
      // Update existing edge if there are props
      if (Object.keys(props).length > 0) {
        const rid = existing["@rid"] ?? existing["rid"];
        if (typeof rid === "string") {
          const setClause = buildSetClause(props);
          const updateSql = `UPDATE ${edgeType} SET ${setClause} WHERE @rid = ${rid}`;
          await this.command(updateSql);
        }
      }
      return;
    }

    // Create edge
    const propsWithTenant: Record<string, unknown> = { tenantId, ...props };
    const setClause =
      Object.keys(propsWithTenant).length > 0 ? ` SET ${buildSetClause(propsWithTenant)}` : "";
    const createSql = `CREATE EDGE ${edgeType} FROM ${fromId} TO ${toId}${setClause}`;
    await this.command(createSql);

    void fromType; // used for documentation purposes
    void toType; // used for documentation purposes
  }
}
