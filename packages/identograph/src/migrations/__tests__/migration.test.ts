import { describe, expect, it } from "vitest";
import * as migration001 from "../001-initial-schema.js";

const NODE_TYPES = [
  "HumanIdentity", "ServiceAccount", "AgentIdentity", "APIToken",
  "WorkloadIdentity", "DeviceIdentity", "Application", "Resource",
  "Role", "Policy", "Group", "OrgUnit",
];

const EDGE_TYPES = [
  "HAS_ACCESS", "ASSIGNED_ROLE", "MEMBER_OF", "REPORTS_TO", "OWNS",
  "SPAWNED", "GOVERNS", "PEER_OF", "CREATED_BY", "USED_BY",
];

describe("001-initial-schema migration", () => {
  it("has an id and description", () => {
    expect(migration001.id).toBe("001-initial-schema");
    expect(migration001.description).toBeTruthy();
  });

  it("exports a non-empty statements array", () => {
    expect(Array.isArray(migration001.statements)).toBe(true);
    expect(migration001.statements.length).toBeGreaterThan(0);
  });

  it("all statements are non-empty strings", () => {
    for (const stmt of migration001.statements) {
      expect(typeof stmt).toBe("string");
      expect(stmt.trim().length).toBeGreaterThan(0);
    }
  });

  it("all CREATE statements use IF NOT EXISTS", () => {
    const createStatements = migration001.statements.filter((s) =>
      s.trimStart().toUpperCase().startsWith("CREATE"),
    );
    expect(createStatements.length).toBeGreaterThan(0);
    for (const stmt of createStatements) {
      expect(stmt.toUpperCase()).toContain("IF NOT EXISTS");
    }
  });

  it("has a CREATE VERTEX TYPE statement for all 12 node types", () => {
    for (const nodeType of NODE_TYPES) {
      const found = migration001.statements.some(
        (s) => s.includes(`CREATE VERTEX TYPE ${nodeType}`),
      );
      expect(found, `Missing CREATE VERTEX TYPE ${nodeType}`).toBe(true);
    }
  });

  it("has a CREATE EDGE TYPE statement for all 10 edge types", () => {
    for (const edgeType of EDGE_TYPES) {
      const found = migration001.statements.some(
        (s) => s.includes(`CREATE EDGE TYPE ${edgeType}`),
      );
      expect(found, `Missing CREATE EDGE TYPE ${edgeType}`).toBe(true);
    }
  });

  it("defines tenantId property on all vertex types", () => {
    for (const nodeType of NODE_TYPES) {
      const found = migration001.statements.some(
        (s) => s.includes(`${nodeType}.tenantId`),
      );
      expect(found, `Missing tenantId property on ${nodeType}`).toBe(true);
    }
  });

  it("defines a unique index on tenantId + id for all vertex types", () => {
    for (const nodeType of NODE_TYPES) {
      const found = migration001.statements.some(
        (s) =>
          s.includes(`ON ${nodeType}`) &&
          s.includes("tenantId") &&
          s.includes("id") &&
          s.includes("UNIQUE"),
      );
      expect(found, `Missing unique tenantId+id index on ${nodeType}`).toBe(true);
    }
  });

  it("defines tenantId property on all edge types", () => {
    for (const edgeType of EDGE_TYPES) {
      const found = migration001.statements.some(
        (s) => s.includes(`${edgeType}.tenantId`),
      );
      expect(found, `Missing tenantId property on edge ${edgeType}`).toBe(true);
    }
  });
});
