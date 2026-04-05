import { defineWorkspace } from "vitest/node";

export default defineWorkspace([
  "packages/identograph/vitest.config.ts",
  "packages/api/vitest.config.ts",
]);
