import cors from "@fastify/cors";
import Fastify from "fastify";
import mercurius from "mercurius";
import { ArcadeClient, defaultConfig } from "./db/client.js";
import { typeDefs } from "./graphql/schema.js";
import { makeResolvers } from "./graphql/resolvers/identity.js";
import { registerRiskRoutes, type RiskQueryFn } from "./routes/risk.js";

const PORT = Number(process.env["PORT"] ?? 4000);
const HOST = process.env["HOST"] ?? "0.0.0.0";

export interface BuildServerOptions {
  // Injected risk query backing GET /api/v1/risk/identities. When omitted the
  // route responds 501 (used by graphql-only tests). The real function is wired
  // from @prism/risk-engine in index.ts.
  riskQuery?: RiskQueryFn;
}

export async function buildServer(db?: ArcadeClient, options: BuildServerOptions = {}) {
  const app = Fastify({ logger: { level: process.env["LOG_LEVEL"] ?? "info" } });

  await app.register(cors, { origin: true });

  const client = db ?? new ArcadeClient(defaultConfig());
  const resolvers = makeResolvers(client);

  await app.register(mercurius, {
    schema: typeDefs,
    resolvers,
    graphiql: true, // GraphiQL UI at /graphiql
  });

  // Health check
  app.get("/health", async () => ({ status: "ok", service: "@prism/api" }));

  // REST risk routes
  registerRiskRoutes(app, options.riskQuery);

  return app;
}

export async function start(options: BuildServerOptions = {}) {
  const app = await buildServer(undefined, options);
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`GraphQL API listening on http://localhost:${PORT}/graphql`);
  app.log.info(`GraphiQL available at  http://localhost:${PORT}/graphiql`);
}
