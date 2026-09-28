import { z } from "zod";
import type { ProviderFailureCode } from "@tikdd/contracts";
import { ProviderError } from "../errors";
import type { ProviderManifest, ResolveInput, ResolverProvider } from "../index";
import {
  createRedirectResolution,
  requestText,
  type ProviderFetch
} from "./shared";

const ORIGIN = "https://noadsdl.com";
const HOSTS = new Set(["noadsdl.com"]);
const VIDEO_INFO_PATH = "/api/video-info";
const DOWNLOAD_PATH = "/download";
const STATUS_PATH_PREFIX = "/api/free-download/status/";
const MEDIA_PATH_PREFIX = "/api/free-download/file/";
const MEDIA_POLICY_ID = "noadsdl-youtube-media-v1";
const MAXIMUM_CANDIDATE_LIFETIME_MS = 2 * 60 * 1_000;
const MAXIMUM_RESPONSE_BYTES = 512 * 1_024;
const PROVIDER_TIMEOUT_MS = 45_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_POLL_BUDGET_MS = 40_000;
const DEFAULT_MAX_PREPARED_FORMATS = 2;
const MAXIMUM_STATUS_POLLS = 20;
const SUPPORTED_PLATFORM = "youtube" as const;
const THUMBNAIL_HOSTS = new Set(["i.ytimg.com", "img.youtube.com"]);
const YTIMG_THUMBNAIL_QUERY_KEYS = new Set(["sqp", "rs"]);

const VideoInfoSchema = z.object({
  success: z.boolean().optional(),
  status: z.union([z.string(), z.number()]).nullish(),
  message: z.string().max(500).nullish(),
  detail: z.string().max(500).nullish(),
  error: z.string().max(500).nullish(),
  title: z.string().max(1_000).nullish(),
  thumbnail: z.string().max(4_096).nullish(),
  video_formats: z.union([
    z.record(z.string(), z.unknown()),
    z.array(z.unknown())
  ]).nullish()
}).passthrough();

const JobSchema = z.object({
  status: z.string().max(80).nullish(),
  message: z.string().max(500).nullish(),
  detail: z.string().max(500).nullish(),
  error: z.string().max(500).nullish(),
  status_url: z.string().max(4_096).nullish(),
  direct_url: z.string().max(4_096).nullish(),
  progress: z.union([z.number(), z.string()]).nullish()
}).passthrough();

export type NoAdsContentType = "json" | "html" | "text" | "other" | "missing";
export type NoAdsDiagnosticPhase = "info" | "job" | "poll" | "completed";
export type NoAdsFormatSchema = "legacy" | "sparse" | "unknown";
export type NoAdsThumbnailStatus = "accepted" | "rejected" | "missing";
export type NoAdsJobStatusCategory = "missing" | "queued" | "processing" | "completed" | "failed" | "other";
export type NoAdsProgressBucket = "missing" | "0-24" | "25-49" | "50-74" | "75-99" | "100" | "other";

export interface NoAdsDiagnosticEvent {
  event: "noadsdl_resolution_diagnostic";
  taskId: string;
  platform: "youtube";
  phase: NoAdsDiagnosticPhase;
  outcome: "success" | "failure";
  httpStatus: number | null;
  contentType: NoAdsContentType;
  formatCount: number;
  formatSchema: NoAdsFormatSchema;
  selectedFormat: boolean;
  jobCreated: boolean;
  eligibleFormatCount: number;
  requestedFormatCount: number;
  preparedFormatCount: number;
  skippedFormatCount: number;
  thumbnailAccepted: boolean;
  thumbnailStatus: NoAdsThumbnailStatus;
  secondaryFailureCode: ProviderFailureCode | null;
  pollCount: number;
  jobStatusCategory: NoAdsJobStatusCategory;
  progressBucket: NoAdsProgressBucket;
  failureCode: ProviderFailureCode | null;
  durationMs: number;
}

export interface NoAdsVideoInfo {
  title: string | null;
  thumbnailUrl: string | null;
  thumbnailStatus: NoAdsThumbnailStatus;
  formatCount: number;
  formatSchema: NoAdsFormatSchema;
  formats: NoAdsFormatOffer[];
}

export interface NoAdsFormatOffer {
  formatId: string;
  label: string;
  quality: number;
}

