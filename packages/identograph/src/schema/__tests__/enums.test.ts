import { describe, expect, it } from "vitest";
import {
  AccessLevel,
  CredentialType,
  EdgeType,
  EmploymentType,
  IdentityStatus,
  NodeType,
} from "../enums.js";

describe("NodeType", () => {
  it("has exactly 18 node types (12 Phase 0 + 6 Phase 1)", () => {
    expect(Object.values(NodeType)).toHaveLength(18);
  });

  it("includes all 6 identity types", () => {
    expect(NodeType.HumanIdentity).toBe("HumanIdentity");
    expect(NodeType.ServiceAccount).toBe("ServiceAccount");
    expect(NodeType.AgentIdentity).toBe("AgentIdentity");
    expect(NodeType.APIToken).toBe("APIToken");
    expect(NodeType.WorkloadIdentity).toBe("WorkloadIdentity");
    expect(NodeType.DeviceIdentity).toBe("DeviceIdentity");
  });

  it("includes all 2 resource types", () => {
    expect(NodeType.Application).toBe("Application");
    expect(NodeType.Resource).toBe("Resource");
  });

  it("includes all 2 policy types", () => {
    expect(NodeType.Role).toBe("Role");
    expect(NodeType.Policy).toBe("Policy");
  });

  it("includes all 2 structural types", () => {
    expect(NodeType.Group).toBe("Group");
    expect(NodeType.OrgUnit).toBe("OrgUnit");
  });

  it("has no duplicate values", () => {
    const values = Object.values(NodeType);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("EdgeType", () => {
  it("has exactly 16 edge types (10 Phase 0 + 6 Phase 1)", () => {
    expect(Object.values(EdgeType)).toHaveLength(16);
  });

  it("includes all spec-defined edge types", () => {
    expect(EdgeType.HAS_ACCESS).toBe("HAS_ACCESS");
    expect(EdgeType.ASSIGNED_ROLE).toBe("ASSIGNED_ROLE");
    expect(EdgeType.MEMBER_OF).toBe("MEMBER_OF");
    expect(EdgeType.REPORTS_TO).toBe("REPORTS_TO");
    expect(EdgeType.OWNS).toBe("OWNS");
    expect(EdgeType.SPAWNED).toBe("SPAWNED");
    expect(EdgeType.GOVERNS).toBe("GOVERNS");
    expect(EdgeType.PEER_OF).toBe("PEER_OF");
    expect(EdgeType.CREATED_BY).toBe("CREATED_BY");
    expect(EdgeType.USED_BY).toBe("USED_BY");
  });

  it("has no duplicate values", () => {
    const values = Object.values(EdgeType);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("IdentityStatus", () => {
  it("has exactly 5 statuses", () => {
    expect(Object.values(IdentityStatus)).toHaveLength(5);
  });

  it("includes all expected statuses", () => {
    expect(IdentityStatus.Active).toBe("Active");
    expect(IdentityStatus.Inactive).toBe("Inactive");
    expect(IdentityStatus.Suspended).toBe("Suspended");
    expect(IdentityStatus.Orphaned).toBe("Orphaned");
    expect(IdentityStatus.PendingReview).toBe("PendingReview");
  });
});

describe("EmploymentType", () => {
  it("has exactly 4 employment types", () => {
    expect(Object.values(EmploymentType)).toHaveLength(4);
  });

  it("includes all spec-defined types", () => {
    expect(EmploymentType.FTE).toBe("FTE");
    expect(EmploymentType.Contractor).toBe("Contractor");
    expect(EmploymentType.Vendor).toBe("Vendor");
    expect(EmploymentType.Partner).toBe("Partner");
  });
});

describe("CredentialType", () => {
  it("has exactly 4 credential types", () => {
    expect(Object.values(CredentialType)).toHaveLength(4);
  });

  it("includes all spec-defined types", () => {
    expect(CredentialType.OAuth).toBe("OAuth");
    expect(CredentialType.APIKey).toBe("APIKey");
    expect(CredentialType.mTLS).toBe("mTLS");
    expect(CredentialType.OIDC).toBe("OIDC");
  });
});

describe("AccessLevel", () => {
  it("has exactly 4 access levels", () => {
    expect(Object.values(AccessLevel)).toHaveLength(4);
  });
});
