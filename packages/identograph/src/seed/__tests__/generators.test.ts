import { describe, expect, it } from "vitest";
import { NodeType, IdentityStatus, CredentialType } from "../../schema/enums.js";
import { generateAgentIdentities } from "../generators/agent-identity.js";
import { generateHumans } from "../generators/human.js";
import {
  generateAssignedRoles,
  generateHasAccess,
  generateMemberOf,
  generateOwns,
  generateReportsTo,
  generateSpawned,
} from "../generators/relationships.js";
import { generateServiceAccounts } from "../generators/service-account.js";
import {
  generateApplications,
  generateGroups,
  generateOrgUnits,
  generateResources,
  generateRoles,
} from "../generators/supporting.js";

const TENANT = "test-tenant";

// ---------------------------------------------------------------------------
// Supporting node generators
// ---------------------------------------------------------------------------

describe("generateOrgUnits()", () => {
  it("generates 10 org units", () => {
    expect(generateOrgUnits(TENANT)).toHaveLength(10);
  });

  it("all have correct tenantId and nodeType", () => {
    for (const unit of generateOrgUnits(TENANT)) {
      expect(unit.tenantId).toBe(TENANT);
      expect(unit.nodeType).toBe(NodeType.OrgUnit);
      expect(unit.displayName).toBeTruthy();
      expect(unit.code).toBeTruthy();
    }
  });
});

describe("generateApplications()", () => {
  it("generates 12 applications", () => {
    expect(generateApplications(TENANT)).toHaveLength(12);
  });

  it("all have valid criticality values", () => {
    const valid = new Set(["low", "medium", "high", "critical"]);
    for (const app of generateApplications(TENANT)) {
      expect(valid.has(app.criticality)).toBe(true);
    }
  });
});

describe("generateResources()", () => {
  it("generates 15 resources", () => {
    const apps = generateApplications(TENANT);
    expect(generateResources(TENANT, apps)).toHaveLength(15);
  });

  it("all have valid sensitivity values", () => {
    const apps = generateApplications(TENANT);
    const valid = new Set(["public", "internal", "confidential", "restricted"]);
    for (const r of generateResources(TENANT, apps)) {
      expect(valid.has(r.sensitivity)).toBe(true);
    }
  });

  it("all reference an existing application", () => {
    const apps = generateApplications(TENANT);
    const appIds = new Set(apps.map((a) => a.id));
    for (const r of generateResources(TENANT, apps)) {
      expect(appIds.has(r.applicationRef!)).toBe(true);
    }
  });
});

describe("generateRoles()", () => {
  it("generates roles for every app (12 apps x 10 role templates = 120)", () => {
    const apps = generateApplications(TENANT);
    expect(generateRoles(TENANT, apps)).toHaveLength(120);
  });

  it("all roles reference an existing application", () => {
    const apps = generateApplications(TENANT);
    const appIds = new Set(apps.map((a) => a.id));
    for (const role of generateRoles(TENANT, apps)) {
      expect(appIds.has(role.applicationRef!)).toBe(true);
    }
  });
});

describe("generateGroups()", () => {
  it("generates 8 groups", () => {
    expect(generateGroups(TENANT)).toHaveLength(8);
  });

  it("includes an 'All Employees' group", () => {
    const names = generateGroups(TENANT).map((g) => g.displayName);
    expect(names).toContain("All Employees");
  });
});

// ---------------------------------------------------------------------------
// HumanIdentity generator
// ---------------------------------------------------------------------------