export interface NoAdsJobState {
  status: string;
  statusCategory: NoAdsJobStatusCategory;
  progressBucket: NoAdsProgressBucket;
  statusUrl: string | null;
  directUrl: string | null;
}

export interface NoAdsDLProviderOptions {
  enabled?: boolean;
  deliveryVerified?: boolean;
  fetchImpl?: ProviderFetch;
  maxConcurrency?: number;
  minIntervalMs?: number;
  pollIntervalMs?: number;
  pollBudgetMs?: number;
  maxPreparedFormats?: number;
  diagnosticSink?: (event: NoAdsDiagnosticEvent) => void;
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

function boundedFormatId(value: unknown): string | null {
  const candidate = typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 999_999
    ? String(value)
    : stringValue(value, 160);
  return candidate && /^[A-Za-z0-9._-]+$/.test(candidate) ? candidate : null;
}

function contentTypeCategory(headers: Headers): NoAdsContentType {
  const value = headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (!value) return "missing";
  if (value === "application/json" || value.endsWith("+json")) return "json";
  if (value === "text/html" || value === "application/xhtml+xml") return "html";
  if (value.startsWith("text/")) return "text";
  return "other";
}

function failureText(value: unknown): string {
  if (typeof value === "string") return value.slice(0, 500);
  const record = asRecord(value);
  if (!record) return "";
  return [record.message, record.detail, record.error, record.reason, record.code]
    .map((entry) => stringValue(entry, 200))
    .filter((entry): entry is string => Boolean(entry))
    .join(" ");
}

function mapFailure(detail: string, fallback: ProviderFailureCode = "provider_unavailable"): never {
  if (/private|members.only|sign.?in|login|age.restrict/i.test(detail)) {
    throw new ProviderError("The YouTube video is private or restricted.", "content_private", false, false);
  }
  if (/not.?found|deleted|removed|unavailable/i.test(detail)) {
    throw new ProviderError("The YouTube video is unavailable.", "content_not_found", false, false);
  }
  if (/invalid|unsupported|playlist|channel|search/i.test(detail)) {
    throw new ProviderError("NoAdsDL does not support this YouTube URL.", "unsupported_url", false, true);
  }
  if (/rate|too many|limit/i.test(detail)) {
    throw new ProviderError("NoAdsDL rate limited the request.", "provider_rate_limited", true, true);
  }
  throw new ProviderError(
    "NoAdsDL returned an unsuccessful response.",
    fallback,
    fallback === "provider_timeout" || fallback === "provider_rate_limited" || fallback === "provider_unavailable",
    true
  );
}

function parseQuality(value: unknown, fallback: string): number {
  const match = String(value ?? fallback).match(/\b(\d{3,4})p?\b/i);
  return match?.[1] ? Number.parseInt(match[1], 10) : 0;
}

function formatEntries(value: unknown): Array<{ key: string; record: Record<string, unknown> }> {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => {
      const record = asRecord(entry);
      return record ? [{ key: String(index), record }] : [];
    });
  }
  const record = asRecord(value);
  return record
    ? Object.entries(record).flatMap(([key, entry]) => {
        const item = asRecord(entry);
        return item ? [{ key, record: item }] : [];
      })
    : [];
}

function isLegacyCombinedMp4(record: Record<string, unknown>): boolean {
  const ext = stringValue(record.ext, 16)?.toLowerCase();
  const type = stringValue(record.type, 32)?.toLowerCase();
  const vcodec = stringValue(record.vcodec, 32)?.toLowerCase();
  const acodec = stringValue(record.acodec, 32)?.toLowerCase();
  return ext === "mp4" && type !== "audio" && vcodec !== "none" && acodec !== "none";
}

function isSparseCombinedMp4(key: string, record: Record<string, unknown>): boolean {
  // The current NoAdsDL schema omits codecs and extension metadata. The
  // provider keeps combined MP4s in the video_formats map and labels them
  // with a bounded "<height>p MP4" key; audio_formats is a separate map.
  if (!/^\d{3,4}p\s+MP4$/i.test(key)) return false;
  if (!boundedFormatId(record.format_id)) return false;
  const resolution = stringValue(record.resolution, 32);
  if (resolution && !/^\d{2,5}(?:x\d{2,5}|p)$/i.test(resolution)) return false;
  const bitrate = record.bitrate;
  if (bitrate !== undefined && typeof bitrate !== "number" && typeof bitrate !== "string") return false;
  const sizeMb = record.size_mb;
  if (sizeMb !== undefined && typeof sizeMb !== "number" && typeof sizeMb !== "string") return false;
  return true;
}

