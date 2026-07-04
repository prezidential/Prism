// API process entrypoint and composition root.
//
// This is the one file that imports @prism/risk-engine. Because the monorepo
// runs on tsx/vitest and never builds package dist/, the import is by relative
// source path, and this file is excluded from the package's rootDir-constrained
// tsconfig (typechecked at the repo root instead). See tsconfig.json.

import { getRiskIdentities } from "../../risk-engine/src/index.js";
import { ArcadeClient, defaultConfig } from "./db/client.js";
import { start } from "./server.js";

// A single shared read client for risk queries.
const riskClient = new ArcadeClient(defaultConfig());

start({
  riskQuery: (tenantId, options) => getRiskIdentities(riskClient, tenantId, options),
}).catch((err: unknown) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
