import { randomUUID } from "node:crypto";
import { detectPlatform } from "@tikdd/platform";
import {
  ProviderError,
  YtDlpIsolatedProvider,
  type ResolverProvider
} from "@tikdd/providers";

const SUPPORTED_PLATFORM = "youtube" as const;
const CAPABILITIES = ["direct", "relay", "artifact"] as const;
const SAMPLE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,38}[a-z0-9])?$/;
const MAXIMUM_SAMPLES = 2;
// Keep qualification spacing at or above the Runner's YouTube admission guard.
export const YTDLP_QUALIFICATION_INTERVAL_MS = 15_000;

export type YtDlpQualificationCapability = (typeof CAPABILITIES)[number];

export interface YtDlpQualificationSample {
  id: string;
  platform: typeof SUPPORTED_PLATFORM;
  sourceUrl: string;
  canonicalUrl: string;
}

export interface YtDlpQualificationPlan {
  capability: YtDlpQualificationCapability;
  samples: readonly YtDlpQualificationSample[];
}

export interface YtDlpQualificationResult {
  sampleId: string;
  platform: typeof SUPPORTED_PLATFORM;
  capability: YtDlpQualificationCapability;
  outcome: "resolved" | "failed";
  formatCount: number;
  candidateCount: number;
  hostPolicyIds: readonly string[];
  deliveryModes: readonly string[];
  thumbnailStatus: "accepted" | "missing";
  failureCode: string | null;
  durationMs: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseYtDlpQualificationPlan(value: unknown): YtDlpQualificationPlan {
  if (!isRecord(value) || !CAPABILITIES.includes(value.capability as YtDlpQualificationCapability) ||
      !Array.isArray(value.samples) || value.samples.length < 1 || value.samples.length > MAXIMUM_SAMPLES) {
    throw new Error("yt-dlp YouTube qualification requires one or two samples and a reviewed capability.");
  }
  const identifiers = new Set<string>();
  const samples = value.samples.map((candidate): YtDlpQualificationSample => {
    if (!isRecord(candidate) || typeof candidate.id !== "string" || !SAMPLE_ID_PATTERN.test(candidate.id) ||
        identifiers.has(candidate.id) || typeof candidate.url !== "string" || candidate.url.length > 4_096) {
      throw new Error("yt-dlp qualification samples must have unique bounded identifiers and URLs.");
    }
    identifiers.add(candidate.id);
    const detected = detectPlatform(candidate.url);
    if (detected.platform !== SUPPORTED_PLATFORM) {
      throw new Error("yt-dlp qualification accepts YouTube samples only.");
    }
    return { id: candidate.id, platform: SUPPORTED_PLATFORM, sourceUrl: candidate.url, canonicalUrl: detected.canonicalUrl };
  });
  return { capability: value.capability as YtDlpQualificationCapability, samples };
}

export function assertYtDlpQualificationTrafficIsolation(
  plan: YtDlpQualificationPlan,
  input: { enabled?: string | undefined; approvedPlatforms?: string | undefined; verifiedCapabilities?: string | undefined }
): void {
  const approved = new Set((input.approvedPlatforms ?? "").split(",").map((value) => value.trim()).filter(Boolean));
  const capabilities = (input.verifiedCapabilities ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (approved.has(SUPPORTED_PLATFORM) || capabilities.some((entry) => entry.split(":", 1)[0] === SUPPORTED_PLATFORM)) {
    throw new Error("yt-dlp YouTube qualification overlaps an active Worker capability.");
  }
  if (input.enabled === "true" && approved.size === 0 && capabilities.length > 0) {
    throw new Error("yt-dlp qualification runtime configuration is inconsistent.");
  }
  void plan;
}

function summarize(
  sample: YtDlpQualificationSample,
  capability: YtDlpQualificationCapability,
  resolution: Awaited<ReturnType<ResolverProvider["resolve"]>>,
  durationMs: number
): YtDlpQualificationResult {
  return {
    sampleId: sample.id,
    platform: sample.platform,
    capability,
    outcome: "resolved",
    formatCount: resolution.result.formats.length,
    candidateCount: resolution.candidates.length,
    hostPolicyIds: [...new Set(resolution.candidates.map((candidate) => candidate.hostPolicyId))].sort(),
    deliveryModes: [...new Set(resolution.candidates.map((candidate) => candidate.mode))].sort(),
    thumbnailStatus: resolution.result.media.thumbnailUrl ? "accepted" : "missing",
    failureCode: null,
    durationMs
  };
}

export async function runYtDlpQualification(
  plan: YtDlpQualificationPlan,
  options: {
    apiUrl: string;
    hmacSecret: string;
    sleep?: (milliseconds: number) => Promise<void>;
    providerFactory?: () => ResolverProvider;
  }
): Promise<readonly YtDlpQualificationResult[]> {
  if (options.hmacSecret.trim().length < 32) throw new Error("yt-dlp qualification requires a configured Runner secret.");
  const provider = options.providerFactory?.() ?? new YtDlpIsolatedProvider({
    enabled: true,
    apiUrl: options.apiUrl,
    hmacSecret: options.hmacSecret,
    approvedPlatforms: [SUPPORTED_PLATFORM],
    deliveryVerifiedCapabilities: { [SUPPORTED_PLATFORM]: plan.capability }
  });
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const results: YtDlpQualificationResult[] = [];
  for (const [index, sample] of plan.samples.entries()) {
    if (index > 0) await sleep(YTDLP_QUALIFICATION_INTERVAL_MS);
    const startedAt = Date.now();
    try {
      const resolution = await provider.resolve({
        taskId: randomUUID(), sourceUrl: sample.sourceUrl, canonicalUrl: sample.canonicalUrl, platform: sample.platform
      });
      results.push(summarize(sample, plan.capability, resolution, Date.now() - startedAt));
    } catch (error) {
      results.push({
        sampleId: sample.id, platform: sample.platform, capability: plan.capability, outcome: "failed",
        formatCount: 0, candidateCount: 0, hostPolicyIds: [], deliveryModes: [], thumbnailStatus: "missing",
        failureCode: error instanceof ProviderError ? error.failureCode : "provider_unavailable",
        durationMs: Date.now() - startedAt
      });
    }
  }
  return results;
}
