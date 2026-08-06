import type { Platform } from "@tikdd/contracts";
import { ProviderResolutionSchema } from "@tikdd/delivery-core";
import { ProviderError } from "../errors";
import type { ProviderManifest, ResolveInput, ResolverProvider } from "../index";
import {
  createResolveResult,
  readAttributes,
  requestText,
  textFromHtml,
  type ParsedFormat,
  type ProviderFetch
} from "./shared";

const ORIGIN = "https://dlpanda.com";
const ALLOWED_HOSTS = new Set(["dlpanda.com", "www.dlpanda.com"]);
const PLATFORM_PATHS: Readonly<Partial<Record<Platform, string>>> = {
  tiktok: "/",
  douyin: "/douyin",
  x: "/t",
  xiaohongshu: "/rednote",
  bilibili: "/bl",
  weibo: "/weibo",
  vimeo: "/vimeo",
  facebook: "/fb",
  snapchat: "/snapchat",
  pinterest: "/pinterest",
  xigua: "/xigua",
  oasis: "/oasis"
};

export interface DLPandaProviderOptions {
  enabled?: boolean;
  fetchImpl?: ProviderFetch;
}

function attributeValue(html: string, name: string): string | null {
  for (const match of html.matchAll(/<(?:input|meta)\b([^>]*)>/gi)) {
    const attributes = readAttributes(match[1] ?? "");
    if (attributes.get("name")?.toLowerCase() === name.toLowerCase()) {
      return attributes.get("value") ?? attributes.get("content") ?? null;
    }
  }
  return null;
}

function parseDLPandaHtml(html: string): {
  title: string | null;
  thumbnailUrl: string | null;
  formats: ParsedFormat[];
} {
  const formats: ParsedFormat[] = [];

  for (const match of html.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const attributes = readAttributes(match[2] ?? "");
    const label = textFromHtml(match[3] ?? "");
    const url = attributes.get("data-download-url") ?? attributes.get("href");
    const className = attributes.get("class") ?? "";
    const downloadName = attributes.get("data-download-name") ?? "";
    const isDownloadControl =
      attributes.has("data-download-url") ||
      (/download/i.test(className) && /^https?:\/\//i.test(url ?? ""));
    if (!url || !isDownloadControl || !/^https?:\/\//i.test(url)) {
      continue;
    }

    const combinedLabel = `${label} ${downloadName}`.trim();
    const isAudio = /\b(mp3|m4a|audio)\b/i.test(combinedLabel);
    const container = combinedLabel.match(/\b(mp4|webm|m4a|mp3)\b/i)?.[1]?.toLowerCase();
    formats.push({
      url,
      label: label || downloadName || "Download",
      ...(container ? { container } : {}),
      quality: combinedLabel.match(/\b\d{3,4}p\b/i)?.[0] || label || "Source",
      hasVideo: !isAudio,
      hasAudio: true
    });
  }

  const resultArea =
    html.match(
      /<(?:section|div)\b[^>]*class="[^"]*(?:download-result|result-box)[^"]*"[\s\S]*?<\/(?:section|div)>/i
    )?.[0] ?? html;
  const titleMatch = resultArea.match(
    /<(?:h1|h2|h3)\b[^>]*(?:class="[^"]*(?:media-title|video-title|result-title)[^"]*")?[^>]*>([\s\S]*?)<\/(?:h1|h2|h3)>/i
  );
  const imageMatch = resultArea.match(/<img\b([^>]*)>/i);

  return {
    title: titleMatch?.[1] ? textFromHtml(titleMatch[1]) : null,
    thumbnailUrl: imageMatch?.[1] ? readAttributes(imageMatch[1]).get("src") ?? null : null,
    formats
  };
}

export class DLPandaProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  private readonly fetchImpl: ProviderFetch;

  constructor(options: DLPandaProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.manifest = {
      id: "dlpanda",
      displayName: "DLPanda",
      kind: "site-adapter",
      enabled: options.enabled ?? false,
      regions: ["*"],
      timeoutMs: 18_000,
      costWeight: 20,
      platforms: [
        { platform: "tiktok", priority: 820 },
        { platform: "douyin", priority: 800 },
        { platform: "xiaohongshu", priority: 780 },
        { platform: "x", priority: 700 },
        { platform: "bilibili", priority: 650 },
        { platform: "weibo", priority: 620 },
        { platform: "vimeo", priority: 580 },
        { platform: "facebook", priority: 560 },
        { platform: "snapchat", priority: 540 },
        { platform: "pinterest", priority: 520 },
        { platform: "xigua", priority: 500 },
        { platform: "oasis", priority: 480 }
      ]
    };
  }

  async resolve(input: ResolveInput) {
    const path = PLATFORM_PATHS[input.platform];
    if (!path) {
      throw new ProviderError("DLPanda does not declare this platform.", "unsupported_url", false, true);
    }

    const landingUrl = new URL(path, ORIGIN);
    const landing = await requestText(
      this.fetchImpl,
      landingUrl,
      {
        method: "GET",
        redirect: "follow",
        ...(input.signal ? { signal: input.signal } : {}),
        headers: { accept: "text/html,application/xhtml+xml" }
      },
      ALLOWED_HOSTS
    );
    const token = attributeValue(landing.body, "t0ken");
    if (!token) {
      throw new ProviderError(
        "DLPanda did not expose its form token.",
        "provider_schema_changed",
        true,
        true
      );
    }

    const resultUrl = new URL(path, ORIGIN);
    resultUrl.searchParams.set("url", input.canonicalUrl);
    resultUrl.searchParams.set("t0ken", token);
    const result = await requestText(
      this.fetchImpl,
      resultUrl,
      {
        method: "GET",
        redirect: "follow",
        ...(input.signal ? { signal: input.signal } : {}),
        headers: {
          accept: "text/html,application/xhtml+xml",
          referer: landingUrl.toString(),
          ...(landing.cookie ? { cookie: landing.cookie } : {})
        }
      },
      ALLOWED_HOSTS
    );

    if (/parse error|invalid (?:url|link)|video not found/i.test(result.body)) {
      throw new ProviderError(
        "DLPanda could not resolve this public URL.",
        "unsupported_url",
        false,
        true
      );
    }
    if (/paste the (?:sessionid|sessdata)|need sessionid|require[^<]{0,40}sessdata/i.test(result.body)) {
      throw new ProviderError(
        "DLPanda requires an upstream account cookie for this URL.",
        "authentication_required",
        false,
        false
      );
    }

    const parsed = parseDLPandaHtml(result.body);
    return ProviderResolutionSchema.parse({
      result: createResolveResult(this.manifest.id, this.manifest.kind, input, {
        ...parsed,
        warnings: ["DLPanda is limited to public media that requires no account cookie."]
      }),
      candidates: []
    });
  }
}
