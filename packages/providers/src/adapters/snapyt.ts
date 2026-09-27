import { z } from "zod";
import type { ProviderFailureCode } from "@tikdd/contracts";
import { ProviderError } from "../errors";
import type { ProviderManifest, ResolveInput, ResolverProvider } from "../index";
import {
  createRedirectResolution,
  requestText,
  type ParsedFormat,
  type ProviderChallengeObservation,
  type ProviderFetch
} from "./shared";

const PAGE_ORIGIN = "https://www.snapyt.app";
const PAGE_HOSTS = new Set(["www.snapyt.app"]);
const AJAX_PATH = "/wp-admin/admin-ajax.php";
const MEDIA_HOST_POLICY_ID = "snapyt-app-youtube-media-v1";
const MAXIMUM_CANDIDATE_LIFETIME_MS = 2 * 60 * 1_000;
const MAXIMUM_PAGE_BYTES = 384 * 1_024;
const MAXIMUM_RESULT_BYTES = 512 * 1_024;
const MAXIMUM_JSON_BYTES = 64 * 1_024;
const COMBINED_MP4_ITAGS = new Map([
  ["18", "360p"],
  ["22", "720p"]
]);

const AjaxResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional()
}).passthrough();

export type SnapYTDiagnosticPhase = "landing" | "resolve" | "result" | "completed";
export type SnapYTContentType = "json" | "html" | "text" | "other" | "missing";

export interface SnapYTDiagnosticEvent {
  event: "snapyt_resolution_diagnostic";
  taskId: string;
  platform: "youtube";
  phase: SnapYTDiagnosticPhase;
  outcome: "success" | "failure";
  httpStatus: number | null;
  contentType: SnapYTContentType;
  candidateCount: number;
  acceptedCount: number;
  failureCode: ProviderFailureCode | null;
  durationMs: number;
}

