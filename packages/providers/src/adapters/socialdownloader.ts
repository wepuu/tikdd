import { z } from "zod";
import type { ProviderFailureCode } from "@tikdd/contracts";
import { ProviderError } from "../errors";
import type { ProviderManifest, ResolveInput, ResolverProvider } from "../index";
import {
  createRedirectResolution,
  requestText,
  type ParsedFormat,
  type ProviderFetch
} from "./shared";

const API_ORIGIN = "https://www.socialdownloader.space";
const API_PATH = "/api/download";
const API_HOSTS = new Set(["www.socialdownloader.space"]);
const MEDIA_HOST_POLICY_ID = "socialdownloader-space-facebook-media-v1";
const MAXIMUM_CANDIDATE_LIFETIME_MS = 4 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const MEDIA_PATH = "/api/video";

const ResponseSchema = z.object({
  success: z.boolean().nullish(),
  status: z.union([z.string(), z.number()]).nullish(),
  message: z.string().max(500).nullish(),
  error: z.string().max(500).nullish(),
  downloadUrl: z.string().max(16_384).nullish(),
  videoUrl: z.string().max(16_384).nullish(),
  title: z.string().max(1_000).nullish(),
  metadata: z.object({
    title: z.string().max(1_000).nullish()
  }).passthrough().nullish()
}).passthrough();

export interface SocialDownloaderProviderOptions {
  enabled?: boolean;
  fetchImpl?: ProviderFetch;
  diagnosticSink?: (event: SocialDownloaderDiagnosticEvent) => void;
}

export type SocialDownloaderDiagnosticPhase = "request" | "payload" | "resources" | "completed";
export type SocialDownloaderContentType = "json" | "html" | "text" | "other" | "missing";

export interface SocialDownloaderDiagnosticEvent {
  event: "socialdownloader_resolution_diagnostic";
  taskId: string;
  platform: "facebook";
  phase: SocialDownloaderDiagnosticPhase;
  outcome: "success" | "failure";
  httpStatus: number | null;
  contentType: SocialDownloaderContentType;
  candidateCount: number | null;
  validMediaCount: number;
  rejectedHostCount: number;
  rejectedPathCount: number;
  rejectedMalformedCount: number;
  failureCode: ProviderFailureCode | null;
  durationMs: number;
}

interface SocialDownloaderParseDiagnostics {
  candidateCount: number;
  validMediaCount: number;
  rejectedHostCount: number;
  rejectedPathCount: number;
  rejectedMalformedCount: number;
}

const emptyParseDiagnostics = (): SocialDownloaderParseDiagnostics => ({
  candidateCount: 0,
  validMediaCount: 0,
  rejectedHostCount: 0,
  rejectedPathCount: 0,
  rejectedMalformedCount: 0
});

function diagnosticFailureCode(error: unknown): ProviderFailureCode {
  if (error instanceof ProviderError) return error.failureCode;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return "provider_timeout";
  }
  return "internal_error";
}

function contentTypeCategory(headers: Headers): SocialDownloaderContentType {
  const contentType = headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (!contentType) return "missing";
  if (contentType === "application/json" || contentType.endsWith("+json")) return "json";
  if (contentType === "text/html") return "html";
  if (contentType.startsWith("text/")) return "text";
  return "other";
}

function mapFailure(status: number, message: string): never {
  const detail = `${status} ${message}`.trim();
  if (/private|permission|restricted/i.test(detail)) {
    throw new ProviderError("The Facebook post is private or restricted.", "content_private", false, false);
  }
  if (/not.?found|deleted|removed|unavailable/i.test(detail)) {
    throw new ProviderError("The Facebook post is unavailable.", "content_not_found", false, false);
  }
  if (/invalid|unsupported|no media|no downloadable/i.test(detail) || status === 422) {
    throw new ProviderError("SocialDownloader does not support this Facebook URL.", "unsupported_url", false, false);
  }
  if (status === 401) {
    throw new ProviderError("SocialDownloader requires authentication.", "authentication_required", false, false);
  }
  throw new ProviderError("SocialDownloader returned an unsuccessful response.", "provider_unavailable", true, true);
}

function reviewedMediaUrl(value: unknown): { url: string | null; reason: "valid" | "host" | "path" | "malformed" } {
  if (typeof value !== "string" || value.length === 0 || value.length > 16_384) {
    return { url: null, reason: "malformed" };
  }
  let url: URL;
  try {
    url = new URL(value, API_ORIGIN);
  } catch {
    return { url: null, reason: "malformed" };
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !API_HOSTS.has(url.hostname.toLowerCase())) {
    return { url: null, reason: "host" };
  }
  if (url.pathname !== MEDIA_PATH) {
    return { url: null, reason: "path" };
  }
  return { url: url.toString(), reason: "valid" };
}

