import { describe, expect, it } from "vitest";
import {
  CaepEventType,
  EdgeType,
  NHIdentityKind,
  NodeType,
  SessionState,
  SignalSeverity,
} from "../enums.js";

describe("Phase 1 NodeType additions", () => {
  it("includes NHIdentity", () => {
    expect(NodeType.NHIdentity).toBe("NHIdentity");
  });

  it("includes Entitlement", () => {
    expect(NodeType.Entitlement).toBe("Entitlement");
  });

  it("includes Session", () => {
    expect(NodeType.Session).toBe("Session");
  });

  it("includes Delegation", () => {
    expect(NodeType.Delegation).toBe("Delegation");
  });

  it("includes ExecutionEvent", () => {
    expect(NodeType.ExecutionEvent).toBe("ExecutionEvent");
  });

  it("includes RiskSignal", () => {
    expect(NodeType.RiskSignal).toBe("RiskSignal");
  });

  it("has no duplicate values", () => {
    const values = Object.values(NodeType);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("Phase 1 EdgeType additions", () => {
  it("includes HAS_ENTITLEMENT", () => {
    expect(EdgeType.HAS_ENTITLEMENT).toBe("HAS_ENTITLEMENT");
  });

  it("includes DELEGATES_TO", () => {
    expect(EdgeType.DELEGATES_TO).toBe("DELEGATES_TO");
  });

  it("includes EXECUTED_BY", () => {
    expect(EdgeType.EXECUTED_BY).toBe("EXECUTED_BY");
  });

  it("includes OWNS_RESOURCE", () => {
    expect(EdgeType.OWNS_RESOURCE).toBe("OWNS_RESOURCE");
  });

  it("includes TRUSTS", () => {
    expect(EdgeType.TRUSTS).toBe("TRUSTS");
  });

  it("includes GENERATES_SIGNAL", () => {
    expect(EdgeType.GENERATES_SIGNAL).toBe("GENERATES_SIGNAL");
  });

  it("has no duplicate values", () => {
    const values = Object.values(EdgeType);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("CaepEventType (SSF/CAEP)", () => {
  it("includes all 7 CAEP event types", () => {
    expect(Object.values(CaepEventType)).toHaveLength(7);
  });

  it("includes risk-level-change", () => {
    expect(CaepEventType.RiskLevelChange).toBe("risk-level-change");
  });

  it("includes credential-change", () => {
    expect(CaepEventType.CredentialChange).toBe("credential-change");
  });

  it("includes session-revoked", () => {
    expect(CaepEventType.SessionRevoked).toBe("session-revoked");
  });
});

describe("NHIdentityKind", () => {
  it("includes IAMUser", () => {
    expect(NHIdentityKind.IAMUser).toBe("IAMUser");
  });

  it("includes IAMRole", () => {
    expect(NHIdentityKind.IAMRole).toBe("IAMRole");
  });

  it("has no duplicate values", () => {
    const values = Object.values(NHIdentityKind);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("SessionState", () => {
  it("includes Active, Revoked, Expired, Suspended", () => {
    expect(SessionState.Active).toBe("Active");
    expect(SessionState.Revoked).toBe("Revoked");
    expect(SessionState.Expired).toBe("Expired");
    expect(SessionState.Suspended).toBe("Suspended");
  });
});

describe("SignalSeverity", () => {
  it("includes info, warning, critical", () => {
    expect(SignalSeverity.Info).toBe("info");
    expect(SignalSeverity.Warning).toBe("warning");
    expect(SignalSeverity.Critical).toBe("critical");
  });
});
