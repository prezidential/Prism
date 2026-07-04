// Executable entrypoint for the Identograph MCP server (`npm run mcp:serve`).
// Kept separate from server.ts so server.ts stays importable without side effects.
import { main } from "./server.js";

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
