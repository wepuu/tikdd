import { ProviderError } from "../errors";
import type { Platform } from "@tikdd/contracts";
import type { LocoLoaderRequestBudget } from "../locoloader-budget";
import type { ProviderManifest, ResolveInput, ResolverProvider } from "../index";
import { createRedirectResolution, requestText, type ParsedFormat, type ProviderFetch } from "./shared";

const ORIGIN = "https://www.locoloader.com";
const ALLOWED_HOSTS = new Set(["www.locoloader.com", "locoloader.com"]);
const MEDIA_HOST_POLICY_ID = "locoloader-xhamster-media-v1";
const MAXIMUM_CANDIDATE_LIFETIME_MS = 5 * 60 * 1_000;
const SUPPORTED_PLATFORMS = ["xhamster", "x", "tiktok", "facebook"] as const;
const DELIVERY_POLICY_PLATFORMS = new Set<Platform>(["xhamster"]);

export interface LocoLoaderProviderOptions {
  enabled?: boolean;
  fetchImpl?: ProviderFetch;
  now?: () => number;
  approvedPlatforms?: readonly Platform[];
  deliveryVerifiedPlatforms?: readonly Platform[];
  requestBudget?: LocoLoaderRequestBudget;
}

/** Reproduces the short-lived key used by the public LocoLoader form. */
export function createLocoLoaderKey(sourceUrl: string, timestamp = Date.now()): string {
  const suffix = String(timestamp);
  return [...sourceUrl].map((character, index) =>
    character !== "t" && character !== ":" && character !== "/" && index % 2 === 1
      ? character
      : suffix[index] ?? ""
  ).join("");
}

function numberFrom(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number.parseInt(value, 10);
  return null;
}

