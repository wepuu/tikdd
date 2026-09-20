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

const API_ORIGIN = "https://pinterest-videodownloader.com";
const API_HOSTS = new Set(["pinterest-videodownloader.com"]);
const MEDIA_HOSTS = new Set(["v1.pinimg.com"]);
const MEDIA_HOST_POLICY_ID = "pinterest-videodownloader-pinterest-media-v1";
const MAXIMUM_CANDIDATE_LIFETIME_MS = 5 * 60 * 1000;

const ExpandResponseSchema = z.object({
  url: z.string().url().max(8_192)
}).passthrough();

const optionalUrl = (maximum: number) => z.preprocess(
  (value) => value === "" ? null : value,
  z.string().url().max(maximum).nullable().optional()
);

const PinResponseSchema = z.object({
  type: z.string().max(40).nullish(),
  _type: z.string().max(40).nullish(),
  title: z.string().max(1_000).nullish(),
  author_name: z.string().max(500).nullish(),
  thumbnail_url: optionalUrl(8_192),
  video_url: optionalUrl(16_384)
}).passthrough();

export interface PinterestVideoDownloaderProviderOptions {
  enabled?: boolean;
  fetchImpl?: ProviderFetch;
}

function extractPinId(value: string): string | null {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/pin\/(\d+)(?:\/|$)/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function reviewedMediaUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !MEDIA_HOSTS.has(url.hostname.toLowerCase()) ||
      !/\.mp4(?:$|[?#])/i.test(url.pathname)
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function parsePinResponse(body: string): {
  title: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  formats: ParsedFormat[];
} {
  let payload: z.infer<typeof PinResponseSchema>;
  try {
    payload = PinResponseSchema.parse(JSON.parse(body));
  } catch {
    throw new ProviderError(
      "Pinterest Video Downloader returned an invalid response.",
      "provider_schema_changed",
      true,
      true
    );
  }

  const mediaUrl = payload.video_url ? reviewedMediaUrl(payload.video_url) : null;
  // The upstream currently returns an oEmbed-style `type: "rich"` with `_type: "video"`.
  // The media URL is the authoritative signal; optional type metadata must not make a valid
  // MP4 unusable when the provider omits or changes it.
  if (!mediaUrl) {
    throw new ProviderError(
      "Pinterest Video Downloader returned no reviewed MP4 resource.",
      "invalid_result",
      false,
      true
    );
  }

  return {
    title: payload.title ?? null,
    author: payload.author_name ?? null,
    thumbnailUrl: reviewedThumbnailUrl(payload.thumbnail_url, new Set(["i.pinimg.com"])),
    formats: [{
      url: mediaUrl,
      label: "Source MP4",
      container: "mp4",
      quality: "Source",
      hasVideo: true,
      hasAudio: true
    }]
  };
}

export function parsePinterestVideoDownloaderResponse(body: string) {
  return parsePinResponse(body);
}

export class PinterestVideoDownloaderProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  private readonly fetchImpl: ProviderFetch;

  constructor(options: PinterestVideoDownloaderProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.manifest = {
      id: "pinterest-videodownloader",
      displayName: "Pinterest Video Downloader",
      kind: "api",
      enabled: options.enabled ?? false,
      regions: ["nl", "global", "canary-global"],
      timeoutMs: 15_000,
      costWeight: 35,
      platforms: [{
        platform: "pinterest",
        priority: 760,
        deliveryModes: ["redirect"],
        verificationStatus: "delivery_verified"
      }]
    };
  }

  async resolve(input: ResolveInput) {
    if (input.platform !== "pinterest") {
      throw new ProviderError(
        "Pinterest Video Downloader only accepts Pinterest URLs.",
        "unsupported_url",
        false,
        true
      );
    }

    let pinId = extractPinId(input.canonicalUrl);
    if (!pinId) {
      let expandedResponse: { url: string };
      const expandUrl = new URL("/api/expand", API_ORIGIN);
      expandUrl.searchParams.set("url", input.canonicalUrl);
      const expanded = await requestText(
        this.fetchImpl,
        expandUrl,
        {
          method: "GET",
          redirect: "manual",
          ...(input.signal ? { signal: input.signal } : {}),
          headers: { accept: "application/json" }
        },
        API_HOSTS,
        { expectedContentTypes: ["application/json"], maximumBytes: 64_000 }
      );
      try {
        expandedResponse = ExpandResponseSchema.parse(JSON.parse(expanded.body));
      } catch {
        throw new ProviderError(
          "Pinterest Video Downloader could not expand this Pinterest URL.",
          "unsupported_url",
          false,
          true
        );
      }
      pinId = extractPinId(expandedResponse.url);
    }
    if (!pinId) {
      throw new ProviderError(
        "Pinterest Video Downloader does not support this Pinterest URL.",
        "unsupported_url",
        false,
        true
      );
    }

    const endpoint = new URL("/api/pin", API_ORIGIN);
    endpoint.searchParams.set("id", pinId);
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
      { expectedContentTypes: ["application/json"], maximumBytes: 256_000 }
    );
    const parsed = parsePinResponse(response.body);
    return ProviderResolutionSchema.parse(createRedirectResolution(
      this.manifest.id,
      this.manifest.kind,
      input,
      { ...parsed, warnings: ["Pinterest support is an experimental Beta route."] },
      { hostPolicyId: MEDIA_HOST_POLICY_ID, maximumLifetimeMs: MAXIMUM_CANDIDATE_LIFETIME_MS }
    ));
  }
}
