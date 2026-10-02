import { z } from "zod";
import type { ProviderFetch } from "./shared";

const OEMBED_ORIGIN = "https://www.tiktok.com";
const OEMBED_HOST = "www.tiktok.com";
const REVIEWED_THUMBNAIL_HOST = "p16-common-sign.tiktokcdn-eu.com";
const MAXIMUM_RESPONSE_BYTES = 64 * 1024;
const MAXIMUM_THUMBNAIL_URL_LENGTH = 4_096;
const MAXIMUM_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 3_000;

const TikTokOEmbedSchema = z.object({
  thumbnail_url: z.string().max(MAXIMUM_THUMBNAIL_URL_LENGTH).nullish()
}).passthrough();

export type TikTokThumbnailStatus =
  | "accepted"
  | "missing"
  | "timeout"
  | "http_error"
  | "schema_changed"
  | "unsafe_host";

export type TikTokThumbnailPhase = "request" | "response" | "validate" | "completed";

export interface TikTokThumbnailDiagnosticEvent {
  event: "tiktok_thumbnail_diagnostic";
  taskId: string;
  phase: TikTokThumbnailPhase;
  status: TikTokThumbnailStatus;
  httpStatus: number | null;
  contentType: "json" | "other" | "missing";
  redirectCount: number;
  durationMs: number;
}

export interface TikTokThumbnailOptions {
  taskId: string;
  canonicalUrl: string;
  fetchImpl?: ProviderFetch;
  signal?: AbortSignal;
  timeoutMs?: number;
  diagnosticSink?: (event: TikTokThumbnailDiagnosticEvent) => void;
}

function reviewedOEmbedUrl(value: URL): boolean {
  return value.protocol === "https:" && value.hostname.toLowerCase() === OEMBED_HOST &&
    !value.port && !value.username && !value.password;
}

export function reviewedTikTokThumbnailUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > MAXIMUM_THUMBNAIL_URL_LENGTH) {
    return null;
  }
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" || url.username || url.password || url.port ||
      url.hostname.toLowerCase() !== REVIEWED_THUMBNAIL_HOST
    ) {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function responseContentType(response: Response): TikTokThumbnailDiagnosticEvent["contentType"] {
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (!contentType) return "missing";
  return contentType === "application/json" ? "json" : "other";
}

async function boundedBody(response: Response): Promise<string | null> {
  const declaredLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAXIMUM_RESPONSE_BYTES) return null;
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let byteCount = 0;
  let body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteCount += value.byteLength;
    if (byteCount > MAXIMUM_RESPONSE_BYTES) {
      await reader.cancel();
      return null;
    }
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
}

/**
 * Best-effort metadata enrichment. This function never throws: a thumbnail must not turn an
 * already valid Cobalt resolution into a Provider failure.
 */
export async function resolveTikTokThumbnail(options: TikTokThumbnailOptions): Promise<string | null> {
  const startedAt = Date.now();
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let phase: TikTokThumbnailPhase = "request";
  let status: TikTokThumbnailStatus = "missing";
  let httpStatus: number | null = null;
  let contentType: TikTokThumbnailDiagnosticEvent["contentType"] = "missing";
  let redirectCount = 0;
  const emit = () => {
    try {
      options.diagnosticSink?.({
        event: "tiktok_thumbnail_diagnostic",
        taskId: options.taskId,
        phase,
        status,
        httpStatus,
        contentType,
        redirectCount,
        durationMs: Math.max(0, Date.now() - startedAt)
      });
    } catch {
      // Optional diagnostics must not affect a successful media resolution.
    }
  };

  try {
    const endpoint = new URL("/oembed", OEMBED_ORIGIN);
    endpoint.searchParams.set("url", options.canonicalUrl);
    let currentUrl = endpoint;
    let response: Response | null = null;
    for (redirectCount = 0; redirectCount <= MAXIMUM_REDIRECTS; redirectCount += 1) {
      response = await fetchImpl(currentUrl, {
        method: "GET",
        redirect: "manual",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
        headers: { accept: "application/json", "user-agent": "TikDD/tiktok-thumbnail" }
      });
      httpStatus = response.status;
      phase = "response";
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      if (redirectCount === MAXIMUM_REDIRECTS) {
        status = "unsafe_host";
        emit();
        return null;
      }
      const location = response.headers.get("location");
      if (!location) {
        status = "schema_changed";
        emit();
        return null;
      }
      const nextUrl = new URL(location, currentUrl);
      if (!reviewedOEmbedUrl(nextUrl)) {
        status = "unsafe_host";
        emit();
        return null;
      }
      currentUrl = nextUrl;
    }
    if (!response || !response.ok) {
      status = "http_error";
      emit();
      return null;
    }
    contentType = responseContentType(response);
    if (contentType !== "json") {
      status = "schema_changed";
      emit();
      return null;
    }
    const body = await boundedBody(response);
    if (body === null) {
      status = "schema_changed";
      emit();
      return null;
    }
    phase = "validate";
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      status = "schema_changed";
      emit();
      return null;
    }
    const parsed = TikTokOEmbedSchema.safeParse(payload);
    if (!parsed.success) {
      status = "schema_changed";
      emit();
      return null;
    }
    if (!parsed.data.thumbnail_url) {
      status = "missing";
      emit();
      return null;
    }
    const thumbnailUrl = reviewedTikTokThumbnailUrl(parsed.data.thumbnail_url);
    if (!thumbnailUrl) {
      status = "unsafe_host";
      emit();
      return null;
    }
    phase = "completed";
    status = "accepted";
    emit();
    return thumbnailUrl;
  } catch (error) {
    status = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")
      ? "timeout"
      : "http_error";
    emit();
    return null;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}
