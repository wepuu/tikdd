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

const API_ORIGIN = "https://fdown.isuru.eu.org";
const API_PATH = "/download";
const API_HOSTS = new Set(["fdown.isuru.eu.org"]);
const MEDIA_HOST_POLICY_ID = "fdown-isuru-facebook-media-v2";
const MAXIMUM_CANDIDATE_LIFETIME_MS = 4 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

const FormatSchema = z.object({
  quality: z.string().max(80).nullish(),
  format_id: z.union([z.string(), z.number()]).nullish(),
  ext: z.string().max(24).nullish(),
  filesize: z.number().nonnegative().nullish(),
  url: z.string().url().max(16_384).nullish()
}).passthrough();

const ResponseSchema = z.object({
  status: z.union([z.string(), z.number()]).nullish(),
  message: z.string().max(500).nullish(),
  video_info: z.object({
    title: z.string().max(1_000).nullish(),
    duration: z.number().nonnegative().max(86_400).nullish(),
    thumbnail: z.string().url().max(16_384).nullish(),
    uploader: z.string().max(500).nullish()
  }).passthrough().nullish(),
  download_url: z.string().url().max(16_384).nullish(),
  available_formats: z.array(z.unknown()).max(50).nullish()
}).passthrough();

export interface FDownIsuruProviderOptions {
  enabled?: boolean;
  fetchImpl?: ProviderFetch;
  diagnosticSink?: (event: FDownIsuruDiagnosticEvent) => void;
}

export type FDownIsuruDiagnosticPhase = "request" | "payload" | "resources" | "completed";
export type FDownIsuruContentType = "json" | "html" | "text" | "other" | "missing";

export interface FDownIsuruDiagnosticEvent {
  event: "fdown_isuru_resolution_diagnostic";
  taskId: string;
  phase: FDownIsuruDiagnosticPhase;
  outcome: "success" | "failure";
  httpStatus: number | null;
  contentType: FDownIsuruContentType;
  candidateCount: number | null;
  validMp4Count: number;
  rejectedHostCount: number;
  rejectedNonMp4Count: number;
  rejectedMalformedCount: number;
  failureCode: ProviderFailureCode | null;
  durationMs: number;
}

interface FDownIsuruParseDiagnostics {
  candidateCount: number;
  validMp4Count: number;
  rejectedHostCount: number;
  rejectedNonMp4Count: number;
  rejectedMalformedCount: number;
}

const emptyParseDiagnostics = (): FDownIsuruParseDiagnostics => ({
  candidateCount: 0,
  validMp4Count: 0,
  rejectedHostCount: 0,
  rejectedNonMp4Count: 0,
  rejectedMalformedCount: 0
});

function diagnosticFailureCode(error: unknown): ProviderFailureCode {
  if (error instanceof ProviderError) return error.failureCode;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return "provider_timeout";
  }
  return "internal_error";
}

function contentTypeCategory(headers: Headers): FDownIsuruContentType {
  const contentType = headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (!contentType) return "missing";
  if (contentType === "application/json" || contentType.endsWith("+json")) return "json";
  if (contentType === "text/html") return "html";
  if (contentType.startsWith("text/")) return "text";
  return "other";
}

function mapFailure(status: number, message: string): never {
  const detail = `${status} ${message}`.trim();
  if (status === 401 || /login|authentication|session|cookie/i.test(detail)) {
    throw new ProviderError("FDown Isuru requires authentication.", "authentication_required", false, false);
  }
  if (status === 403 || /captcha|turnstile|challenge|blocked|access denied/i.test(detail)) {
    throw new ProviderError("FDown Isuru presented an access challenge.", "provider_challenge", true, true);
  }
  if (status === 429 || /rate|limit|too many/i.test(detail)) {
    throw new ProviderError("FDown Isuru rate limited the request.", "provider_rate_limited", true, true);
  }
  if (/private|permission|restricted/i.test(detail)) {
    throw new ProviderError("The Facebook post is private or restricted.", "content_private", false, false);
  }
  if (/not.?found|deleted|removed|unavailable/i.test(detail)) {
    throw new ProviderError("The Facebook post is unavailable.", "content_not_found", false, false);
  }
  if (status === 400 || /invalid|unsupported/i.test(detail)) {
    throw new ProviderError("FDown Isuru does not support this Facebook URL.", "unsupported_url", false, true);
  }
  throw new ProviderError("FDown Isuru changed its response schema.", "provider_schema_changed", true, true);
}

