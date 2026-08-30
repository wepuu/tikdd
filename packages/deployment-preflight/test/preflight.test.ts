import { describe, expect, it } from "vitest";
import {
  assertInternalStartup,
  evaluateInternalPreflight,
  issueInternalPreflightAttestation,
  loadInternalRuntime
} from "../src/index";

const now = new Date("2026-08-11T08:00:00.000Z");
const plan = {
  schemaVersion: 1 as const, status: "ready" as const,
  scope: { deploymentId: "tikdd", region: "nl", platform: "x" as const, providers: ["twittersaver", "ssstwitter"] },
  network: { trustedProxyMode: "trusted-proxy" as const, providerPageHosts: ["twittersaver.net", "ssstwitter.com"] },
  providerUse: [
    { providerId: "twittersaver", termsConfirmed: true, productionUseConfirmed: true },
    { providerId: "ssstwitter", termsConfirmed: true, productionUseConfirmed: true }
  ],
  bounds: { attestationTtlMs: 600_000, cleanupMaximumAgeMs: 300_000, evidenceMaximumAgeMs: 600_000, emergencyDenyMaximumPropagationMs: 15_000 },
};
const environment = {
  NODE_ENV: "production", TIKDD_DEPLOYMENT_STAGE: "internal", TIKDD_DEPLOYMENT_ID: "tikdd",
  TIKDD_OBSERVATION_CLASS: "internal", WORKER_REGION: "nl", ENABLE_MOCK_PROVIDER: "false",
  ENABLE_TWITTERSAVER_PROVIDER: "true", ENABLE_SSSTWITTER_PROVIDER: "true", ENABLE_DLPANDA_PROVIDER: "false",
  TWITTERSAVER_TERMS_APPROVED: "true", SSSTWITTER_TERMS_APPROVED: "true", SSSTWITTER_DELIVERY_AUDIT_APPROVED: "true",
  PROVIDER_ROLLOUT_ENABLED: "true", PROVIDER_ROLLOUT_DEVELOPMENT_BYPASS: "false", ADMISSION_CONTROL_ENABLED: "true",
  TRUSTED_PROXY_CIDRS: "10.0.0.0/8", DELIVERY_ENCRYPTION_KEY_ID: "delivery-v1", DELIVERY_ENCRYPTION_KEY_BASE64URL: "present",
  PROVIDER_ROLLOUT_COHORT_KEY_BASE64URL: "present", TASK_ADMISSION_HMAC_KEY_BASE64URL: "present",
  PROVIDER_DIAGNOSTICS_TOKEN: "present", PILOT_EVIDENCE_DIAGNOSTICS_TOKEN: "present", PILOT_EVIDENCE_DIAGNOSTICS_ACTOR_ID: "operator.one"
};
const signals = { postgresReady: true, redisReady: true, providerEgressReady: true,
  cleanupLastSucceededAt: "2026-08-11T07:58:00.000Z", evidenceLastSucceededAt: "2026-08-11T07:55:00.000Z",
  emergencyDenyPropagationMs: 4_000, workerRestartFailClosed: true, deliveryExpiryFailClosed: true, manualRecoveryRequired: true };
const manifests = [
  {
    id: "twittersaver", displayName: "TwitterSaver", kind: "site-adapter" as const,
    enabled: true, regions: ["nl", "global", "canary-global"], timeoutMs: 15_000,
    costWeight: 10,
    platforms: [{ platform: "x", priority: 900, deliveryModes: ["redirect" as const], verificationStatus: "delivery_verified" as const }]
  },
  {
    id: "ssstwitter", displayName: "SSSTwitter", kind: "site-adapter" as const,
    enabled: true, regions: ["nl", "global", "canary-global"], timeoutMs: 18_000,
    costWeight: 15,
    platforms: [{ platform: "x", priority: 800, deliveryModes: ["redirect" as const], verificationStatus: "delivery_verified" as const }]
  }
];

