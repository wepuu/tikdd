import { z } from "zod";
import { ProviderError } from "../errors";
import type { ResolveInput, ResolverProvider, ProviderManifest } from "../index";
import {
  createRedirectResolution,
  requestText,
  type ParsedFormat,
  type ProviderFetch
} from "./shared";

const API_ORIGIN = "https://tikwm.com";
const API_PATH = "/api/";
const API_HOSTS = new Set(["tikwm.com"]);
const MEDIA_HOSTS = new Set<string>();
const MEDIA_HOST_SUFFIX = "tiktokcdn-us.com";
const MEDIA_HOST_POLICY_ID = "tikcd-tiktok-media-v1";
const MAXIMUM_CANDIDATE_LIFETIME_MS = 5 * 60 * 1000;
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";

const ResponseSchema = z.object({
  code: z.number().int(),
  msg: z.string().max(500).nullish(),
  data: z.object({
    id: z.union([z.string(), z.number()]).nullish(),
    title: z.string().max(1_000).nullish(),
    play: z.string().url().nullish(),
    hdplay: z.string().url().nullish(),
    wmplay: z.string().url().nullish(),
    cover: z.string().url().nullish(),
    ai_dynamic_cover: z.string().url().nullish()
  }).passthrough().nullish()
}).passthrough();

export interface TikCDProviderOptions {
  enabled?: boolean;
  fetchImpl?: ProviderFetch;
}

function isReviewedMediaUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 16_384) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      (MEDIA_HOSTS.has(host) || host.endsWith(`.${MEDIA_HOST_SUFFIX}`)) &&
      (url.searchParams.get("mime_type")?.toLowerCase() === "video_mp4" ||
        /\.mp4(?:$|[?#])/i.test(url.pathname));
  } catch {
    return false;
  }
}

function parseResponse(body: string): { title: string | null; thumbnailUrl: string | null; formats: ParsedFormat[] } {
  let parsed: z.infer<typeof ResponseSchema>;
  try {
    parsed = ResponseSchema.parse(JSON.parse(body));
  } catch {
    throw new ProviderError("TikCD returned an invalid API response.", "provider_schema_changed", true, true);
  }
  if (parsed.code !== 0 || !parsed.data) {
    const message = parsed.msg ?? "TikCD could not resolve this TikTok URL.";
    if (/private|not found|removed|unavailable/i.test(message)) {
      throw new ProviderError("The TikTok post is unavailable.", "content_not_found", false, false);
    }
    throw new ProviderError("TikCD could not resolve this TikTok URL.", "provider_unavailable", true, true);
  }

  const values = [parsed.data.hdplay, parsed.data.play, parsed.data.wmplay].filter(isReviewedMediaUrl);
  const formats: ParsedFormat[] = [];
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (seen.has(value)) continue;
    seen.add(value);
    formats.push({
      url: value,
      label: index === 0 ? "HD MP4" : "MP4",
      container: "mp4",
      quality: index === 0 ? "HD" : "Source",
      hasVideo: true,
      hasAudio: true
    });
  }
  if (formats.length === 0) {
    throw new ProviderError("TikCD returned no reviewed MP4 resource.", "invalid_result", true, true);
  }
  return {
    title: parsed.data.title ?? null,
    // TikCD cover URLs are intentionally not exposed until thumbnail delivery receives its own
    // host review. Download candidates remain encrypted internal delivery data.
    thumbnailUrl: null,
    formats
  };
}

export class TikCDProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  private readonly fetchImpl: ProviderFetch;

  constructor(options: TikCDProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.manifest = {
      id: "tikcd",
      displayName: "TikCD.com",
      kind: "api",
      enabled: options.enabled ?? false,
      regions: ["nl", "global", "canary-global"],
      timeoutMs: 15_000,
      costWeight: 35,
      platforms: [{
        platform: "tiktok",
        priority: 760,
        deliveryModes: ["redirect"],
        verificationStatus: "delivery_verified"
      }]
    };
  }

  async resolve(input: ResolveInput) {
    if (input.platform !== "tiktok") {
      throw new ProviderError("TikCD only accepts TikTok URLs.", "unsupported_url", false, true);
    }
    const endpoint = new URL(API_PATH, API_ORIGIN);
    endpoint.searchParams.set("url", input.canonicalUrl);
    endpoint.searchParams.set("hd", "1");
    const response = await requestText(
      this.fetchImpl,
      endpoint,
      {
        method: "GET",
        redirect: "manual",
        ...(input.signal ? { signal: input.signal } : {}),
        headers: {
          accept: "application/json",
          "user-agent": BROWSER_USER_AGENT
        }
      },
      API_HOSTS,
      { expectedContentTypes: ["application/json"], maximumBytes: 512_000 }
    );
    const parsed = parseResponse(response.body);
    return createRedirectResolution(
      this.manifest.id,
      this.manifest.kind,
      input,
      { ...parsed, warnings: ["TikCD is an experimental secondary TikTok Provider."] },
      { hostPolicyId: MEDIA_HOST_POLICY_ID, maximumLifetimeMs: MAXIMUM_CANDIDATE_LIFETIME_MS }
    );
  }
}
