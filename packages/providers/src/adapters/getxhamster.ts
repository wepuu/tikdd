import type { Platform } from "@tikdd/contracts";
import { ProviderError } from "../errors";
import type { ProviderManifest, ResolveInput, ResolverProvider } from "../index";
import {
  createRedirectResolution,
  requestText,
  type ParsedFormat,
  type ProviderFetch
} from "./shared";

const API_ORIGIN = "https://getxhamster.com";
const API_HOSTS = new Set(["getxhamster.com", "www.getxhamster.com"]);
const MEDIA_HOST_POLICY_ID = "getxhamster-xhamster-media-v1";
const MEDIA_HOST_SUFFIXES = ["xhcdn.com", "ahcdn.com"] as const;
const MAXIMUM_CANDIDATE_LIFETIME_MS = 5 * 60 * 1_000;
const MAXIMUM_RESPONSE_BYTES = 512 * 1024;
const SUPPORTED_PLATFORMS = ["xhamster"] as const;

export interface GetXHamsterProviderOptions {
  enabled?: boolean;
  fetchImpl?: ProviderFetch;
  approvedPlatforms?: readonly Platform[];
  deliveryVerifiedPlatforms?: readonly Platform[];
  maxConcurrency?: number;
  minIntervalMs?: number;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown, maximum: number): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum
    ? value.trim()
    : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value.trim())) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function reviewedMediaUrl(value: unknown): string | null {
  const raw = stringValue(value, 16_384);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    const allowedHost = MEDIA_HOST_SUFFIXES.some(
      (suffix) => hostname !== suffix && hostname.endsWith(`.${suffix}`)
    );
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !allowedHost ||
      !/\.mp4$/i.test(url.pathname)
    ) {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function qualityValue(record: Record<string, unknown>): string {
  const raw = record.quality ?? record.height ?? record.resolution ?? record.label;
  if (typeof raw === "number" && Number.isFinite(raw)) return `${Math.round(raw)}p`;
  const text = stringValue(raw, 80);
  if (!text) return "MP4";
  return /^\d{3,4}$/.test(text) ? `${text}p` : text;
}

function parseMediaItem(value: unknown): ParsedFormat | null {
  const record = recordValue(value);
  if (!record) return null;
  const url = reviewedMediaUrl(record.url);
  if (!url) return null;
  const quality = qualityValue(record);
  return {
    url,
    label: quality,
    quality,
    container: "mp4",
    hasVideo: true,
    hasAudio: true
  };
}

function parseGetXHamsterResponse(body: string): {
  title: string | null;
  durationSeconds: number | null;
  formats: ParsedFormat[];
} {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new ProviderError(
      "GetXHamster returned an invalid response.",
      "provider_schema_changed",
      true,
      true
    );
  }
  const root = recordValue(payload);
  if (!root) {
    throw new ProviderError(
      "GetXHamster returned an invalid response.",
      "provider_schema_changed",
      true,
      true
    );
  }
  const errorMessage = stringValue(root.message ?? root.error, 300);
  if (errorMessage && !Array.isArray(root.media)) {
    if (/not from xhamster|invalid|unsupported/i.test(errorMessage)) {
      throw new ProviderError("The URL is not supported by GetXHamster.", "unsupported_url", false, true);
    }
  }
  const formats: ParsedFormat[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(root.media) ? root.media : []) {
    const parsed = parseMediaItem(item);
    if (parsed && !seen.has(parsed.url)) {
      seen.add(parsed.url);
      formats.push(parsed);
    }
  }
  if (formats.length === 0) {
    throw new ProviderError(
      "GetXHamster returned no reviewed progressive MP4 resource.",
      "invalid_result",
      false,
      true
    );
  }
  const duration = numberValue(root.duration);
  return {
    title: stringValue(root.title, 1_000),
    durationSeconds: duration !== null && duration >= 0 && duration <= 86_400 ? duration : null,
    formats
  };
}

export { parseGetXHamsterResponse };

