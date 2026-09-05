import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  DEFAULT_RESOLVE_QUEUE_NAME,
  loadResolveQueueName,
  ProviderManifestSchema,
  ResolveQueueNameSchema,
  type ProviderManifest
} from "@tikdd/contracts";
import { z } from "zod";

const SlugSchema = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);
const InstantSchema = z.string().datetime({ offset: true });

export const InternalPreflightPlanSchema = z.object({
  schemaVersion: z.literal(1),
  status: z.enum(["pending", "ready"]),
  scope: z.object({
    deploymentId: SlugSchema.nullable(),
    region: SlugSchema.nullable(),
    platform: z.literal("x"),
    providers: z.array(SlugSchema).min(1).max(8)
  }).strict(),
  network: z.object({
    trustedProxyMode: z.enum(["direct", "trusted-proxy"]).nullable(),
    providerPageHosts: z.array(z.string().regex(/^[a-z0-9.-]+$/)).min(1).max(16)
  }).strict(),
  providerUse: z.array(z.object({
    providerId: SlugSchema,
    termsConfirmed: z.boolean(),
    productionUseConfirmed: z.boolean()
  }).strict()).min(1).max(8),
  bounds: z.object({
    attestationTtlMs: z.number().int().min(60_000).max(900_000),
    cleanupMaximumAgeMs: z.number().int().min(60_000).max(86_400_000),
    evidenceMaximumAgeMs: z.number().int().min(60_000).max(86_400_000),
    emergencyDenyMaximumPropagationMs: z.number().int().min(1_000).max(60_000)
  }).strict()
}).strict().superRefine((value, context) => {
  if (new Set(value.scope.providers).size !== value.scope.providers.length) {
    context.addIssue({ code: "custom", message: "Provider IDs must be unique." });
  }
  const confirmedProviders = value.providerUse.map(({ providerId }) => providerId);
  if (new Set(confirmedProviders).size !== confirmedProviders.length || !equalSets(confirmedProviders, value.scope.providers)) {
    context.addIssue({ code: "custom", message: "Provider use confirmations must exactly match the scoped providers." });
  }
});
export type InternalPreflightPlan = z.infer<typeof InternalPreflightPlanSchema>;

export const InternalRuntimeSchema = z.object({
  serviceRole: z.enum(["combined", "api", "worker"]),
  authorizationId: z.string().max(128), windowStartsAt: z.string(), windowEndsAt: z.string(),
  nodeEnv: z.string(), deploymentStage: z.string(), deploymentId: z.string(), region: z.string(),
  observationClass: z.string(), resolveQueueName: ResolveQueueNameSchema,
  enabledProviders: z.array(SlugSchema), mockEnabled: z.boolean(),
  providerApprovalsPresent: z.boolean(),
  rolloutEnabled: z.boolean(), developmentBypass: z.boolean(), admissionEnabled: z.boolean(),
  trustedProxyCidrs: z.array(z.string()), deliverySecretPresent: z.boolean(),
  rolloutSecretPresent: z.boolean(), admissionSecretPresent: z.boolean(),
  diagnosticsCredentialPresent: z.boolean(), evidenceDiagnosticsCredentialPresent: z.boolean()
}).strict();
export type InternalRuntime = z.infer<typeof InternalRuntimeSchema>;

export const OperationalSignalsSchema = z.object({
  postgresReady: z.boolean(), redisReady: z.boolean(), providerEgressReady: z.boolean(),
  cleanupLastSucceededAt: InstantSchema.nullable(), evidenceLastSucceededAt: InstantSchema.nullable(),
  emergencyDenyPropagationMs: z.number().int().nonnegative().nullable(),
  workerRestartFailClosed: z.boolean(), deliveryExpiryFailClosed: z.boolean(),
  manualRecoveryRequired: z.boolean()
}).strict();
export type OperationalSignals = z.infer<typeof OperationalSignalsSchema>;

const CheckSchema = z.object({
  id: z.string(), status: z.enum(["pass", "block"]), reason: z.string()
}).strict();
export const InternalPreflightReportSchema = z.object({
  schemaVersion: z.literal(1), decision: z.enum(["ready", "blocked"]), generatedAt: InstantSchema,
  summary: z.object({ passed: z.number().int().nonnegative(), blocked: z.number().int().nonnegative() }).strict(),
  scope: z.object({ deploymentId: SlugSchema.nullable(), region: SlugSchema.nullable(), platform: z.literal("x"), providers: z.array(SlugSchema) }).strict(),
  blockers: z.array(CheckSchema), verified: z.array(CheckSchema)
}).strict();
export type InternalPreflightReport = z.infer<typeof InternalPreflightReportSchema>;

