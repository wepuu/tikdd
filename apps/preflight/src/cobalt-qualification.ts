import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { detectPlatform } from "@tikdd/platform";
import {
  CobaltProvider,
  ProviderError,
  type CobaltDiagnosticEvent,
  type CobaltSuccessMode,
  type ResolverProvider
} from "@tikdd/providers";
import { parseCobaltTunnelAuditInput } from "./cobalt-tunnel-audit";

const SUPPORTED_PLATFORMS = [
  "x",
  "instagram",
  "tiktok",
  "facebook",
  "dailymotion",
  "reddit",
  "vk"
] as const;
const ALL_MODES: readonly CobaltSuccessMode[] = ["redirect", "picker", "tunnel", "local-processing"];
const SAMPLE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,38}[a-z0-9])?$/;
const MAXIMUM_SAMPLES = 8;
const MAXIMUM_SAMPLES_PER_PLATFORM = 2;
export const COBALT_QUALIFICATION_INTERVAL_MS = 10_000;

type QualificationPlatform = (typeof SUPPORTED_PLATFORMS)[number];

export interface CobaltQualificationSample {
  id: string;
  platform: QualificationPlatform;
  sourceUrl: string;
  canonicalUrl: string;
}

export interface CobaltQualificationPlan {
  samples: readonly CobaltQualificationSample[];
}

export interface CobaltQualificationResult {
  sampleId: string;
  platform: QualificationPlatform;
  outcome: "resolved" | "failed";
  responseMode: string | null;
  httpStatus: number | null;
  formatCount: number;
  candidateCount: number;
  mediaKinds: readonly string[];
  hostPolicyIds: readonly string[];
  processingOperations: readonly string[];
  failureCode: string | null;
  durationMs: number;
}

export interface CobaltQualificationTunnelArtifactSample {
  id: string;
  url: string;
}

export function writeCobaltQualificationTunnelArtifact(
  path: string,
  samples: readonly CobaltQualificationTunnelArtifactSample[]
): void {
  const plan = parseCobaltTunnelAuditInput({ samples }, "client-direct");
  const artifact = {
    schemaVersion: "1.0",
    samples: plan.samples.map(({ id, targetUrl }) => ({ id, url: targetUrl }))
  };
  writeFileSync(path, `${JSON.stringify(artifact)}\n`, { encoding: "utf8", flag: "w", mode: 0o600 });
  chmodSync(path, 0o600);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function qualificationPlatform(value: unknown): QualificationPlatform {
  if (typeof value !== "string" || !(SUPPORTED_PLATFORMS as readonly string[]).includes(value)) {
    throw new Error("Cobalt qualification platform is not in a reviewed batch.");
  }
  return value as QualificationPlatform;
}

export function parseCobaltQualificationPlan(value: unknown): CobaltQualificationPlan {
  if (!isRecord(value) || !Array.isArray(value.samples) || value.samples.length < 1 || value.samples.length > MAXIMUM_SAMPLES) {
    throw new Error("Cobalt qualification requires between one and eight samples.");
  }
  const identifiers = new Set<string>();
  const platformCounts = new Map<QualificationPlatform, number>();
  const samples = value.samples.map((candidate): CobaltQualificationSample => {
    if (!isRecord(candidate)) throw new Error("Cobalt qualification samples must be objects.");
    const id = candidate.id;
    if (typeof id !== "string" || !SAMPLE_ID_PATTERN.test(id) || identifiers.has(id)) {
      throw new Error("Cobalt qualification sample IDs must be unique safe identifiers.");
    }
    identifiers.add(id);
    const platform = qualificationPlatform(candidate.platform);
    const nextCount = (platformCounts.get(platform) ?? 0) + 1;
    if (nextCount > MAXIMUM_SAMPLES_PER_PLATFORM) {
      throw new Error("Cobalt qualification accepts at most two samples per platform.");
    }
    platformCounts.set(platform, nextCount);
    if (typeof candidate.url !== "string" || candidate.url.length > 4_096) {
      throw new Error("Cobalt qualification samples require a bounded source URL.");
    }
    const detected = detectPlatform(candidate.url);
    if (detected.platform !== platform) {
      throw new Error("Cobalt qualification sample platform does not match its reviewed host.");
    }
    return { id, platform, sourceUrl: candidate.url, canonicalUrl: detected.canonicalUrl };
  });
  return { samples };
}

export function assertCobaltQualificationTrafficIsolation(
  plan: CobaltQualificationPlan,
  input: { approvedPlatforms?: string | undefined; verifiedCapabilities?: string | undefined }
): void {
  const activePlatforms = new Set(
    (input.approvedPlatforms ?? "").split(",").map((value) => value.trim()).filter(Boolean)
  );
  for (const entry of (input.verifiedCapabilities ?? "").split(",")) {
    const platform = entry.trim().split(":", 1)[0];
    if (platform) activePlatforms.add(platform);
  }
  const overlap = plan.samples.find(({ platform }) => activePlatforms.has(platform));
  if (overlap) {
    throw new Error(`Cobalt qualification platform is active in Worker configuration: ${overlap.platform}.`);
  }
}

export function readCobaltApiKey(path: string): string {
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isRecord(value)) throw new Error("Cobalt API key registry must be a JSON object.");
  const keys = Object.keys(value);
  if (keys.length !== 1 || !keys[0] || keys[0].length > 512) {
    throw new Error("Cobalt qualification requires exactly one bounded API key.");
  }
  return keys[0];
}

