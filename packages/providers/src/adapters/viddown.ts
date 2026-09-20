import { z } from "zod";
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

const PAGE_ORIGIN = "https://www.viddown.net";
const PAGE_HOSTS = new Set(["www.viddown.net"]);
const API_ORIGIN = "https://api.viddown.net";
const API_HOSTS = new Set(["api.viddown.net"]);
const MEDIA_HOSTS = new Set(["player.vimeo.com"]);
const THUMBNAIL_HOSTS = new Set(["i.vimeocdn.com"]);
const MEDIA_HOST_POLICY_ID = "viddown-net-vimeo-media-v1";
const MAXIMUM_CANDIDATE_LIFETIME_MS = 4 * 60 * 1000;
const MAXIMUM_RESPONSE_BYTES = 512_000;

const TokenResponseSchema = z.object({
  token: z.string().min(1).max(512)
}).passthrough();

const LoaderResponseSchema = z.object({
  state: z.union([z.number(), z.string()]).nullish(),
  msg: z.string().max(500).nullish(),
  data: z.unknown().nullish()
}).passthrough();

const VIMEO_URL_PATTERN = /\.mp4(?:$|[?#])/i;

export interface VidDownProviderOptions {
  enabled?: boolean;
  fetchImpl?: ProviderFetch;
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

function reviewedMediaUrl(value: unknown): string | null {
  const raw = stringValue(value, 16_384);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !MEDIA_HOSTS.has(url.hostname.toLowerCase()) ||
      !VIMEO_URL_PATTERN.test(url.pathname)
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function readQuality(value: Record<string, unknown>): string {
  return stringValue(value.quality, 80)
    ?? stringValue(value.resolution, 80)
    ?? (typeof value.height === "number" && Number.isInteger(value.height) && value.height > 0
      ? `${value.height}p`
      : "Source");
}

function collectMediaRecords(value: unknown, records: Record<string, unknown>[]): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectMediaRecords(entry, records));
    return;
  }
  const record = asRecord(value);
  if (!record) return;
  if (reviewedMediaUrl(record.url) || reviewedMediaUrl(record.videoUrl) || reviewedMediaUrl(record.downloadUrl)) {
    records.push(record);
  }
  Object.values(record).forEach((entry) => collectMediaRecords(entry, records));
}

function findFirstString(value: unknown, keys: ReadonlySet<string>): string | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findFirstString(entry, keys);
      if (found) return found;
    }
    return null;
  }
  const record = asRecord(value);
  if (!record) return null;
  for (const [key, entry] of Object.entries(record)) {
    if (keys.has(key.toLowerCase())) {
      const found = stringValue(entry, 1_000);
      if (found) return found;
    }
  }
  for (const entry of Object.values(record)) {
    const found = findFirstString(entry, keys);
    if (found) return found;
  }
  return null;
}

function findThumbnail(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findThumbnail(entry);
      if (found) return found;
    }
    return null;
  }
  const record = asRecord(value);
  if (!record) return null;
  for (const [key, entry] of Object.entries(record)) {
    if (key.toLowerCase() === "url" || key.toLowerCase() === "link") {
      const reviewed = reviewedThumbnailUrl(entry, THUMBNAIL_HOSTS);
      if (reviewed) return reviewed;
    }
    if (/thumbnail|poster|cover/i.test(key)) {
      if (Array.isArray(entry)) {
        const nested = findThumbnail(entry);
        if (nested) return nested;
      } else {
        const candidate = asRecord(entry)?.url ?? asRecord(entry)?.link ?? entry;
        const reviewed = reviewedThumbnailUrl(candidate, THUMBNAIL_HOSTS);
        if (reviewed) return reviewed;
      }
    }
  }
  for (const entry of Object.values(record)) {
    const found = findThumbnail(entry);
    if (found) return found;
  }
  return null;
}

function parseFailure(message: string | null, status: number): never {
  const detail = `${status} ${message ?? ""}`;
  if (/private|permission|restricted/i.test(detail)) {
    throw new ProviderError("VidDown cannot resolve private Vimeo media.", "content_private", false, false);
  }
  if (/not.?found|deleted|removed|unavailable/i.test(detail)) {
    throw new ProviderError("VidDown could not find this Vimeo media.", "content_not_found", false, false);
  }
  if (/invalid|unsupported/i.test(detail)) {
    throw new ProviderError("VidDown does not support this Vimeo URL.", "unsupported_url", false, false);
  }
  throw new ProviderError("VidDown returned an unsuccessful response.", "provider_unavailable", true, true);
}

