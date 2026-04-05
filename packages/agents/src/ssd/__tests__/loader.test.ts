import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fs/promises before importing loader
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}));

import * as fs from "fs/promises";
import { loadSSD, loadSSDDirectory } from "../loader.js";

const VALID_YAML = `
ssdVersion: "1.0"
sourceSystem:
  id: okta-test
  name: Okta Test
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

const VALID_YAML_2 = `
ssdVersion: "1.0"
sourceSystem:
  id: okta-prod
  name: Okta Prod
  type: IDP
  connection:
    type: REST_API
    baseUrl: https://prod.okta.com
    authType: OAuth2_ClientCredentials
    credentialRef: vault/secret/okta-prod
  changeDetection:
    type: poll
    pollIntervalSeconds: 600
identityMappings: []
`;

describe("loadSSD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module to clear in-memory cache between tests
    vi.resetModules();
  });

  it("calls readFile with the correct path", async () => {
    const readFileMock = vi.mocked(fs.readFile);
    readFileMock.mockResolvedValue(VALID_YAML as unknown as Buffer);

    // Re-import after reset to get fresh cache
    const { loadSSD: freshLoadSSD } = await import("../loader.js");
    await freshLoadSSD("/path/to/okta.yaml");

    expect(readFileMock).toHaveBeenCalledWith("/path/to/okta.yaml", "utf8");
  });

  it("throws if readFile throws", async () => {
    const readFileMock = vi.mocked(fs.readFile);
    readFileMock.mockRejectedValue(new Error("ENOENT: file not found"));

    const { loadSSD: freshLoadSSD } = await import("../loader.js");

    await expect(freshLoadSSD("/nonexistent/path.yaml")).rejects.toThrow(
      "ENOENT: file not found",
    );
  });

  it("returns a parsed SSD definition", async () => {
    const readFileMock = vi.mocked(fs.readFile);
    readFileMock.mockResolvedValue(VALID_YAML as unknown as Buffer);

    const { loadSSD: freshLoadSSD } = await import("../loader.js");
    const result = await freshLoadSSD("/path/to/okta.yaml");

    expect(result.sourceSystem.id).toBe("okta-test");
    expect(result.ssdVersion).toBe("1.0");
  });

  it("caches the result - second call with same path does not call readFile again", async () => {
    const readFileMock = vi.mocked(fs.readFile);
    readFileMock.mockResolvedValue(VALID_YAML as unknown as Buffer);

    const { loadSSD: freshLoadSSD } = await import("../loader.js");
    await freshLoadSSD("/path/to/okta.yaml");
    await freshLoadSSD("/path/to/okta.yaml");

    expect(readFileMock).toHaveBeenCalledTimes(1);
  });
});

describe("loadSSDDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("reads all .yaml files from the directory", async () => {
    const readFileMock = vi.mocked(fs.readFile);
    const readdirMock = vi.mocked(fs.readdir);

    readdirMock.mockResolvedValue(["okta.yaml", "workday.yaml"] as unknown as ReturnType<typeof fs.readdir> extends Promise<infer T> ? T : never);
    readFileMock
      .mockResolvedValueOnce(VALID_YAML as unknown as Buffer)
      .mockResolvedValueOnce(VALID_YAML_2 as unknown as Buffer);

    const { loadSSDDirectory: freshLoadSSDDirectory } = await import("../loader.js");
    const results = await freshLoadSSDDirectory("/path/to/ssds");

    expect(results).toHaveLength(2);
    expect(readFileMock).toHaveBeenCalledTimes(2);
  });

  it("skips non-.yaml files", async () => {
    const readFileMock = vi.mocked(fs.readFile);
    const readdirMock = vi.mocked(fs.readdir);

    readdirMock.mockResolvedValue(
      ["okta.yaml", "README.md", "notes.txt", "config.json"] as unknown as ReturnType<typeof fs.readdir> extends Promise<infer T> ? T : never,
    );
    readFileMock.mockResolvedValue(VALID_YAML as unknown as Buffer);

    const { loadSSDDirectory: freshLoadSSDDirectory } = await import("../loader.js");
    const results = await freshLoadSSDDirectory("/path/to/ssds");

    expect(results).toHaveLength(1);
    expect(readFileMock).toHaveBeenCalledTimes(1);
  });
});