function bool(value: string | undefined): boolean { return value === "true"; }
export function loadInternalRuntime(environment: NodeJS.ProcessEnv = process.env): InternalRuntime {
  const providers = ([
    ["twittersaver", "ENABLE_TWITTERSAVER_PROVIDER"], ["dlpanda", "ENABLE_DLPANDA_PROVIDER"],
    ["ssstwitter", "ENABLE_SSSTWITTER_PROVIDER"]
  ] as const).filter(([, key]) => bool(environment[key])).map(([id]) => id);
  const providerApprovalsPresent = providers.every((provider) => {
    if (provider === "twittersaver") return bool(environment.TWITTERSAVER_TERMS_APPROVED);
    if (provider === "dlpanda") return bool(environment.DLPANDA_TERMS_APPROVED);
    return bool(environment.SSSTWITTER_TERMS_APPROVED) && bool(environment.SSSTWITTER_DELIVERY_AUDIT_APPROVED);
  });
  return InternalRuntimeSchema.parse({
    serviceRole: environment.TIKDD_INTERNAL_RUNTIME_ROLE ?? "combined",
    authorizationId: environment.TIKDD_INTERNAL_AUTHORIZATION_ID ?? "",
    windowStartsAt: environment.TIKDD_INTERNAL_WINDOW_STARTS_AT ?? "",
    windowEndsAt: environment.TIKDD_INTERNAL_WINDOW_ENDS_AT ?? "",
    nodeEnv: environment.NODE_ENV ?? "development", deploymentStage: environment.TIKDD_DEPLOYMENT_STAGE ?? "local",
    deploymentId: environment.TIKDD_DEPLOYMENT_ID ?? "", region: environment.WORKER_REGION ?? "global",
    observationClass: environment.TIKDD_OBSERVATION_CLASS ?? "public",
    resolveQueueName: loadResolveQueueName(environment.TIKDD_RESOLVE_QUEUE_NAME), enabledProviders: providers,
    providerApprovalsPresent,
    mockEnabled: bool(environment.ENABLE_MOCK_PROVIDER), rolloutEnabled: bool(environment.PROVIDER_ROLLOUT_ENABLED),
    developmentBypass: bool(environment.PROVIDER_ROLLOUT_DEVELOPMENT_BYPASS), admissionEnabled: bool(environment.ADMISSION_CONTROL_ENABLED),
    trustedProxyCidrs: (environment.TRUSTED_PROXY_CIDRS ?? "").split(",").map((item) => item.trim()).filter(Boolean),
    deliverySecretPresent: Boolean(environment.DELIVERY_ENCRYPTION_KEY_ID && environment.DELIVERY_ENCRYPTION_KEY_BASE64URL),
    rolloutSecretPresent: Boolean(environment.PROVIDER_ROLLOUT_COHORT_KEY_BASE64URL),
    admissionSecretPresent: Boolean(environment.TASK_ADMISSION_HMAC_KEY_BASE64URL),
    diagnosticsCredentialPresent: Boolean(environment.PROVIDER_DIAGNOSTICS_TOKEN),
    evidenceDiagnosticsCredentialPresent: Boolean(environment.PILOT_EVIDENCE_DIAGNOSTICS_TOKEN && environment.PILOT_EVIDENCE_DIAGNOSTICS_ACTOR_ID)
  });
}

function equalSets(left: readonly string[], right: readonly string[]): boolean {
  return [...left].sort().join("\0") === [...right].sort().join("\0");
}

function isIsolatedInternalRuntime(runtime: InternalRuntime): boolean {
  return (runtime.serviceRole === "api" || runtime.serviceRole === "worker")
    && /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(runtime.authorizationId)
    && InstantSchema.safeParse(runtime.windowStartsAt).success
    && InstantSchema.safeParse(runtime.windowEndsAt).success
    && runtime.resolveQueueName !== DEFAULT_RESOLVE_QUEUE_NAME
    && runtime.resolveQueueName.startsWith("resolve-internal-");
}

