import { ProviderError } from "../errors";
import type { ProviderManifest, ResolveInput, ResolverProvider } from "../index";
import {
  createRedirectResolution,
  readAttributes,
  requestText,
  textFromHtml,
  type ParsedFormat,
  type ProviderFetch
} from "./shared";

const ORIGIN = "https://ssstwitter.com";
const ALLOWED_HOSTS = new Set(["ssstwitter.com", "www.ssstwitter.com"]);
const MEDIA_HOST_POLICY_ID = "ssstwitter-media-v1";
const MAXIMUM_CANDIDATE_LIFETIME_MS = 4 * 60 * 1000;

export interface SSSTwitterQualificationEvidence {
  candidateHosts: readonly string[];
}

export interface SSSTwitterProviderOptions {
  enabled?: boolean;
  fetchImpl?: ProviderFetch;
}

function formValue(source: string, name: string): string | null {
  const pattern = new RegExp(`(?:^|,)\\s*${name}\\s*:\\s*(?:'([^']*)'|"([^"]*)"|([^,\\s]+))`, "i");
  const match = source.match(pattern);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function parseForm(html: string): { tt: string; ts: string; source: string } {
  const formMatch = html.match(/<form\b([^>]*)>/i);
  const attributes = formMatch?.[1] ? readAttributes(formMatch[1]) : null;
  const includeValues = attributes?.get("include-vals") ?? attributes?.get("data-include-vals");
  const tt = includeValues ? formValue(includeValues, "tt") : null;
  const ts = includeValues ? formValue(includeValues, "ts") : null;
  const source = includeValues ? formValue(includeValues, "source") : null;
  if (!tt || !ts || !source || !/^\d{8,16}$/.test(ts)) {
    throw new ProviderError(
      "SSSTwitter changed its form token schema.",
      "provider_schema_changed",
      true,
      true
    );
  }
  return { tt, ts, source };
}

function resultScope(html: string): string {
  const opening = /<([a-z][\w:-]*)\b[^>]*\bid=(?:"result"|'result'|result)[^>]*>/i.exec(html);
  const tagName = opening?.[1];
  if (!opening || !tagName || opening.index === undefined) {
    throw new ProviderError(
      "SSSTwitter did not return its result container.",
      "provider_schema_changed",
      true,
      true
    );
  }

  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
  tagPattern.lastIndex = opening.index;
  let depth = 0;
  for (let match = tagPattern.exec(html); match; match = tagPattern.exec(html)) {
    const token = match[0];
    if (/^<\//.test(token)) {
      depth -= 1;
      if (depth === 0) {
        return html.slice(opening.index, tagPattern.lastIndex);
      }
    } else if (!/\/>$/.test(token)) {
      depth += 1;
    }
  }

  throw new ProviderError(
    "SSSTwitter returned an incomplete result container.",
    "provider_schema_changed",
    true,
    true
  );
}

function parseResult(html: string): {
  title: string | null;
  formats: ParsedFormat[];
  candidateHosts: readonly string[];
} {
  const scopedHtml = resultScope(html);
  if (/private (?:post|tweet|account)|protected (?:post|tweet|account)/i.test(scopedHtml)) {
    throw new ProviderError(
      "The X post is private.",
      "content_private",
      false,
      false
    );
  }
  if (/tweet (?:was )?(?:deleted|not found)|post (?:was )?(?:deleted|not found)/i.test(scopedHtml)) {
    throw new ProviderError(
      "The X post is unavailable.",
      "content_not_found",
      false,
      false
    );
  }
  if (/not available in (?:your|this) (?:country|region)|geo(?:graphically)? restricted/i.test(scopedHtml)) {
    throw new ProviderError(
      "The X post is region restricted.",
      "geo_restricted",
      false,
      false
    );
  }

  const formats: ParsedFormat[] = [];
  const candidateHosts = new Set<string>();
  for (const match of scopedHtml.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attributes = readAttributes(match[1] ?? "");
    const href = attributes.get("href");
    const label = textFromHtml(match[2] ?? "");
    if (!href || !/^https:\/\//i.test(href) || !/download|\bmp4\b|\b\d{3,4}p\b/i.test(label)) {
      continue;
    }
    let target: URL;
    try {
      target = new URL(href);
    } catch {
      continue;
    }
    if (ALLOWED_HOSTS.has(target.hostname.toLowerCase())) {
      continue;
    }
    const isAudio = /\b(mp3|m4a|audio)\b/i.test(label);
    const container = label.match(/\b(mp4|webm|m4a|mp3)\b/i)?.[1]?.toLowerCase();
    formats.push({
      url: target.toString(),
      label: label || "Download",
      ...(container ? { container } : {}),
      quality: label.match(/\b\d{3,4}p\b/i)?.[0] ?? (label || "Source"),
      hasVideo: !isAudio,
      hasAudio: true
    });
    candidateHosts.add(target.hostname.toLowerCase());
  }

  const titleMatch = scopedHtml.match(
    /<(?:h1|h2|h3)\b[^>]*(?:class="[^"]*(?:title|result)[^"]*")?[^>]*>([\s\S]*?)<\/(?:h1|h2|h3)>/i
  );
  return {
    title: titleMatch?.[1] ? textFromHtml(titleMatch[1]) : null,
    formats,
    candidateHosts: [...candidateHosts].sort()
  };
}

export class SSSTwitterProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  private readonly fetchImpl: ProviderFetch;
  private qualificationEvidence: SSSTwitterQualificationEvidence | null = null;

  constructor(options: SSSTwitterProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.manifest = {
      id: "ssstwitter",
      displayName: "SSSTwitter",
      kind: "site-adapter",
      enabled: options.enabled ?? false,
      regions: ["global", "canary-global"],
      timeoutMs: 18_000,
      costWeight: 15,
      platforms: [{ platform: "x", priority: 800, deliveryModes: ["redirect"], verificationStatus: "delivery_verified" }]
    };
  }

  consumeQualificationEvidence(): SSSTwitterQualificationEvidence | null {
    const evidence = this.qualificationEvidence;
    this.qualificationEvidence = null;
    return evidence;
  }

  async resolve(input: ResolveInput) {
    this.qualificationEvidence = null;
    if (input.platform !== "x") {
      throw new ProviderError("SSSTwitter only accepts X URLs.", "unsupported_url", false, true);
    }

    const landingUrl = new URL("/", ORIGIN);
    const landing = await requestText(
      this.fetchImpl,
      landingUrl,
      {
        method: "GET",
        redirect: "follow",
        ...(input.signal ? { signal: input.signal } : {}),
        headers: { accept: "text/html,application/xhtml+xml" }
      },
      ALLOWED_HOSTS,
      { expectedContentTypes: ["text/html", "application/xhtml+xml"] }
    );
    const form = parseForm(landing.body);
    const requestBody = new URLSearchParams({
      id: input.canonicalUrl,
      locale: "en",
      tt: form.tt,
      ts: form.ts,
      source: form.source
    });
    const result = await requestText(
      this.fetchImpl,
      landingUrl,
      {
        method: "POST",
        redirect: "follow",
        ...(input.signal ? { signal: input.signal } : {}),
        headers: {
          accept: "text/html,application/xhtml+xml",
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          "hx-current-url": landingUrl.toString(),
          "hx-request": "true",
          "hx-target": "target",
          origin: ORIGIN,
          referer: landingUrl.toString(),
          ...(landing.cookie ? { cookie: landing.cookie } : {})
        },
        body: requestBody
      },
      ALLOWED_HOSTS,
      { expectedContentTypes: ["text/html", "application/xhtml+xml"] }
    );
    const parsed = parseResult(result.body);
    this.qualificationEvidence = { candidateHosts: parsed.candidateHosts };
    try {
      return createRedirectResolution(
        this.manifest.id,
        this.manifest.kind,
        input,
        {
          title: parsed.title,
          formats: parsed.formats,
          warnings: ["SSSTwitter production rollout is not approved."]
        },
        {
          hostPolicyId: MEDIA_HOST_POLICY_ID,
          maximumLifetimeMs: MAXIMUM_CANDIDATE_LIFETIME_MS
        }
      );
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      throw new ProviderError(
        "SSSTwitter returned a delivery target outside its reviewed policy.",
        "invalid_result",
        true,
        true
      );
    }
  }
}
