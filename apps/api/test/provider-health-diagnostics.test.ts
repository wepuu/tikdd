import type { CircuitSnapshot } from "@tikdd/routing-health";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerProviderHealthDiagnostics } from "../src/provider-health-diagnostics";

const token = "diagnostic-token-with-at-least-32-characters";
const snapshot: CircuitSnapshot = {
  key: { providerId: "provider-a", platform: "x", region: "global" },
  state: "open",
  successRate: 0.2,
  latencyP95Ms: 1_200,
  sampleCount: 5,
  counts: {
    succeeded: 1,
    integrity: 4,
    accessFriction: 0,
    availability: 0,
    neutralContentPolicy: 0,
    neutralCapability: 0
  },
  insufficientData: false,
  reason: "integrity",
  calculatedAt: "2026-08-07T12:00:00.000Z",
  windowStartedAt: "2026-08-07T11:59:00.000Z",
  lastTransitionAt: "2026-08-07T12:00:00.000Z",
  openedAt: "2026-08-07T12:00:00.000Z",
  openUntil: "2026-08-07T12:01:00.000Z",
  probeLeaseExpiresAt: null,
  consecutiveOpenCount: 1,
  recoverySuccessCount: 0,
  policyVersion: "test-v1",
  revision: 2
};

function appWith(configuredToken: string | null) {
  const app = Fastify();
  registerProviderHealthDiagnostics(app, {
    token: configuredToken,
    store: { async listSnapshots() { return [snapshot]; } }
  });
  return app;
}

describe("provider health diagnostics", () => {
  it("does not register the internal route without an explicit credential", async () => {
    const app = appWith(null);
    try {
      const response = await app.inject({ method: "GET", url: "/internal/v1/provider-health" });
      expect(response.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("rejects missing and incorrect bearer credentials", async () => {
    const app = appWith(token);
    try {
      const missing = await app.inject({ method: "GET", url: "/internal/v1/provider-health" });
      const incorrect = await app.inject({
        method: "GET",
        url: "/internal/v1/provider-health",
        headers: { authorization: "Bearer incorrect" }
      });
      expect(missing.statusCode).toBe(401);
      expect(incorrect.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("returns only sanitized operational metadata", async () => {
    const app = appWith(token);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/internal/v1/provider-health",
        headers: { authorization: `Bearer ${token}` }
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        circuits: [
          {
            providerId: "provider-a",
            platform: "x",
            region: "global",
            state: "open",
            reason: "integrity",
            policyVersion: "test-v1"
          }
        ]
      });
      expect(response.body).not.toContain("sourceUrl");
      expect(response.body).not.toContain("canonicalUrl");
      expect(response.body).not.toContain("media");
      expect(response.body).not.toContain(token);
    } finally {
      await app.close();
    }
  });
});
