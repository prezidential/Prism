import cors from "@fastify/cors";
import Fastify from "fastify";
import mercurius from "mercurius";
import { ArcadeClient, defaultConfig } from "./db/client.js";
import { typeDefs } from "./graphql/schema.js";
import { makeResolvers } from "./graphql/resolvers/identity.js";

const PORT = Number(process.env["PORT"] ?? 4000);
const HOST = process.env["HOST"] ?? "0.0.0.0";

export async function buildServer(db?: ArcadeClient) {
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

  return app;
}

export async function start() {
  const app = await buildServer();
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`GraphQL API listening on http://localhost:${PORT}/graphql`);
  app.log.info(`GraphiQL available at  http://localhost:${PORT}/graphiql`);
}
