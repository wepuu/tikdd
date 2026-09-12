import { ProviderError } from "../errors";
import type { ProviderManifest, ResolveInput, ResolverProvider } from "../index";
import {
  createRedirectResolution,
  readAttributes,
  reviewedThumbnailUrl,
  requestText,
  textFromHtml,
  type ParsedFormat,
  type ProviderFetch
} from "./shared";

const ORIGIN = "https://snaptik.monster";
const ALLOWED_HOSTS = new Set(["snaptik.monster", "www.snaptik.monster"]);
const MEDIA_HOST = "tikcdn.beubagah.com";
const MEDIA_HOSTS = new Set([MEDIA_HOST]);
const MEDIA_HOST_POLICY_ID = "snaptik-monster-tiktok-media-v1";
const MAXIMUM_CANDIDATE_LIFETIME_MS = 5 * 60 * 1000;
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";

export interface SnapTikMonsterProviderOptions {
  enabled?: boolean;
  fetchImpl?: ProviderFetch;
}

function csrfToken(html: string): string {
  for (const match of html.matchAll(/<input\b([^>]*)>/gi)) {
    const attributes = readAttributes(match[1] ?? "");
    if (attributes.get("name")?.toLowerCase() !== "_csrf") continue;
    const token = attributes.get("value") ?? "";
    if (/^[A-Za-z0-9._~-]{8,256}$/.test(token)) return token;
  }
  throw new ProviderError(
    "SnapTik changed its form token schema.",
    "provider_schema_changed",
    true,
    true
  );
}

function mapContentFailure(html: string): void {
  if (/(?:video|post|content)\s+(?:is\s+)?private|private\s+(?:video|post)/i.test(html)) {
    throw new ProviderError("The TikTok post is private.", "content_private", false, false);
  }
  if (/(?:video|post|content)[^<]{0,60}(?:not found|does not exist|removed|unavailable)/i.test(html)) {
    throw new ProviderError("The TikTok post is unavailable.", "content_not_found", false, false);
  }
  if (/invalid\s+(?:tiktok\s+)?(?:url|link)|unsupported/i.test(html)) {
    throw new ProviderError("SnapTik does not support this TikTok URL.", "unsupported_url", false, true);
  }
}

function parseSnapTikHtml(html: string): {
  title: string | null;
  thumbnailUrl: string | null;
  formats: ParsedFormat[];
} {
  const formats: ParsedFormat[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attributes = readAttributes(match[1] ?? "");
    const href = attributes.get("href");
    const label = textFromHtml(match[2] ?? "");
    if (!href || !/^https:\/\//i.test(href) || !/download/i.test(label) || /\b(mp3|audio)\b/i.test(label)) {
      continue;
    }

    let target: URL;
    try {
      target = new URL(href);
    } catch {
      continue;
    }
    if (target.hostname.toLowerCase() !== MEDIA_HOST || seen.has(target.toString())) continue;
    seen.add(target.toString());
    const quality = label.match(/\b(?:\d{3,4}p|hd|original|source)\b/i)?.[0] ?? "Original";
    formats.push({
      url: target.toString(),
      label: label || "Download video",
      container: "mp4",
      quality,
      hasVideo: true,
      hasAudio: true
    });
  }

  if (formats.length === 0) {
    mapContentFailure(html);
    throw new ProviderError(
      "SnapTik returned no reviewed MP4 resource.",
      "invalid_result",
      true,
      true
    );
  }

  let title: string | null = null;
  for (const match of html.matchAll(/<(?:h1|h2|h3|p)\b([^>]*)>([\s\S]*?)<\/(?:h1|h2|h3|p)>/gi)) {
    const attributes = readAttributes(match[1] ?? "");
    if (!/(?:title|caption|description|nickname)/i.test(attributes.get("class") ?? "") &&
        !/(?:title|caption|description|nickname)/i.test(attributes.get("id") ?? "")) {
      continue;
    }
    title = textFromHtml(match[2] ?? "") || null;
    if (title) break;
  }

  let thumbnailUrl: string | null = null;
  for (const match of html.matchAll(/<(?:img|video)\b([^>]*)>/gi)) {
    const attributes = readAttributes(match[1] ?? "");
    thumbnailUrl = reviewedThumbnailUrl(
      attributes.get("src") ?? attributes.get("poster"),
      MEDIA_HOSTS
    );
    if (thumbnailUrl) break;
  }

  return { title, thumbnailUrl, formats };
}

export class SnapTikMonsterProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  private readonly fetchImpl: ProviderFetch;

  constructor(options: SnapTikMonsterProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.manifest = {
      id: "snaptik-monster",
      displayName: "SnapTik Monster",
      kind: "site-adapter",
      enabled: options.enabled ?? false,
      regions: ["nl", "global", "canary-global"],
      timeoutMs: 15_000,
      costWeight: 20,
      platforms: [{
        platform: "tiktok",
        priority: 850,
        deliveryModes: ["redirect"],
        verificationStatus: "delivery_verified"
      }]
    };
  }

  async resolve(input: ResolveInput) {
    if (input.platform !== "tiktok") {
      throw new ProviderError("SnapTik only accepts TikTok URLs.", "unsupported_url", false, true);
    }

    const landingUrl = new URL("/", ORIGIN);
    const landing = await requestText(
      this.fetchImpl,
      landingUrl,
      {
        method: "GET",
        redirect: "follow",
        ...(input.signal ? { signal: input.signal } : {}),
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": BROWSER_USER_AGENT
        }
      },
      ALLOWED_HOSTS,
      { expectedContentTypes: ["text/html", "application/xhtml+xml"], maximumBytes: 1_000_000 }
    );

    const token = csrfToken(landing.body);
    const result = await requestText(
      this.fetchImpl,
      landingUrl,
      {
        method: "POST",
        redirect: "manual",
        ...(input.signal ? { signal: input.signal } : {}),
        headers: {
          accept: "text/html,application/xhtml+xml",
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          "user-agent": BROWSER_USER_AGENT,
          origin: ORIGIN,
          referer: landingUrl.toString(),
          "hx-request": "true",
          "hx-target": "target",
          ...(landing.cookie ? { cookie: landing.cookie } : {})
        },
        body: new URLSearchParams({ _csrf: token, url: input.canonicalUrl })
      },
      ALLOWED_HOSTS,
      { expectedContentTypes: ["text/html", "application/xhtml+xml"], maximumBytes: 1_500_000 }
    );

    const parsed = parseSnapTikHtml(result.body);
    return createRedirectResolution(
      this.manifest.id,
      this.manifest.kind,
      input,
      {
        ...parsed,
        warnings: ["SnapTik Monster is limited to public TikTok videos."]
      },
      { hostPolicyId: MEDIA_HOST_POLICY_ID, maximumLifetimeMs: MAXIMUM_CANDIDATE_LIFETIME_MS }
    );
  }
}
