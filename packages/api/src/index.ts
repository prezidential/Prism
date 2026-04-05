import { start } from "./server.js";

start().catch((err: unknown) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
