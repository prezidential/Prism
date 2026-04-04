// Generates supporting nodes: OrgUnit, Application, Resource, Role, Group
// These are created before identity nodes since identities reference them.

import { faker } from "@faker-js/faker";
import { IdentityStatus, NodeType } from "../../schema/enums.js";
import type {
  Application,
  Group,
  OrgUnit,
  Resource,
  Role,
} from "../../schema/types.js";

const now = () => new Date().toISOString();
const past = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString();


// Fix: updatedAt should just use past()
function makeBase(nodeType: NodeType, tenantId: string) {
  const daysAgo = faker.number.int({ min: 30, max: 1800 });
  return {
    id: faker.string.uuid(),
    tenantId,
    nodeType,
    externalIds: {} as Record<string, string>,
    createdAt: past(daysAgo),
    updatedAt: past(faker.number.int({ min: 0, max: Math.min(daysAgo, 30) })),
    status: IdentityStatus.Active,
    riskScore: faker.number.float({ min: 0, max: 0.3, fractionDigits: 2 }),
    lastActivity: past(faker.number.int({ min: 0, max: 30 })),
    tags: [] as string[],
    metadata: {} as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------------------
// OrgUnits
// ---------------------------------------------------------------------------

const DEPARTMENTS = [
  "Engineering", "Product", "Sales", "Marketing", "Finance",
  "Human Resources", "Legal", "Security", "Operations", "Customer Success",
];

export function generateOrgUnits(tenantId: string): OrgUnit[] {
  return DEPARTMENTS.map((dept, i) => ({
    ...makeBase(NodeType.OrgUnit, tenantId),
    nodeType: NodeType.OrgUnit as const,
    displayName: dept,
    code: dept.toUpperCase().replace(/\s+/g, "_"),
    parentOrgUnitRef: i > 0 ? undefined : undefined,
    headcountApprox: faker.number.int({ min: 10, max: 200 }),
  }));
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

const APPS: Array<{ name: string; type: string; criticality: Application["criticality"]; url?: string }> = [
  { name: "Okta", type: "saas", criticality: "critical", url: "https://company.okta.com" },
  { name: "Salesforce", type: "saas", criticality: "high", url: "https://company.salesforce.com" },
  { name: "GitHub Enterprise", type: "saas", criticality: "high", url: "https://github.company.com" },
  { name: "AWS Production", type: "cloud", criticality: "critical" },
  { name: "AWS Staging", type: "cloud", criticality: "medium" },
  { name: "Jira", type: "saas", criticality: "medium", url: "https://company.atlassian.net" },
  { name: "Slack", type: "saas", criticality: "medium" },
  { name: "ServiceNow", type: "saas", criticality: "high" },
  { name: "Internal API Gateway", type: "internal", criticality: "critical" },
  { name: "Data Warehouse", type: "internal", criticality: "high" },
  { name: "HR Portal", type: "internal", criticality: "medium" },
  { name: "Finance System", type: "internal", criticality: "critical" },
];

export function generateApplications(tenantId: string): Application[] {
  return APPS.map((app) => ({
    ...makeBase(NodeType.Application, tenantId),
    nodeType: NodeType.Application as const,
    displayName: app.name,
    appType: app.type,
    owner: undefined,
    criticality: app.criticality,
    url: app.url,
  }));
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

const RESOURCE_TEMPLATES: Array<{
  name: string;
  type: string;
  sensitivity: Resource["sensitivity"];
}> = [
  { name: "Production Database", type: "database", sensitivity: "restricted" },
  { name: "Staging Database", type: "database", sensitivity: "confidential" },
  { name: "Customer PII Store", type: "database", sensitivity: "restricted" },
  { name: "Financial Records", type: "database", sensitivity: "restricted" },
  { name: "Employee Records", type: "database", sensitivity: "confidential" },
  { name: "Source Code Repository", type: "repository", sensitivity: "confidential" },
  { name: "CI/CD Pipeline", type: "api", sensitivity: "confidential" },
  { name: "Internal API", type: "api", sensitivity: "internal" },
  { name: "Public API", type: "api", sensitivity: "public" },
  { name: "Secrets Vault", type: "secrets", sensitivity: "restricted" },
  { name: "Audit Log Store", type: "storage", sensitivity: "restricted" },
  { name: "Analytics Dashboard", type: "application", sensitivity: "internal" },
  { name: "Kubernetes Cluster - Prod", type: "cloud-resource", sensitivity: "restricted" },
  { name: "Kubernetes Cluster - Dev", type: "cloud-resource", sensitivity: "confidential" },
  { name: "S3 Bucket - Backups", type: "cloud-resource", sensitivity: "confidential" },
];

export function generateResources(tenantId: string, applications: Application[]): Resource[] {
  return RESOURCE_TEMPLATES.map((tmpl) => {
    const app = faker.helpers.arrayElement(applications);
    return {
      ...makeBase(NodeType.Resource, tenantId),
      nodeType: NodeType.Resource as const,
      displayName: tmpl.name,
      resourceType: tmpl.type,
      applicationRef: app.id,
      sensitivity: tmpl.sensitivity,
      classification: tmpl.sensitivity === "restricted" ? "PII" : undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

const ROLE_TEMPLATES: Array<{ name: string; privileged: boolean; perms: string[] }> = [
  { name: "Admin", privileged: true, perms: ["read", "write", "delete", "admin"] },
  { name: "Read Only", privileged: false, perms: ["read"] },
  { name: "Developer", privileged: false, perms: ["read", "write"] },
  { name: "Billing Admin", privileged: true, perms: ["read", "write", "billing"] },
  { name: "Security Admin", privileged: true, perms: ["read", "write", "audit"] },
  { name: "Support", privileged: false, perms: ["read"] },
  { name: "Manager", privileged: false, perms: ["read", "write", "approve"] },
  { name: "Auditor", privileged: false, perms: ["read", "audit"] },
  { name: "Data Engineer", privileged: true, perms: ["read", "write", "execute"] },
  { name: "DevOps Engineer", privileged: true, perms: ["read", "write", "deploy"] },
];

export function generateRoles(tenantId: string, applications: Application[]): Role[] {
  const roles: Role[] = [];
  for (const app of applications) {
    for (const tmpl of ROLE_TEMPLATES) {
      roles.push({
        ...makeBase(NodeType.Role, tenantId),
        nodeType: NodeType.Role as const,
        displayName: `${app.displayName} - ${tmpl.name}`,
        description: `${tmpl.name} access for ${app.displayName}`,
        applicationRef: app.id,
        permissions: tmpl.perms,
        isPrivileged: tmpl.privileged,
      });
    }
  }
  return roles;
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

const GROUP_TEMPLATES: Array<{ name: string; type: string }> = [
  { name: "All Employees", type: "org" },
  { name: "Engineering - All", type: "security" },
  { name: "Contractors", type: "security" },
  { name: "Privileged Users", type: "security" },
  { name: "Finance Team", type: "org" },
  { name: "Security Team", type: "security" },
  { name: "Executives", type: "security" },
  { name: "External Vendors", type: "security" },
];

export function generateGroups(tenantId: string): Group[] {
  return GROUP_TEMPLATES.map((tmpl) => ({
    ...makeBase(NodeType.Group, tenantId),
    nodeType: NodeType.Group as const,
    displayName: tmpl.name,
    groupType: tmpl.type,
    ownerRef: undefined,
    memberCount: faker.number.int({ min: 5, max: 300 }),
  }));
}
