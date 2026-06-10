// Migration runner for ArcadeDB.
// Executes migrations in order against the configured ArcadeDB instance.
// Each migration is idempotent (uses IF NOT EXISTS), so re-running is safe.

import * as migration001 from "./001-initial-schema.js";
import * as migration002 from "./002-phase1-identograph.js";

const ARCADEDB_URL = process.env["ARCADEDB_URL"] ?? "http://localhost:2480";
const ARCADEDB_DB = process.env["ARCADEDB_DB"] ?? "idem";
const ARCADEDB_USER = process.env["ARCADEDB_USER"] ?? "root";
const ARCADEDB_PASS = process.env["ARCADEDB_PASS"] ?? "prism-dev-secret";

const AUTH = Buffer.from(`${ARCADEDB_USER}:${ARCADEDB_PASS}`).toString("base64");

async function execStatement(statement: string): Promise<void> {
  const res = await fetch(`${ARCADEDB_URL}/api/v1/command/${ARCADEDB_DB}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${AUTH}`,
    },
    body: JSON.stringify({ language: "sql", command: statement }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ArcadeDB error on statement:\n  ${statement}\nHTTP ${res.status}: ${body}`);
  }
}

async function waitForArcadeDB(maxAttempts = 20): Promise<void> {
  console.log(`Connecting to ArcadeDB at ${ARCADEDB_URL}...`);
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      // /api/v1/ready is a public health endpoint — no auth required
      const res = await fetch(`${ARCADEDB_URL}/api/v1/ready`);
      if (res.ok) {
        console.log("ArcadeDB is ready.");
        return;
      }
    } catch {
      // not yet reachable
    }
    if (i < maxAttempts) {
      console.log(`  Attempt ${i}/${maxAttempts} - waiting 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("ArcadeDB did not become ready in time.");
}

async function ensureDatabaseExists(): Promise<void> {
  // Check if the database exists; create it if not
  const listRes = await fetch(`${ARCADEDB_URL}/api/v1/databases`, {
    headers: { Authorization: `Basic ${AUTH}` },
  });

  if (!listRes.ok) {
    // Older ArcadeDB versions may not have this endpoint - just attempt create
    const createRes = await fetch(`${ARCADEDB_URL}/api/v1/create/${ARCADEDB_DB}`, {
      method: "POST",
      headers: { Authorization: `Basic ${AUTH}` },
    });
    // 400/409 means it already exists - that's fine
    if (!createRes.ok && createRes.status !== 400 && createRes.status !== 409) {
      const body = await createRes.text();
      throw new Error(`Failed to create database: ${body}`);
    }
    return;
  }

  const { result } = (await listRes.json()) as { result: string[] };
  if (!result.includes(ARCADEDB_DB)) {
    console.log(`Database '${ARCADEDB_DB}' not found - creating...`);
    const createRes = await fetch(`${ARCADEDB_URL}/api/v1/create/${ARCADEDB_DB}`, {
      method: "POST",
      headers: { Authorization: `Basic ${AUTH}` },
    });
    if (!createRes.ok) {
      const body = await createRes.text();
      throw new Error(`Failed to create database: ${body}`);
    }
    console.log(`Database '${ARCADEDB_DB}' created.`);
  } else {
    console.log(`Database '${ARCADEDB_DB}' already exists.`);
  }
}

const migrations = [migration001, migration002];

async function run(): Promise<void> {
  await waitForArcadeDB();
  await ensureDatabaseExists();

  for (const migration of migrations) {
    console.log(`\nRunning migration: ${migration.id}`);
    console.log(`  ${migration.description}`);

    let succeeded = 0;
    let failed = 0;

    for (const statement of migration.statements) {
      try {
        await execStatement(statement);
        succeeded++;
      } catch (err) {
        // IF NOT EXISTS guards most conflicts, but log unexpected failures
        const message = err instanceof Error ? err.message : String(err);
        // ArcadeDB returns errors for duplicate indexes even with IF NOT EXISTS in some versions
        if (message.includes("already exists") || message.includes("already defined")) {
          succeeded++;
        } else {
          console.error(`  FAILED: ${statement}`);
          console.error(`  Error: ${message}`);
          failed++;
        }
      }
    }

    console.log(`  Done: ${succeeded} succeeded, ${failed} failed`);
    if (failed > 0) {
      throw new Error(`Migration ${migration.id} had ${failed} failures - aborting.`);
    }
  }

  console.log("\nAll migrations complete.");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
