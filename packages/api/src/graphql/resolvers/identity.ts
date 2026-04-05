// Resolvers for identity queries.

import type { ArcadeClient } from "../../db/client.js";

const DEFAULT_TENANT = process.env["PRISM_TENANT_ID"] ?? "prism-dev";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

function clamp(value: number | undefined, max: number): number {
  return Math.min(value ?? DEFAULT_LIMIT, max);
}

type FilterArgs = Record<string, string | number | boolean | null | undefined>;

function buildWhere(tenantId: string, extra: FilterArgs = {}): string {
  const clauses: string[] = [`tenantId = '${tenantId}'`];
  for (const [key, val] of Object.entries(extra)) {
    if (val === undefined || val === null) continue;
    if (typeof val === "string") clauses.push(`${key} = '${val}'`);
    else if (typeof val === "boolean") clauses.push(`${key} = ${val}`);
    else clauses.push(`${key} = ${val}`);
  }
  return clauses.join(" AND ");
}

export function makeResolvers(db: ArcadeClient) {
  return {
    Query: {
      // -----------------------------------------------------------------------
      // node - searches all types by ID
      // -----------------------------------------------------------------------
      async node(_: unknown, args: { id: string; tenantId?: string }) {
        const tid = args.tenantId ?? DEFAULT_TENANT;
        const types = [
          "HumanIdentity", "ServiceAccount", "AgentIdentity", "APIToken",
          "WorkloadIdentity", "DeviceIdentity", "Application", "Resource",
          "Role", "Policy", "Group", "OrgUnit",
        ];
        for (const type of types) {
          const rows = await db.query<Record<string, unknown>>(
            `SELECT * FROM ${type} WHERE tenantId = ${db.escape(tid)} AND id = ${db.escape(args.id)} LIMIT 1`,
          );
          if (rows.length > 0) return rows[0];
        }
        return null;
      },

      // -----------------------------------------------------------------------
      // humans
      // -----------------------------------------------------------------------
      async humans(
        _: unknown,
        args: {
          tenantId?: string;
          status?: string;
          department?: string;
          employmentType?: string;
          limit?: number;
          offset?: number;
        },
      ) {
        const tid = args.tenantId ?? DEFAULT_TENANT;
        const where = buildWhere(tid, {
          status: args.status,
          department: args.department,
          employmentType: args.employmentType,
        });
        const limit = clamp(args.limit, MAX_LIMIT);
        const offset = args.offset ?? 0;
        return db.query(
          `SELECT * FROM HumanIdentity WHERE ${where} LIMIT ${limit} OFFSET ${offset}`,
        );
      },

      // -----------------------------------------------------------------------
      // human (single)
      // -----------------------------------------------------------------------
      async human(_: unknown, args: { id: string; tenantId?: string }) {
        const tid = args.tenantId ?? DEFAULT_TENANT;
        const rows = await db.query<Record<string, unknown>>(
          `SELECT * FROM HumanIdentity WHERE ${buildWhere(tid, { id: args.id })} LIMIT 1`,
        );
        return rows[0] ?? null;
      },

      // -----------------------------------------------------------------------
      // serviceAccounts
      // -----------------------------------------------------------------------
      async serviceAccounts(
        _: unknown,
        args: { tenantId?: string; status?: string; limit?: number; offset?: number },
      ) {
        const tid = args.tenantId ?? DEFAULT_TENANT;
        const where = buildWhere(tid, { status: args.status });
        const limit = clamp(args.limit, MAX_LIMIT);
        const offset = args.offset ?? 0;
        return db.query(
          `SELECT * FROM ServiceAccount WHERE ${where} LIMIT ${limit} OFFSET ${offset}`,
        );
      },

      // -----------------------------------------------------------------------
      // agentIdentities
      // -----------------------------------------------------------------------
      async agentIdentities(
        _: unknown,
        args: {
          tenantId?: string;
          status?: string;
          agentType?: string;
          limit?: number;
          offset?: number;
        },
      ) {
        const tid = args.tenantId ?? DEFAULT_TENANT;
        const where = buildWhere(tid, { status: args.status, agentType: args.agentType });
        const limit = clamp(args.limit, MAX_LIMIT);
        const offset = args.offset ?? 0;
        return db.query(
          `SELECT * FROM AgentIdentity WHERE ${where} LIMIT ${limit} OFFSET ${offset}`,
        );
      },

      // -----------------------------------------------------------------------
      // applications
      // -----------------------------------------------------------------------
      async applications(
        _: unknown,
        args: { tenantId?: string; limit?: number; offset?: number },
      ) {
        const tid = args.tenantId ?? DEFAULT_TENANT;
        const limit = clamp(args.limit, MAX_LIMIT);
        const offset = args.offset ?? 0;
        return db.query(
          `SELECT * FROM Application WHERE tenantId = ${db.escape(tid)} LIMIT ${limit} OFFSET ${offset}`,
        );
      },

      // -----------------------------------------------------------------------
      // resources
      // -----------------------------------------------------------------------
      async resources(
        _: unknown,
        args: { tenantId?: string; sensitivity?: string; limit?: number; offset?: number },
      ) {
        const tid = args.tenantId ?? DEFAULT_TENANT;
        const where = buildWhere(tid, { sensitivity: args.sensitivity });
        const limit = clamp(args.limit, MAX_LIMIT);
        const offset = args.offset ?? 0;
        return db.query(
          `SELECT * FROM Resource WHERE ${where} LIMIT ${limit} OFFSET ${offset}`,
        );
      },

      // -----------------------------------------------------------------------
      // roles
      // -----------------------------------------------------------------------
      async roles(
        _: unknown,
        args: { tenantId?: string; privilegedOnly?: boolean; limit?: number; offset?: number },
      ) {
        const tid = args.tenantId ?? DEFAULT_TENANT;
        const where = buildWhere(tid, {
          isPrivileged: args.privilegedOnly === true ? true : undefined,
        });
        const limit = clamp(args.limit, MAX_LIMIT);
        const offset = args.offset ?? 0;
        return db.query(
          `SELECT * FROM Role WHERE ${where} LIMIT ${limit} OFFSET ${offset}`,
        );
      },

      // -----------------------------------------------------------------------
      // highRiskIdentities
      // -----------------------------------------------------------------------
      async highRiskIdentities(
        _: unknown,
        args: { tenantId?: string; minRiskScore?: number; nodeType?: string; limit?: number },
      ) {
        const tid = args.tenantId ?? DEFAULT_TENANT;
        const minScore = args.minRiskScore ?? 0.7;
        const limit = clamp(args.limit, MAX_LIMIT);

        const types = args.nodeType
          ? [args.nodeType]
          : ["HumanIdentity", "ServiceAccount", "AgentIdentity", "APIToken", "WorkloadIdentity"];

        const results: unknown[] = [];
        for (const type of types) {
          const rows = await db.query(
            `SELECT * FROM ${type} WHERE tenantId = ${db.escape(tid)} AND riskScore >= ${minScore} ORDER BY riskScore DESC LIMIT ${limit}`,
          );
          results.push(...rows);
          if (results.length >= limit) break;
        }

        return results.slice(0, limit);
      },

      // -----------------------------------------------------------------------
      // searchIdentities - basic LIKE search across name/email/displayName
      // -----------------------------------------------------------------------
      async searchIdentities(
        _: unknown,
        args: { query: string; tenantId?: string; limit?: number },
      ) {
        const tid = args.tenantId ?? DEFAULT_TENANT;
        const limit = clamp(args.limit, 100);
        const q = args.query.replace(/'/g, "\\'");

        const searchableTypes: Array<{ type: string; field: string }> = [
          { type: "HumanIdentity", field: "name" },
          { type: "HumanIdentity", field: "email" },
          { type: "ServiceAccount", field: "displayName" },
          { type: "AgentIdentity", field: "agentType" },
          { type: "Application", field: "displayName" },
          { type: "Resource", field: "displayName" },
        ];

        const results: unknown[] = [];
        for (const { type, field } of searchableTypes) {
          if (results.length >= limit) break;
          const rows = await db.query(
            `SELECT * FROM ${type} WHERE tenantId = ${db.escape(tid)} AND ${field} LIKE '%${q}%' LIMIT ${limit}`,
          );
          results.push(...rows);
        }

        return results.slice(0, limit);
      },

      // -----------------------------------------------------------------------
      // stats
      // -----------------------------------------------------------------------
      async stats(_: unknown, args: { tenantId?: string }) {
        const tid = args.tenantId ?? DEFAULT_TENANT;
        const countOf = async (type: string): Promise<number> => {
          const rows = await db.query<{ count: number }>(
            `SELECT count(*) as count FROM ${type} WHERE tenantId = ${db.escape(tid)}`,
          );
          return rows[0]?.count ?? 0;
        };

        const [
          humanCount, serviceAccountCount, agentCount, applicationCount,
          resourceCount, roleCount, groupCount, orgUnitCount,
        ] = await Promise.all([
          countOf("HumanIdentity"), countOf("ServiceAccount"), countOf("AgentIdentity"),
          countOf("Application"), countOf("Resource"), countOf("Role"),
          countOf("Group"), countOf("OrgUnit"),
        ]);

        return {
          tenantId: tid,
          humanCount,
          serviceAccountCount,
          agentCount,
          applicationCount,
          resourceCount,
          roleCount,
          groupCount,
          orgUnitCount,
        };
      },
    },

    // -----------------------------------------------------------------------
    // __resolveType for the AnyNode union
    // -----------------------------------------------------------------------
    AnyNode: {
      __resolveType(obj: { nodeType?: string }) {
        return obj.nodeType ?? null;
      },
    },

    // __resolveType for the IdentityNode interface
    IdentityNode: {
      __resolveType(obj: { nodeType?: string }) {
        return obj.nodeType ?? null;
      },
    },
  };
}
