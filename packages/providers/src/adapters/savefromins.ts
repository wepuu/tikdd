import { z } from "zod";
import type { ProviderFailureCode } from "@tikdd/contracts";
import { ProviderError } from "../errors";
import type { ProviderManifest, ResolveInput, ResolverProvider } from "../index";
import {
  createRedirectResolution,
  reviewedThumbnailUrl,
  requestText,
  type ParsedFormat,
  type ProviderFetch
} from "./shared";

const API_ORIGIN = "https://api.savefromins.com";
const API_PATH = "/api/contentsite_api/media/parse";
const REQUEST_DOMAIN = "api-ak.savefromins.com";
const ALLOWED_HOSTS = new Set(["api.savefromins.com"]);
const THUMBNAIL_HOSTS = new Set(["api-ak.savefromins.com"]);
const MEDIA_HOST_POLICY_ID = "savefromins-instagram-media-v2";
const MAXIMUM_CANDIDATE_LIFETIME_MS = 4 * 60 * 1000;
const MAXIMUM_RESOURCE_COUNT = 40;
// SaveFromIns is deliberately single-attempt. Allow a slow anonymous parse to
// finish without multiplying upstream traffic through retries.
const PROVIDER_TIMEOUT_MS = 40_000;

const ResourceSchema = z.object({
  quality: z.string().max(80).nullish(),
  format: z.string().min(1).max(24),
  type: z.string().min(1).max(24),
  download_mode: z.string().min(1).max(24),
  download_url: z.string().url().max(16_384)
});

const ResponseEnvelopeSchema = z.object({
  status: z.unknown().optional(),
  status_code: z.unknown().optional(),
  success: z.unknown().optional(),
  message: z.unknown().optional(),
  msg: z.unknown().optional(),
  error: z.unknown().optional(),
  data: z.unknown().optional()
}).passthrough();

const ResponseDataSchema = z.object({
  title: z.string().max(500).nullish(),
  duration: z.number().int().nonnegative().max(86_400).nullish(),
  thumbnail: z.unknown().optional(),
  resources: z.array(z.unknown()).max(20).optional(),
  media: z.array(z.unknown()).max(20).optional()
}).passthrough();

const MediaResourceGroupSchema = z.object({
  resources: z.array(z.unknown()).max(20)
}).passthrough();

export interface SaveFromInsProviderOptions {
  enabled?: boolean;
  requestAuth?: string;
  fetchImpl?: ProviderFetch;
  diagnosticSink?: (event: SaveFromInsDiagnosticEvent) => void;
}

export type SaveFromInsDiagnosticPhase = "request" | "payload" | "resources" | "completed";
export type SaveFromInsContentType = "json" | "html" | "text" | "other" | "missing";
export type SaveFromInsEnvelopeVariant =
  | "observed-instagram-resources"
  | "provider-error"
  | "unrecognized";
export type SaveFromInsProviderOutcome = "success" | "failure" | "unknown";
export type SaveFromInsResourcePath =
  | "data.resources"
  | "data.media[].resources"
  | "data.resources+data.media[].resources"
  | "none";

export interface SaveFromInsDiagnosticEvent {
  event: "savefromins_resolution_diagnostic";
  taskId: string;
  phase: SaveFromInsDiagnosticPhase;
  outcome: "success" | "failure";
  httpStatus: number | null;
  contentType: SaveFromInsContentType;
  resourceCount: number | null;
  validDirectMp4Count: number;
  envelopeVariant: SaveFromInsEnvelopeVariant;
  providerOutcome: SaveFromInsProviderOutcome;
  resourcePath: SaveFromInsResourcePath;
  rejectedMalformedCount: number;
  rejectedNonVideoCount: number;
  rejectedNonMp4Count: number;
  rejectedNonDirectCount: number;
  timeToHeadersMs: number | null;
  bodyReadMs: number | null;
  failureCode: ProviderFailureCode | null;
  durationMs: number;
}

