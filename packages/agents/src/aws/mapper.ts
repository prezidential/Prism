// AWS IAM → Identograph mapping.
//
// Reads a normalized IAM snapshot and produces a provider-agnostic MappedGraph:
// IAM users and roles become NHIdentity vertices, attached policies become
// Entitlement vertices, and each principal gets a HAS_ENTITLEMENT edge to its
// policies. Anchored on ARN (the stable AWS identifier) so re-runs reconcile.

import type { GraphEdgeUpsert, GraphVertexUpsert, MappedGraph } from "../ingest/graph-ops.js";

export interface IamUser {
  userName: string;
  userId: string;
  arn: string;
  createDate: string;
  path?: string;
  tags?: Record<string, string>;
}

export interface IamAccessKey {
  accessKeyId: string;
  status: "Active" | "Inactive";
  createDate: string;
  lastUsedDate?: string;
}

export interface IamRole {
  roleName: string;
  roleId: string;
  arn: string;
  createDate: string;
  path?: string;
  tags?: Record<string, string>;
}

export interface IamAttachedPolicy {
  policyName: string;
  policyArn: string;
}

export interface IamUserRecord {
  user: IamUser;
  accessKeys: IamAccessKey[];
  attachedPolicies: IamAttachedPolicy[];
}

export interface IamRoleRecord {
  role: IamRole;
  attachedPolicies: IamAttachedPolicy[];
}

export interface IamSnapshot {
  users: IamUserRecord[];
  roles: IamRoleRecord[];
}

// A source of IAM data — implemented by a live AWS SDK adapter or a fixture.
export interface AwsIamSource {
  fetchSnapshot(): Promise<IamSnapshot>;
}

// AWS-managed policies / names that imply privileged access.
const PRIVILEGED_PATTERN = /(administrator|admin|poweruser|fullaccess|\*)/i;

export function isPrivilegedPolicy(policy: IamAttachedPolicy): boolean {
  return PRIVILEGED_PATTERN.test(policy.policyName) || PRIVILEGED_PATTERN.test(policy.policyArn);
}

function policyVertex(policy: IamAttachedPolicy, tenantId: string, now: string): GraphVertexUpsert {
  const privileged = isPrivilegedPolicy(policy);
  return {
    type: "Entitlement",
    externalId: policy.policyArn,
    externalIdField: "id",
    props: {
      tenantId,
      nodeType: "Entitlement",
      displayName: policy.policyName,
      description: `AWS IAM policy ${policy.policyName}`,
      entitlementType: "iam-policy",
      provider: "aws",
      isPrivileged: privileged,
      riskWeight: privileged ? 0.8 : 0.3,
      status: "Active",
      riskScore: 0,
      createdAt: now,
      updatedAt: now,
    },
  };
}

export function mapIamSnapshot(snapshot: IamSnapshot, tenantId: string, now: string): MappedGraph {
  const vertices: GraphVertexUpsert[] = [];
  const edges: GraphEdgeUpsert[] = [];
  const policySeen = new Set<string>();

  const addPolicies = (
    ownerArn: string,
    policies: IamAttachedPolicy[],
  ): void => {
    for (const policy of policies) {
      if (!policySeen.has(policy.policyArn)) {
        policySeen.add(policy.policyArn);
        vertices.push(policyVertex(policy, tenantId, now));
      }
      edges.push({
        edgeType: "HAS_ENTITLEMENT",
        fromType: "NHIdentity",
        toType: "Entitlement",
        fromExternalId: ownerArn,
        toExternalId: policy.policyArn,
        props: { grantedAt: now, isActive: true },
      });
    }
  };

  for (const record of snapshot.users) {
    const { user, accessKeys, attachedPolicies } = record;
    const activeKey = accessKeys.find((k) => k.status === "Active");
    vertices.push({
      type: "NHIdentity",
      externalId: user.arn,
      externalIdField: "id",
      props: {
        tenantId,
        nodeType: "NHIdentity",
        kind: "IAMUser",
        displayName: user.userName,
        provider: "aws",
        status: "Active",
        riskScore: 0,
        isRotationEnabled: accessKeys.length > 0,
        lastRotatedAt: activeKey?.createDate ?? user.createDate,
        lastActivity: activeKey?.lastUsedDate ?? user.createDate,
        externalIds: { aws: user.userId },
        createdAt: user.createDate,
        updatedAt: now,
      },
    });
    addPolicies(user.arn, attachedPolicies);
  }

  for (const record of snapshot.roles) {
    const { role, attachedPolicies } = record;
    vertices.push({
      type: "NHIdentity",
      externalId: role.arn,
      externalIdField: "id",
      props: {
        tenantId,
        nodeType: "NHIdentity",
        kind: "IAMRole",
        displayName: role.roleName,
        provider: "aws",
        status: "Active",
        riskScore: 0,
        isRotationEnabled: false,
        externalIds: { aws: role.roleId },
        createdAt: role.createDate,
        updatedAt: now,
      },
    });
    addPolicies(role.arn, attachedPolicies);
  }

  return { vertices, edges };
}
