// OktaIngestAgent - ties together Okta client, Kafka producer, and graph write service

import Fastify from "fastify";
import type { IngestAgent, IngestAgentStatus } from "../base/agent.js";
import type { IdentityEventEnvelope } from "../messages/envelope.js";
import type { OktaUserPayload } from "../messages/okta.js";
import { KafkaProducer } from "../kafka/producer.js";
import { TOPICS } from "../kafka/topics.js";
import { OktaClient } from "./client.js";
import { mapOktaUserToEnvelope } from "./mapper.js";
import { oktaWebhookPlugin } from "./webhook.js";
import { ArcadeGraphWriteService } from "../graph/write-service.js";

export interface OktaAgentConfig {
  tenantId: string;
  sourceSystemId: string;
  okta: {
    domain: string;
    token: string;
  };
  kafka: {
    brokers: string[];
    clientId: string;
  };
  arcadedb: {
    url: string;
    db: string;
    user: string;
    pass: string;
  };
  webhook?: {
    secret: string;
    port: number;
  };
  // Full sync interval in ms, default 3600000 (1 hour)
  syncIntervalMs?: number;
}

export class OktaIngestAgent implements IngestAgent {
  readonly config: {
    sourceSystemId: string;
    tenantId: string;
    kafkaBrokers: string[];
    pollIntervalMs: number;
  };

  readonly sourceSystemId: string;

  private readonly oktaClient: OktaClient;
  private readonly kafkaProducer: KafkaProducer;
  private readonly graphWriteService: ArcadeGraphWriteService;
  private readonly syncIntervalMs: number;

  private running = false;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private fastifyServer: ReturnType<typeof Fastify> | null = null;

  private statusState: IngestAgentStatus["state"] = "initializing";
  private lastRunAt: string | undefined;
  private lastEventAt: string | undefined;
  private totalEventsEmitted = 0;
  private errorCount = 0;

  constructor(agentConfig: OktaAgentConfig) {
    this.sourceSystemId = agentConfig.sourceSystemId;
    this.syncIntervalMs = agentConfig.syncIntervalMs ?? 3_600_000;

    this.config = {
      sourceSystemId: agentConfig.sourceSystemId,
      tenantId: agentConfig.tenantId,
      kafkaBrokers: agentConfig.kafka.brokers,
      pollIntervalMs: this.syncIntervalMs,
    };

    this.oktaClient = new OktaClient({
      domain: agentConfig.okta.domain,
      token: agentConfig.okta.token,
    });

    this.kafkaProducer = new KafkaProducer({
      brokers: agentConfig.kafka.brokers,
      clientId: agentConfig.kafka.clientId,
    });

    this.graphWriteService = new ArcadeGraphWriteService(agentConfig.arcadedb);
  }

  status(): IngestAgentStatus {
    return {
      sourceSystemId: this.sourceSystemId,
      state: this.statusState,
      lastRunAt: this.lastRunAt,
      lastEventAt: this.lastEventAt,
      totalEventsEmitted: this.totalEventsEmitted,
      errorCount: this.errorCount,
    };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.statusState = "initializing";

    await this.kafkaProducer.connect();

    // Run initial full sync
    await this.runFullDiscovery();

    // Schedule periodic syncs
    this.syncTimer = setInterval(() => {
      this.runFullDiscovery().catch((err: unknown) => {
        console.error("Periodic sync failed:", err);
        this.errorCount++;
      });
    }, this.syncIntervalMs);

    this.statusState = "active";
  }

  async stop(): Promise<void> {
    this.running = false;
    this.statusState = "terminated";

    if (this.syncTimer !== null) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.fastifyServer) {
      await this.fastifyServer.close();
      this.fastifyServer = null;
    }

    await this.kafkaProducer.disconnect();
  }

  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, unknown> }> {
    try {
      // Attempt to fetch a single user to verify Okta connectivity
      const iter = this.oktaClient.listUsers("status eq \"ACTIVE\"");
      const next = await iter.next();
      void next; // we just want to check it doesn't throw

      return {
        healthy: true,
        details: {
          state: this.statusState,
          totalEventsEmitted: this.totalEventsEmitted,
          errorCount: this.errorCount,
          lastRunAt: this.lastRunAt,
        },
      };
    } catch (err) {
      this.errorCount++;
      return {
        healthy: false,
        details: {
          state: this.statusState,
          error: err instanceof Error ? err.message : String(err),
          errorCount: this.errorCount,
        },
      };
    }
  }

  async runFullDiscovery(): Promise<void> {
    this.statusState = "active";
    this.lastRunAt = new Date().toISOString();

    try {
      for await (const user of this.oktaClient.listUsers()) {
        const envelope = mapOktaUserToEnvelope(
          user,
          this.config.tenantId,
          this.sourceSystemId,
          "identity.discovered",
        );

        // Write to graph
        await this.upsertUserToGraph(envelope);

        // Publish to Kafka
        await this.kafkaProducer.publish(TOPICS.IDENTITY_EVENTS_RAW, envelope, {
          key: envelope.correlationId,
        });

        this.totalEventsEmitted++;
        this.lastEventAt = new Date().toISOString();
      }

      this.statusState = "idle";
    } catch (err) {
      this.errorCount++;
      this.statusState = "failed";
      throw err;
    }
  }

  async handleWebhookEvent(envelope: IdentityEventEnvelope): Promise<void> {
    if (
      envelope.eventType === "identity.discovered" ||
      envelope.eventType === "identity.updated" ||
      envelope.eventType === "identity.deactivated"
    ) {
      const userEnvelope = envelope as IdentityEventEnvelope<OktaUserPayload>;
      await this.upsertUserToGraph(userEnvelope);
    }

    await this.kafkaProducer.publish(TOPICS.IDENTITY_EVENTS_RAW, envelope, {
      key: envelope.correlationId,
    });

    this.totalEventsEmitted++;
    this.lastEventAt = new Date().toISOString();
  }

  private async upsertUserToGraph(
    envelope: IdentityEventEnvelope<OktaUserPayload>,
  ): Promise<void> {
    const payload = envelope.payload;

    const props: Record<string, unknown> = {
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      displayName: payload.displayName,
      status: payload.status.toLowerCase(),
      updatedAt: payload.updatedAt,
      sourceSystemId: envelope.sourceSystemId,
    };

    if (payload.department !== undefined) props["department"] = payload.department;
    if (payload.title !== undefined) props["jobTitle"] = payload.title;
    if (payload.employeeNumber !== undefined) props["employeeNumber"] = payload.employeeNumber;
    if (payload.mobilePhone !== undefined) props["mobilePhone"] = payload.mobilePhone;

    await this.graphWriteService.upsertVertex(
      "HumanIdentity",
      envelope.tenantId,
      payload.sourceId,
      "externalIds.okta",
      props,
    );
  }

  async startWebhookServer(port: number, secret: string): Promise<void> {
    const server = Fastify({ logger: true });
    this.fastifyServer = server;

    await server.register(oktaWebhookPlugin, {
      secret,
      tenantId: this.config.tenantId,
      sourceSystemId: this.sourceSystemId,
      onEvent: (envelope: IdentityEventEnvelope) => this.handleWebhookEvent(envelope),
    });

    await server.listen({ port, host: "0.0.0.0" });
  }
}