function diagnosticFailureCode(error: unknown): ProviderFailureCode {
  if (error instanceof ProviderError) return error.failureCode;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return "provider_timeout";
  }
  return "internal_error";
}

function contentTypeCategory(headers: Headers): SaveFromInsContentType {
  const contentType = headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (!contentType) return "missing";
  if (contentType === "application/json" || contentType.endsWith("+json")) return "json";
  if (contentType === "text/html") return "html";
  if (contentType.startsWith("text/")) return "text";
  return "other";
}

function boundedText(value: unknown, maximumLength: number): string {
  return typeof value === "string" ? value.slice(0, maximumLength) : "";
}

function normalizedMarker(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return "";
  }
  return String(value).trim().toLowerCase();
}

function hasExplicitFailureMarker(envelope: z.infer<typeof ResponseEnvelopeSchema>): boolean {
  const status = normalizedMarker(envelope.status);
  const statusCode = normalizedMarker(envelope.status_code);
  return envelope.success === false || ["0", "error", "failed", "fail"].includes(status) ||
    ["0", "error", "failed", "fail"].includes(statusCode);
}

function hasSuccessMarker(envelope: z.infer<typeof ResponseEnvelopeSchema>): boolean {
  const status = normalizedMarker(envelope.status);
  const statusCode = normalizedMarker(envelope.status_code);
  return envelope.success === true || ["1", "success", "ok"].includes(status) ||
    ["1", "success", "ok"].includes(statusCode);
}

function extractResources(data: z.infer<typeof ResponseDataSchema>): {
  path: SaveFromInsResourcePath;
  resources: unknown[];
} {
  const direct = data.resources ?? [];
  const nested = (data.media ?? []).flatMap((item) => {
    const parsed = MediaResourceGroupSchema.safeParse(item);
    return parsed.success ? parsed.data.resources : [];
  });
  // SaveFromIns now returns both a direct list and UI-only popup resources for
  // some Reels. The public site always prefers download_url when it exists;
  // keep that same direct-first boundary and do not let incomplete popup
  // siblings poison an otherwise valid direct MP4.
  const path: SaveFromInsResourcePath = direct.length > 0
    ? "data.resources"
    : nested.length > 0
      ? "data.media[].resources"
      : "none";
  const resources = direct.length > 0 ? direct : nested;
  if (resources.length > MAXIMUM_RESOURCE_COUNT) {
    throw new ProviderError(
      "SaveFromIns returned too many media resources.",
      "provider_schema_changed",
      true,
      true
    );
  }
  return { path, resources };
}

function mapProviderFailure(code: string, message: string): never {
  const detail = `${code} ${message}`.trim();
  if (/session|cookie|authentication|account required/i.test(detail)) {
    throw new ProviderError(
      "SaveFromIns requires an upstream account credential.",
      "authentication_required",
      false,
      false
    );
  }
  if (/private|permission|not accessible/i.test(detail)) {
    throw new ProviderError("The Instagram post is private.", "content_private", false, false);
  }
  if (/deleted|not.?found|removed|unavailable/i.test(detail)) {
    throw new ProviderError("The Instagram post is unavailable.", "content_not_found", false, false);
  }
  if (/country|region|geo/i.test(detail)) {
    throw new ProviderError("The Instagram post is region restricted.", "geo_restricted", false, false);
  }
  if (/rate|limit|too many/i.test(detail)) {
    throw new ProviderError("SaveFromIns rate limited the request.", "provider_rate_limited", true, true);
  }
  if (/captcha|challenge|blocked/i.test(detail)) {
    throw new ProviderError("SaveFromIns presented an access challenge.", "provider_challenge", true, true);
  }
  if (/unsupported|invalid.?url/i.test(detail)) {
    throw new ProviderError("SaveFromIns does not support this Instagram URL.", "unsupported_url", false, true);
  }
  throw new ProviderError("SaveFromIns returned an unsuccessful response.", "provider_unavailable", true, true);
}