function formatSchemaForEntries(entries: Array<{ key: string; record: Record<string, unknown> }>): NoAdsFormatSchema {
  if (entries.some(({ record }) => isLegacyCombinedMp4(record))) return "legacy";
  if (entries.some(({ key, record }) => isSparseCombinedMp4(key, record))) return "sparse";
  return "unknown";
}

function countVideoInfoFormats(body: string): number {
  try {
    const payload = VideoInfoSchema.parse(JSON.parse(body));
    return formatEntries(payload.video_formats).length;
  } catch {
    return 0;
  }
}

export function reviewedNoAdsThumbnailUrl(value: unknown): string | null {
  const raw = stringValue(value, 4_096);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:" ||
      !THUMBNAIL_HOSTS.has(url.hostname.toLowerCase()) ||
      url.username ||
      url.password ||
      url.port ||
      raw.includes("#") ||
      !/\.(?:jpe?g|png|webp)$/iu.test(url.pathname)
    ) return null;

    if (url.search) {
      if (url.hostname.toLowerCase() !== "i.ytimg.com") return null;
      const seen = new Set<string>();
      for (const [key, queryValue] of url.searchParams) {
        if (!YTIMG_THUMBNAIL_QUERY_KEYS.has(key) || seen.has(key) || queryValue.length === 0) {
          return null;
        }
        seen.add(key);
      }
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function parseNoAdsVideoInfo(body: string, httpStatus = 200): NoAdsVideoInfo {
  let payload: z.infer<typeof VideoInfoSchema>;
  try {
    payload = VideoInfoSchema.parse(JSON.parse(body));
  } catch {
    throw new ProviderError("NoAdsDL returned an invalid video-info response.", "provider_schema_changed", true, true);
  }
  const detail = failureText(payload);
  if (httpStatus < 200 || httpStatus >= 300 || payload.success !== true) {
    mapFailure(detail || `status ${String(payload.status ?? httpStatus)}`);
  }
  const entries = formatEntries(payload.video_formats);
  const formatSchema = formatSchemaForEntries(entries);
  const eligible = entries.filter(({ key, record }) =>
    isLegacyCombinedMp4(record) || isSparseCombinedMp4(key, record)
  );
  if (eligible.length === 0) {
    throw new ProviderError("NoAdsDL returned no free combined MP4 format.", "invalid_result", false, true);
  }
  const sorted = [...eligible].sort((left, right) => {
    const leftQuality = parseQuality(left.record.height ?? left.record.quality, left.key);
    const rightQuality = parseQuality(right.record.height ?? right.record.quality, right.key);
    const preferred = (quality: number) => quality === 720 ? 0 : quality === 1_080 ? 1 : quality === 480 ? 2 : quality === 360 ? 3 : 4;
    return preferred(leftQuality) - preferred(rightQuality) || rightQuality - leftQuality;
  });
  const seen = new Set<string>();
  const formats = sorted.flatMap(({ key, record }) => {
    const formatId = boundedFormatId(record.format_id);
    if (!formatId || seen.has(formatId)) return [];
    seen.add(formatId);
    const quality = parseQuality(record.height ?? record.quality, key);
    return [{ formatId, quality, label: quality > 0 ? `${quality}p MP4` : "MP4" }];
  });
  if (formats.length === 0) {
    throw new ProviderError("NoAdsDL omitted selectable format identifiers.", "provider_schema_changed", true, true);
  }
  const suppliedThumbnail = stringValue(payload.thumbnail, 4_096);
  const thumbnailUrl = reviewedNoAdsThumbnailUrl(payload.thumbnail);
  return {
    title: stringValue(payload.title, 1_000),
    thumbnailUrl,
    thumbnailStatus: thumbnailUrl ? "accepted" : suppliedThumbnail ? "rejected" : "missing",
    formatCount: entries.length,
    formatSchema,
    formats
  };
}

function reviewedStatusUrl(value: unknown): string | null {
  const raw = stringValue(value, 4_096);
  if (!raw) return null;
  try {
    const url = new URL(raw, ORIGIN);
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== "noadsdl.com" ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      url.search ||
      !url.pathname.startsWith(STATUS_PATH_PREFIX)
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function reviewedNoAdsDirectUrl(value: unknown): string | null {
  const raw = stringValue(value, 4_096);
  if (!raw) return null;
  try {
    const url = new URL(raw, ORIGIN);
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== "noadsdl.com" ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      url.search ||
      !/^\/api\/free-download\/file\/[A-Za-z0-9_-]{16,128}$/.test(url.pathname)
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function jobStatusCategory(value: string): NoAdsJobStatusCategory {
  if (!value) return "missing";
  if (["queued", "pending"].includes(value)) return "queued";
  if (["processing", "running"].includes(value)) return "processing";
  if (["completed", "complete", "ready", "success", "done"].includes(value)) return "completed";
  if (["failed", "error", "cancelled", "canceled", "expired"].includes(value)) return "failed";
  return "other";
}

function progressBucket(value: unknown): NoAdsProgressBucket {
  if (value === null || value === undefined || value === "") return "missing";
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value).replace(/%$/u, ""));
  if (!Number.isFinite(numeric) || numeric < 0) return "other";
  if (numeric >= 100) return "100";
  if (numeric >= 75) return "75-99";
  if (numeric >= 50) return "50-74";
  if (numeric >= 25) return "25-49";
  return "0-24";
}

export function parseNoAdsJobResponse(body: string, httpStatus = 200): NoAdsJobState {
  let payload: z.infer<typeof JobSchema>;
  try {
    payload = JobSchema.parse(JSON.parse(body));
  } catch {
    throw new ProviderError("NoAdsDL returned an invalid job response.", "provider_schema_changed", true, true);
  }
  const status = stringValue(payload.status, 80)?.toLowerCase() ?? "";
  const statusCategory = jobStatusCategory(status);
  const currentProgressBucket = progressBucket(payload.progress);
  const detail = failureText(payload);
  if (httpStatus < 200 || httpStatus >= 300 || statusCategory === "failed") {
    mapFailure(detail || `status ${String(payload.status ?? httpStatus)}`);
  }
  const statusUrl = reviewedStatusUrl(payload.status_url);
  const directUrl = reviewedNoAdsDirectUrl(payload.direct_url);
  if (statusCategory === "completed" && !directUrl) {
    throw new ProviderError(
      "NoAdsDL completed the job without a reviewed media URL.",
      "provider_schema_changed",
      true,
      true
    );
  }
  if (!statusUrl && !directUrl) {
    if (["queued", "pending", "processing", "running"].includes(status)) {
      return { status, statusCategory, progressBucket: currentProgressBucket, statusUrl: null, directUrl: null };
    }
    throw new ProviderError("NoAdsDL returned no bounded job continuation.", "provider_schema_changed", true, true);
  }
  return {
    status: status || "queued",
    statusCategory,
    progressBucket: currentProgressBucket,
    statusUrl,
    directUrl
  };
}

function diagnosticFailureCode(error: unknown): ProviderFailureCode {
  if (error instanceof ProviderError) return error.failureCode;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return "provider_timeout";
  }
  return "internal_error";
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

function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    if (!signal) return;
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? new Error("NoAdsDL request aborted."));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export class NoAdsDLProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  private readonly fetchImpl: ProviderFetch;
  private readonly deliveryVerified: boolean;
  private readonly maxConcurrency: number;
  private readonly minIntervalMs: number;
  private readonly pollIntervalMs: number;
  private readonly pollBudgetMs: number;
  private readonly maxPreparedFormats: number;
  private readonly diagnosticSink: ((event: NoAdsDiagnosticEvent) => void) | null;
  private activeRequests = 0;
  private lastRequestAt = 0;

  constructor(options: NoAdsDLProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.deliveryVerified = options.deliveryVerified ?? false;
    this.maxConcurrency = Math.max(1, Math.min(2, Math.floor(options.maxConcurrency ?? 1)));
    this.minIntervalMs = Math.max(0, Math.min(60_000, Math.floor(options.minIntervalMs ?? 5_000)));
    this.pollIntervalMs = Math.max(0, Math.min(10_000, Math.floor(options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS)));
    this.pollBudgetMs = Math.max(2_000, Math.min(DEFAULT_POLL_BUDGET_MS, Math.floor(options.pollBudgetMs ?? DEFAULT_POLL_BUDGET_MS)));
    this.maxPreparedFormats = Math.max(1, Math.min(2, Math.floor(options.maxPreparedFormats ?? DEFAULT_MAX_PREPARED_FORMATS)));
    this.diagnosticSink = options.diagnosticSink ?? null;
    this.manifest = {
      id: "noadsdl",
      displayName: "NoAdsDL.com",
      kind: "api",
      enabled: options.enabled ?? false,
      regions: ["nl", "global", "canary-global"],
      timeoutMs: PROVIDER_TIMEOUT_MS,
      costWeight: 62,
      platforms: [{
        platform: SUPPORTED_PLATFORM,
        priority: 740,
        deliveryModes: this.deliveryVerified ? ["redirect"] : [],
        verificationStatus: this.deliveryVerified ? "delivery_verified" : "fixture_verified"
      }]
    };
  }

  async resolve(input: ResolveInput) {
    if (input.platform !== SUPPORTED_PLATFORM) {
      throw new ProviderError("NoAdsDL only accepts YouTube URLs.", "unsupported_url", false, true);
    }
    if (!this.deliveryVerified) {
      throw new ProviderError(
        "NoAdsDL has no approved browser Delivery audit.",
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
      throw new ProviderError("NoAdsDL is temporarily rate limited.", "provider_rate_limited", true, true);
    }
    this.activeRequests += 1;
    this.lastRequestAt = now;
    const startedAt = Date.now();
    let phase: NoAdsDiagnosticPhase = "info";
    let httpStatus: number | null = null;
    let contentType: NoAdsContentType = "missing";
    let formatCount = 0;
    let formatSchema: NoAdsFormatSchema = "unknown";
    let selectedFormat = false;
    let jobCreated = false;
    let eligibleFormatCount = 0;
    let requestedFormatCount = 0;
    let preparedFormatCount = 0;
    let skippedFormatCount = 0;
    let thumbnailAccepted = false;
    let thumbnailStatus: NoAdsThumbnailStatus = "missing";
    let secondaryFailureCode: ProviderFailureCode | null = null;
    let pollCount = 0;
    let currentJobStatusCategory: NoAdsJobStatusCategory = "missing";
    let currentProgressBucket: NoAdsProgressBucket = "missing";
    let sessionCookie = "";
    const emit = (outcome: NoAdsDiagnosticEvent["outcome"], failureCode: ProviderFailureCode | null) => {
      try {
        this.diagnosticSink?.({
          event: "noadsdl_resolution_diagnostic",
          taskId: input.taskId,
          platform: SUPPORTED_PLATFORM,
          phase,
          outcome,
          httpStatus,
          contentType,
          formatCount,
          formatSchema,
          selectedFormat,
          jobCreated,
          eligibleFormatCount,
          requestedFormatCount,
          preparedFormatCount,
          skippedFormatCount,
          thumbnailAccepted,
          thumbnailStatus,
          secondaryFailureCode,
          pollCount,
          jobStatusCategory: currentJobStatusCategory,
          progressBucket: currentProgressBucket,
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
    const requestJson = async (url: URL, init: RequestInit) => {
      const headers = new Headers(init.headers);
      headers.set("accept", "application/json");
      if (sessionCookie) headers.set("cookie", sessionCookie);
      const response = await requestText(this.fetchImpl, url, {
        ...init,
        headers,
        redirect: "manual",
        ...(input.signal ? { signal: input.signal } : {})
      }, HOSTS, {
        maximumBytes: MAXIMUM_RESPONSE_BYTES,
        expectedContentTypes: ["application/json"],
        maximumRedirects: 0,
        allowNonOk: true,
        observer
      });
      sessionCookie = mergeCookies(sessionCookie, response.cookie);
      return response;
    };
    try {
      const infoUrl = new URL(VIDEO_INFO_PATH, ORIGIN);
      infoUrl.searchParams.set("url", input.canonicalUrl);
      phase = "info";
      const infoResponse = await requestJson(infoUrl, { method: "GET" });
      formatCount = countVideoInfoFormats(infoResponse.body);
      const info = parseNoAdsVideoInfo(infoResponse.body, infoResponse.response.status);
      formatCount = info.formatCount;
      formatSchema = info.formatSchema;
      eligibleFormatCount = info.formats.length;
      selectedFormat = eligibleFormatCount > 0;
      thumbnailAccepted = info.thumbnailUrl !== null;
      thumbnailStatus = info.thumbnailStatus;
      const preparationStartedAt = Date.now();
      const prepared: Array<{ url: string; label: string }> = [];
      const requested = info.formats.slice(0, this.maxPreparedFormats);
      skippedFormatCount = Math.max(0, info.formats.length - requested.length);

      for (const [index, format] of requested.entries()) {
        if (Date.now() - preparationStartedAt >= this.pollBudgetMs) {
          skippedFormatCount += requested.length - index;
          if (index === 0) {
            throw new ProviderError("NoAdsDL did not finish the download job in time.", "provider_timeout", true, true);
          }
          secondaryFailureCode = "provider_timeout";
          break;
        }
        try {
          requestedFormatCount += 1;
          const jobUrl = new URL(DOWNLOAD_PATH, ORIGIN);
          jobUrl.searchParams.set("url", input.canonicalUrl);
          jobUrl.searchParams.set("format", "mp4");
          jobUrl.searchParams.set("format_id", format.formatId);
          jobUrl.searchParams.set("async", "1");
          phase = "job";
          const jobResponse = await requestJson(jobUrl, { method: "GET" });
          let job = parseNoAdsJobResponse(jobResponse.body, jobResponse.response.status);
          jobCreated = true;
          currentJobStatusCategory = job.statusCategory;
          currentProgressBucket = job.progressBucket;
          let statusUrl = job.statusUrl;
          if (!job.directUrl && !statusUrl) {
            throw new ProviderError("NoAdsDL did not return a bounded job status URL.", "provider_schema_changed", true, true);
          }

          while (!job.directUrl && statusUrl && pollCount < MAXIMUM_STATUS_POLLS) {
            const remainingMs = this.pollBudgetMs - (Date.now() - preparationStartedAt);
            if (remainingMs <= 0) break;
            await delay(Math.min(this.pollIntervalMs, remainingMs), input.signal);
            pollCount += 1;
            phase = "poll";
            const pollResponse = await requestJson(new URL(statusUrl), { method: "GET" });
            job = parseNoAdsJobResponse(pollResponse.body, pollResponse.response.status);
            currentJobStatusCategory = job.statusCategory;
            currentProgressBucket = job.progressBucket;
            statusUrl = job.statusUrl ?? statusUrl;
          }
          if (!job.directUrl) {
            throw new ProviderError("NoAdsDL did not finish the download job in time.", "provider_timeout", true, true);
          }
          prepared.push({ url: job.directUrl, label: format.label });
          preparedFormatCount = prepared.length;
        } catch (error) {
          if (index === 0) throw error;
          secondaryFailureCode = diagnosticFailureCode(error);
          skippedFormatCount += requested.length - index;
          break;
        }
      }
      phase = "completed";
      const resolution = createRedirectResolution(
        this.manifest.id,
        this.manifest.kind,
        input,
        {
          title: info.title,
          thumbnailUrl: info.thumbnailUrl,
          formats: prepared.map((format) => ({
            url: format.url,
            label: format.label,
            quality: format.label,
            container: "mp4",
            hasVideo: true,
            hasAudio: true
          })),
          warnings: ["NoAdsDL prepares the MP4 on its own server before browser delivery."]
        },
        { hostPolicyId: MEDIA_POLICY_ID, maximumLifetimeMs: MAXIMUM_CANDIDATE_LIFETIME_MS }
      );
      emit("success", null);
      return resolution;
    } catch (error) {
      emit("failure", diagnosticFailureCode(error));
      if (error instanceof ProviderError) throw error;
      if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
        throw new ProviderError("NoAdsDL timed out.", "provider_timeout", true, true);
      }
      throw new ProviderError("NoAdsDL could not be reached.", "provider_unavailable", true, true);
    } finally {
      this.activeRequests -= 1;
    }
  }
}