export interface SnapYTProviderOptions {
  enabled?: boolean;
  deliveryVerified?: boolean;
  fetchImpl?: ProviderFetch;
  maxConcurrency?: number;
  minIntervalMs?: number;
  diagnosticSink?: (event: SnapYTDiagnosticEvent) => void;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown, maximum: number): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum
    ? value.trim()
    : null;
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, hexadecimal: string) => String.fromCodePoint(Number.parseInt(hexadecimal, 16)))
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function attributesFromTag(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of tag.matchAll(/\b([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*(["'])([\s\S]*?)\2/g)) {
    const name = match[1]?.toLowerCase();
    const value = match[3];
    if (name && value !== undefined) attributes.set(name, decodeHtmlAttribute(value));
  }
  return attributes;
}

export function extractSnapYTNonce(body: string): string {
  const nonce = body.match(/(?:const|let|var)?\s*VD_NONCE\s*=\s*["']([A-Za-z0-9_-]{6,128})["']/)?.[1];
  if (!nonce) {
    throw new ProviderError("SnapYT did not expose a valid request nonce.", "provider_schema_changed", true, true);
  }
  return nonce;
}

function failureText(value: unknown): string {
  if (typeof value === "string") return value.slice(0, 500);
  const record = asRecord(value);
  if (!record) return "";
  return [record.message, record.error, record.reason, record.code]
    .map((entry) => stringValue(entry, 200))
    .filter((entry): entry is string => Boolean(entry))
    .join(" ");
}

function throwSnapYTFailure(value: unknown): never {
  const detail = failureText(value);
  if (/private|members.only|sign.?in|login|age.restrict/i.test(detail)) {
    throw new ProviderError("The YouTube video is private or restricted.", "content_private", false, false);
  }
  if (/not.?found|removed|deleted|unavailable/i.test(detail)) {
    throw new ProviderError("The YouTube video is unavailable.", "content_not_found", false, false);
  }
  if (/invalid|unsupported|playlist/i.test(detail)) {
    throw new ProviderError("SnapYT does not support this YouTube URL.", "unsupported_url", false, true);
  }
  if (/rate|too many|limit/i.test(detail)) {
    throw new ProviderError("SnapYT rate limited the request.", "provider_rate_limited", true, true);
  }
  throw new ProviderError("SnapYT returned an unsuccessful response.", "provider_unavailable", true, true);
}

export function parseSnapYTAjaxResponse(body: string): string {
  let payload: z.infer<typeof AjaxResponseSchema>;
  try {
    payload = AjaxResponseSchema.parse(JSON.parse(body));
  } catch {
    throw new ProviderError("SnapYT returned an invalid JSON response.", "provider_schema_changed", true, true);
  }
  if (!payload.success) throwSnapYTFailure(payload.data);
  const data = asRecord(payload.data);
  const raw = stringValue(data?.redirect_url ?? data?.redirectUrl ?? data?.redirect, 4_096);
  if (!raw) {
    throw new ProviderError("SnapYT omitted its result page.", "provider_schema_changed", true, true);
  }
  let url: URL;
  try {
    url = new URL(raw, PAGE_ORIGIN);
  } catch {
    throw new ProviderError("SnapYT returned an invalid result page.", "invalid_result", false, true);
  }
  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== "www.snapyt.app" ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new ProviderError("SnapYT returned a result page outside its allowlist.", "invalid_result", false, true);
  }
  url.hash = "";
  return url.toString();
}

function reviewedForceDownloadUrl(value: string): { url: string; quality: string } | null {
  if (value.length > 8_192) return null;
  try {
    const url = new URL(value, PAGE_ORIGIN);
    const action = url.searchParams.getAll("action");
    const pid = url.searchParams.getAll("pid");
    const fmt = url.searchParams.getAll("fmt");
    const nonce = url.searchParams.getAll("nonce");
    const allowedKeys = new Set(["action", "pid", "fmt", "nonce"]);
    const hasUnexpectedKey = [...url.searchParams.keys()].some((key) => !allowedKeys.has(key));
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== "www.snapyt.app" ||
      url.pathname !== AJAX_PATH ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      action.length !== 1 ||
      action[0] !== "snapyt_force_download" ||
      pid.length !== 1 ||
      !pid[0] ||
      fmt.length !== 1 ||
      !COMBINED_MP4_ITAGS.has(fmt[0] ?? "") ||
      nonce.length !== 1 ||
      !nonce[0] ||
      hasUnexpectedKey
    ) {
      return null;
    }
    return { url: url.toString(), quality: COMBINED_MP4_ITAGS.get(fmt[0] ?? "") ?? "MP4" };
  } catch {
    return null;
  }
}

export function parseSnapYTResultPage(body: string): {
  candidateCount: number;
  formats: ParsedFormat[];
} {
  const formats: ParsedFormat[] = [];
  const seen = new Set<string>();
  let candidateCount = 0;
  for (const match of body.matchAll(/<[^>]{0,8192}\bdata-force\s*=\s*(["'])[\s\S]*?\1[^>]*>/gi)) {
    const tag = match[0];
    const raw = attributesFromTag(tag).get("data-force");
    if (!raw) continue;
    candidateCount += 1;
    const reviewed = reviewedForceDownloadUrl(raw);
    if (!reviewed || seen.has(reviewed.url)) continue;
    seen.add(reviewed.url);
    formats.push({
      url: reviewed.url,
      label: reviewed.quality,
      quality: reviewed.quality,
      container: "mp4",
      hasVideo: true,
      hasAudio: true
    });
  }
  if (formats.length === 0) {
    throw new ProviderError(
      "SnapYT returned no reviewed combined MP4 resource.",
      "invalid_result",
      false,
      true
    );
  }
  return { candidateCount, formats };
}

function mergeCookies(...cookies: Array<string | null | undefined>): string {
  const values = new Map<string, string>();
  for (const cookie of cookies) {
    for (const part of cookie?.split(";") ?? []) {
      const separator = part.indexOf("=");
      if (separator <= 0) continue;
      const name = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      if (/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(name) && value) values.set(name, value);
    }
  }
  return [...values].map(([name, value]) => `${name}=${value}`).join("; ");
}

function contentTypeCategory(headers: Headers): SnapYTContentType {
  const value = headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (!value) return "missing";
  if (value === "application/json" || value.endsWith("+json")) return "json";
  if (value === "text/html" || value === "application/xhtml+xml") return "html";
  if (value.startsWith("text/")) return "text";
  return "other";
}

function isSnapYTChallenge(observation: ProviderChallengeObservation): boolean {
  if (observation.status === 403 || observation.headers.get("cf-mitigated") === "challenge") return true;
  if (observation.headers.get("content-type")?.toLowerCase().startsWith("text/html") !== true) return false;
  const title = observation.body.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i)?.[1] ?? "";
  return /just a moment|attention required|access denied/i.test(title) &&
    /cf-turnstile|cdn-cgi\/challenge-platform|challenge-stage/i.test(observation.body);
}

function diagnosticFailureCode(error: unknown): ProviderFailureCode {
  if (error instanceof ProviderError) return error.failureCode;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return "provider_timeout";
  }
  return "internal_error";
}

export class SnapYTProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  private readonly fetchImpl: ProviderFetch;
  private readonly deliveryVerified: boolean;
  private readonly maxConcurrency: number;
  private readonly minIntervalMs: number;
  private readonly diagnosticSink: ((event: SnapYTDiagnosticEvent) => void) | null;
  private activeRequests = 0;
  private lastRequestAt = 0;

  constructor(options: SnapYTProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.deliveryVerified = options.deliveryVerified ?? false;
    this.maxConcurrency = Math.max(1, Math.min(2, Math.floor(options.maxConcurrency ?? 1)));
    this.minIntervalMs = Math.max(0, Math.min(60_000, Math.floor(options.minIntervalMs ?? 5_000)));
    this.diagnosticSink = options.diagnosticSink ?? null;
    this.manifest = {
      id: "snapyt-app",
      displayName: "SnapYT.app",
      kind: "site-adapter",
      enabled: options.enabled ?? false,
      regions: ["nl", "global", "canary-global"],
      timeoutMs: 25_000,
      costWeight: 55,
      platforms: [{
        platform: "youtube",
        priority: 720,
        deliveryModes: this.deliveryVerified ? ["redirect"] : [],
        verificationStatus: this.deliveryVerified ? "delivery_verified" : "fixture_verified"
      }]
    };
  }

  async resolve(input: ResolveInput) {
    if (input.platform !== "youtube") {
      throw new ProviderError("SnapYT only accepts YouTube URLs.", "unsupported_url", false, true);
    }
    if (!this.deliveryVerified) {
      throw new ProviderError(
        "SnapYT has no approved browser Delivery audit.",
        "unsupported_url",
        false,
        true
      );
    }
    const now = Date.now();
    if (
      this.activeRequests >= this.maxConcurrency ||
      (this.lastRequestAt > 0 && now < this.lastRequestAt + this.minIntervalMs)
    ) {
      throw new ProviderError("SnapYT is temporarily rate limited.", "provider_rate_limited", true, true);
    }

    const startedAt = Date.now();
    let phase: SnapYTDiagnosticPhase = "landing";
    let httpStatus: number | null = null;
    let contentType: SnapYTContentType = "missing";
    let candidateCount = 0;
    let acceptedCount = 0;
    const emit = (outcome: SnapYTDiagnosticEvent["outcome"], failureCode: ProviderFailureCode | null) => {
      try {
        this.diagnosticSink?.({
          event: "snapyt_resolution_diagnostic",
          taskId: input.taskId,
          platform: "youtube",
          phase,
          outcome,
          httpStatus,
          contentType,
          candidateCount,
          acceptedCount,
          failureCode,
          durationMs: Math.max(0, Date.now() - startedAt)
        });
      } catch {
        // Diagnostics must never change Provider behavior.
      }
    };
    const observer = {
      onResponse: (observation: { status: number; headers: Headers }) => {
        httpStatus = observation.status;
        contentType = contentTypeCategory(observation.headers);
      }
    };

    this.activeRequests += 1;
    this.lastRequestAt = now;
    try {
      const landing = await requestText(
        this.fetchImpl,
        new URL("/", PAGE_ORIGIN),
        {
          method: "GET",
          redirect: "manual",
          ...(input.signal ? { signal: input.signal } : {}),
          headers: {
            accept: "text/html,application/xhtml+xml",
            "accept-language": "en-US,en;q=0.9",
            "user-agent": "TikDD/snapyt-youtube"
          }
        },
        PAGE_HOSTS,
        {
          expectedContentTypes: ["text/html"],
          maximumBytes: MAXIMUM_PAGE_BYTES,
          observer,
          challengeClassifier: isSnapYTChallenge
        }
      );
      const nonce = extractSnapYTNonce(landing.body);
      let providerCookie = landing.cookie;

      phase = "resolve";
      const form = new URLSearchParams({
        action: "process_video_url",
        video_url: input.canonicalUrl,
        security: nonce
      });
      const resolved = await requestText(
        this.fetchImpl,
        new URL(AJAX_PATH, PAGE_ORIGIN),
        {
          method: "POST",
          redirect: "manual",
          ...(input.signal ? { signal: input.signal } : {}),
          headers: {
            accept: "application/json",
            "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
            origin: PAGE_ORIGIN,
            referer: `${PAGE_ORIGIN}/`,
            "user-agent": "TikDD/snapyt-youtube",
            ...(providerCookie ? { cookie: providerCookie } : {})
          },
          body: form
        },
        PAGE_HOSTS,
        {
          expectedContentTypes: ["application/json"],
          maximumBytes: MAXIMUM_JSON_BYTES,
          observer,
          challengeClassifier: isSnapYTChallenge
        }
      );
      providerCookie = mergeCookies(providerCookie, resolved.cookie);
      const resultUrl = parseSnapYTAjaxResponse(resolved.body);

      phase = "result";
      const resultPage = await requestText(
        this.fetchImpl,
        new URL(resultUrl),
        {
          method: "GET",
          redirect: "manual",
          ...(input.signal ? { signal: input.signal } : {}),
          headers: {
            accept: "text/html,application/xhtml+xml",
            "accept-language": "en-US,en;q=0.9",
            referer: `${PAGE_ORIGIN}/`,
            "user-agent": "TikDD/snapyt-youtube",
            ...(providerCookie ? { cookie: providerCookie } : {})
          }
        },
        PAGE_HOSTS,
        {
          expectedContentTypes: ["text/html"],
          maximumBytes: MAXIMUM_RESULT_BYTES,
          observer,
          challengeClassifier: isSnapYTChallenge
        }
      );
      const parsed = parseSnapYTResultPage(resultPage.body);
      candidateCount = parsed.candidateCount;
      acceptedCount = parsed.formats.length;
      phase = "completed";
      const resolution = createRedirectResolution(
        this.manifest.id,
        this.manifest.kind,
        input,
        {
          title: null,
          thumbnailUrl: null,
          durationSeconds: null,
          formats: parsed.formats,
          warnings: [
            "YouTube Beta uses short-lived combined MP4 resources; unavailable adaptive formats are omitted."
          ]
        },
        {
          hostPolicyId: MEDIA_HOST_POLICY_ID,
          maximumLifetimeMs: MAXIMUM_CANDIDATE_LIFETIME_MS
        }
      );
      emit("success", null);
      return resolution;
    } catch (error) {
      emit("failure", diagnosticFailureCode(error));
      if (error instanceof ProviderError) throw error;
      if (input.signal?.aborted) throw error;
      throw new ProviderError("SnapYT could not be reached.", "provider_unavailable", true, true);
    } finally {
      this.activeRequests = Math.max(0, this.activeRequests - 1);
    }
  }
}
