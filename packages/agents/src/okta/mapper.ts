// Maps Okta API responses to IdentityEventEnvelope format
// Uses real types from Dev 1's files

import type { IdentityEventEnvelope, EventType } from "../messages/envelope.js";
import { buildEnvelope } from "../messages/envelope.js";
import type { OktaUserPayload, OktaGroupPayload } from "../messages/okta.js";
import type { OktaApiUser, OktaApiGroup } from "./client.js";

export function mapOktaUserToEnvelope(
  user: OktaApiUser,
  tenantId: string,
  sourceSystemId: string,
  eventType: Extract<EventType, "identity.discovered" | "identity.updated" | "identity.deactivated">,
  sourceAgent = "okta-ingest-agent",
): IdentityEventEnvelope<OktaUserPayload> {
  const payload: OktaUserPayload = {
    sourceId: user.id,
    login: user.profile.login,
    email: user.profile.email,
    firstName: user.profile.firstName,
    lastName: user.profile.lastName,
    displayName:
      user.profile.displayName ?? `${user.profile.firstName} ${user.profile.lastName}`.trim(),
    status: user.status as OktaUserPayload["status"],
    employeeNumber: user.profile.employeeNumber,
    department: user.profile.department,
    title: user.profile.title,
    managerId: user.profile.managerId,
    mobilePhone: user.profile.mobilePhone,
    createdAt: user.created,
    updatedAt: user.lastUpdated,
    rawProfile: user.profile as Record<string, unknown>,
  };

  return buildEnvelope<OktaUserPayload>({
    eventType,
    timestamp: new Date().toISOString(),
    sourceAgent,
    sourceSystemId,
    correlationId: user.id,
    tenantId,
    payload,
  });
}

export function mapOktaGroupToEnvelope(
  group: OktaApiGroup,
  tenantId: string,
  sourceSystemId: string,
  sourceAgent = "okta-ingest-agent",
): IdentityEventEnvelope<OktaGroupPayload> {
  const groupType = mapGroupType(group.type);

  const payload: OktaGroupPayload = {
    sourceId: group.id,
    name: group.profile.name,
    description: group.profile.description,
    groupType,
    createdAt: group.lastUpdated, // Okta doesn't always expose createdAt on groups
    updatedAt: group.lastUpdated,
  };

  return buildEnvelope<OktaGroupPayload>({
    eventType: "group.discovered",
    timestamp: new Date().toISOString(),
    sourceAgent,
    sourceSystemId,
    correlationId: group.id,
    tenantId,
    payload,
  });
}

function mapGroupType(type: string): OktaGroupPayload["groupType"] {
  if (type === "APP_GROUP") return "APP_GROUP";
  if (type === "BUILT_IN") return "BUILT_IN";
  return "OKTA_GROUP";
}
