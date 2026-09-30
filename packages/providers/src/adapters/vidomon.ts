import { Buffer } from "node:buffer";
import { z } from "zod";
import type { ProviderFailureCode } from "@tikdd/contracts";
import { ProviderResolutionSchema } from "@tikdd/delivery-core";
import { ProviderError } from "../errors";
import type { ProviderManifest, ResolveInput, ResolverProvider } from "../index";
import {
  createRedirectResolution,
  requestText,
  reviewedThumbnailUrl,
  type ParsedFormat,
  type ProviderFetch
} from "./shared";

const PAGE_ORIGIN = "https://vidomon.com";
const PAGE_HOSTS = new Set(["vidomon.com"]);
const MEDIA_HOST_SUFFIX = ".okcdn.ru";
const THUMBNAIL_HOSTS = new Set(["iv.okcdn.ru"]);
const MEDIA_POLICY_ID = "vidomon-okru-media-v1";
const MAXIMUM_PAGE_BYTES = 512_000;
const MAXIMUM_RESPONSE_BYTES = 512_000;
const MAXIMUM_TOKEN_LENGTH = 256;
const MAXIMUM_MEDIA_URL_LENGTH = 8_192;
const MAXIMUM_FORMATS = 12;
const MAXIMUM_CANDIDATE_LIFETIME_MS = 4 * 60 * 1_000;

const MediaSchema = z.object({
  url: z.string().max(MAXIMUM_MEDIA_URL_LENGTH).nullish(),
  extension: z.string().max(16).nullish(),
  quality: z.string().max(80).nullish(),
  videoAvailable: z.union([z.boolean(), z.number(), z.string()]).nullish(),
  audioAvailable: z.union([z.boolean(), z.number(), z.string()]).nullish()
}).passthrough();

const ResponseSchema = z.object({
  title: z.string().max(500).nullish(),
  thumbnail: z.string().max(4_096).nullish(),
  duration: z.union([z.number(), z.string()]).nullish(),
  medias: z.array(MediaSchema).max(100)
}).passthrough();

export type VidomonDiagnosticPhase = "landing" | "token" | "resolve" | "parse" | "completed";
export type VidomonContentType = "json" | "html" | "text" | "other" | "missing";

export interface VidomonDiagnosticEvent {
  event: "vidomon_resolution_diagnostic";
  taskId: string;
  platform: "odnoklassniki";
  phase: VidomonDiagnosticPhase;
  outcome: "success" | "failure";
  httpStatus: number | null;
  contentType: VidomonContentType;
  responseBytes: number | null;
  tokenPresent: boolean;
  resourceCount: number;
  validMp4Count: number;
  rejectedHostCount: number;
  rejectedFormatCount: number;
  failureCode: ProviderFailureCode | null;
  durationMs: number;
}

export interface VidomonProviderOptions {
  enabled?: boolean;
  fetchImpl?: ProviderFetch;
  diagnosticSink?: (event: VidomonDiagnosticEvent) => void;
}

function category(headers: Headers): VidomonContentType {
  const value = headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (!value) return "missing";
  if (value === "application/json" || value.endsWith("+json")) return "json";
  if (value === "text/html") return "html";
  if (value.startsWith("text/")) return "text";
  return "other";
}

function failureCode(error: unknown): ProviderFailureCode {
  if (error instanceof ProviderError) return error.failureCode;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return "provider_timeout";
  }
  return "internal_error";
}

function truthy(value: boolean | number | string | null | undefined): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function explicitlyUnavailable(value: boolean | number | string | null | undefined): boolean {
  return value === false || value === 0 || value === "0" || value === "false";
}

function cleanText(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 300) : null;
}

function durationSeconds(value: number | string | null | undefined): number | null {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 24 * 60 * 60
    ? Math.floor(parsed)
    : null;
}

