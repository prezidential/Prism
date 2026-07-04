// Executable entrypoint for the real-time risk consumer (`npm run risk:consume`).
import { main } from "./entrypoint.js";

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