function isCurrentInternalWindow(runtime: InternalRuntime, now: Date): boolean {
  const startsAt = new Date(runtime.windowStartsAt).getTime();
  const endsAt = new Date(runtime.windowEndsAt).getTime();
  return startsAt % 86_400_000 === 0
    && startsAt <= now.getTime()
    && endsAt > now.getTime()
    && endsAt - startsAt === 3 * 86_400_000;
}

export function getInternalRuntimeWindowEnd(environment: NodeJS.ProcessEnv = process.env): Date | null {
  const runtime = loadInternalRuntime(environment);
  if (runtime.observationClass !== "internal" && runtime.deploymentStage !== "internal") return null;
  const parsed = InstantSchema.safeParse(runtime.windowEndsAt);
  if (!parsed.success) throw new Error("Internal runtime window end is invalid.");
  return new Date(parsed.data);
}

function providerCapabilityReason(
  providerId: string,
  platform: string,
  region: string,
  manifests: readonly ProviderManifest[]
): { pass: boolean; reason: string } {
  const matches = manifests.filter((manifest) => manifest.id === providerId);
  if (matches.length !== 1) {
    return {
      pass: false,
      reason: matches.length === 0
        ? `provider_manifest_missing:${providerId}`
        : `provider_manifest_duplicate:${providerId}`
    };
  }

  const manifest = matches[0]!;
  if (!manifest.enabled) {
    return { pass: false, reason: `provider_manifest_disabled:${providerId}` };
  }
  const capability = manifest.platforms.find((item) => item.platform === platform);
  if (!capability) {
    return { pass: false, reason: `provider_capability_missing:${providerId}:${platform}` };
  }
  if (!manifest.regions.includes("*") && !manifest.regions.includes(region)) {
    return {
      pass: false,
      reason: `deployment_region_not_admitted:${providerId}:${platform}:${region}`
    };
  }
  if (
    capability.verificationStatus !== "delivery_verified" ||
    capability.deliveryModes.length === 0
  ) {
    return {
      pass: false,
      reason: `provider_delivery_not_eligible:${providerId}:${platform}`
    };
  }
  return { pass: true, reason: `delivery_capability_admits_region:${providerId}:${platform}:${region}` };
}