function summarizeResolution(
  sample: CobaltQualificationSample,
  resolution: Awaited<ReturnType<ResolverProvider["resolve"]>>,
  diagnostic: CobaltDiagnosticEvent | null,
  durationMs: number
): CobaltQualificationResult {
  const policies = new Set<string>();
  const operations = new Set<string>();
  for (const candidate of resolution.candidates) {
    policies.add(candidate.hostPolicyId);
    if (candidate.kind === "processing") operations.add(candidate.processing.operation);
  }
  return {
    sampleId: sample.id,
    platform: sample.platform,
    outcome: "resolved",
    responseMode: diagnostic?.responseStatus ?? null,
    httpStatus: diagnostic?.httpStatus ?? null,
    formatCount: resolution.result.formats.length,
    candidateCount: resolution.candidates.length,
    mediaKinds: [...new Set(resolution.result.formats.map((format) => format.mediaKind ?? "video"))].sort(),
    hostPolicyIds: [...policies].sort(),
    processingOperations: [...operations].sort(),
    failureCode: null,
    durationMs
  };
}

export async function runCobaltQualification(
  plan: CobaltQualificationPlan,
  options: {
    apiUrl: string;
    apiKey: string;
    sleep?: (milliseconds: number) => Promise<void>;
    providerFactory?: (diagnosticSink: (event: CobaltDiagnosticEvent) => void) => ResolverProvider;
    tunnelArtifactSink?: (samples: readonly CobaltQualificationTunnelArtifactSample[]) => void | Promise<void>;
  }
): Promise<readonly CobaltQualificationResult[]> {
  const diagnostics = new Map<string, CobaltDiagnosticEvent>();
  const platforms = [...new Set(plan.samples.map(({ platform }) => platform))];
  const capabilityMap = Object.fromEntries(platforms.map((platform) => [platform, ALL_MODES]));
  const provider = options.providerFactory?.((event) => diagnostics.set(event.taskId, event)) ?? new CobaltProvider({
    enabled: true,
    apiUrl: options.apiUrl,
    apiKey: options.apiKey,
    approvedPlatforms: platforms,
    deliveryVerifiedCapabilities: capabilityMap,
    diagnosticSink: (event) => diagnostics.set(event.taskId, event)
  });
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const results: CobaltQualificationResult[] = [];
  const tunnelArtifactSamples: CobaltQualificationTunnelArtifactSample[] = [];

  for (const [index, sample] of plan.samples.entries()) {
    if (index > 0) await sleep(COBALT_QUALIFICATION_INTERVAL_MS);
    const taskId = randomUUID();
    const startedAt = Date.now();
    try {
      const resolution = await provider.resolve({
        taskId,
        sourceUrl: sample.sourceUrl,
        canonicalUrl: sample.canonicalUrl,
        platform: sample.platform
      });
      const tunnelCandidates = resolution.candidates.flatMap((candidate) => {
        if (candidate.kind === "processing") return [];
        return candidate.mode === "proxy" && candidate.hostPolicyId === "cobalt-selfhosted-tunnel-media-v1"
          ? [candidate]
          : [];
      });
      if (tunnelCandidates.length > 1) {
        throw new ProviderError("Cobalt qualification returned multiple tunnel candidates for one sample.", "invalid_result", false, true);
      }
      const tunnelCandidate = tunnelCandidates[0];
      if (tunnelCandidate) tunnelArtifactSamples.push({ id: sample.id, url: tunnelCandidate.targetUrl });
      results.push(summarizeResolution(sample, resolution, diagnostics.get(taskId) ?? null, Date.now() - startedAt));
    } catch (error) {
      const diagnostic = diagnostics.get(taskId) ?? null;
      results.push({
        sampleId: sample.id,
        platform: sample.platform,
        outcome: "failed",
        responseMode: diagnostic?.responseStatus ?? null,
        httpStatus: diagnostic?.httpStatus ?? null,
        formatCount: 0,
        candidateCount: diagnostic?.candidateCount ?? 0,
        mediaKinds: [],
        hostPolicyIds: [],
        processingOperations: [],
        failureCode: error instanceof ProviderError ? error.failureCode : "provider_unavailable",
        durationMs: Date.now() - startedAt
      });
    }
  }
  if (tunnelArtifactSamples.length > 2) {
    throw new Error("Cobalt qualification tunnel artifact is limited to two samples.");
  }
  if (tunnelArtifactSamples.length > 0) await options.tunnelArtifactSink?.(tunnelArtifactSamples);
  return results;
}