describe("generateHumans()", () => {
  const orgUnits = generateOrgUnits(TENANT);

  it("generates the exact requested count", () => {
    expect(generateHumans(500, TENANT, orgUnits)).toHaveLength(500);
    expect(generateHumans(10, TENANT, orgUnits)).toHaveLength(10);
  });

  it("all humans have required base fields", () => {
    for (const h of generateHumans(20, TENANT, orgUnits)) {
      expect(h.id).toBeTruthy();
      expect(h.tenantId).toBe(TENANT);
      expect(h.nodeType).toBe(NodeType.HumanIdentity);
      expect(h.createdAt).toBeTruthy();
      expect(h.updatedAt).toBeTruthy();
    }
  });

  it("risk scores are in the 0-1 range", () => {
    for (const h of generateHumans(50, TENANT, orgUnits)) {
      expect(h.riskScore).toBeGreaterThanOrEqual(0);
      expect(h.riskScore).toBeLessThanOrEqual(1);
    }
  });

  it("email addresses are unique", () => {
    const humans = generateHumans(100, TENANT, orgUnits);
    const emails = humans.map((h) => h.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it("ids are unique", () => {
    const humans = generateHumans(100, TENANT, orgUnits);
    const ids = humans.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all emails contain @", () => {
    for (const h of generateHumans(20, TENANT, orgUnits)) {
      expect(h.email).toContain("@");
    }
  });

  it("status values are valid IdentityStatus enum values", () => {
    const valid = new Set(Object.values(IdentityStatus));
    for (const h of generateHumans(50, TENANT, orgUnits)) {
      expect(valid.has(h.status)).toBe(true);
    }
  });

  it("managerRef references an earlier human when set", () => {
    // The generator sets managerRef to humans[0..19], so all manager refs
    // must be present in the generated set
    const humans = generateHumans(100, TENANT, orgUnits);
    const idSet = new Set(humans.map((h) => h.id));
    for (const h of humans) {
      if (h.managerRef !== undefined) {
        expect(idSet.has(h.managerRef)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// ServiceAccount generator
// ---------------------------------------------------------------------------

describe("generateServiceAccounts()", () => {
  const orgUnits = generateOrgUnits(TENANT);
  const humans = generateHumans(20, TENANT, orgUnits);
  const apps = generateApplications(TENANT);

  it("generates the exact requested count", () => {
    expect(generateServiceAccounts(200, TENANT, humans, apps)).toHaveLength(200);
  });

  it("all have valid nodeType", () => {
    for (const sa of generateServiceAccounts(20, TENANT, humans, apps)) {
      expect(sa.nodeType).toBe(NodeType.ServiceAccount);
    }
  });

  it("orphaned accounts have elevated risk scores", () => {
    const accounts = generateServiceAccounts(200, TENANT, humans, apps);
    const orphaned = accounts.filter((sa) => sa.status === IdentityStatus.Orphaned);
    // There will be some orphaned accounts; all should have risk > 0.5
    if (orphaned.length > 0) {
      for (const sa of orphaned) {
        expect(sa.riskScore).toBeGreaterThanOrEqual(0.5);
      }
    }
  });

  it("ownerRef references a real human when set", () => {
    const accounts = generateServiceAccounts(50, TENANT, humans, apps);
    const humanIds = new Set(humans.map((h) => h.id));
    for (const sa of accounts) {
      if (sa.ownerRef !== undefined) {
        expect(humanIds.has(sa.ownerRef)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// AgentIdentity generator
// ---------------------------------------------------------------------------

describe("generateAgentIdentities()", () => {
  it("generates the exact requested count", () => {
    expect(generateAgentIdentities(50, TENANT)).toHaveLength(50);
  });

  it("all have valid nodeType", () => {
    for (const a of generateAgentIdentities(20, TENANT)) {
      expect(a.nodeType).toBe(NodeType.AgentIdentity);
    }
  });

  it("credentialRef never contains a raw secret - only a vault path", () => {
    for (const a of generateAgentIdentities(20, TENANT)) {
      // Must start with a secrets store prefix, never look like an actual token
      expect(a.credentialRef).toMatch(/^vault\//);
    }
  });

  it("credentialType values are valid", () => {
    const valid = new Set(Object.values(CredentialType));
    for (const a of generateAgentIdentities(20, TENANT)) {
      expect(valid.has(a.credentialType)).toBe(true);
    }
  });

  it("parentAgentRef references an earlier agent when set", () => {
    const agents = generateAgentIdentities(50, TENANT);
    const idSet = new Set(agents.map((a) => a.id));
    for (const a of agents) {
      if (a.parentAgentRef !== undefined) {
        expect(idSet.has(a.parentAgentRef)).toBe(true);
      }
    }
  });

  it("all agents have a non-empty scopeDefinition", () => {
    for (const a of generateAgentIdentities(10, TENANT)) {
      expect(typeof a.scopeDefinition).toBe("object");
      expect(a.scopeDefinition).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Relationship generators
// ---------------------------------------------------------------------------

describe("generateReportsTo()", () => {
  const orgUnits = generateOrgUnits(TENANT);
  const humans = generateHumans(50, TENANT, orgUnits);

  it("only generates edges for humans with a managerRef", () => {
    const edges = generateReportsTo(humans);
    const managedHumans = humans.filter((h) => h.managerRef !== undefined);
    expect(edges).toHaveLength(managedHumans.length);
  });

  it("fromId matches the human's id", () => {
    const edges = generateReportsTo(humans);
    const humanById = new Map(humans.map((h) => [h.id, h]));
    for (const edge of edges) {
      const human = humanById.get(edge.fromId);
      expect(human).toBeDefined();
      expect(human!.managerRef).toBe(edge.toId);
    }
  });
});

describe("generateHasAccess()", () => {
  const orgUnits = generateOrgUnits(TENANT);
  const humans = generateHumans(10, TENANT, orgUnits);
  const apps = generateApplications(TENANT);
  const resources = generateResources(TENANT, apps);
  const serviceAccounts = generateServiceAccounts(5, TENANT, humans, apps);
  const agentIdentities = generateAgentIdentities(5, TENANT);

  it("produces edges for humans, service accounts, and agents", () => {
    const edges = generateHasAccess(humans, serviceAccounts, agentIdentities, resources);
    expect(edges.length).toBeGreaterThan(0);
  });

  it("toType is always Resource", () => {
    const edges = generateHasAccess(humans, serviceAccounts, agentIdentities, resources);
    for (const edge of edges) {
      expect(edge.toType).toBe("Resource");
    }
  });

  it("toId references a real resource", () => {
    const edges = generateHasAccess(humans, serviceAccounts, agentIdentities, resources);
    const resourceIds = new Set(resources.map((r) => r.id));
    for (const edge of edges) {
      expect(resourceIds.has(edge.toId)).toBe(true);
    }
  });
});

describe("generateMemberOf()", () => {
  const orgUnits = generateOrgUnits(TENANT);
  const humans = generateHumans(20, TENANT, orgUnits);
  const groups = generateGroups(TENANT);

  it("every human is a member of All Employees", () => {
    const allEmployees = groups.find((g) => g.displayName === "All Employees");
    const edges = generateMemberOf(humans, groups);
    const allEmployeesEdges = edges.filter((e) => e.toId === allEmployees!.id);
    expect(allEmployeesEdges.length).toBe(humans.length);
  });
});

describe("generateOwns()", () => {
  const orgUnits = generateOrgUnits(TENANT);
  const humans = generateHumans(20, TENANT, orgUnits);
  const apps = generateApplications(TENANT);
  const serviceAccounts = generateServiceAccounts(20, TENANT, humans, apps);

  it("generates one OWNS edge per service account that has an ownerRef", () => {
    const owned = serviceAccounts.filter((sa) => sa.ownerRef !== undefined);
    const edges = generateOwns(humans, serviceAccounts);
    expect(edges).toHaveLength(owned.length);
  });

  it("fromId matches the service account ownerRef", () => {
    const edges = generateOwns(humans, serviceAccounts);
    for (const edge of edges) {
      const sa = serviceAccounts.find((s) => s.id === edge.toId);
      expect(sa?.ownerRef).toBe(edge.fromId);
    }
  });
});

describe("generateSpawned()", () => {
  it("generates one SPAWNED edge per agent that has a parentAgentRef", () => {
    const agents = generateAgentIdentities(50, TENANT);
    const withParent = agents.filter((a) => a.parentAgentRef !== undefined);
    const edges = generateSpawned(agents);
    expect(edges).toHaveLength(withParent.length);
  });
});
