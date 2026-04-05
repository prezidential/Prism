// Fastify plugin providing Okta event hook webhook endpoints

import type { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import crypto from "node:crypto";
import type { IdentityEventEnvelope, EventType } from "../messages/envelope.js";
import { buildEnvelope } from "../messages/envelope.js";
import type { OktaUserPayload, OktaGroupMembershipPayload } from "../messages/okta.js";

export interface OktaWebhookOptions extends FastifyPluginOptions {
  secret: string; // HMAC secret for signature verification
  tenantId: string;
  sourceSystemId: string;
  sourceAgent?: string;
  onEvent: (envelope: IdentityEventEnvelope) => Promise<void>;
}

// Okta event types we handle
type OktaEventType =
  | "user.lifecycle.create"
  | "user.lifecycle.activate"
  | "user.lifecycle.deactivate"
  | "user.lifecycle.suspend"
  | "user.lifecycle.unsuspend"
  | "user.account.update_profile"
  | "group.user_membership.add"
  | "group.user_membership.remove";

interface OktaEventHookBody {
  data: {
    events: Array<{
      eventType: string;
      published: string;
      actor?: {
        id: string;
        type: string;
        displayName?: string;
      };
      target?: Array<{
        id: string;
        type: string;
        displayName?: string;
        alternateId?: string;
        detailEntry?: Record<string, unknown>;
      }>;
    }>;
  };
}

function mapOktaEventTypeToEnvelopeType(
  oktaType: OktaEventType,
): Extract<EventType, "identity.discovered" | "identity.updated" | "identity.deactivated" | "group.membership.changed"> {
  switch (oktaType) {
    case "user.lifecycle.create":
    case "user.lifecycle.activate":
      return "identity.discovered";
    case "user.lifecycle.deactivate":
    case "user.lifecycle.suspend":
      return "identity.deactivated";
    case "user.lifecycle.unsuspend":
    case "user.account.update_profile":
      return "identity.updated";
    case "group.user_membership.add":
    case "group.user_membership.remove":
      return "group.membership.changed";
  }
}

function verifyOktaSignature(
  secret: string,
  requestId: string,
  body: string,
  signatureHeader: string,
): boolean {
  // Okta HMAC: SHA-256 HMAC of the request body
  // Header format: "sha256=<hex_digest>"
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const expectedHeader = `sha256=${expected}`;

  // Use timingSafeEqual to prevent timing attacks
  if (signatureHeader.length !== expectedHeader.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader, "utf8"),
    Buffer.from(expectedHeader, "utf8"),
  );

  void requestId; // available for logging if needed
}

export async function oktaWebhookPlugin(
  fastify: FastifyInstance,
  opts: OktaWebhookOptions,
): Promise<void> {
  const sourceAgent = opts.sourceAgent ?? "okta-ingest-agent";

  // GET /webhooks/okta/verify - Okta one-time verification
  fastify.get(
    "/webhooks/okta/verify",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const challenge = (request.headers as Record<string, string | undefined>)[
        "x-okta-verification-challenge"
      ];
      if (!challenge) {
        return reply.status(400).send({ error: "Missing x-okta-verification-challenge header" });
      }
      return reply.send({ verification: challenge });
    },
  );

  // POST /webhooks/okta/events - receive Okta event hook payloads
  fastify.post(
    "/webhooks/okta/events",
    {
      config: { rawBody: true },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const headers = request.headers as Record<string, string | undefined>;
      const requestId = headers["x-okta-request-id"] ?? "";
      const signatureHeader = headers["x-hub-signature"] ?? "";

      if (!signatureHeader) {
        return reply.status(401).send({ error: "Missing x-hub-signature header" });
      }

      // Get raw body for HMAC verification
      const rawBody =
        (request as FastifyRequest & { rawBody?: string }).rawBody ??
        JSON.stringify(request.body);

      const isValid = verifyOktaSignature(opts.secret, requestId, rawBody, signatureHeader);
      if (!isValid) {
        return reply.status(401).send({ error: "Invalid signature" });
      }

      const body = request.body as OktaEventHookBody;
      const events = body.data?.events ?? [];

      for (const event of events) {
        try {
          const oktaType = event.eventType as OktaEventType;
          const eventType = mapOktaEventTypeToEnvelopeType(oktaType);
          const firstTarget = event.target?.[0];

          if (oktaType === "group.user_membership.add" || oktaType === "group.user_membership.remove") {
            // Group membership event
            const userId = firstTarget?.id ?? "";
            const group = event.target?.[1];
            const groupId = group?.id ?? "";

            const payload: OktaGroupMembershipPayload = {
              userId,
              groupId,
              action: oktaType === "group.user_membership.add" ? "added" : "removed",
            };

            const envelope = buildEnvelope<OktaGroupMembershipPayload>({
              eventType: "group.membership.changed",
              timestamp: event.published,
              sourceAgent,
              sourceSystemId: opts.sourceSystemId,
              correlationId: userId,
              tenantId: opts.tenantId,
              payload,
            });

            await opts.onEvent(envelope as IdentityEventEnvelope);
          } else {
            // User lifecycle/profile event
            const userId = firstTarget?.id ?? "";
            const login = firstTarget?.alternateId ?? "";

            const payload: Partial<OktaUserPayload> & { sourceId: string; login: string } = {
              sourceId: userId,
              login,
              email: login,
              firstName: "",
              lastName: "",
              displayName: firstTarget?.displayName ?? "",
              status: "ACTIVE",
              createdAt: event.published,
              updatedAt: event.published,
              rawProfile: {},
            };

            const envelope = buildEnvelope({
              eventType,
              timestamp: event.published,
              sourceAgent,
              sourceSystemId: opts.sourceSystemId,
              correlationId: userId,
              tenantId: opts.tenantId,
              payload,
            });

            await opts.onEvent(envelope as IdentityEventEnvelope);
          }
        } catch (err) {
          fastify.log.error({ err, event }, "Failed to process Okta webhook event");
        }
      }

      return reply.status(200).send({ processed: events.length });
    },
  );
}
