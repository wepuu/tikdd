import { createHash } from "node:crypto";
import {
  ProviderManifestSchema,
  RegionIdSchema,
  ResolveResultSchema,
  type Platform,
  type ProviderAttempt,
  type ProviderManifest as ProviderManifestContract,
  type ProviderPlatformCapability as ProviderPlatformCapabilityContract,
  type RegionId,
  type ResolveResult
} from "@tikdd/contracts";
import {
  ProviderResolutionSchema,
  type ProviderResolution
} from "@tikdd/delivery-core";
import type {
  ProviderCircuitKey,
  ProviderRoutingHealthSnapshot,
  ProviderRoutingHealthSource
} from "@tikdd/routing-health";
import {
  NoProviderAvailableError,
  ProviderError,
  ProviderRoutingError
} from "./errors";

export { NoProviderAvailableError, ProviderError, ProviderRoutingError } from "./errors";
export {
  FailureInjectionProvider,
  type FailureInjectionOutcome,
  type FailureInjectionProviderOptions
} from "./failure-injection";
export { DLPandaProvider, type DLPandaProviderOptions } from "./adapters/dlpanda";
export {
  TwitterSaverProvider,
  type TwitterSaverProviderOptions
} from "./adapters/twitter-saver";

export interface ResolveInput {
  sourceUrl: string;
  canonicalUrl: string;
  platform: Platform;
  signal?: AbortSignal;
}

export type ProviderPlatformCapability = ProviderPlatformCapabilityContract;
export type ProviderManifest = ProviderManifestContract;
export type {
  ProviderCircuitKey,
  ProviderRoutingHealthSnapshot as ProviderHealthSnapshot,
  ProviderRoutingHealthSource as ProviderHealthSource
} from "@tikdd/routing-health";

export interface ResolverProvider {
  readonly manifest: ProviderManifest;
  resolve(input: ResolveInput): Promise<ProviderResolution>;
}

export type ProviderCircuitState = "closed" | "open" | "half-open";

class NeutralProviderHealthSource implements ProviderRoutingHealthSource {
  async get(_key: ProviderCircuitKey): Promise<ProviderRoutingHealthSnapshot> {
    return {
      state: "closed",
      successRate: 0,
      latencyP95Ms: 0,
      insufficientData: true,
      openUntil: null,
      calculatedAt: new Date().toISOString()
    };
  }

  async acquireProbe(_key: ProviderCircuitKey): Promise<boolean> {
    return false;
  }
}

export interface ProviderRoutingResult {
  resolution: ProviderResolution;
  attempts: readonly ProviderAttempt[];
}

interface RankedProvider {
  provider: ResolverProvider;
  capability: ProviderPlatformCapability;
  score: number;
}

export interface ProviderRouterOptions {
  region?: RegionId;
  maxAttempts?: number;
  healthSource?: ProviderRoutingHealthSource;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }

  return new ProviderError(
    "The provider failed unexpectedly.",
    "internal_error",
    true,
    true
  );
}

export class ProviderRouter {
  private readonly region: RegionId;
  private readonly maxAttempts: number;
  private readonly healthSource: ProviderRoutingHealthSource;

  constructor(
    private readonly providers: readonly ResolverProvider[],
    options: ProviderRouterOptions = {}
  ) {
    const providerIds = new Set<string>();
    for (const provider of providers) {
      ProviderManifestSchema.parse(provider.manifest);
      if (providerIds.has(provider.manifest.id)) {
        throw new Error(`Duplicate provider id: ${provider.manifest.id}`);
      }
      providerIds.add(provider.manifest.id);
    }
    this.region = RegionIdSchema.parse(options.region ?? "global");
    this.maxAttempts = options.maxAttempts ?? 4;
    this.healthSource = options.healthSource ?? new NeutralProviderHealthSource();
  }

  getProviderCountsByPlatform(): ReadonlyMap<Platform, number> {
    const counts = new Map<Platform, number>();
    for (const provider of this.providers) {
      if (!provider.manifest.enabled) {
        continue;
      }
      for (const capability of provider.manifest.platforms) {
        counts.set(capability.platform, (counts.get(capability.platform) ?? 0) + 1);
      }
    }
    return counts;
  }

  private async rank(platform: Platform): Promise<RankedProvider[]> {
    const ranked: RankedProvider[] = [];

    for (const provider of this.providers) {
      const { manifest } = provider;
      const capability = manifest.platforms.find((item) => item.platform === platform);
      const regionMatches = manifest.regions.includes("*") || manifest.regions.includes(this.region);
      const circuitKey: ProviderCircuitKey = {
        providerId: manifest.id,
        platform,
        region: this.region
      };
      const health = await this.healthSource.get(circuitKey);

      if (!manifest.enabled || !capability || !regionMatches) {
        continue;
      }

      if (health.state !== "closed") {
        const cooldownElapsed =
          health.state === "half-open" ||
          (health.openUntil !== null && new Date(health.openUntil).getTime() <= Date.now());
        if (!cooldownElapsed || !(await this.healthSource.acquireProbe(circuitKey))) {
          continue;
        }
      }

      const successRate = clamp(health.successRate, 0, 1);
      const latencyPenalty = Math.min(Math.max(health.latencyP95Ms, 0) / 1000, 50);
      const score =
        capability.priority * 1000 + successRate * 100 - latencyPenalty - manifest.costWeight;
      ranked.push({ provider, capability, score });
    }

    return ranked.sort(
      (left, right) =>
        right.score - left.score || left.provider.manifest.id.localeCompare(right.provider.manifest.id)
    );
  }

