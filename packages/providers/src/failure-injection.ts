import { createHash } from "node:crypto";
import {
  ResolveResultSchema,
  type Platform,
  type ProviderDeliveryMode,
  type ProviderFailureCode,
  type RegionId
} from "@tikdd/contracts";
import { ProviderResolutionSchema, type ProviderResolution } from "@tikdd/delivery-core";
import { ProviderError } from "./errors";
import type { ProviderManifest, ResolveInput, ResolverProvider } from "./index";

export type FailureInjectionOutcome =
  | { kind: "success" }
  | {
      kind: "failure";
      failureCode: ProviderFailureCode;
      retryable: boolean;
      fallbackAllowed: boolean;
    };

export interface FailureInjectionProviderOptions {
  id: string;
  platform: Platform;
  priority: number;
  outcomes: readonly FailureInjectionOutcome[];
  region?: RegionId | "*";
  deliveryModes?: readonly ProviderDeliveryMode[];
}

export class FailureInjectionProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  calls = 0;
  private readonly outcomes: readonly FailureInjectionOutcome[];

  constructor(options: FailureInjectionProviderOptions) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FailureInjectionProvider cannot run in production.");
    }
    if (options.outcomes.length === 0) {
      throw new Error("FailureInjectionProvider requires at least one outcome.");
    }
    this.outcomes = options.outcomes;
    this.manifest = {
      id: options.id,
      displayName: `Failure injection ${options.id}`,
      kind: "mock",
      enabled: true,
      regions: [options.region ?? "*"],
      timeoutMs: 1_000,
      costWeight: 0,
      platforms: [{
        platform: options.platform,
        priority: options.priority,
        deliveryModes: [...(options.deliveryModes ?? [])],
        verificationStatus: options.deliveryModes?.length ? "delivery_verified" : "fixture_verified"
      }]
    };
  }

  async resolve(input: ResolveInput): Promise<ProviderResolution> {
    const outcome = this.outcomes[Math.min(this.calls, this.outcomes.length - 1)];
    this.calls += 1;
    if (outcome && outcome.kind === "failure") {
      throw new ProviderError(
        `Injected ${outcome.failureCode}.`,
        outcome.failureCode,
        outcome.retryable,
        outcome.fallbackAllowed
      );
    }
    const mediaId = createHash("sha256").update(input.canonicalUrl).digest("hex").slice(0, 16);
    return ProviderResolutionSchema.parse({
      result: ResolveResultSchema.parse({
        schemaVersion: "1.0",
        source: { platform: input.platform, canonicalUrl: input.canonicalUrl },
        media: {
          id: mediaId,
          title: "Failure injection success",
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
            quality: "Fixture",
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
        warnings: []
      }),
      candidates: []
    });
  }
}