export function extractVidomonToken(html: string): string | null {
  const patterns = [
    /<input\b[^>]*\bid=["']token["'][^>]*\bvalue=["']([^"']+)["'][^>]*>/i,
    /<input\b[^>]*\bvalue=["']([^"']+)["'][^>]*\bid=["']token["'][^>]*>/i
  ];
  for (const pattern of patterns) {
    const token = html.match(pattern)?.[1]?.trim();
    if (token && token.length <= MAXIMUM_TOKEN_LENGTH) return token;
  }
  return null;
}

export function createVidomonHash(url: string): string {
  return `${Buffer.from(url, "utf8").toString("base64")}${url.length + 1_000}${Buffer.from("aio-dl", "utf8").toString("base64")}`;
}

function reviewedMediaUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      hostname === "okcdn.ru" ||
      !hostname.endsWith(MEDIA_HOST_SUFFIX)
    ) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function parseVidomonResponse(body: string) {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new ProviderError("Vidomon returned invalid JSON.", "provider_schema_changed", true, true);
  }
  const parsed = ResponseSchema.safeParse(value);
  if (!parsed.success) {
    throw new ProviderError("Vidomon response schema changed.", "provider_schema_changed", true, true);
  }

  const formats: ParsedFormat[] = [];
  const seen = new Set<string>();
  let rejectedHostCount = 0;
  let rejectedFormatCount = 0;
  for (const media of parsed.data.medias) {
    const extension = media.extension?.trim().toLowerCase();
    if (extension !== "mp4" || explicitlyUnavailable(media.videoAvailable)) {
      rejectedFormatCount += 1;
      continue;
    }
    const url = reviewedMediaUrl(media.url);
    if (!url) {
      rejectedHostCount += 1;
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    const quality = cleanText(media.quality) ?? "MP4";
    formats.push({
      url,
      label: `${quality} MP4`,
      quality,
      container: "mp4",
      hasVideo: true,
      hasAudio: truthy(media.audioAvailable)
    });
    if (formats.length >= MAXIMUM_FORMATS) break;
  }
  if (formats.length === 0) {
    throw new ProviderError("Vidomon returned no reviewed MP4 resource.", "invalid_result", true, true);
  }
  return {
    media: {
      title: cleanText(parsed.data.title),
      thumbnailUrl: reviewedThumbnailUrl(parsed.data.thumbnail, THUMBNAIL_HOSTS),
      durationSeconds: durationSeconds(parsed.data.duration),
      formats,
      warnings: ["OK.ru support is an experimental Beta route."]
    },
    resourceCount: parsed.data.medias.length,
    rejectedHostCount,
    rejectedFormatCount
  };
}

export class VidomonProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  private readonly fetchImpl: ProviderFetch;
  private readonly diagnosticSink: ((event: VidomonDiagnosticEvent) => void) | null;

  constructor(options: VidomonProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.diagnosticSink = options.diagnosticSink ?? null;
    this.manifest = {
      id: "vidomon",
      displayName: "Vidomon",
      kind: "api",
      enabled: options.enabled ?? false,
      regions: ["nl", "global", "canary-global"],
      timeoutMs: 35_000,
      costWeight: 45,
      platforms: [{
        platform: "odnoklassniki",
        priority: 760,
        deliveryModes: [],
        verificationStatus: "canary_failed"
      }]
    };
  }

  async resolve(input: ResolveInput) {
    if (input.platform !== "odnoklassniki") {
      throw new ProviderError("Vidomon only supports OK.ru.", "unsupported_url", false, false);
    }
    const startedAt = Date.now();
    let phase: VidomonDiagnosticPhase = "landing";
    let httpStatus: number | null = null;
    let contentType: VidomonContentType = "missing";
    let responseBytes: number | null = null;
    let tokenPresent = false;
    let resourceCount = 0;
    let validMp4Count = 0;
    let rejectedHostCount = 0;
    let rejectedFormatCount = 0;
    const emit = (outcome: "success" | "failure", code: ProviderFailureCode | null) => {
      this.diagnosticSink?.({
        event: "vidomon_resolution_diagnostic", taskId: input.taskId,
        platform: "odnoklassniki", phase, outcome, httpStatus, contentType, responseBytes,
        tokenPresent, resourceCount, validMp4Count, rejectedHostCount, rejectedFormatCount,
        failureCode: code, durationMs: Date.now() - startedAt
      });
    };

    try {
      const page = await requestText(this.fetchImpl, new URL("/", PAGE_ORIGIN), {
        method: "GET", redirect: "manual", ...(input.signal ? { signal: input.signal } : {}),
        headers: { accept: "text/html,application/xhtml+xml", "accept-language": "en", "user-agent": "TikDD/vidomon-okru" }
      }, PAGE_HOSTS, { maximumBytes: MAXIMUM_PAGE_BYTES, expectedContentTypes: ["text/html"] });
      httpStatus = page.response.status;
      contentType = category(page.response.headers);
      responseBytes = Buffer.byteLength(page.body);
      phase = "token";
      const token = extractVidomonToken(page.body);
      tokenPresent = Boolean(token);
      if (!token) {
        throw new ProviderError("Vidomon did not provide a valid page token.", "provider_schema_changed", true, true);
      }

      phase = "resolve";
      const payload = new URLSearchParams({ url: input.canonicalUrl, token, hash: createVidomonHash(input.canonicalUrl) });
      const resolved = await requestText(this.fetchImpl, new URL("/wp-json/aio-dl/video-data/", PAGE_ORIGIN), {
        method: "POST", redirect: "manual", ...(input.signal ? { signal: input.signal } : {}),
        headers: {
          accept: "application/json, text/plain, */*", "content-type": "application/x-www-form-urlencoded",
          origin: PAGE_ORIGIN, referer: `${PAGE_ORIGIN}/`, "user-agent": "TikDD/vidomon-okru",
          ...(page.cookie ? { cookie: page.cookie } : {})
        }, body: payload
      }, PAGE_HOSTS, { maximumBytes: MAXIMUM_RESPONSE_BYTES, expectedContentTypes: ["application/json"] });
      httpStatus = resolved.response.status;
      contentType = category(resolved.response.headers);
      responseBytes = Buffer.byteLength(resolved.body);
      phase = "parse";
      const parsed = parseVidomonResponse(resolved.body);
      resourceCount = parsed.resourceCount;
      validMp4Count = parsed.media.formats.length;
      rejectedHostCount = parsed.rejectedHostCount;
      rejectedFormatCount = parsed.rejectedFormatCount;
      phase = "completed";
      emit("success", null);
      return ProviderResolutionSchema.parse(createRedirectResolution(
        this.manifest.id, this.manifest.kind, input, parsed.media,
        { hostPolicyId: MEDIA_POLICY_ID, maximumLifetimeMs: MAXIMUM_CANDIDATE_LIFETIME_MS }
      ));
    } catch (error) {
      emit("failure", failureCode(error));
      throw error;
    }
  }
}