export function evaluateInternalPreflight(input: { plan: unknown; runtime: unknown; signals: unknown; manifests: unknown; now?: Date }): InternalPreflightReport {
  const plan = InternalPreflightPlanSchema.parse(input.plan); const runtime = InternalRuntimeSchema.parse(input.runtime);
  const signals = OperationalSignalsSchema.parse(input.signals); const now = input.now ?? new Date();
  const manifests = z.array(ProviderManifestSchema).parse(input.manifests);
  const checks: z.infer<typeof CheckSchema>[] = [];
  const add = (id: string, pass: boolean, reason: string) =>
    checks.push(CheckSchema.parse({ id, status: pass ? "pass" : "block", reason }));
  add("plan_status", plan.status === "ready", plan.status === "ready" ? "ready" : "plan_pending");
  const exactScope = Boolean(plan.scope.deploymentId && plan.scope.region) && runtime.deploymentId === plan.scope.deploymentId && runtime.region === plan.scope.region && runtime.deploymentStage === "internal" && runtime.observationClass === "internal" && equalSets(runtime.enabledProviders, plan.scope.providers);
  add("scope", exactScope, exactScope ? "exact_internal_scope" : "scope_mismatch");
  for (const provider of plan.providerUse) {
    const pass = provider.termsConfirmed && provider.productionUseConfirmed;
    add(`provider_use:${provider.providerId}`, pass, pass ? "confirmed" : "not_confirmed");
  }
  if (plan.scope.region !== null) {
    for (const providerId of plan.scope.providers) {
      const capability = providerCapabilityReason(
        providerId,
        plan.scope.platform,
        plan.scope.region,
        manifests
      );
      add(`provider_capability:${providerId}`, capability.pass, capability.reason);
    }
  } else {
    add("provider_capabilities", false, "deployment_region_missing");
  }
  const commonRuntimeSafe = runtime.nodeEnv === "production" && !runtime.mockEnabled && runtime.providerApprovalsPresent && runtime.rolloutEnabled && !runtime.developmentBypass && runtime.admissionEnabled;
  const roleRuntimeSafe = runtime.serviceRole === "api"
    ? runtime.admissionSecretPresent && runtime.diagnosticsCredentialPresent && runtime.evidenceDiagnosticsCredentialPresent
    : runtime.serviceRole === "worker"
      ? runtime.deliverySecretPresent && runtime.rolloutSecretPresent
      : runtime.deliverySecretPresent && runtime.rolloutSecretPresent && runtime.admissionSecretPresent && runtime.diagnosticsCredentialPresent && runtime.evidenceDiagnosticsCredentialPresent;
  const runtimeSafe = commonRuntimeSafe && roleRuntimeSafe;
  add("runtime_boundaries", runtimeSafe, runtimeSafe ? "fail_closed_controls_enabled" : "runtime_boundary_missing");
  add(
    "runtime_isolation",
    isIsolatedInternalRuntime(runtime),
    isIsolatedInternalRuntime(runtime) ? "explicit_role_and_internal_queue" : "explicit_role_or_internal_queue_missing"
  );
  add(
    "authorization_window",
    isCurrentInternalWindow(runtime, now),
    isCurrentInternalWindow(runtime, now) ? "active_three_day_utc_window" : "authorization_window_inactive"
  );
  const proxySafe = plan.network.trustedProxyMode === "direct" ? runtime.trustedProxyCidrs.length === 0 : plan.network.trustedProxyMode === "trusted-proxy" && runtime.trustedProxyCidrs.length > 0;
  add("trusted_proxy", proxySafe, proxySafe ? "boundary_matches_review" : "proxy_boundary_mismatch");
  add("postgres", signals.postgresReady, signals.postgresReady ? "ready" : "unavailable");
  add("redis", signals.redisReady, signals.redisReady ? "ready" : "unavailable");
  add("provider_egress", signals.providerEgressReady, signals.providerEgressReady ? "reviewed_hosts_reachable" : "unavailable");
  const cleanupFresh = signals.cleanupLastSucceededAt !== null && now.getTime() - new Date(signals.cleanupLastSucceededAt).getTime() >= 0 && now.getTime() - new Date(signals.cleanupLastSucceededAt).getTime() <= plan.bounds.cleanupMaximumAgeMs;
  add("cleanup_freshness", cleanupFresh, cleanupFresh ? "fresh" : "stale_or_missing");
  const evidenceFresh = signals.evidenceLastSucceededAt !== null && now.getTime() - new Date(signals.evidenceLastSucceededAt).getTime() >= 0 && now.getTime() - new Date(signals.evidenceLastSucceededAt).getTime() <= plan.bounds.evidenceMaximumAgeMs;
  add("evidence_freshness", evidenceFresh, evidenceFresh ? "fresh" : "stale_or_missing");
  const denyBounded = signals.emergencyDenyPropagationMs !== null && signals.emergencyDenyPropagationMs <= plan.bounds.emergencyDenyMaximumPropagationMs;
  add("emergency_deny", denyBounded, denyBounded ? "within_reviewed_bound" : "missing_or_too_slow");
  add("worker_restart", signals.workerRestartFailClosed, signals.workerRestartFailClosed ? "fail_closed" : "not_proven");
  add("delivery_expiry", signals.deliveryExpiryFailClosed, signals.deliveryExpiryFailClosed ? "fail_closed" : "not_proven");
  add("manual_recovery", signals.manualRecoveryRequired, signals.manualRecoveryRequired ? "manual_confirmation_required" : "not_proven");
  const blockers = checks.filter(({ status }) => status === "block"); const verified = checks.filter(({ status }) => status === "pass");
  return InternalPreflightReportSchema.parse({ schemaVersion: 1, decision: blockers.length === 0 ? "ready" : "blocked", generatedAt: now.toISOString(), summary: { passed: verified.length, blocked: blockers.length }, scope: plan.scope, blockers, verified });
}

