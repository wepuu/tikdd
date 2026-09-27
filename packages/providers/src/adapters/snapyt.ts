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
const MAXIMUM_MEDIA_PROBE_BYTES = 1_024;
const MAX_MEDIA_PROBES = 5;
const QUALITY_BY_FORMAT = new Map([
  ["0", "360p"],
  ["18", "360p"],
  ["22", "720p"]
]);
const COMBINED_FORMATS = new Set(["0", "18", "22"]);

const AjaxResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional()
}).passthrough();

export type SnapYTDiagnosticPhase = "landing" | "resolve" | "result" | "media" | "completed";
export type SnapYTContentType = "json" | "html" | "text" | "other" | "missing";
export type SnapYTFormatKind = "combined" | "video-only" | "audio-only";
export type SnapYTMediaRejectionReason =
  | "redirect"
  | "policy"
  | "status"
  | "html"
  | "mime"
  | "disposition"
  | "empty";

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
  combinedCount: number;
  videoOnlyCount: number;
  audioOnlyCount: number;
  rejectedMediaCount: number;
  redirectRejectedCount: number;
  policyRejectedCount: number;
  statusRejectedCount: number;
  htmlRejectedCount: number;
  mimeRejectedCount: number;
  dispositionRejectedCount: number;
  emptyRejectedCount: number;
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

type FormatKindHint = SnapYTFormatKind | "unknown";

interface ReviewedSnapYTFormat extends ParsedFormat {
  kindHint: FormatKindHint;
}

function qualityHintFromContext(context: string): string | null {
  const videoQualities = [...context.matchAll(/\b(\d{3,4}p)\b/gi)].map(([_, value]) => value);
  const audioQualities = [...context.matchAll(/\b(\d{2,4})\s*(?:kbps|kbit\/s|kb\/s)\b/gi)]
    .map(([_, value]) => `${value}kbps`);
  return [...videoQualities, ...audioQualities].at(-1) ?? null;
}

function kindHintFromContext(context: string, format: string): FormatKindHint {
  const normalized = context.toLowerCase();
  if (/audio[\s-]*only|only[\s-]*audio/.test(normalized)) return "audio-only";
  if (/video[\s-]*only|only[\s-]*video/.test(normalized)) return "video-only";
  if (/combined|with[\s+/-]*audio|video[\s+/-]*audio/.test(normalized)) return "combined";
  if (COMBINED_FORMATS.has(format)) return "combined";
  return "unknown";
}

function reviewedForceDownloadUrl(value: string, context = ""): { url: string; quality: string; kindHint: FormatKindHint } | null {
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
      !/^[0-9]{1,4}$/.test(fmt[0] ?? "") ||
      nonce.length !== 1 ||
      !nonce[0] ||
      hasUnexpectedKey
    ) {
      return null;
    }
    return {
      url: url.toString(),
      quality: qualityHintFromContext(context) ?? QUALITY_BY_FORMAT.get(fmt[0] ?? "") ?? "MP4",
      kindHint: kindHintFromContext(context, fmt[0] ?? "")
    };
  } catch {
    return null;
  }
}