function parseFDownIsuruResponseInternal(
  body: string,
  httpStatus = 200
): {
  parsed: { title: string | null; author: string | null; thumbnailUrl: null; durationSeconds: number | null; formats: ParsedFormat[] };
  diagnostics: FDownIsuruParseDiagnostics;
} {
  const diagnostics = emptyParseDiagnostics();
  let payload: z.infer<typeof ResponseSchema>;
  try {
    payload = ResponseSchema.parse(JSON.parse(body));
  } catch {
    throw new ProviderError("FDown Isuru returned an invalid API response.", "provider_schema_changed", true, true);
  }

  const status = String(payload.status ?? "").toLowerCase();
  if (httpStatus < 200 || httpStatus >= 300 || status !== "success") {
    mapFailure(httpStatus, payload.message ?? `status ${status || "missing"}`);
  }

  const formats: ParsedFormat[] = [];
  const seen = new Set<string>();
  const candidates: Array<{ value: unknown; quality: string }> = [];
  if (payload.download_url) candidates.push({ value: payload.download_url, quality: "Original" });
  for (const item of payload.available_formats ?? []) {
    diagnostics.candidateCount += 1;
    const parsed = FormatSchema.safeParse(item);
    if (!parsed.success || !parsed.data.url) {
      diagnostics.rejectedMalformedCount += 1;
      continue;
    }
    const quality = parsed.data.quality?.trim() || "Original";
    candidates.push({ value: parsed.data.url, quality });
  }
  diagnostics.candidateCount += payload.download_url ? 1 : 0;
  for (const candidate of candidates) {
    if (typeof candidate.value !== "string") {
      diagnostics.rejectedMalformedCount += 1;
      continue;
    }
    let candidateUrl: URL;
    try {
      candidateUrl = new URL(candidate.value);
    } catch {
      diagnostics.rejectedMalformedCount += 1;
      continue;
    }
    if (candidateUrl.protocol !== "https:" || candidateUrl.username || candidateUrl.password || candidateUrl.port) {
      diagnostics.rejectedHostCount += 1;
      continue;
    }
    if (!candidateUrl.hostname.toLowerCase().endsWith(".fbcdn.net")) {
      diagnostics.rejectedHostCount += 1;
      continue;
    }
    if (!/\.mp4(?:$|[?#])/i.test(candidateUrl.pathname)) {
      diagnostics.rejectedNonMp4Count += 1;
      continue;
    }
    if (seen.has(candidate.value)) continue;
    seen.add(candidate.value);
    formats.push({
      url: candidate.value,
      label: `${candidate.quality} MP4`,
      container: "mp4",
      quality: candidate.quality,
      hasVideo: true,
      hasAudio: true
    });
  }
  diagnostics.validMp4Count = formats.length;
  if (formats.length === 0) {
    throw new ProviderError("FDown Isuru returned no reviewed MP4 resource.", "invalid_result", true, true);
  }

  return {
    parsed: {
      title: payload.video_info?.title ?? null,
      author: payload.video_info?.uploader ?? null,
      thumbnailUrl: null,
      durationSeconds: payload.video_info?.duration ?? null,
      formats
    },
    diagnostics
  };
}

export function parseFDownIsuruResponse(
  body: string,
  httpStatus = 200
): { title: string | null; author: string | null; thumbnailUrl: null; durationSeconds: number | null; formats: ParsedFormat[] } {
  return parseFDownIsuruResponseInternal(body, httpStatus).parsed;
}

function timeoutSignal(parent: AbortSignal | undefined): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort();
  if (parent?.aborted) controller.abort();
  else parent?.addEventListener("abort", abort, { once: true });
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", abort);
    }
  };
}

