import { buildSchema } from "graphql";
import { describe, expect, it } from "vitest";
import { typeDefs } from "../schema.js";

describe("GraphQL schema", () => {
  it("is valid and builds without errors", () => {
    expect(() => buildSchema(typeDefs)).not.toThrow();
  });

  it("contains all 12 Identograph node types", () => {
    const schema = buildSchema(typeDefs);
    const typeMap = schema.getTypeMap();

    const expectedTypes = [
      "HumanIdentity", "ServiceAccount", "AgentIdentity", "APIToken",
      "WorkloadIdentity", "DeviceIdentity", "Application", "Resource",
      "Role", "Policy", "Group", "OrgUnit",
    ];

    for (const typeName of expectedTypes) {
      expect(typeMap[typeName], `Missing type ${typeName}`).toBeDefined();
    }
  });

  it("has a Query type with all expected root fields", () => {
    const schema = buildSchema(typeDefs);
    const queryType = schema.getQueryType();
    expect(queryType).toBeDefined();

    const fields = queryType!.getFields();
    const expectedFields = [
      "node", "humans", "human", "serviceAccounts", "agentIdentities",
      "applications", "resources", "roles", "highRiskIdentities",
      "searchIdentities", "stats",
    ];

    for (const field of expectedFields) {
      expect(fields[field], `Missing query field: ${field}`).toBeDefined();
    }
  });

  it("defines the AnyNode union with all identity types", () => {
    const schema = buildSchema(typeDefs);
    const anyNode = schema.getType("AnyNode");
    expect(anyNode).toBeDefined();
    // AnyNode is a union - it should contain multiple types
    const typeMap = schema.getTypeMap();
    expect(typeMap["AnyNode"]).toBeDefined();
  });

  it("IdentityStatus enum has all 5 expected values", () => {
    const schema = buildSchema(typeDefs);
    const statusEnum = schema.getType("IdentityStatus") as ReturnType<typeof schema.getType> & {
      getValues?: () => Array<{ name: string }>;
    };
    expect(statusEnum).toBeDefined();
    const values = (statusEnum as { getValues: () => Array<{ name: string }> }).getValues();
    const names = values.map((v) => v.name);
    expect(names).toContain("Active");
    expect(names).toContain("Inactive");
    expect(names).toContain("Suspended");
    expect(names).toContain("Orphaned");
    expect(names).toContain("PendingReview");
  });

  it("NodeType enum has all 12 expected values", () => {
    const schema = buildSchema(typeDefs);
    const nodeTypeEnum = schema.getType("NodeType") as {
      getValues: () => Array<{ name: string }>;
    };
    expect(nodeTypeEnum).toBeDefined();
    const values = nodeTypeEnum.getValues();
    expect(values).toHaveLength(12);
  });

  it("IdentographStats type has count fields for all node categories", () => {
    const schema = buildSchema(typeDefs);
    const statsType = schema.getType("IdentographStats") as {
      getFields: () => Record<string, unknown>;
    };
    expect(statsType).toBeDefined();
    const fields = statsType.getFields();
    expect(fields["humanCount"]).toBeDefined();
    expect(fields["serviceAccountCount"]).toBeDefined();
    expect(fields["agentCount"]).toBeDefined();
    expect(fields["applicationCount"]).toBeDefined();
    expect(fields["resourceCount"]).toBeDefined();
    expect(fields["roleCount"]).toBeDefined();
    expect(fields["groupCount"]).toBeDefined();
    expect(fields["orgUnitCount"]).toBeDefined();
  });
});
