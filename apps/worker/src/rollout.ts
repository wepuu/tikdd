import { RolloutRuleRepository } from "@tikdd/persistence";
import {
  RedisRolloutStore,
  RolloutDecisionSchema,
  RuntimeProviderRolloutSource,
  refreshRolloutSnapshot,
  type ProviderRolloutRequest,
  type ProviderRolloutSource
} from "@tikdd/rollout-control";
import type Redis from "ioredis";

export interface RolloutConfiguration {
  enabled: boolean;
  developmentBypass: boolean;
  cohortKey: Uint8Array | null;
  refreshIntervalMs: number;
  snapshotTtlMs: number;
  maximumStaleMs: number;
}

function parseInteger(name: string, raw: string | undefined, fallback: number): number {
  const value = Number.parseInt(raw ?? String(fallback), 10);
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer.`);
  }
  return value;
}

function parseBoolean(name: string, raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) {
    return fallback;
  }
  if (raw !== "true" && raw !== "false") {
    throw new Error(`${name} must be true or false.`);
  }
  return raw === "true";
}

export function loadRolloutConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): RolloutConfiguration {
  const enabled = parseBoolean(
    "PROVIDER_ROLLOUT_ENABLED",
    environment.PROVIDER_ROLLOUT_ENABLED,
    false
  );
  const developmentBypass = parseBoolean(
    "PROVIDER_ROLLOUT_DEVELOPMENT_BYPASS",
    environment.PROVIDER_ROLLOUT_DEVELOPMENT_BYPASS,
    false
  );
  if (environment.NODE_ENV === "production" && developmentBypass) {
    throw new Error("PROVIDER_ROLLOUT_DEVELOPMENT_BYPASS cannot be enabled in production.");
  }

  const refreshIntervalMs = parseInteger(
    "PROVIDER_ROLLOUT_REFRESH_MS",
    environment.PROVIDER_ROLLOUT_REFRESH_MS,
    5_000
  );
  const snapshotTtlMs = parseInteger(
    "PROVIDER_ROLLOUT_SNAPSHOT_TTL_MS",
    environment.PROVIDER_ROLLOUT_SNAPSHOT_TTL_MS,
    30_000
  );
  const maximumStaleMs = parseInteger(
    "PROVIDER_ROLLOUT_MAX_STALE_MS",
    environment.PROVIDER_ROLLOUT_MAX_STALE_MS,
    15_000
  );
  if (refreshIntervalMs < 1_000 || refreshIntervalMs > 5_000) {
    throw new Error("PROVIDER_ROLLOUT_REFRESH_MS must be between 1000 and 5000.");
  }
  if (snapshotTtlMs < 5_000 || snapshotTtlMs > 24 * 60 * 60 * 1_000) {
    throw new Error("PROVIDER_ROLLOUT_SNAPSHOT_TTL_MS is outside the supported range.");
  }
  if (maximumStaleMs < 5_000 || maximumStaleMs > 60_000 || snapshotTtlMs < maximumStaleMs) {
    throw new Error("Rollout snapshot TTL must cover a 5-60 second maximum stale interval.");
  }

  let cohortKey: Uint8Array | null = null;
  if (enabled) {
    const encoded = environment.PROVIDER_ROLLOUT_COHORT_KEY_BASE64URL;
    if (!encoded) {
      throw new Error("PROVIDER_ROLLOUT_COHORT_KEY_BASE64URL is required when rollout is enabled.");
    }
    if (!/^[A-Za-z0-9_-]+$/.test(encoded)) {
      throw new Error("The rollout cohort key must use unpadded base64url encoding.");
    }
    cohortKey = Buffer.from(encoded, "base64url");
    if (cohortKey.byteLength < 32 || Buffer.from(cohortKey).toString("base64url") !== encoded) {
      throw new Error("The rollout cohort key must contain at least 32 bytes.");
    }
  }

  return {
    enabled,
    developmentBypass,
    cohortKey,
    refreshIntervalMs,
    snapshotTtlMs,
    maximumStaleMs
  };
}

class WorkerRolloutSource implements ProviderRolloutSource {
  constructor(
    private readonly runtime: RuntimeProviderRolloutSource | null,
    private readonly production: boolean,
    private readonly developmentBypass: boolean
  ) {}

  async decide(request: ProviderRolloutRequest) {
    if (request.providerKind === "mock") {
      return RolloutDecisionSchema.parse({
        allowed: !this.production,
        reason: this.production ? "production_mock_denied" : "development_bypass",
        ruleId: null,
        snapshotRevision: null,
        bucket: null
      });
    }
    if (this.runtime) {
      return this.runtime.decide(request);
    }
    return RolloutDecisionSchema.parse({
      allowed: !this.production && this.developmentBypass,
      reason: !this.production && this.developmentBypass ? "development_bypass" : "control_unavailable",
      ruleId: null,
      snapshotRevision: null,
      bucket: null
    });
  }
}

export interface RolloutRuntime {
  source: ProviderRolloutSource;
  stop(): void;
}

export async function createRolloutRuntime(input: {
  redis: Redis;
  repository: RolloutRuleRepository;
  configuration: RolloutConfiguration;
  production: boolean;
  onResult?: (message: string) => void;
  onError?: (error: unknown) => void;
}): Promise<RolloutRuntime> {
  const { configuration } = input;
  if (!configuration.enabled || !configuration.cohortKey) {
    return {
      source: new WorkerRolloutSource(null, input.production, configuration.developmentBypass),
      stop() {}
    };
  }

  const store = new RedisRolloutStore(input.redis);
  const loadDurable = () => input.repository.loadSnapshot();
  const runtime = new RuntimeProviderRolloutSource(
    store,
    loadDurable,
    configuration.cohortKey,
    configuration.maximumStaleMs
  );
  let lastPublishedRevision: number | null = null;
  const refresh = async () => {
    try {
      const snapshot = await refreshRolloutSnapshot({
        store,
        loadDurable,
        ttlMs: configuration.snapshotTtlMs
      });
      if (snapshot.revision !== lastPublishedRevision) {
        input.onResult?.(`Published rollout revision ${snapshot.revision}.`);
        lastPublishedRevision = snapshot.revision;
      }
    } catch (error) {
      input.onError?.(error);
    }
  };
  await refresh();
  const timer = setInterval(() => void refresh(), configuration.refreshIntervalMs);
  timer.unref();

  return {
    source: new WorkerRolloutSource(runtime, input.production, configuration.developmentBypass),
    stop() {
      clearInterval(timer);
    }
  };
}
