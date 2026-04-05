import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import crypto from "node:crypto";
import { oktaWebhookPlugin } from "../webhook.js";
import type { IdentityEventEnvelope } from "../../messages/envelope.js";

const TEST_SECRET = "test-webhook-secret-key";
const TEST_TENANT = "prism-dev";
const TEST_SOURCE = "okta-dev";

function signBody(body: string): string {
  const hash = crypto.createHmac("sha256", TEST_SECRET).update(body).digest("hex");
  return `sha256=${hash}`;
}

function buildOktaEventBody(eventType: string, userId = "usr-001", userLogin = "test@example.com"): string {
  return JSON.stringify({
    data: {
      events: [
        {
          eventType,
          published: "2024-06-01T10:00:00.000Z",
          actor: {
            id: "actor-001",
            type: "User",
            displayName: "Admin User",
          },
          target: [
            {
              id: userId,
              type: "AppUser",
              alternateId: userLogin,
              displayName: "Test User",
            },
          ],
        },
      ],
    },
  });
}

async function buildTestApp(onEvent: (envelope: IdentityEventEnvelope) => Promise<void>) {
  const app = Fastify({ logger: false });

  // Simulate rawBody plugin behavior
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    (req as typeof req & { rawBody: string }).rawBody = body as string;
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  await app.register(oktaWebhookPlugin, {
    secret: TEST_SECRET,
    tenantId: TEST_TENANT,
    sourceSystemId: TEST_SOURCE,
    onEvent,
  });

  await app.ready();
  return app;
}

describe("oktaWebhookPlugin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /webhooks/okta/verify", () => {
    it("returns the challenge value from header", async () => {
      const onEvent = vi.fn();
      const app = await buildTestApp(onEvent);

      const response = await app.inject({
        method: "GET",
        url: "/webhooks/okta/verify",
        headers: {
          "x-okta-verification-challenge": "my-challenge-abc123",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as { verification: string };
      expect(body.verification).toBe("my-challenge-abc123");

      await app.close();
    });

    it("returns 400 when challenge header is missing", async () => {
      const onEvent = vi.fn();
      const app = await buildTestApp(onEvent);

      const response = await app.inject({
        method: "GET",
        url: "/webhooks/okta/verify",
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });

  describe("POST /webhooks/okta/events", () => {
    it("returns 401 when signature header is missing", async () => {
      const onEvent = vi.fn();
      const app = await buildTestApp(onEvent);
      const body = buildOktaEventBody("user.lifecycle.create");

      const response = await app.inject({
        method: "POST",
        url: "/webhooks/okta/events",
        payload: body,
        headers: {
          "content-type": "application/json",
          // No x-hub-signature
        },
      });

      expect(response.statusCode).toBe(401);
      await app.close();
    });

    it("returns 401 when signature is invalid", async () => {
      const onEvent = vi.fn();
      const app = await buildTestApp(onEvent);
      const body = buildOktaEventBody("user.lifecycle.create");

      const response = await app.inject({
        method: "POST",
        url: "/webhooks/okta/events",
        payload: body,
        headers: {
          "content-type": "application/json",
          "x-hub-signature": "sha256=invalid-signature",
          "x-okta-request-id": "req-001",
        },
      });

      expect(response.statusCode).toBe(401);
      await app.close();
    });

    it("calls onEvent with valid signature for user.lifecycle.create", async () => {
      const onEvent = vi.fn<[IdentityEventEnvelope], Promise<void>>().mockResolvedValue(undefined);
      const app = await buildTestApp(onEvent);
      const body = buildOktaEventBody("user.lifecycle.create", "usr-001", "user@example.com");
      const signature = signBody(body);

      const response = await app.inject({
        method: "POST",
        url: "/webhooks/okta/events",
        payload: body,
        headers: {
          "content-type": "application/json",
          "x-hub-signature": signature,
          "x-okta-request-id": "req-001",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(onEvent).toHaveBeenCalledTimes(1);
      await app.close();
    });

    it("maps user.lifecycle.create to identity.discovered", async () => {
      const capturedEnvelopes: IdentityEventEnvelope[] = [];
      const onEvent = vi.fn().mockImplementation((env: IdentityEventEnvelope) => {
        capturedEnvelopes.push(env);
        return Promise.resolve();
      });
      const app = await buildTestApp(onEvent);
      const body = buildOktaEventBody("user.lifecycle.create");
      const signature = signBody(body);

      await app.inject({
        method: "POST",
        url: "/webhooks/okta/events",
        payload: body,
        headers: {
          "content-type": "application/json",
          "x-hub-signature": signature,
          "x-okta-request-id": "req-002",
        },
      });

      expect(capturedEnvelopes[0]?.eventType).toBe("identity.discovered");
      await app.close();
    });

    it("maps user.lifecycle.deactivate to identity.deactivated", async () => {
      const capturedEnvelopes: IdentityEventEnvelope[] = [];
      const onEvent = vi.fn().mockImplementation((env: IdentityEventEnvelope) => {
        capturedEnvelopes.push(env);
        return Promise.resolve();
      });
      const app = await buildTestApp(onEvent);
      const body = buildOktaEventBody("user.lifecycle.deactivate");
      const signature = signBody(body);

      await app.inject({
        method: "POST",
        url: "/webhooks/okta/events",
        payload: body,
        headers: {
          "content-type": "application/json",
          "x-hub-signature": signature,
          "x-okta-request-id": "req-003",
        },
      });

      expect(capturedEnvelopes[0]?.eventType).toBe("identity.deactivated");
      await app.close();
    });

    it("sets correct tenantId and sourceSystemId on envelope", async () => {
      const capturedEnvelopes: IdentityEventEnvelope[] = [];
      const onEvent = vi.fn().mockImplementation((env: IdentityEventEnvelope) => {
        capturedEnvelopes.push(env);
        return Promise.resolve();
      });
      const app = await buildTestApp(onEvent);
      const body = buildOktaEventBody("user.lifecycle.activate");
      const signature = signBody(body);

      await app.inject({
        method: "POST",
        url: "/webhooks/okta/events",
        payload: body,
        headers: {
          "content-type": "application/json",
          "x-hub-signature": signature,
          "x-okta-request-id": "req-004",
        },
      });

      const envelope = capturedEnvelopes[0];
      expect(envelope?.tenantId).toBe(TEST_TENANT);
      expect(envelope?.sourceSystemId).toBe(TEST_SOURCE);
      await app.close();
    });
  });
});
