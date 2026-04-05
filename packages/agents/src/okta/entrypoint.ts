// entrypoint.ts - Docker entry point for the Okta ingest agent
import { OktaIngestAgent } from "./agent.js";

const config = {
  tenantId: process.env["PRISM_TENANT_ID"] ?? "prism-dev",
  sourceSystemId: process.env["SSD_ID"] ?? "okta-dev",
  okta: {
    domain: process.env["OKTA_DOMAIN"] ?? "",
    token: process.env["OKTA_API_TOKEN"] ?? "",
  },
  kafka: {
    brokers: (process.env["KAFKA_BROKERS"] ?? "localhost:9092").split(","),
    clientId: "prism-okta-agent",
  },
  arcadedb: {
    url: process.env["ARCADEDB_URL"] ?? "http://localhost:2480",
    db: process.env["ARCADEDB_DB"] ?? "prism",
    user: process.env["ARCADEDB_USER"] ?? "root",
    pass: process.env["ARCADEDB_PASS"] ?? "prism-dev-secret",
  },
};

const agent = new OktaIngestAgent(config);

process.on("SIGTERM", () => {
  agent.stop().then(() => process.exit(0)).catch(() => process.exit(1));
});
process.on("SIGINT", () => {
  agent.stop().then(() => process.exit(0)).catch(() => process.exit(1));
});

agent.start().catch((err: unknown) => {
  console.error("Agent failed to start:", err);
  process.exit(1);
});
