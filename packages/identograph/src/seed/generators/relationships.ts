// Generates realistic edges between identity nodes.
// Produces: HAS_ACCESS, ASSIGNED_ROLE, MEMBER_OF, REPORTS_TO, OWNS, SPAWNED

import { faker } from "@faker-js/faker";
import { AccessLevel, EdgeType } from "../../schema/enums.js";
import type {
  AgentIdentity,
  Application,
  Group,
  HumanIdentity,
  Resource,
  Role,
  ServiceAccount,
} from "../../schema/types.js";

export interface EdgeRecord {
  edgeType: EdgeType;
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  props: Record<string, unknown>;
}

function past(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function future(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

// ---------------------------------------------------------------------------
// REPORTS_TO edges: wire up the manager hierarchy
// ---------------------------------------------------------------------------

export function generateReportsTo(humans: HumanIdentity[]): EdgeRecord[] {
  return humans
    .filter((h) => h.managerRef !== undefined)
    .map((h) => ({
      edgeType: EdgeType.REPORTS_TO,
      fromType: "HumanIdentity",
      fromId: h.id,
      toType: "HumanIdentity",
      toId: h.managerRef!,
      props: {
        effectiveDate: h.hireDate,
        source: "workday",
        createdAt: h.hireDate,
      },
    }));
}

// ---------------------------------------------------------------------------
// ASSIGNED_ROLE edges: humans -> roles (2-5 roles each)
// ---------------------------------------------------------------------------

export function generateAssignedRoles(
  humans: HumanIdentity[],
  roles: Role[],
  applications: Application[],
): EdgeRecord[] {
  const edges: EdgeRecord[] = [];

  for (const human of humans) {
    // Filter roles to apps the human's department plausibly uses
    const roleCount = faker.number.int({ min: 1, max: 5 });
    const assignedRoles = faker.helpers.arrayElements(roles, roleCount);

    for (const role of assignedRoles) {
      const assignedDaysAgo = faker.number.int({ min: 1, max: 730 });
      const isExpiring = faker.datatype.boolean({ probability: 0.15 });

      edges.push({
        edgeType: EdgeType.ASSIGNED_ROLE,
        fromType: "HumanIdentity",
        fromId: human.id,
        toType: "Role",
        toId: role.id,
        props: {
          assignedAt: past(assignedDaysAgo),
          assignedBy: faker.helpers.arrayElement(humans.slice(0, 20))?.id,
          expiresAt: isExpiring ? future(faker.number.int({ min: 1, max: 90 })) : undefined,
          certifiedAt: faker.datatype.boolean({ probability: 0.7 })
            ? past(faker.number.int({ min: 1, max: 90 }))
            : undefined,
          createdAt: past(assignedDaysAgo),
        },
      });
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// HAS_ACCESS edges: identities -> resources (direct access grants)
// ---------------------------------------------------------------------------

export function generateHasAccess(
  humans: HumanIdentity[],
  serviceAccounts: ServiceAccount[],
  agentIdentities: AgentIdentity[],
  resources: Resource[],
): EdgeRecord[] {
  const edges: EdgeRecord[] = [];

  // Humans: 1-4 direct resource access grants each
  for (const human of humans) {
    const count = faker.number.int({ min: 0, max: 4 });
    const targets = faker.helpers.arrayElements(resources, count);
    for (const resource of targets) {
      const grantedDaysAgo = faker.number.int({ min: 1, max: 365 });
      edges.push({
        edgeType: EdgeType.HAS_ACCESS,
        fromType: "HumanIdentity",
        fromId: human.id,
        toType: "Resource",
        toId: resource.id,
        props: {
          grantedAt: past(grantedDaysAgo),
          grantedBy: faker.helpers.arrayElement(humans.slice(0, 20))?.id,
          accessLevel: faker.helpers.weightedArrayElement([
            { weight: 60, value: AccessLevel.Read },
            { weight: 25, value: AccessLevel.Write },
            { weight: 10, value: AccessLevel.Admin },
            { weight: 5, value: AccessLevel.Owner },
          ]),
          lastUsed: faker.datatype.boolean({ probability: 0.8 })
            ? past(faker.number.int({ min: 0, max: 30 }))
            : past(faker.number.int({ min: 90, max: 365 })),
          createdAt: past(grantedDaysAgo),
        },
      });
    }
  }

  // Service accounts: 2-6 resource accesses each
  for (const sa of serviceAccounts) {
    const count = faker.number.int({ min: 2, max: 6 });
    const targets = faker.helpers.arrayElements(resources, count);
    for (const resource of targets) {
      const grantedDaysAgo = faker.number.int({ min: 1, max: 730 });
      edges.push({
        edgeType: EdgeType.HAS_ACCESS,
        fromType: "ServiceAccount",
        fromId: sa.id,
        toType: "Resource",
        toId: resource.id,
        props: {
          grantedAt: past(grantedDaysAgo),
          accessLevel: faker.helpers.weightedArrayElement([
            { weight: 30, value: AccessLevel.Read },
            { weight: 50, value: AccessLevel.Write },
            { weight: 20, value: AccessLevel.Admin },
          ]),
          lastUsed: past(faker.number.int({ min: 0, max: 60 })),
          createdAt: past(grantedDaysAgo),
        },
      });
    }
  }

  // Agents: scoped to a subset of resources
  for (const agent of agentIdentities) {
    const count = faker.number.int({ min: 1, max: 3 });
    const targets = faker.helpers.arrayElements(resources, count);
    for (const resource of targets) {
      const grantedDaysAgo = faker.number.int({ min: 1, max: 180 });
      edges.push({
        edgeType: EdgeType.HAS_ACCESS,
        fromType: "AgentIdentity",
        fromId: agent.id,
        toType: "Resource",
        toId: resource.id,
        props: {
          grantedAt: past(grantedDaysAgo),
          accessLevel: AccessLevel.Read,
          lastUsed: past(faker.number.int({ min: 0, max: 7 })),
          createdAt: past(grantedDaysAgo),
        },
      });
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// MEMBER_OF edges: humans -> groups
// ---------------------------------------------------------------------------

export function generateMemberOf(
  humans: HumanIdentity[],
  groups: Group[],
): EdgeRecord[] {
  const edges: EdgeRecord[] = [];

  for (const human of humans) {
    // Everyone is in "All Employees"
    const allEmployeesGroup = groups.find((g) => g.displayName === "All Employees");
    if (allEmployeesGroup) {
      edges.push({
        edgeType: EdgeType.MEMBER_OF,
        fromType: "HumanIdentity",
        fromId: human.id,
        toType: "Group",
        toId: allEmployeesGroup.id,
        props: { joinedAt: human.hireDate, addedBy: "system", createdAt: human.hireDate },
      });
    }

    // 1-3 additional groups
    const additionalGroups = faker.helpers.arrayElements(
      groups.filter((g) => g.displayName !== "All Employees"),
      faker.number.int({ min: 0, max: 3 }),
    );
    for (const group of additionalGroups) {
      edges.push({
        edgeType: EdgeType.MEMBER_OF,
        fromType: "HumanIdentity",
        fromId: human.id,
        toType: "Group",
        toId: group.id,
        props: {
          joinedAt: past(faker.number.int({ min: 1, max: 365 })),
          addedBy: faker.helpers.arrayElement(humans.slice(0, 10))?.id,
          createdAt: past(faker.number.int({ min: 1, max: 365 })),
        },
      });
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// OWNS edges: humans -> service accounts
// ---------------------------------------------------------------------------

export function generateOwns(
  humans: HumanIdentity[],
  serviceAccounts: ServiceAccount[],
): EdgeRecord[] {
  return serviceAccounts
    .filter((sa) => sa.ownerRef !== undefined)
    .map((sa) => ({
      edgeType: EdgeType.OWNS,
      fromType: "HumanIdentity",
      fromId: sa.ownerRef!,
      toType: "ServiceAccount",
      toId: sa.id,
      props: {
        since: sa.createdAt,
        approvedBy: faker.helpers.arrayElement(humans.slice(0, 10))?.id,
        createdAt: sa.createdAt,
      },
    }));
}

// ---------------------------------------------------------------------------
// SPAWNED edges: agents that have parent agents
// ---------------------------------------------------------------------------

export function generateSpawned(agentIdentities: AgentIdentity[]): EdgeRecord[] {
  return agentIdentities
    .filter((a) => a.parentAgentRef !== undefined)
    .map((a) => ({
      edgeType: EdgeType.SPAWNED,
      fromType: "AgentIdentity",
      fromId: a.parentAgentRef!,
      toType: "AgentIdentity",
      toId: a.id,
      props: {
        at: a.spawnedAt,
        parentCorrelationId: faker.string.uuid(),
        createdAt: a.spawnedAt,
      },
    }));
}