export class GetXHamsterProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  private readonly fetchImpl: ProviderFetch;
  private readonly approvedPlatforms: ReadonlySet<Platform>;
  private readonly deliveryVerifiedPlatforms: ReadonlySet<Platform>;
  private readonly maxConcurrency: number;
  private readonly minIntervalMs: number;
  private activeRequests = 0;
  private lastRequestAt = 0;

  constructor(options: GetXHamsterProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    const approvedPlatforms = options.approvedPlatforms ?? ["xhamster"];
    const deliveryVerifiedPlatforms = options.deliveryVerifiedPlatforms ?? ["xhamster"];
    const unsupported = [...new Set([...approvedPlatforms, ...deliveryVerifiedPlatforms])]
      .find((platform) => !SUPPORTED_PLATFORMS.includes(platform as (typeof SUPPORTED_PLATFORMS)[number]));
    if (unsupported) throw new Error(`GetXHamster does not support the configured platform: ${unsupported}.`);
    if (deliveryVerifiedPlatforms.some((platform) => !approvedPlatforms.includes(platform))) {
      throw new Error("GetXHamster delivery-verified platforms must be a subset of approved platforms.");
    }
    this.approvedPlatforms = new Set(approvedPlatforms);
    this.deliveryVerifiedPlatforms = new Set(deliveryVerifiedPlatforms);
    this.maxConcurrency = Math.max(1, Math.min(4, Math.floor(options.maxConcurrency ?? 1)));
    this.minIntervalMs = Math.max(0, Math.min(60_000, Math.floor(options.minIntervalMs ?? 2_000)));
    this.manifest = {
      id: "getxhamster",
      displayName: "GetXHamster",
      kind: "api",
      enabled: options.enabled ?? false,
      regions: ["nl", "global", "canary-global"],
      timeoutMs: 20_000,
      costWeight: 55,
      platforms: [{
        platform: "xhamster",
        priority: 820,
        deliveryModes: this.deliveryVerifiedPlatforms.has("xhamster") ? ["redirect"] : [],
        verificationStatus: this.deliveryVerifiedPlatforms.has("xhamster")
          ? "fixture_verified"
          : "unverified"
      }]
    };
  }

  async resolve(input: ResolveInput) {
    if (!SUPPORTED_PLATFORMS.includes(input.platform as (typeof SUPPORTED_PLATFORMS)[number]) || !this.approvedPlatforms.has(input.platform)) {
      throw new ProviderError(
        "GetXHamster only accepts xHamster URLs.",
        "unsupported_url",
        false,
        true
      );
    }
    if (!this.deliveryVerifiedPlatforms.has(input.platform)) {
      throw new ProviderError(
        "GetXHamster has no reviewed Delivery policy for this platform.",
        "unsupported_url",
        false,
        true
      );
    }
    const now = Date.now();
    if (this.activeRequests >= this.maxConcurrency || (this.lastRequestAt > 0 && now < this.lastRequestAt + this.minIntervalMs)) {
      throw new ProviderError("GetXHamster is temporarily rate limited.", "provider_rate_limited", true, true);
    }
    this.activeRequests += 1;
    this.lastRequestAt = now;
    try {
      const endpoint = new URL("/api/video", API_ORIGIN);
      endpoint.searchParams.set("u", input.canonicalUrl);
      const response = await requestText(
        this.fetchImpl,
        endpoint,
        {
          method: "GET",
          redirect: "manual",
          ...(input.signal ? { signal: input.signal } : {}),
          headers: { accept: "application/json" }
        },
        API_HOSTS,
        {
          expectedContentTypes: ["application/json"],
          maximumBytes: MAXIMUM_RESPONSE_BYTES
        }
      );
      const parsed = parseGetXHamsterResponse(response.body);
      return createRedirectResolution(
        this.manifest.id,
        this.manifest.kind,
        input,
        {
          title: parsed.title,
          thumbnailUrl: null,
          durationSeconds: parsed.durationSeconds,
          formats: parsed.formats,
          warnings: [
            "GetXHamster returns progressive MP4 files for direct browser delivery; adaptive stream formats are not included."
          ]
        },
        { hostPolicyId: MEDIA_HOST_POLICY_ID, maximumLifetimeMs: MAXIMUM_CANDIDATE_LIFETIME_MS }
      );
    } finally {
      this.activeRequests = Math.max(0, this.activeRequests - 1);
    }
  }
}