describe("internal deployment preflight", () => {
  it("produces an aggregate ready report without secrets or infrastructure addresses", () => {
    const report = evaluateInternalPreflight({ plan, runtime: loadInternalRuntime(environment), signals, manifests, now });
    expect(report.decision).toBe("ready"); expect(report.summary.blocked).toBe(0);
    expect(report.verified.map(({ id }) => id)).toEqual(expect.arrayContaining([
      "provider_capability:twittersaver", "provider_capability:ssstwitter"
    ]));
    expect(JSON.stringify(report)).not.toMatch(/TOKEN|BASE64|10\.0\.0\.0|DELIVERY_ENCRYPTION|DATABASE_URL/i);
  });

  it("fails closed when one intended Provider does not admit the deployment region", () => {
    const report = evaluateInternalPreflight({
      plan, runtime: loadInternalRuntime(environment), signals,
      manifests: manifests.map((manifest) => manifest.id === "ssstwitter"
        ? { ...manifest, regions: ["global", "canary-global"] }
        : manifest),
      now
    });
    expect(report.decision).toBe("blocked");
    expect(report.blockers).toContainEqual(expect.objectContaining({
      id: "provider_capability:ssstwitter",
      reason: "deployment_region_not_admitted:ssstwitter:x:nl"
    }));
    expect(report.verified).toContainEqual(expect.objectContaining({ id: "provider_capability:twittersaver" }));
  });

  it("fails closed when all intended Providers are outside the deployment region", () => {
    const report = evaluateInternalPreflight({
      plan, runtime: loadInternalRuntime(environment), signals,
      manifests: manifests.map((manifest) => ({ ...manifest, regions: ["global", "canary-global"] })),
      now
    });
    expect(report.decision).toBe("blocked");
    expect(report.blockers.filter(({ id }) => id.startsWith("provider_capability:"))).toHaveLength(2);
  });

  it("fails closed when an intended capability is no longer delivery eligible", () => {
    const report = evaluateInternalPreflight({
      plan, runtime: loadInternalRuntime(environment), signals,
      manifests: manifests.map((manifest) => manifest.id === "ssstwitter"
        ? { ...manifest, platforms: [{ ...manifest.platforms[0]!, deliveryModes: [], verificationStatus: "fixture_verified" as const }] }
        : manifest),
      now
    });
    expect(report.decision).toBe("blocked");
    expect(report.blockers).toContainEqual(expect.objectContaining({
      id: "provider_capability:ssstwitter",
      reason: "provider_delivery_not_eligible:ssstwitter:x"
    }));
  });

  it("fails closed when the intended Provider set and deployed Manifests drift", () => {
    const missing = evaluateInternalPreflight({
      plan, runtime: loadInternalRuntime(environment), signals,
      manifests: manifests.filter(({ id }) => id !== "ssstwitter"), now
    });
    expect(missing.blockers).toContainEqual(expect.objectContaining({
      id: "provider_capability:ssstwitter",
      reason: "provider_manifest_missing:ssstwitter"
    }));

    const disabled = evaluateInternalPreflight({
      plan, runtime: loadInternalRuntime(environment), signals,
      manifests: manifests.map((manifest) => manifest.id === "ssstwitter"
        ? { ...manifest, enabled: false }
        : manifest),
      now
    });
    expect(disabled.blockers).toContainEqual(expect.objectContaining({
      id: "provider_capability:ssstwitter",
      reason: "provider_manifest_disabled:ssstwitter"
    }));
  });

  it("blocks unconfirmed provider use and every unavailable or stale dependency", () => {
    const blocked = evaluateInternalPreflight({
      plan: { ...plan, status: "pending", providerUse: plan.providerUse.map((item, index) => index === 0 ? { ...item, productionUseConfirmed: false } : item) },
      runtime: loadInternalRuntime({ ...environment, PROVIDER_ROLLOUT_ENABLED: "false" }),
      signals: { ...signals, postgresReady: false, redisReady: false, providerEgressReady: false, cleanupLastSucceededAt: "2026-08-11T06:00:00.000Z", evidenceLastSucceededAt: null, emergencyDenyPropagationMs: 20_000, workerRestartFailClosed: false, deliveryExpiryFailClosed: false, manualRecoveryRequired: false }, manifests, now
    });
    expect(blocked.decision).toBe("blocked");
    expect(blocked.blockers.map(({ id }) => id).sort()).toEqual(expect.arrayContaining(["plan_status", "provider_use:twittersaver", "runtime_boundaries", "postgres", "redis", "provider_egress", "cleanup_freshness", "evidence_freshness", "emergency_deny", "worker_restart", "delivery_expiry", "manual_recovery"]));
  });

  it("binds a short-lived signed attestation to the exact runtime", () => {
    const runtime = loadInternalRuntime(environment); const report = evaluateInternalPreflight({ plan, runtime, signals, manifests, now });
    const encodedKey = Buffer.alloc(32, 11).toString("base64url");
    const attestation = issueInternalPreflightAttestation({ report, runtime, encodedKey, now, ttlMs: 600_000 });
    expect(() => issueInternalPreflightAttestation({ report, runtime, encodedKey, now: new Date("2026-08-11T08:01:00.000Z"), ttlMs: 600_000 })).toThrow(/report is stale/);
    expect(assertInternalStartup({ ...environment, TIKDD_INTERNAL_PREFLIGHT_HMAC_KEY_BASE64URL: encodedKey, TIKDD_INTERNAL_PREFLIGHT_ATTESTATION: attestation }, new Date("2026-08-11T08:05:00.000Z"))).toBe("internal");
    expect(() => assertInternalStartup({ ...environment, WORKER_REGION: "other", TIKDD_INTERNAL_PREFLIGHT_HMAC_KEY_BASE64URL: encodedKey, TIKDD_INTERNAL_PREFLIGHT_ATTESTATION: attestation }, new Date("2026-08-11T08:05:00.000Z"))).toThrow(/does not match/);
    expect(() => assertInternalStartup({ ...environment, TIKDD_INTERNAL_PREFLIGHT_HMAC_KEY_BASE64URL: encodedKey, TIKDD_INTERNAL_PREFLIGHT_ATTESTATION: attestation }, new Date("2026-08-11T08:11:00.000Z"))).toThrow(/stale or expired/);
  });

  it("does not require an internal attestation for the public/local path", () => {
    expect(assertInternalStartup({ NODE_ENV: "development" })).toBe("public");
    expect(() => assertInternalStartup({ NODE_ENV: "production", TIKDD_OBSERVATION_CLASS: "internal" })).toThrow(/production internal deployment stage/);
  });
});