function parseLoaderResponse(body: string, httpStatus = 200): {
  title: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  formats: ParsedFormat[];
} {
  let payload: z.infer<typeof LoaderResponseSchema>;
  try {
    payload = LoaderResponseSchema.parse(JSON.parse(body));
  } catch {
    throw new ProviderError("VidDown returned an invalid API response.", "provider_schema_changed", true, true);
  }

  const state = payload.state === undefined || payload.state === null
    ? null
    : String(payload.state).toLowerCase();
  if (httpStatus < 200 || httpStatus >= 300 || (state !== null && state !== "0" && state !== "success")) {
    parseFailure(payload.msg ?? null, httpStatus);
  }

  const records: Record<string, unknown>[] = [];
  collectMediaRecords(payload.data, records);
  const formats: ParsedFormat[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    const raw = record.url ?? record.videoUrl ?? record.downloadUrl;
    const url = reviewedMediaUrl(raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    formats.push({
      url,
      label: readQuality(record),
      container: "mp4",
      quality: readQuality(record),
      hasVideo: true,
      hasAudio: true
    });
  }
  if (formats.length === 0) {
    throw new ProviderError("VidDown returned no reviewed Vimeo MP4 resource.", "invalid_result", false, true);
  }

  const data = asRecord(payload.data);
  const author = asRecord(data?.author);
  const duration = data?.duration;
  return {
    title: findFirstString(data, new Set(["title", "name"])),
    author: stringValue(author?.name, 200),
    thumbnailUrl: findThumbnail(data),
    durationSeconds: typeof duration === "number" && Number.isFinite(duration) && duration >= 0 ? duration : null,
    formats
  };
}

export function parseVidDownResponse(body: string, httpStatus = 200) {
  return parseLoaderResponse(body, httpStatus);
}

export class VidDownProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  private readonly fetchImpl: ProviderFetch;

  constructor(options: VidDownProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.manifest = {
      id: "viddown-net",
      displayName: "VidDown.net",
      kind: "api",
      enabled: options.enabled ?? false,
      regions: ["nl", "global", "canary-global"],
      timeoutMs: 20_000,
      costWeight: 45,
      platforms: [{
        platform: "vimeo",
        priority: 760,
        deliveryModes: ["redirect"],
        verificationStatus: "delivery_verified"
      }]
    };
  }

  async resolve(input: ResolveInput) {
    if (input.platform !== "vimeo") {
      throw new ProviderError(
        "VidDown only accepts Vimeo URLs.",
        "unsupported_url",
        false,
        true
      );
    }

    const page = await requestText(
      this.fetchImpl,
      new URL("/download-vimeo-video", PAGE_ORIGIN),
      {
        method: "GET",
        redirect: "manual",
        ...(input.signal ? { signal: input.signal } : {}),
        headers: {
          accept: "text/html",
          "accept-language": "en",
          "user-agent": "TikDD/viddown-vimeo"
        }
      },
      PAGE_HOSTS,
      { expectedContentTypes: ["text/html"], maximumBytes: 64_000 }
    );
    const tokenResponse = await requestText(
      this.fetchImpl,
      new URL("/api/get-page-token", PAGE_ORIGIN),
      {
        method: "GET",
        redirect: "manual",
        ...(input.signal ? { signal: input.signal } : {}),
        headers: {
          accept: "application/json",
          "accept-language": "en",
          referer: page.response.url || `${PAGE_ORIGIN}/download-vimeo-video`,
          "user-agent": "TikDD/viddown-vimeo"
        }
      },
      PAGE_HOSTS,
      { expectedContentTypes: ["application/json"], maximumBytes: 64_000 }
    );
    let token: string;
    try {
      token = TokenResponseSchema.parse(JSON.parse(tokenResponse.body)).token;
    } catch {
      throw new ProviderError("VidDown did not return a valid page token.", "provider_schema_changed", true, true);
    }

    const response = await requestText(
      this.fetchImpl,
      new URL("/vimeo/v1/getLoaderList", API_ORIGIN),
      {
        method: "POST",
        redirect: "manual",
        ...(input.signal ? { signal: input.signal } : {}),
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: token,
          "access-from": "web",
          "accept-language": "en",
          origin: PAGE_ORIGIN,
          referer: page.response.url || `${PAGE_ORIGIN}/download-vimeo-video`,
          ...(tokenResponse.cookie ? { cookie: tokenResponse.cookie } : {})
        },
        body: JSON.stringify({ url: input.canonicalUrl, ga: { client_id: "", events: [] } })
      },
      API_HOSTS,
      { expectedContentTypes: ["application/json"], maximumBytes: MAXIMUM_RESPONSE_BYTES }
    );
    const parsed = parseLoaderResponse(response.body, response.response.status);
    return ProviderResolutionSchema.parse(createRedirectResolution(
      this.manifest.id,
      this.manifest.kind,
      input,
      {
        ...parsed,
        warnings: ["VidDown Vimeo support is an experimental Beta route."]
      },
      { hostPolicyId: MEDIA_HOST_POLICY_ID, maximumLifetimeMs: MAXIMUM_CANDIDATE_LIFETIME_MS }
    ));
  }
}