export class FDownIsuruProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  private readonly fetchImpl: ProviderFetch;
  private readonly diagnosticSink: ((event: FDownIsuruDiagnosticEvent) => void) | null;

  constructor(options: FDownIsuruProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.diagnosticSink = options.diagnosticSink ?? null;
    this.manifest = {
      id: "fdown-isuru",
      displayName: "FDown Isuru",
      kind: "api",
      enabled: options.enabled ?? false,
      regions: ["nl"],
      timeoutMs: REQUEST_TIMEOUT_MS,
      costWeight: 45,
      platforms: [{
        platform: "facebook",
        priority: 700,
        deliveryModes: ["redirect"],
        verificationStatus: "delivery_verified"
      }]
    };
  }

  async resolve(input: ResolveInput) {
    if (input.platform !== "facebook") {
      throw new ProviderError("FDown Isuru only accepts Facebook URLs.", "unsupported_url", false, true);
    }
    const startedAt = Date.now();
    let phase: FDownIsuruDiagnosticPhase = "request";
    let httpStatus: number | null = null;
    let contentType: FDownIsuruContentType = "missing";
    let parseDiagnostics = emptyParseDiagnostics();
    const emit = (outcome: FDownIsuruDiagnosticEvent["outcome"], failureCode: ProviderFailureCode | null) => {
      try {
        this.diagnosticSink?.({
          event: "fdown_isuru_resolution_diagnostic",
          taskId: input.taskId,
          phase,
          outcome,
          httpStatus,
          contentType,
          candidateCount: phase === "request" ? null : parseDiagnostics.candidateCount,
          validMp4Count: parseDiagnostics.validMp4Count,
          rejectedHostCount: parseDiagnostics.rejectedHostCount,
          rejectedNonMp4Count: parseDiagnostics.rejectedNonMp4Count,
          rejectedMalformedCount: parseDiagnostics.rejectedMalformedCount,
          failureCode,
          durationMs: Math.max(0, Date.now() - startedAt)
        });
      } catch {
        // Diagnostics must never change Provider behavior.
      }
    };
    const timeout = timeoutSignal(input.signal);
    try {
      const response = await requestText(
        this.fetchImpl,
        new URL(API_PATH, API_ORIGIN),
        {
          method: "POST",
          redirect: "manual",
          signal: timeout.signal,
          headers: {
            accept: "application/json",
            "content-type": "application/json"
          },
          body: JSON.stringify({ url: input.canonicalUrl, quality: "best" })
        },
        API_HOSTS,
        {
          expectedContentTypes: ["application/json"],
          maximumBytes: 512_000,
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
      const parsedWithDiagnostics = parseFDownIsuruResponseInternal(response.body, response.response.status);
      parseDiagnostics = parsedWithDiagnostics.diagnostics;
      phase = "resources";
      const parsed = parsedWithDiagnostics.parsed;
      phase = "completed";
      emit("success", null);
      return createRedirectResolution(
        this.manifest.id,
        this.manifest.kind,
        input,
        {
          ...parsed,
          warnings: ["FDown Isuru is an experimental Facebook Provider."]
        },
        { hostPolicyId: MEDIA_HOST_POLICY_ID, maximumLifetimeMs: MAXIMUM_CANDIDATE_LIFETIME_MS }
      );
    } catch (error) {
      emit("failure", diagnosticFailureCode(error));
      if (error instanceof ProviderError) throw error;
      if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
        throw new ProviderError("FDown Isuru timed out.", "provider_timeout", true, true);
      }
      throw new ProviderError("FDown Isuru could not be reached.", "provider_unavailable", true, true);
    } finally {
      timeout.dispose();
    }
  }
}