function parseSocialDownloaderResponseInternal(
  body: string,
  httpStatus = 200
): {
  parsed: { title: string | null; formats: ParsedFormat[] };
  diagnostics: SocialDownloaderParseDiagnostics;
} {
  const diagnostics = emptyParseDiagnostics();
  let payload: z.infer<typeof ResponseSchema>;
  try {
    payload = ResponseSchema.parse(JSON.parse(body));
  } catch {
    throw new ProviderError("SocialDownloader returned an invalid API response.", "provider_schema_changed", true, true);
  }

  const detail = payload.message ?? payload.error ?? "";
  const hasObservedMediaField = Boolean(payload.downloadUrl || payload.videoUrl);
  const success =
    payload.success === true ||
    String(payload.status ?? "").toLowerCase() === "success" ||
    (payload.success == null && !payload.status && hasObservedMediaField);
  if (httpStatus < 200 || httpStatus >= 300 || !success) {
    mapFailure(httpStatus, detail || `status ${String(payload.status ?? "missing")}`);
  }

  const candidates = [payload.downloadUrl, payload.videoUrl].filter((value): value is string => Boolean(value));
  diagnostics.candidateCount = candidates.length;
  const formats: ParsedFormat[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const reviewed = reviewedMediaUrl(candidate);
    if (!reviewed.url) {
      if (reviewed.reason === "host") diagnostics.rejectedHostCount += 1;
      else if (reviewed.reason === "path") diagnostics.rejectedPathCount += 1;
      else diagnostics.rejectedMalformedCount += 1;
      continue;
    }
    if (seen.has(reviewed.url)) continue;
    seen.add(reviewed.url);
    formats.push({
      url: reviewed.url,
      label: "MP4",
      container: "mp4",
      quality: "Source",
      hasVideo: true,
      hasAudio: true
    });
  }
  diagnostics.validMediaCount = formats.length;
  if (formats.length === 0) {
    throw new ProviderError("SocialDownloader returned no reviewed media resource.", "unsupported_url", false, false);
  }

  return {
    parsed: {
      title: payload.title ?? payload.metadata?.title ?? null,
      formats
    },
    diagnostics
  };
}

export function parseSocialDownloaderResponse(
  body: string,
  httpStatus = 200
): { title: string | null; formats: ParsedFormat[] } {
  return parseSocialDownloaderResponseInternal(body, httpStatus).parsed;
}

export class SocialDownloaderProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  private readonly fetchImpl: ProviderFetch;
  private readonly diagnosticSink: ((event: SocialDownloaderDiagnosticEvent) => void) | null;

  constructor(options: SocialDownloaderProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.diagnosticSink = options.diagnosticSink ?? null;
    this.manifest = {
      id: "socialdownloader-space",
      displayName: "SocialDownloader.space",
      kind: "api",
      enabled: options.enabled ?? false,
      regions: ["nl"],
      timeoutMs: REQUEST_TIMEOUT_MS,
      costWeight: 60,
      // Facebook is the only platform with two repeatable samples in WI71.
      // X/TikTok remain Lab-only until a second sample and browser delivery audit exist.
      platforms: [{
        platform: "facebook",
        priority: 650,
        deliveryModes: ["redirect"],
        verificationStatus: "delivery_verified"
      }]
    };
  }

  async resolve(input: ResolveInput) {
    if (input.platform !== "facebook") {
      throw new ProviderError("SocialDownloader only accepts Facebook URLs in this release.", "unsupported_url", false, true);
    }
    const startedAt = Date.now();
    let phase: SocialDownloaderDiagnosticPhase = "request";
    let httpStatus: number | null = null;
    let contentType: SocialDownloaderContentType = "missing";
    let parseDiagnostics = emptyParseDiagnostics();
    const emit = (outcome: SocialDownloaderDiagnosticEvent["outcome"], failureCode: ProviderFailureCode | null) => {
      try {
        this.diagnosticSink?.({
          event: "socialdownloader_resolution_diagnostic",
          taskId: input.taskId,
          platform: "facebook",
          phase,
          outcome,
          httpStatus,
          contentType,
          candidateCount: phase === "request" ? null : parseDiagnostics.candidateCount,
          validMediaCount: parseDiagnostics.validMediaCount,
          rejectedHostCount: parseDiagnostics.rejectedHostCount,
          rejectedPathCount: parseDiagnostics.rejectedPathCount,
          rejectedMalformedCount: parseDiagnostics.rejectedMalformedCount,
          failureCode,
          durationMs: Math.max(0, Date.now() - startedAt)
        });
      } catch {
        // Diagnostics must never change Provider behavior.
      }
    };

    try {
      const response = await requestText(
        this.fetchImpl,
        new URL(API_PATH, API_ORIGIN),
        {
          method: "POST",
          redirect: "manual",
          ...(input.signal ? { signal: input.signal } : {}),
          headers: {
            accept: "application/json",
            "content-type": "application/json"
          },
          body: JSON.stringify({ url: input.canonicalUrl })
        },
        API_HOSTS,
        {
          maximumBytes: 512_000,
          expectedContentTypes: ["application/json"],
          maximumRedirects: 0,
          allowNonOk: true,
          observer: {
            onResponse: (observation) => {
              phase = "payload";
              httpStatus = observation.status;
              contentType = contentTypeCategory(observation.headers);
            }
          }
        }
      );
      phase = "payload";
      const parsedWithDiagnostics = parseSocialDownloaderResponseInternal(response.body, response.response.status);
      parseDiagnostics = parsedWithDiagnostics.diagnostics;
      phase = "resources";
      phase = "completed";
      emit("success", null);
      return createRedirectResolution(
        this.manifest.id,
        this.manifest.kind,
        input,
        {
          ...parsedWithDiagnostics.parsed,
          thumbnailUrl: null,
          warnings: ["SocialDownloader is an experimental Facebook secondary Provider."]
        },
        { hostPolicyId: MEDIA_HOST_POLICY_ID, maximumLifetimeMs: MAXIMUM_CANDIDATE_LIFETIME_MS }
      );
    } catch (error) {
      emit("failure", diagnosticFailureCode(error));
      if (error instanceof ProviderError) throw error;
      if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
        throw new ProviderError("SocialDownloader timed out.", "provider_timeout", true, true);
      }
      throw new ProviderError("SocialDownloader could not be reached.", "provider_unavailable", true, true);
    }
  }
}
