import { describe, it, expect } from "vitest";
import { mapOktaUserToEnvelope, mapOktaGroupToEnvelope } from "../mapper.js";
import type { OktaApiUser, OktaApiGroup } from "../client.js";

function makeOktaUser(overrides: Partial<OktaApiUser> = {}): OktaApiUser {
  return {
    id: "okta-user-001",
    status: "ACTIVE",
    created: "2024-01-01T00:00:00.000Z",
    lastUpdated: "2024-06-01T00:00:00.000Z",
    lastLogin: "2024-06-15T10:00:00.000Z",
    profile: {
      login: "jane.doe@example.com",
      email: "jane.doe@example.com",
      firstName: "Jane",
      lastName: "Doe",
      displayName: "Jane Doe",
      department: "Engineering",
      title: "Senior Engineer",
      managerId: "mgr-001",
      employeeNumber: "EMP-123",
    },
    ...overrides,
  };
}

function makeOktaGroup(overrides: Partial<OktaApiGroup> = {}): OktaApiGroup {
  return {
    id: "grp-001",
    type: "OKTA_GROUP",
    lastUpdated: "2024-01-15T00:00:00.000Z",
    lastMembershipUpdated: "2024-05-01T00:00:00.000Z",
    profile: {
      name: "Engineering",
      description: "Engineering team group",
    },
    ...overrides,
  };
}

describe("mapOktaUserToEnvelope", () => {
  it("produces valid envelope shape", () => {
    const user = makeOktaUser();
    const envelope = mapOktaUserToEnvelope(user, "prism-dev", "okta-dev", "identity.discovered");

    expect(envelope.eventId).toBeDefined();
    expect(envelope.schemaVersion).toBe("1.0");
    expect(envelope.tenantId).toBe("prism-dev");
    expect(envelope.sourceSystemId).toBe("okta-dev");
    expect(envelope.eventType).toBe("identity.discovered");
    expect(envelope.timestamp).toBeDefined();
    expect(envelope.correlationId).toBe(user.id);
  });

  it("maps active user to correct status", () => {
    const user = makeOktaUser({ status: "ACTIVE" });
    const envelope = mapOktaUserToEnvelope(user, "prism-dev", "okta-dev", "identity.discovered");
    expect(envelope.payload.status).toBe("ACTIVE");
  });

  it("maps inactive/deprovisioned user status", () => {
    const user = makeOktaUser({ status: "DEPROVISIONED" });
    const envelope = mapOktaUserToEnvelope(user, "prism-dev", "okta-dev", "identity.deactivated");
    expect(envelope.payload.status).toBe("DEPROVISIONED");
    expect(envelope.eventType).toBe("identity.deactivated");
  });

  it("includes all required fields in payload", () => {
    const user = makeOktaUser();
    const envelope = mapOktaUserToEnvelope(user, "prism-dev", "okta-dev", "identity.discovered");
    const { payload } = envelope;

    expect(payload.sourceId).toBe(user.id);
    expect(payload.login).toBe(user.profile.login);
    expect(payload.email).toBe(user.profile.email);
    expect(payload.firstName).toBe(user.profile.firstName);
    expect(payload.lastName).toBe(user.profile.lastName);
    expect(payload.displayName).toBeDefined();
    expect(payload.createdAt).toBe(user.created);
    expect(payload.updatedAt).toBe(user.lastUpdated);
  });

  it("includes optional fields when present", () => {
    const user = makeOktaUser();
    const envelope = mapOktaUserToEnvelope(user, "prism-dev", "okta-dev", "identity.discovered");
    const { payload } = envelope;

    expect(payload.department).toBe("Engineering");
    expect(payload.title).toBe("Senior Engineer");
    expect(payload.managerId).toBe("mgr-001");
    expect(payload.employeeNumber).toBe("EMP-123");
  });

  it("generates displayName from firstName + lastName when not provided", () => {
    const user = makeOktaUser({
      profile: {
        login: "john@example.com",
        email: "john@example.com",
        firstName: "John",
        lastName: "Smith",
        // no displayName
      },
    });
    const envelope = mapOktaUserToEnvelope(user, "prism-dev", "okta-dev", "identity.discovered");
    expect(envelope.payload.displayName).toBe("John Smith");
  });

  it("partitionKey is the sourceSystemId via correlationId", () => {
    const user = makeOktaUser();
    const envelope = mapOktaUserToEnvelope(user, "prism-dev", "okta-dev", "identity.discovered");
    // The envelope's correlationId links to the source identity
    expect(envelope.correlationId).toBe(user.id);
    expect(envelope.sourceSystemId).toBe("okta-dev");
  });

  it("maps identity.updated event type", () => {
    const user = makeOktaUser();
    const envelope = mapOktaUserToEnvelope(user, "prism-dev", "okta-dev", "identity.updated");
    expect(envelope.eventType).toBe("identity.updated");
  });

  it("includes rawProfile in payload", () => {
    const user = makeOktaUser();
    const envelope = mapOktaUserToEnvelope(user, "prism-dev", "okta-dev", "identity.discovered");
    expect(envelope.payload.rawProfile).toBeDefined();
    expect(typeof envelope.payload.rawProfile).toBe("object");
  });
});

describe("mapOktaGroupToEnvelope", () => {
  it("produces valid envelope shape for a group", () => {
    const group = makeOktaGroup();
    const envelope = mapOktaGroupToEnvelope(group, "prism-dev", "okta-dev");

    expect(envelope.eventId).toBeDefined();
    expect(envelope.schemaVersion).toBe("1.0");
    expect(envelope.tenantId).toBe("prism-dev");
    expect(envelope.sourceSystemId).toBe("okta-dev");
    expect(envelope.eventType).toBe("group.discovered");
  });

  it("includes group payload fields", () => {
    const group = makeOktaGroup();
    const envelope = mapOktaGroupToEnvelope(group, "prism-dev", "okta-dev");
    const { payload } = envelope;

    expect(payload.sourceId).toBe(group.id);
    expect(payload.name).toBe(group.profile.name);
    expect(payload.description).toBe(group.profile.description);
    expect(payload.groupType).toBe("OKTA_GROUP");
  });

  it("maps APP_GROUP type correctly", () => {
    const group = makeOktaGroup({ type: "APP_GROUP" });
    const envelope = mapOktaGroupToEnvelope(group, "prism-dev", "okta-dev");
    expect(envelope.payload.groupType).toBe("APP_GROUP");
  });

  it("maps BUILT_IN type correctly", () => {
    const group = makeOktaGroup({ type: "BUILT_IN" });
    const envelope = mapOktaGroupToEnvelope(group, "prism-dev", "okta-dev");
    expect(envelope.payload.groupType).toBe("BUILT_IN");
  });

  it("correlationId equals group id", () => {
    const group = makeOktaGroup({ id: "specific-group-id" });
    const envelope = mapOktaGroupToEnvelope(group, "prism-dev", "okta-dev");
    expect(envelope.correlationId).toBe("specific-group-id");
  });
});
