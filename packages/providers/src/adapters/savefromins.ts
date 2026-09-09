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

const ResourceSchema = z.object({
  quality: z.string().max(80),
  format: z.string().min(1).max(24),
  type: z.string().min(1).max(24),
  download_mode: z.string().min(1).max(24),
  download_url: z.string().url().max(16_384)
});

const ResponseSchema = z.object({
  status: z.union([z.number(), z.string()]),
  status_code: z.string().max(120).optional(),
  message: z.string().max(500).nullish(),
  msg: z.string().max(500).nullish(),
  data: z.object({
    title: z.string().max(500).nullish(),
    duration: z.number().int().nonnegative().max(86_400).nullish(),
    thumbnail: z.unknown().optional(),
    resources: z.array(z.unknown()).max(20)
  }).nullish()
});

export interface SaveFromInsProviderOptions {
  enabled?: boolean;
  requestAuth?: string;
  fetchImpl?: ProviderFetch;
  diagnosticSink?: (event: SaveFromInsDiagnosticEvent) => void;
}

export type SaveFromInsDiagnosticPhase = "request" | "payload" | "resources" | "completed";
export type SaveFromInsContentType = "json" | "html" | "text" | "other" | "missing";

export interface SaveFromInsDiagnosticEvent {
  event: "savefromins_resolution_diagnostic";
  taskId: string;
  phase: SaveFromInsDiagnosticPhase;
  outcome: "success" | "failure";
  httpStatus: number | null;
  contentType: SaveFromInsContentType;
  resourceCount: number | null;
  validDirectMp4Count: number;
  failureCode: ProviderFailureCode | null;
  durationMs: number;
}

function contentTypeCategory(headers: Headers): SaveFromInsContentType {
  const contentType = headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (!contentType) return "missing";
  if (contentType === "application/json" || contentType.endsWith("+json")) return "json";
  if (contentType === "text/html") return "html";
  if (contentType.startsWith("text/")) return "text";
  return "other";
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
  throw new ProviderError("SaveFromIns changed its response schema.", "provider_schema_changed", true, true);
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
      timeoutMs: 10_000,
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
            }
          }
        }
      );

      phase = "payload";
      let payload: z.infer<typeof ResponseSchema>;
      try {
        payload = ResponseSchema.parse(JSON.parse(response.body));
      } catch {
        throw new ProviderError(
          "SaveFromIns changed its response schema.",
          "provider_schema_changed",
          true,
          true
        );
      }

      if ((payload.status !== 1 && payload.status !== "1") || payload.status_code !== "success" || !payload.data) {
        mapProviderFailure(payload.status_code ?? "", payload.message ?? payload.msg ?? "");
      }

      resourceCount = payload.data.resources.length;
      phase = "resources";
      const formats: ParsedFormat[] = payload.data.resources.flatMap((resource) => {
        const parsed = ResourceSchema.safeParse(resource);
        if (!parsed.success) return [];
        if (
          parsed.data.type.toLowerCase() !== "video" ||
          parsed.data.format.toLowerCase() !== "mp4" ||
          parsed.data.download_mode.toLowerCase() !== "direct"
        ) return [];

        const quality = parsed.data.quality.trim() || "Original";
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
            title: payload.data.title ?? null,
            thumbnailUrl: reviewedThumbnailUrl(payload.data.thumbnail, THUMBNAIL_HOSTS),
            durationSeconds: payload.data.duration ?? null,
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
      const failureCode = error instanceof ProviderError ? error.failureCode : "internal_error";
      emit("failure", failureCode);
      throw error;
    }
  }
}