const AttestationPayloadSchema = z.object({ schemaVersion: z.literal(2), serviceRole: z.enum(["combined", "api", "worker"]), deploymentId: SlugSchema, region: SlugSchema, platform: z.literal("x"), providers: z.array(SlugSchema), resolveQueueName: ResolveQueueNameSchema, runtimeDigest: z.string().regex(/^[a-f0-9]{64}$/), issuedAt: InstantSchema, expiresAt: InstantSchema }).strict();
const AttestationSchema = z.object({ payload: AttestationPayloadSchema, signature: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();
function canonicalRuntime(runtime: InternalRuntime): string { return JSON.stringify(InternalRuntimeSchema.parse(runtime)); }
function runtimeDigest(runtime: InternalRuntime): string { return createHash("sha256").update(canonicalRuntime(runtime)).digest("hex"); }
function readKey(encoded: string): Buffer { const key = Buffer.from(encoded, "base64url"); if (!/^[A-Za-z0-9_-]+$/.test(encoded) || key.length < 32 || key.toString("base64url") !== encoded) throw new Error("Internal preflight HMAC key must contain at least 32 canonical base64url bytes."); return key; }
function signPayload(payload: z.infer<typeof AttestationPayloadSchema>, key: Buffer): string { return createHmac("sha256", key).update("tikdd-internal-preflight-v2\0").update(JSON.stringify(payload)).digest("base64url"); }

export function issueInternalPreflightAttestation(input: { report: InternalPreflightReport; runtime: InternalRuntime; encodedKey: string; now?: Date; ttlMs: number }): string {
  const report = InternalPreflightReportSchema.parse(input.report); const runtime = InternalRuntimeSchema.parse(input.runtime); const now = input.now ?? new Date();
  if (report.decision !== "ready" || report.scope.deploymentId === null || report.scope.region === null) throw new Error("A blocked preflight cannot issue an attestation.");
  if (!isIsolatedInternalRuntime(runtime)) throw new Error("Internal preflight attestation requires an explicit API or Worker role and an isolated resolve-internal-* queue.");
  if (!isCurrentInternalWindow(runtime, now)) throw new Error("Internal preflight attestation requires an active three-day authorization window.");
  const reportAgeMs = now.getTime() - new Date(report.generatedAt).getTime();
  if (reportAgeMs < 0 || reportAgeMs > 30_000 || runtime.deploymentId !== report.scope.deploymentId || runtime.region !== report.scope.region || !equalSets(runtime.enabledProviders, report.scope.providers)) throw new Error("The ready preflight report is stale or does not match this runtime.");
  if (input.ttlMs < 60_000 || input.ttlMs > 900_000) throw new Error("Internal preflight attestation TTL is invalid.");
  const payload = AttestationPayloadSchema.parse({ schemaVersion: 2, serviceRole: runtime.serviceRole, deploymentId: report.scope.deploymentId, region: report.scope.region, platform: "x", providers: report.scope.providers, resolveQueueName: runtime.resolveQueueName, runtimeDigest: runtimeDigest(runtime), issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + input.ttlMs).toISOString() });
  const value = AttestationSchema.parse({ payload, signature: signPayload(payload, readKey(input.encodedKey)) });
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function assertInternalStartup(expectedRole: "api" | "worker", environment: NodeJS.ProcessEnv = process.env, now = new Date()): "public" | "internal" {
  const runtime = loadInternalRuntime(environment);
  if (runtime.observationClass !== "internal" && runtime.deploymentStage !== "internal") return "public";
  if (runtime.observationClass !== "internal" || runtime.deploymentStage !== "internal" || runtime.nodeEnv !== "production") throw new Error("Internal observation requires the production internal deployment stage.");
  if (!isIsolatedInternalRuntime(runtime) || runtime.serviceRole !== expectedRole) throw new Error(`Internal ${expectedRole} startup requires its explicit service role and an isolated resolve-internal-* queue.`);
  if (!isCurrentInternalWindow(runtime, now)) throw new Error("Internal startup requires an active three-day authorization window.");
  const encoded = environment.TIKDD_INTERNAL_PREFLIGHT_ATTESTATION; const encodedKey = environment.TIKDD_INTERNAL_PREFLIGHT_HMAC_KEY_BASE64URL;
  if (!encoded || !encodedKey) throw new Error("A current signed internal preflight attestation is required.");
  let attestation: z.infer<typeof AttestationSchema>;
  try { attestation = AttestationSchema.parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))); } catch { throw new Error("The internal preflight attestation is invalid."); }
  const expected = Buffer.from(signPayload(attestation.payload, readKey(encodedKey)), "base64url"); const actual = Buffer.from(attestation.signature, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error("The internal preflight attestation signature is invalid.");
  const issued = new Date(attestation.payload.issuedAt).getTime(); const expires = new Date(attestation.payload.expiresAt).getTime();
  if (issued > now.getTime() + 5_000 || expires <= now.getTime() || expires - issued > 900_000) throw new Error("The internal preflight attestation is stale or expired.");
  if (attestation.payload.runtimeDigest !== runtimeDigest(runtime)) throw new Error("The internal preflight attestation does not match this runtime.");
  return "internal";
}
