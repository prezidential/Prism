import { randomUUID } from "crypto";

export type SourceSystemType = "HRIS" | "IDP" | "CLOUD" | "SAAS" | "PAM" | "CUSTOM";

export type EventType =
  | "identity.discovered"
  | "identity.updated"
  | "identity.deactivated"
  | "identity.deleted"
  | "group.discovered"
  | "group.membership.changed"
  | "app.assignment.added"
  | "app.assignment.removed"
  | "ingest.run.started"
  | "ingest.run.completed"
  | "ingest.run.failed";

export interface IdentityEventEnvelope<TPayload = unknown> {
  eventId: string;
  eventType: EventType;
  timestamp: string;
  sourceAgent: string;
  sourceSystemId: string;
  correlationId: string;
  tenantId: string;
  schemaVersion: "1.0";
  payload: TPayload;
}

export interface ProcessedEventPayload {
  sourceId: string;
  identographNodeId: string;
  operation: "created" | "updated";
  nodeType: string;
}

export function buildEnvelope<TPayload>(
  fields: Omit<IdentityEventEnvelope<TPayload>, "eventId" | "schemaVersion">,
): IdentityEventEnvelope<TPayload> {
  return {
    ...fields,
    eventId: randomUUID(),
    schemaVersion: "1.0",
  };
}