function reviewedMediaUrl(value: unknown, platform: Platform): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 16_384) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    // Only xHamster's CDN has an audited Delivery boundary today. Other LocoLoader
    // platforms remain Lab capabilities until their real CDN hosts receive policies.
    if (platform !== "xhamster" || url.protocol !== "https:" || url.username || url.password || url.port ||
      hostname === "xhcdn.com" || !hostname.endsWith(".xhcdn.com") || !/\.mp4$/i.test(url.pathname)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function valueFromLink(link: unknown): { url: unknown; quality: unknown } | null {
  if (typeof link === "string") return { url: link, quality: null };
  if (!link || typeof link !== "object") return null;
  const record = link as Record<string, unknown>;
  return {
    url: record.url ?? record.link_url ?? record.link ?? record.download ?? record.href,
    quality: record.quality ?? record.file_quality ?? record.resolution ?? record.label ?? record.file_name
  };
}

function errorForCode(code: number | null): ProviderError {
  if (code === 1 || code === 6 || code === 7 || code === 9) return new ProviderError("LocoLoader is temporarily unavailable.", "provider_unavailable", true, true);
  if (code === 8) return new ProviderError("The media is region restricted.", "geo_restricted", false, false);
  if (code === 13) return new ProviderError("LocoLoader presented an access challenge.", "provider_challenge", true, true);
  if (code === 11 || code === 12) return new ProviderError("The media is private or unavailable.", "content_private", false, false);
  if (code === 14 || code === 16) return new ProviderError("The URL is not supported by LocoLoader.", "unsupported_url", false, true);
  return new ProviderError("LocoLoader could not resolve this URL.", "provider_schema_changed", true, true);
}

export function parseLocoLoaderResponse(body: string, platform: Platform = "xhamster"): { title: string | null; thumbnailUrl: string | null; formats: ParsedFormat[] } {
  let payload: unknown;
  try { payload = JSON.parse(body); } catch {
    throw new ProviderError("LocoLoader returned an invalid response.", "provider_schema_changed", true, true);
  }
  if (!payload || typeof payload !== "object") throw new ProviderError("LocoLoader returned an invalid response.", "provider_schema_changed", true, true);
  const root = payload as Record<string, unknown>;
  if (root.err === true || root.err === 1 || root.error === true) throw errorForCode(numberFrom(root.err_num ?? root.errNum ?? root.code));
  const groups = Array.isArray(root.final_urls) ? root.final_urls : Array.isArray(root.results) ? root.results : [];
  const formats: ParsedFormat[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    if (!group || typeof group !== "object") continue;
    const record = group as Record<string, unknown>;
    const links = Array.isArray(record.links) ? record.links : Array.isArray(record.formats) ? record.formats : [];
    for (const candidate of links) {
      const value = valueFromLink(candidate);
      const url = reviewedMediaUrl(value?.url, platform);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const quality = typeof value?.quality === "string" && value.quality.trim() ? value.quality.trim().slice(0, 80) : "MP4";
      formats.push({ url, label: quality, quality, container: "mp4", hasVideo: true, hasAudio: true });
    }
  }
  if (formats.length === 0) throw new ProviderError("LocoLoader returned no reviewed MP4 resource.", "invalid_result", false, true);
  return { title: "xHamster video", thumbnailUrl: null, formats };
}

export class LocoLoaderProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  private readonly fetchImpl: ProviderFetch;
  private readonly now: () => number;
  private readonly approvedPlatforms: ReadonlySet<Platform>;
  private readonly deliveryVerifiedPlatforms: ReadonlySet<Platform>;
  private readonly requestBudget: LocoLoaderRequestBudget | null;

  constructor(options: LocoLoaderProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    const approvedPlatforms = options.approvedPlatforms ?? ["xhamster"];
    const deliveryVerifiedPlatforms = options.deliveryVerifiedPlatforms ?? ["xhamster"];
    const unsupported = [...new Set([...approvedPlatforms, ...deliveryVerifiedPlatforms])].find(
      (platform) => !SUPPORTED_PLATFORMS.includes(platform as (typeof SUPPORTED_PLATFORMS)[number])
    );
    if (unsupported) throw new Error(`LocoLoader does not support the configured platform: ${unsupported}.`);
    if (deliveryVerifiedPlatforms.some((platform) => !DELIVERY_POLICY_PLATFORMS.has(platform))) {
      throw new Error("LocoLoader has no reviewed Delivery policy for the configured platform.");
    }
    if (deliveryVerifiedPlatforms.some((platform) => !approvedPlatforms.includes(platform))) {
      throw new Error("LocoLoader delivery-verified platforms must be a subset of approved platforms.");
    }
    this.approvedPlatforms = new Set(approvedPlatforms);
    this.deliveryVerifiedPlatforms = new Set(deliveryVerifiedPlatforms);
    this.requestBudget = options.requestBudget ?? null;
    const capability = (platform: (typeof SUPPORTED_PLATFORMS)[number], status: "fixture_verified" | "canary_failed") => {
      const deliveryModes: ("redirect" | "proxy" | "temporary-object")[] =
        this.deliveryVerifiedPlatforms.has(platform) ? ["redirect"] : [];
      return {
        platform,
        priority: platform === "xhamster" ? 480 : 300,
        deliveryModes,
        verificationStatus: this.deliveryVerifiedPlatforms.has(platform) ? "delivery_verified" as const : status
      };
    };
    this.manifest = {
      id: "locoloader",
      displayName: "LocoLoader",
      kind: "site-adapter",
      enabled: options.enabled ?? false,
      regions: ["nl", "global", "canary-global"],
      timeoutMs: 55_000,
      costWeight: 90,
      platforms: [
        capability("xhamster", "fixture_verified"),
        capability("x", "fixture_verified"),
        capability("tiktok", "fixture_verified"),
        capability("facebook", "fixture_verified")
      ]
    };
  }

  async resolve(input: ResolveInput) {
    if (!SUPPORTED_PLATFORMS.includes(input.platform as (typeof SUPPORTED_PLATFORMS)[number]) || !this.approvedPlatforms.has(input.platform)) {
      throw new ProviderError("LocoLoader is not approved for this platform.", "unsupported_url", false, true);
    }
    const landingUrl = new URL("/", ORIGIN);
    const landing = await requestText(this.fetchImpl, landingUrl, {
      method: "GET", redirect: "manual", ...(input.signal ? { signal: input.signal } : {}), headers: { accept: "text/html,application/xhtml+xml" }
    }, ALLOWED_HOSTS, { maximumBytes: 512 * 1024 });
    const endpoint = new URL("/api-extract/", ORIGIN);
    const requestBody = new URLSearchParams({ url: input.canonicalUrl, key: createLocoLoaderKey(input.canonicalUrl, this.now()) });
    const permit = this.requestBudget ? await this.requestBudget.acquire() : null;
    if (this.requestBudget && !permit) {
      throw new ProviderError("LocoLoader extraction capacity is temporarily exhausted.", "provider_rate_limited", true, true);
    }
    try {
      const response = await requestText(this.fetchImpl, endpoint, {
        method: "POST", redirect: "manual", ...(input.signal ? { signal: input.signal } : {}),
        headers: {
          accept: "application/json, text/javascript, */*; q=0.01",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          origin: ORIGIN, referer: landingUrl.toString(), "x-requested-with": "XMLHttpRequest",
          ...(landing.cookie ? { cookie: landing.cookie } : {})
        }, body: requestBody
      }, ALLOWED_HOSTS, { expectedContentTypes: ["application/json", "text/javascript"], maximumBytes: 512 * 1024 });
      const parsed = parseLocoLoaderResponse(response.body, input.platform);
      if (!this.deliveryVerifiedPlatforms.has(input.platform)) {
        throw new ProviderError("LocoLoader has no reviewed Delivery policy for this platform.", "unsupported_url", false, true);
      }
      return createRedirectResolution(this.manifest.id, this.manifest.kind, input,
        { ...parsed, warnings: ["LocoLoader is an experimental Beta route with a shared upstream extraction budget."] },
        { hostPolicyId: MEDIA_HOST_POLICY_ID, maximumLifetimeMs: MAXIMUM_CANDIDATE_LIFETIME_MS });
    } finally {
      await permit?.release();
    }
  }
}
