import { ProviderResolutionSchema, type ProviderResolution } from "@tikdd/delivery-core";
import { ProviderError } from "../errors";
import {
  createResolveResult,
  readAttributes,
  requestText,
  textFromHtml,
  type ParsedFormat,
  type ParsedMedia,
  type ProviderFetch
} from "./shared";
import type { ProviderKind } from "@tikdd/contracts";
import type { ResolveInput } from "../index";

export interface FreeSiteAdapterConfig {
  readonly origin: string;
  readonly landingPath: string;
  readonly fallbackEndpointPath: string;
  readonly allowedHosts: ReadonlySet<string>;
  readonly platform: string;
  readonly providerId: string;
  readonly providerKind: ProviderKind;
}

function isSafeHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}

function formDetails(html: string, origin: string, allowedHosts: ReadonlySet<string>, fallbackPath: string): {
  action: URL;
  method: "GET" | "POST";
  fields: URLSearchParams;
} {
  const formMatch = html.match(/<form\b([^>]*)>/i);
  const attributes = readAttributes(formMatch?.[1] ?? "");
  const actionValue = attributes.get("action") ?? fallbackPath;
  let action: URL;
  try {
    action = new URL(actionValue, origin);
  } catch {
    throw new ProviderError("The Provider form schema changed.", "provider_schema_changed", true, true);
  }
  if (action.protocol !== "https:" || !allowedHosts.has(action.hostname.toLowerCase())) {
    throw new ProviderError("The Provider form redirected outside its allowlist.", "invalid_result", false, true);
  }

  // HTML forms default to GET when the method attribute is omitted. Treating an omitted method as
  // POST silently diverges from browser behavior and can make a fixture-only adapter look viable.
  const method = (attributes.get("method") ?? "GET").toUpperCase() === "POST" ? "POST" : "GET";
  const fields = new URLSearchParams();
  for (const match of html.matchAll(/<input\b([^>]*)>/gi)) {
    const input = readAttributes(match[1] ?? "");
    const name = input.get("name");
    if (!name || !/^[A-Za-z0-9_.:-]{1,64}$/.test(name)) continue;
    const value = input.get("value") ?? "";
    if (value.length <= 512) fields.set(name, value);
  }
  return { action, method, fields };
}

function mapContentFailure(body: string, providerName: string): void {
  if (/(?:video|post|reel|content)\s+(?:is\s+)?private|private\s+(?:video|post|reel)/i.test(body)) {
    throw new ProviderError("The requested post is private.", "content_private", false, false);
  }
  if (/(?:video|post|reel|content)[^<]{0,80}(?:not found|does not exist|deleted|removed|unavailable)/i.test(body)) {
    throw new ProviderError("The requested post is unavailable.", "content_not_found", false, false);
  }
  if (/captcha|turnstile|challenge|access denied|blocked/i.test(body)) {
    throw new ProviderError(`${providerName} presented an access challenge.`, "provider_challenge", true, true);
  }
  if (/invalid\s+(?:url|link)|unsupported/i.test(body)) {
    throw new ProviderError(`${providerName} does not support this URL.`, "unsupported_url", false, true);
  }
}

export function parseFreeSiteResult(html: string, providerName: string): ParsedMedia {
  const formats: ParsedFormat[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<(?:a|button)\b([^>]*)>([\s\S]*?)<\/(?:a|button)>/gi)) {
    const attributes = readAttributes(match[1] ?? "");
    const candidate = attributes.get("data-download-url") ?? attributes.get("data-url") ?? attributes.get("href");
    const label = textFromHtml(match[2] ?? "");
    if (!candidate || !isSafeHttpsUrl(candidate) || seen.has(candidate)) continue;
    if (/\b(?:mp3|m4a|audio|photo|image)\b/i.test(`${label} ${candidate}`)) continue;
    if (!/\.mp4(?:[?#]|$)/i.test(candidate) && !/\b(?:mp4|video)\b/i.test(label)) continue;
    seen.add(candidate);
    const quality = label.match(/\b(?:\d{3,4}p|hd|original|source)\b/i)?.[0] ?? "Original";
    formats.push({
      url: candidate,
      label: label || "Download video",
      container: "mp4",
      quality,
      hasVideo: true,
      hasAudio: true
    });
  }

  if (formats.length === 0) {
    mapContentFailure(html, providerName);
    throw new ProviderError(
      `${providerName} returned no normalized MP4 resource.`,
      "invalid_result",
      true,
      true
    );
  }

  let title: string | null = null;
  for (const match of html.matchAll(/<(?:h1|h2|h3)\b([^>]*)>([\s\S]*?)<\/(?:h1|h2|h3)>/gi)) {
    const value = textFromHtml(match[2] ?? "");
    if (value) {
      title = value.slice(0, 500);
      break;
    }
  }
  return { title, thumbnailUrl: null, formats };
}

export async function resolveFreeSite(
  config: FreeSiteAdapterConfig,
  input: ResolveInput,
  fetchImpl: ProviderFetch
): Promise<ProviderResolution> {
  if (input.platform !== config.platform) {
    throw new ProviderError(
      `${config.providerId} does not support this platform.`,
      "unsupported_url",
      false,
      true
    );
  }

  const landingUrl = new URL(config.landingPath, config.origin);
  const landing = await requestText(
    fetchImpl,
    landingUrl,
    {
      method: "GET",
      redirect: "manual",
      ...(input.signal ? { signal: input.signal } : {}),
      headers: { accept: "text/html,application/xhtml+xml" }
    },
    config.allowedHosts,
    { expectedContentTypes: ["text/html", "application/xhtml+xml"], maximumBytes: 1_500_000 }
  );
  const form = formDetails(landing.body, config.origin, config.allowedHosts, config.fallbackEndpointPath);
  form.fields.set("url", input.canonicalUrl);
  let endpoint = new URL(form.action);
  let init: RequestInit;
  if (form.method === "GET") {
    for (const [name, value] of form.fields) endpoint.searchParams.set(name, value);
    init = {
      method: "GET",
      redirect: "manual",
      ...(input.signal ? { signal: input.signal } : {}),
      headers: { accept: "text/html,application/xhtml+xml", ...(landing.cookie ? { cookie: landing.cookie } : {}) }
    };
  } else {
    init = {
      method: "POST",
      redirect: "manual",
      ...(input.signal ? { signal: input.signal } : {}),
      headers: {
        accept: "text/html,application/xhtml+xml",
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        referer: landingUrl.toString(),
        origin: config.origin,
        ...(landing.cookie ? { cookie: landing.cookie } : {})
      },
      body: form.fields
    };
  }
  const result = await requestText(
    fetchImpl,
    endpoint,
    init,
    config.allowedHosts,
    { expectedContentTypes: ["text/html", "application/xhtml+xml"], maximumBytes: 2_000_000 }
  );
  const parsed = parseFreeSiteResult(result.body, config.providerId);
  return ProviderResolutionSchema.parse({
    result: createResolveResult(config.providerId, config.providerKind, input, parsed, { deliveryPending: true }),
    candidates: []
  });
}