export function parseSnapYTResultPage(body: string): {
  candidateCount: number;
  formats: ReviewedSnapYTFormat[];
} {
  const formats: ReviewedSnapYTFormat[] = [];
  const seen = new Set<string>();
  let candidateCount = 0;
  for (const match of body.matchAll(/<[^>]{0,8192}\bdata-force\s*=\s*(["'])[\s\S]*?\1[^>]*>/gi)) {
    const tag = match[0];
    const raw = attributesFromTag(tag).get("data-force");
    if (!raw) continue;
    candidateCount += 1;
    const matchIndex = match.index ?? 0;
    const afterTag = body.slice(matchIndex + tag.length, Math.min(body.length, matchIndex + tag.length + 320));
    const nextTag = afterTag.indexOf("<");
    const adjacentText = nextTag >= 0 ? afterTag.slice(0, nextTag) : afterTag;
    const context = `${tag} ${adjacentText}`
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const reviewed = reviewedForceDownloadUrl(raw, context);
    if (!reviewed || seen.has(reviewed.url)) continue;
    seen.add(reviewed.url);
    formats.push({
      url: reviewed.url,
      label: reviewed.quality,
      quality: reviewed.quality,
      container: "mp4",
      hasVideo: reviewed.kindHint !== "audio-only",
      hasAudio: reviewed.kindHint !== "video-only",
      kindHint: reviewed.kindHint
    });
  }
  if (formats.length === 0) {
    throw new ProviderError(
      "SnapYT returned no reviewed media resource.",
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

interface SnapYTMediaProbe {
  status: number;
  contentType: string;
  contentDisposition: string;
  bytesRead: number;
  container: string;
  kind: SnapYTFormatKind;
  hasVideo: boolean;
  hasAudio: boolean;
}

class SnapYTMediaProbeError extends ProviderError {
  constructor(message: string, readonly rejectionReason: SnapYTMediaRejectionReason, retryable = false) {
    super(message, "invalid_result", retryable, true);
    this.name = "SnapYTMediaProbeError";
  }
}

async function probeSnapYTForceDownload(
  fetchImpl: ProviderFetch,
  target: string,
  signal: AbortSignal | undefined,
  observer: { onResponse(observation: { status: number; headers: Headers }): void },
  kindHint: FormatKindHint
): Promise<SnapYTMediaProbe> {
  let response: Response;
  try {
    response = await fetchImpl(new URL(target), {
      method: "GET",
      redirect: "manual",
      ...(signal ? { signal } : {}),
      headers: {
        accept: "video/mp4,*/*",
        range: `bytes=0-${MAXIMUM_MEDIA_PROBE_BYTES - 1}`,
        "user-agent": "TikDD/snapyt-youtube"
      }
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ProviderError("SnapYT media validation could not be reached.", "provider_unavailable", true, true);
  }
  observer.onResponse({ status: response.status, headers: new Headers(response.headers) });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    throw new SnapYTMediaProbeError(
      "SnapYT returned a redirect outside its reviewed Provider-stream boundary.",
      "redirect",
      true
    );
  }
  let responseUrl: URL;
  try {
    responseUrl = new URL(response.url || target);
  } catch {
    throw new SnapYTMediaProbeError("SnapYT returned an invalid media URL.", "policy");
  }
  if (
    responseUrl.protocol !== "https:" ||
    responseUrl.hostname.toLowerCase() !== "www.snapyt.app" ||
    responseUrl.pathname !== AJAX_PATH
  ) {
    throw new SnapYTMediaProbeError("SnapYT media response escaped its reviewed host policy.", "policy");
  }
  if (response.status === 429) {
    throw new ProviderError("SnapYT rate limited media validation.", "provider_rate_limited", true, true);
  }
  if (response.status === 408) {
    throw new ProviderError("SnapYT media validation timed out.", "provider_timeout", true, true);
  }
  if (response.status === 403) {
    throw new ProviderError("SnapYT presented a media access challenge.", "provider_challenge", true, true);
  }
  if (response.status >= 500) {
    throw new ProviderError("SnapYT media validation is temporarily unavailable.", "provider_unavailable", true, true);
  }
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  const contentDisposition = response.headers.get("content-disposition")?.toLowerCase() ?? "";
  if (response.status !== 200 && response.status !== 206) {
    throw new SnapYTMediaProbeError("SnapYT returned an invalid media status.", "status", true);
  }
  if (!contentType.startsWith("video/") && !contentType.startsWith("audio/")) {
    throw new SnapYTMediaProbeError(
      "SnapYT did not return a recognized media response.",
      contentType === "text/html" || contentType === "application/xhtml+xml" ? "html" : "mime"
    );
  }
  if (!contentDisposition.includes("attachment")) {
    throw new SnapYTMediaProbeError(
      "SnapYT media is not marked for browser download.",
      "disposition"
    );
  }
  let bytesRead = 0;
  if (response.body) {
    const reader = response.body.getReader();
    try {
      const chunk = await reader.read();
      bytesRead = Math.min(chunk.value?.byteLength ?? 0, MAXIMUM_MEDIA_PROBE_BYTES);
    } finally {
      await reader.cancel().catch(() => undefined);
    }
  }
  if (bytesRead <= 0) {
    throw new SnapYTMediaProbeError("SnapYT returned an empty media response.", "empty");
  }
  const [major, minor] = contentType.split("/", 2);
  const container = minor === "mpeg" ? "mp3" : minor === "mp4" ? "mp4" : minor === "webm" ? "webm" : minor === "x-m4a" ? "m4a" : "";
  if (!container) {
    throw new SnapYTMediaProbeError("SnapYT returned an unsupported media container.", "mime");
  }
  const hasVideo = major === "video";
  const hasAudio = major === "audio";
  const kind: SnapYTFormatKind = hasAudio
    ? "audio-only"
    : kindHint === "combined" && container === "mp4"
      ? "combined"
      : "video-only";
  return {
    status: response.status,
    contentType,
    contentDisposition,
    bytesRead,
    container,
    kind,
    hasVideo,
    hasAudio: kind === "combined" || hasAudio
  };
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
    let combinedCount = 0;
    let videoOnlyCount = 0;
    let audioOnlyCount = 0;
    let rejectedMediaCount = 0;
    const rejectionCounts: Record<SnapYTMediaRejectionReason, number> = {
      redirect: 0,
      policy: 0,
      status: 0,
      html: 0,
      mime: 0,
      disposition: 0,
      empty: 0
    };
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
          combinedCount,
          videoOnlyCount,
          audioOnlyCount,
          rejectedMediaCount,
          redirectRejectedCount: rejectionCounts.redirect,
          policyRejectedCount: rejectionCounts.policy,
          statusRejectedCount: rejectionCounts.status,
          htmlRejectedCount: rejectionCounts.html,
          mimeRejectedCount: rejectionCounts.mime,
          dispositionRejectedCount: rejectionCounts.disposition,
          emptyRejectedCount: rejectionCounts.empty,
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
      phase = "media";
      const candidatesByQuality = [...parsed.formats].sort((left, right) => {
        const leftQuality = Number.parseInt(left.quality?.match(/\d+/)?.[0] ?? "0", 10);
        const rightQuality = Number.parseInt(right.quality?.match(/\d+/)?.[0] ?? "0", 10);
        const leftCombined = left.kindHint === "combined" ? 1 : 0;
        const rightCombined = right.kindHint === "combined" ? 1 : 0;
        return rightCombined - leftCombined || rightQuality - leftQuality;
      });
      const verifiedFormats: ParsedFormat[] = [];
      let lastProbeError: unknown = null;
      for (const candidate of candidatesByQuality.slice(0, MAX_MEDIA_PROBES)) {
        try {
          const probe = await probeSnapYTForceDownload(this.fetchImpl, candidate.url, input.signal, observer, candidate.kindHint);
          const composition = probe.kind === "combined" ? "" : probe.kind === "video-only" ? " video-only" : " audio-only";
          const baseQuality = candidate.quality === "MP4" && probe.kind === "audio-only"
            ? "Audio"
            : candidate.quality ?? "MP4";
          const quality = `${baseQuality}${composition}`.slice(0, 80);
          verifiedFormats.push({
            url: candidate.url,
            label: quality,
            quality,
            container: probe.container,
            hasVideo: probe.hasVideo,
            hasAudio: probe.hasAudio
          });
          if (probe.kind === "combined") combinedCount += 1;
          else if (probe.kind === "video-only") videoOnlyCount += 1;
          else audioOnlyCount += 1;
        } catch (error) {
          lastProbeError = error;
          rejectedMediaCount += 1;
          if (error instanceof SnapYTMediaProbeError) {
            rejectionCounts[error.rejectionReason] += 1;
          }
          if (error instanceof ProviderError && error.failureCode !== "invalid_result") {
            throw error;
          }
        }
      }
      if (verifiedFormats.length === 0) {
        if (lastProbeError instanceof ProviderError) throw lastProbeError;
        throw new ProviderError("SnapYT returned no browser-downloadable media.", "invalid_result", false, true);
      }
      acceptedCount = verifiedFormats.length;
      phase = "completed";
      const resolution = createRedirectResolution(
        this.manifest.id,
        this.manifest.kind,
        input,
        {
          title: null,
          thumbnailUrl: null,
          durationSeconds: null,
          formats: verifiedFormats,
          warnings: [
            "YouTube Beta exposes only bounded, browser-downloadable media; separate video and audio streams are labeled explicitly."
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