  async resolve(input: ResolveInput): Promise<ProviderRoutingResult> {
    const ranked = (await this.rank(input.platform)).slice(0, this.maxAttempts);
    if (ranked.length === 0) {
      throw new NoProviderAvailableError(input.platform);
    }

    const attempts: ProviderAttempt[] = [];

    for (const candidate of ranked) {
      const startedAt = new Date();
      const timeoutSignal = AbortSignal.timeout(candidate.provider.manifest.timeoutMs);
      const signal = input.signal
        ? AbortSignal.any([input.signal, timeoutSignal])
        : timeoutSignal;

      try {
        const rawResolution = await candidate.provider.resolve({ ...input, signal });
        let resolution: ProviderResolution;
        try {
          resolution = ProviderResolutionSchema.parse(rawResolution);
        } catch {
          throw new ProviderError(
            "The provider returned an invalid normalized result.",
            "invalid_result",
            true,
            true
          );
        }

        const finishedAt = new Date();
        attempts.push({
          providerId: candidate.provider.manifest.id,
          providerKind: candidate.provider.manifest.kind,
          platform: input.platform,
          region: this.region,
          priority: candidate.capability.priority,
          routeScore: candidate.score,
          status: "succeeded",
          failureCode: null,
          retryable: null,
          fallbackAllowed: null,
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime())
        });
        return { resolution, attempts };
      } catch (error) {
        const routeDeadlineReached = input.signal?.aborted ?? false;
        const normalizedError = signal.aborted
          ? new ProviderError("The provider timed out.", "provider_timeout", true, true)
          : normalizeProviderError(error);
        const finishedAt = new Date();
        attempts.push({
          providerId: candidate.provider.manifest.id,
          providerKind: candidate.provider.manifest.kind,
          platform: input.platform,
          region: this.region,
          priority: candidate.capability.priority,
          routeScore: candidate.score,
          status: "failed",
          failureCode: normalizedError.failureCode,
          retryable: normalizedError.retryable,
          fallbackAllowed: normalizedError.fallbackAllowed,
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime())
        });

        if (routeDeadlineReached) {
          throw new ProviderRoutingError(
            "The provider routing deadline was reached.",
            "provider_timeout",
            true,
            attempts
          );
        }

        if (!normalizedError.fallbackAllowed) {
          throw new ProviderRoutingError(
            normalizedError.message,
            normalizedError.failureCode,
            normalizedError.retryable,
            attempts
          );
        }
      }
    }

    const lastAttempt = attempts.at(-1);
    throw new ProviderRoutingError(
      `All eligible providers failed for ${input.platform}.`,
      lastAttempt?.failureCode ?? "provider_unavailable",
      lastAttempt?.retryable ?? true,
      attempts
    );
  }
}

export class MockProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;

  constructor(platforms: readonly Platform[] = ["tiktok", "youtube", "x"]) {
    this.manifest = {
      id: "development-mock",
      displayName: "Development mock",
      kind: "mock",
      enabled: true,
      regions: ["*"],
      timeoutMs: 5_000,
      costWeight: 0,
      platforms: platforms.map((platform) => ({ platform, priority: 10 }))
    };
  }

  async resolve(input: ResolveInput): Promise<ProviderResolution> {
    if (process.env.NODE_ENV === "production") {
      throw new ProviderError(
        "The mock provider cannot run in production.",
        "provider_unavailable",
        false,
        true
      );
    }

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 350);
      input.signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(input.signal?.reason ?? new Error("Provider request aborted."));
        },
        { once: true }
      );
    });

    const mediaId = createHash("sha256").update(input.canonicalUrl).digest("hex").slice(0, 16);

    const result: ResolveResult = ResolveResultSchema.parse({
      schemaVersion: "1.0",
      source: {
        platform: input.platform,
        canonicalUrl: input.canonicalUrl
      },
      media: {
        id: mediaId,
        title: "Development provider result",
        author: null,
        thumbnailUrl: null,
        durationSeconds: null,
        isLive: false
      },
      formats: [
        {
          id: `fmt_${mediaId}_source`,
          container: "mp4",
          mimeType: "video/mp4",
          quality: "Source quality",
          width: null,
          height: null,
          fps: null,
          bitrateKbps: null,
          estimatedBytes: null,
          videoCodec: null,
          audioCodec: null,
          hasVideo: true,
          hasAudio: true
        }
      ],
      provenance: {
        provider: this.manifest.id,
        kind: this.manifest.kind,
        cacheHit: false,
        resolvedAt: new Date().toISOString()
      },
      warnings: ["Development-only result. No real media has been fetched."]
    });
    return ProviderResolutionSchema.parse({ result, candidates: [] });
  }
}
