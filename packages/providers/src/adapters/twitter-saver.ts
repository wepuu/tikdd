import { z } from "zod";
import { ProviderError } from "../errors";
import type { ProviderManifest, ResolveInput, ResolverProvider } from "../index";
import {
  createRedirectResolution,
  parseClockDuration,
  readAttributes,
  requestText,
  textFromHtml,
  type ParsedFormat,
  type ProviderFetch
} from "./shared";

const ORIGIN = "https://twittersaver.net";
const ALLOWED_HOSTS = new Set(["twittersaver.net"]);
const ResponseSchema = z.object({
  status: z.string(),
  statusCode: z.number().optional(),
  msg: z.string().nullish(),
  data: z.string().nullish()
});

export interface TwitterSaverProviderOptions {
  enabled?: boolean;
  fetchImpl?: ProviderFetch;
}

function parseTwitterSaverHtml(html: string): {
  title: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  formats: ParsedFormat[];
} {
  const titleMatch = html.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i);
  const imageMatch = html.match(/<img\b([^>]*)>/i);
  const durationMatch = titleMatch
    ? html.slice((titleMatch.index ?? 0) + titleMatch[0].length).match(/<p\b[^>]*>\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*<\/p>/i)
    : null;
  const formats: ParsedFormat[] = [];

  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attributes = readAttributes(match[1] ?? "");
    const label = textFromHtml(match[2] ?? "");
    const href = attributes.get("href");
    if (!href || !/download\s+mp4/i.test(label)) {
      continue;
    }
    formats.push({
      url: href,
      label,
      container: "mp4",
      quality: label.replace(/^download\s+mp4\s*/i, "").replace(/[()]/g, "").trim() || "MP4",
      hasVideo: true,
      hasAudio: true
    });
  }

  return {
    title: titleMatch?.[1] ? textFromHtml(titleMatch[1]) : null,
    thumbnailUrl: imageMatch?.[1] ? readAttributes(imageMatch[1]).get("src") ?? null : null,
    durationSeconds: durationMatch?.[1] ? parseClockDuration(durationMatch[1]) : null,
    formats
  };
}

export class TwitterSaverProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  private readonly fetchImpl: ProviderFetch;

  constructor(options: TwitterSaverProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.manifest = {
      id: "twittersaver",
      displayName: "TwitterSaver",
      kind: "site-adapter",
      enabled: options.enabled ?? false,
      regions: ["*"],
      timeoutMs: 15_000,
      costWeight: 10,
      platforms: [{ platform: "x", priority: 900 }]
    };
  }

  async resolve(input: ResolveInput) {
    if (input.platform !== "x") {
      throw new ProviderError("TwitterSaver only accepts X URLs.", "unsupported_url", false, true);
    }

    const landingUrl = new URL("/en", ORIGIN);
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

    if (/cf-turnstile/i.test(landing.body)) {
      throw new ProviderError(
        "TwitterSaver requires an interactive challenge.",
        "provider_challenge",
        true,
        true
      );
    }

    const requestBody = new URLSearchParams({
      q: input.canonicalUrl,
      lang: "en",
      cftoken: ""
    });
    const search = await requestText(
      this.fetchImpl,
      new URL("/api/ajaxSearch", ORIGIN),
      {
        method: "POST",
        redirect: "error",
        ...(input.signal ? { signal: input.signal } : {}),
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          origin: ORIGIN,
          referer: landingUrl.toString(),
          "x-requested-with": "XMLHttpRequest",
          ...(landing.cookie ? { cookie: landing.cookie } : {})
        },
        body: requestBody
      },
      ALLOWED_HOSTS
    );

    let payload: z.infer<typeof ResponseSchema>;
    try {
      payload = ResponseSchema.parse(JSON.parse(search.body));
    } catch {
      throw new ProviderError(
        "TwitterSaver changed its response schema.",
        "provider_schema_changed",
        true,
        true
      );
    }

    if (payload.status !== "ok" || !payload.data) {
      const message = payload.msg?.slice(0, 300) || "TwitterSaver could not resolve this URL.";
      throw new ProviderError(message, "unsupported_url", false, true);
    }

    const parsed = parseTwitterSaverHtml(payload.data);
    return createRedirectResolution(
      this.manifest.id,
      this.manifest.kind,
      input,
      {
        ...parsed,
        warnings: ["TwitterSaver is approved for public X posts only."]
      },
      { hostPolicyId: "twittersaver-media-v1", maximumLifetimeMs: 10 * 60 * 1_000 }
    );
  }
}
