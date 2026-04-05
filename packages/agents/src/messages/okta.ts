import type { IdentityEventEnvelope } from "./envelope.js";

export type OktaUserStatus =
  | "ACTIVE"
  | "PROVISIONED"
  | "STAGED"
  | "DEPROVISIONED"
  | "SUSPENDED"
  | "LOCKED_OUT"
  | "PASSWORD_EXPIRED"
  | "RECOVERY";

export interface OktaUserPayload {
  sourceId: string;
  login: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  status: OktaUserStatus;
  employeeNumber?: string;
  department?: string;
  title?: string;
  managerId?: string;
  mobilePhone?: string;
  createdAt: string;
  updatedAt: string;
  rawProfile: Record<string, unknown>;
}

export interface OktaGroupPayload {
  sourceId: string;
  name: string;
  description?: string;
  groupType: "OKTA_GROUP" | "APP_GROUP" | "BUILT_IN";
  createdAt: string;
  updatedAt: string;
}

export interface OktaGroupMembershipPayload {
  userId: string;
  groupId: string;
  action: "added" | "removed";
}

export interface OktaAppAssignmentPayload {
  userId: string;
  appId: string;
  appName: string;
  action: "assigned" | "unassigned";
}

export type OktaUserEvent = IdentityEventEnvelope<OktaUserPayload>;
export type OktaGroupEvent = IdentityEventEnvelope<OktaGroupPayload>;
export type OktaGroupMembershipEvent = IdentityEventEnvelope<OktaGroupMembershipPayload>;
export type OktaAppAssignmentEvent = IdentityEventEnvelope<OktaAppAssignmentPayload>;