export class SaveFromInsProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  private readonly requestAuth: string;
  private readonly fetchImpl: ProviderFetch;
  private readonly diagnosticSink: ((event: SaveFromInsDiagnosticEvent) => void) | null;

  constructor(options: SaveFromInsProviderOptions = {}) {
    this.requestAuth = options.requestAuth ?? "";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.diagnosticSink = options.diagnosticSink ?? null;
    this.manifest = {
      id: "savefromins",
      displayName: "SaveFromIns",
      kind: "site-adapter",
      enabled: options.enabled ?? false,
      regions: ["nl"],
      timeoutMs: PROVIDER_TIMEOUT_MS,
      costWeight: 20,
      platforms: [{
        platform: "instagram",
        priority: 900,
        deliveryModes: ["redirect"],
        verificationStatus: "delivery_verified"
      }]
    };
  }

  async resolve(input: ResolveInput) {
    if (input.platform !== "instagram") {
      throw new ProviderError("SaveFromIns only accepts Instagram URLs.", "unsupported_url", false, true);
    }
    if (!/^[A-Za-z0-9]{8,80}$/.test(this.requestAuth)) {
      throw new ProviderError("SaveFromIns is not configured.", "provider_unavailable", true, true);
    }

    const startedAt = Date.now();
    let phase: SaveFromInsDiagnosticPhase = "request";
    let httpStatus: number | null = null;
    let contentType: SaveFromInsContentType = "missing";
    let resourceCount: number | null = null;
    let validDirectMp4Count = 0;
    let envelopeVariant: SaveFromInsEnvelopeVariant = "unrecognized";
    let providerOutcome: SaveFromInsProviderOutcome = "unknown";
    let resourcePath: SaveFromInsResourcePath = "none";
    let rejectedMalformedCount = 0;
    let rejectedNonVideoCount = 0;
    let rejectedNonMp4Count = 0;
    let rejectedNonDirectCount = 0;
    let responseHeadersAt: number | null = null;
    let timeToHeadersMs: number | null = null;
    let bodyReadMs: number | null = null;
    const emit = (outcome: SaveFromInsDiagnosticEvent["outcome"], failureCode: ProviderFailureCode | null) => {
      try {
        this.diagnosticSink?.({
          event: "savefromins_resolution_diagnostic",
          taskId: input.taskId,
          phase,
          outcome,
          httpStatus,
          contentType,
          resourceCount,
          validDirectMp4Count,
          envelopeVariant,
          providerOutcome,
          resourcePath,
          rejectedMalformedCount,
          rejectedNonVideoCount,
          rejectedNonMp4Count,
          rejectedNonDirectCount,
          timeToHeadersMs,
          bodyReadMs,
          failureCode,
          durationMs: Math.max(0, Date.now() - startedAt)
        });
      } catch {
        // Diagnostics must never change Provider behavior.
      }
    };

    try {
      const body = new URLSearchParams({
        auth: this.requestAuth,
        domain: REQUEST_DOMAIN,
        origin: "source",
        link: input.canonicalUrl
      });
      const response = await requestText(
        this.fetchImpl,
        new URL(API_PATH, API_ORIGIN),
        {
          method: "POST",
          redirect: "error",
          ...(input.signal ? { signal: input.signal } : {}),
          headers: {
            accept: "application/json",
            "content-type": "application/x-www-form-urlencoded;charset=UTF-8"
          },
          body
        },
        ALLOWED_HOSTS,
        {
          maximumBytes: 512_000,
          expectedContentTypes: ["application/json"],
          maximumRedirects: 0,
          observer: {
            onResponse: (observation) => {
              phase = "payload";
              httpStatus = observation.status;
              contentType = contentTypeCategory(observation.headers);
              responseHeadersAt = Date.now();
              timeToHeadersMs = Math.max(0, responseHeadersAt - startedAt);
            },
            onBody: () => {
              bodyReadMs = Math.max(0, Date.now() - (responseHeadersAt ?? startedAt));
            }
          }
        }
      );

      phase = "payload";
      let envelope: z.infer<typeof ResponseEnvelopeSchema>;
      try {
        envelope = ResponseEnvelopeSchema.parse(JSON.parse(response.body));
      } catch {
        throw new ProviderError(
          "SaveFromIns changed its response schema.",
          "provider_schema_changed",
          true,
          true
        );
      }

      const statusCode = boundedText(envelope.status_code, 120);
      const message = boundedText(envelope.message, 500) || boundedText(envelope.msg, 500) ||
        boundedText(envelope.error, 500);
      if (hasExplicitFailureMarker(envelope)) {
        envelopeVariant = "provider-error";
        providerOutcome = "failure";
        mapProviderFailure(statusCode, message);
      }

      const payloadData = ResponseDataSchema.safeParse(envelope.data);
      if (!hasSuccessMarker(envelope) || !payloadData.success) {
        throw new ProviderError(
          "SaveFromIns changed its response schema.",
          "provider_schema_changed",
          true,
          true
        );
      }

      const extracted = extractResources(payloadData.data);
      if (extracted.path === "none") {
        throw new ProviderError(
          "SaveFromIns changed its response schema.",
          "provider_schema_changed",
          true,
          true
        );
      }
      envelopeVariant = "observed-instagram-resources";
      providerOutcome = "success";
      resourcePath = extracted.path;
      resourceCount = extracted.resources.length;
      phase = "resources";
      const seenUrls = new Set<string>();
      const formats: ParsedFormat[] = extracted.resources.flatMap((resource) => {
        const parsed = ResourceSchema.safeParse(resource);
        if (!parsed.success) {
          rejectedMalformedCount += 1;
          return [];
        }
        if (parsed.data.type.toLowerCase() !== "video") {
          rejectedNonVideoCount += 1;
          return [];
        }
        if (parsed.data.format.toLowerCase() !== "mp4") {
          rejectedNonMp4Count += 1;
          return [];
        }
        if (parsed.data.download_mode.toLowerCase() !== "direct") {
          rejectedNonDirectCount += 1;
          return [];
        }
        if (seenUrls.has(parsed.data.download_url)) return [];
        seenUrls.add(parsed.data.download_url);

        const quality = parsed.data.quality?.trim() || "Original";
        return [{
          url: parsed.data.download_url,
          label: `${quality} MP4`,
          container: "mp4",
          quality,
          hasVideo: true,
          hasAudio: true
        }];
      });
      validDirectMp4Count = formats.length;

      if (formats.length === 0) {
        throw new ProviderError(
          "SaveFromIns returned no valid direct MP4 resource.",
          "invalid_result",
          true,
          true
        );
      }

      try {
        const resolution = createRedirectResolution(
          this.manifest.id,
          this.manifest.kind,
          input,
          {
            title: payloadData.data.title ?? null,
            thumbnailUrl: reviewedThumbnailUrl(payloadData.data.thumbnail, THUMBNAIL_HOSTS),
            durationSeconds: payloadData.data.duration ?? null,
            formats,
            warnings: ["SaveFromIns is limited to public Instagram posts."]
          },
          { hostPolicyId: MEDIA_HOST_POLICY_ID, maximumLifetimeMs: MAXIMUM_CANDIDATE_LIFETIME_MS }
        );
        phase = "completed";
        emit("success", null);
        return resolution;
      } catch (error) {
        if (error instanceof ProviderError) throw error;
        throw new ProviderError(
          "SaveFromIns returned a delivery target outside its reviewed policy.",
          "invalid_result",
          true,
          true
        );
      }
    } catch (error) {
      emit("failure", diagnosticFailureCode(error));
      throw error;
    }
  }
}
