import { describe, it, expect } from "vitest";
import { parseSSD, SSDParseError } from "../parser.js";

const VALID_OKTA_SSD = `
ssdVersion: "1.0"
sourceSystem:
  id: okta-dev
  name: Okta Dev Tenant
  type: IDP
  version: "2024"
  connection:
    type: REST_API
    baseUrl: https://dev-123456.okta.com
    authType: APIKey
    credentialRef: vault/secret/okta-api-token
  changeDetection:
    type: webhook
    webhookEndpoint: /webhooks/okta
    webhookSecret: vault/secret/okta-webhook-secret
identityMappings:
  - sourceType: User
    targetNodeType: HumanIdentity
    correlationFields:
      - field: login
        identographField: email
        priority: 1
      - field: profile.employeeNumber
        identographField: employeeId
        priority: 2
    fieldMappings:
      - source: profile.firstName
        target: firstName
      - source: profile.lastName
        target: lastName
      - source: profile.email
        target: email
significanceRules:
  minRiskScoreForAlert: 0.7
  privilegedRolePatterns:
    - ".*admin.*"
    - ".*super.*"
  sensitiveGroupPatterns:
    - ".*security.*"
`;

describe("parseSSD", () => {
  it("parses a valid Okta SSD YAML without error", () => {
    const result = parseSSD(VALID_OKTA_SSD);
    expect(result.ssdVersion).toBe("1.0");
    expect(result.sourceSystem.id).toBe("okta-dev");
    expect(result.sourceSystem.name).toBe("Okta Dev Tenant");
    expect(result.sourceSystem.type).toBe("IDP");
    expect(result.sourceSystem.connection.authType).toBe("APIKey");
    expect(result.identityMappings).toHaveLength(1);
    expect(result.identityMappings[0]?.correlationFields).toHaveLength(2);
  });

  it("throws SSDParseError when sourceSystem.id is missing", () => {
    const yaml = `
ssdVersion: "1.0"
sourceSystem:
  name: Okta Dev
  type: IDP
  connection:
    type: REST_API
    baseUrl: https://dev.okta.com
    authType: APIKey
    credentialRef: vault/secret/token
  changeDetection:
    type: poll
    pollIntervalSeconds: 300
identityMappings: []
`;
    expect(() => parseSSD(yaml)).toThrow(SSDParseError);
    expect(() => parseSSD(yaml)).toThrow(/id/);
  });

  it("throws SSDParseError when credentialRef is missing", () => {
    const yaml = `
ssdVersion: "1.0"
sourceSystem:
  id: okta-dev
  name: Okta Dev
  type: IDP
  connection:
    type: REST_API
    baseUrl: https://dev.okta.com
    authType: APIKey
  changeDetection:
    type: poll
    pollIntervalSeconds: 300
identityMappings: []
`;
    expect(() => parseSSD(yaml)).toThrow(SSDParseError);
  });

  it("throws SSDParseError when changeDetection.type is webhook but webhookEndpoint is missing", () => {
    const yaml = `
ssdVersion: "1.0"
sourceSystem:
  id: okta-dev
  name: Okta Dev
  type: IDP
  connection:
    type: REST_API
    baseUrl: https://dev.okta.com
    authType: APIKey
    credentialRef: vault/secret/token
  changeDetection:
    type: webhook
identityMappings: []
`;
    expect(() => parseSSD(yaml)).toThrow(SSDParseError);
    expect(() => parseSSD(yaml)).toThrow(/webhookEndpoint/);
  });

  it("does not throw on unknown extra fields in YAML", () => {
    const yaml = `
ssdVersion: "1.0"
sourceSystem:
  id: okta-dev
  name: Okta Dev
  type: IDP
  unknownExtraField: some-value
  connection:
    type: REST_API
    baseUrl: https://dev.okta.com
    authType: APIKey
    credentialRef: vault/secret/token
    extraConnectionField: ignored
  changeDetection:
    type: poll
    pollIntervalSeconds: 300
identityMappings: []
extraTopLevelField: ignored
`;
    expect(() => parseSSD(yaml)).not.toThrow();
  });

  it("preserves all field mappings correctly", () => {
    const result = parseSSD(VALID_OKTA_SSD);
    const mapping = result.identityMappings[0];
    expect(mapping).toBeDefined();
    expect(mapping!.sourceType).toBe("User");
    expect(mapping!.targetNodeType).toBe("HumanIdentity");
    expect(mapping!.fieldMappings[0]?.source).toBe("profile.firstName");
    expect(mapping!.fieldMappings[0]?.target).toBe("firstName");
  });

  it("preserves significance rules when present", () => {
    const result = parseSSD(VALID_OKTA_SSD);
    expect(result.significanceRules).toBeDefined();
    expect(result.significanceRules?.minRiskScoreForAlert).toBe(0.7);
    expect(result.significanceRules?.privilegedRolePatterns).toHaveLength(2);
  });

  it("SSDParseError has name 'SSDParseError'", () => {
    const yaml = `
ssdVersion: "1.0"
sourceSystem:
  name: Missing ID
  type: IDP
  connection:
    type: REST_API
    baseUrl: https://dev.okta.com
    authType: APIKey
    credentialRef: vault/secret/token
  changeDetection:
    type: poll
    pollIntervalSeconds: 300
identityMappings: []
`;
    try {
      parseSSD(yaml);
      expect.fail("Expected SSDParseError to be thrown");
    } catch (err) {
      expect(err instanceof SSDParseError).toBe(true);
      if (err instanceof SSDParseError) {
        expect(err.name).toBe("SSDParseError");
      }
    }
  });
});
