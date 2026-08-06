import { createHash } from "node:crypto";
import { ResolveResultSchema, type ProviderKind, type ResolveResult } from "@tikdd/contracts";
import {
  assertDeliveryTargetPolicy,
  ProviderResolutionSchema,
  type ProviderResolution
} from "@tikdd/delivery-core";
import { ProviderError } from "../errors";
import type { ResolveInput } from "../index";

export type ProviderFetch = typeof fetch;

export interface ParsedFormat {
  url: string;
  label: string;
  container?: string;
  quality?: string;
  hasVideo: boolean;
  hasAudio: boolean;
}

export interface ParsedMedia {
  title: string | null;
  author?: string | null;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  formats: ParsedFormat[];
  warnings?: string[];
}

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"'
};

export function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10))
    )
    .replace(/&#x([a-f0-9]+);/gi, (_match, hexadecimal: string) =>
      String.fromCodePoint(Number.parseInt(hexadecimal, 16))
    )
    .replace(
      /&([a-z]+);/gi,
      (match, entity: string) => HTML_ENTITIES[entity.toLowerCase()] ?? match
    );
}

export function textFromHtml(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function readAttributes(value: string): ReadonlyMap<string, string> {
  const attributes = new Map<string, string>();
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;

  for (const match of value.matchAll(pattern)) {
    const name = match[1]?.toLowerCase();
    const rawValue = match[2] ?? match[3] ?? match[4];
    if (name && rawValue !== undefined) {
      attributes.set(name, decodeHtml(rawValue));
    }
  }

  return attributes;
}

export function parseClockDuration(value: string): number | null {
  const parts = value
    .trim()
    .split(":")
    .map((part) => Number.parseInt(part, 10));
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  return parts.reduce((seconds, part) => seconds * 60 + part, 0);
}

function cookiesFrom(response: Response): string {
  const cookieHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = cookieHeaders.getSetCookie?.() ?? [response.headers.get("set-cookie")].filter(Boolean);
  return values
    .map((value) => value?.split(";", 1)[0] ?? "")
    .filter(Boolean)
    .join("; ");
}

async function readBodyWithLimit(response: Response, maximumBytes: number): Promise<string> {
  const declaredLength = Number.parseInt(response.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new ProviderError(
      "The provider response exceeded the configured size limit.",
      "invalid_result",
      true,
      true
    );
  }

  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let byteCount = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    byteCount += value.byteLength;
    if (byteCount > maximumBytes) {
      await reader.cancel();
      throw new ProviderError(
        "The provider response exceeded the configured size limit.",
        "invalid_result",
        true,
        true
      );
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

function responseLooksLikeChallenge(body: string): boolean {
  return /attention required|sorry, you have been blocked|cf-turnstile|challenge-platform/i.test(body);
}

export async function requestText(
  fetchImpl: ProviderFetch,
  url: URL,
  init: RequestInit,
  allowedHosts: ReadonlySet<string>,
  maximumBytes = 2_000_000
): Promise<{ body: string; cookie: string; response: Response }> {
  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch (error) {
    if (init.signal?.aborted) {
      throw error;
    }
    throw new ProviderError(
      "The provider could not be reached.",
      "provider_unavailable",
      true,
      true
    );
  }

  let finalUrl: URL;
  try {
    finalUrl = new URL(response.url || url);
  } catch {
    throw new ProviderError("The provider returned an invalid redirect.", "invalid_result", true, true);
  }
  if (finalUrl.protocol !== "https:" || !allowedHosts.has(finalUrl.hostname.toLowerCase())) {
    throw new ProviderError(
      "The provider redirected outside its allowlist.",
      "invalid_result",
      false,
      true
    );
  }

  const body = await readBodyWithLimit(response, maximumBytes);
  if (response.status === 429) {
    throw new ProviderError("The provider rate limit was reached.", "provider_rate_limited", true, true);
  }
  if (response.status === 401) {
    throw new ProviderError("The provider requires authentication.", "authentication_required", false, false);
  }
  if (response.status === 403 || responseLooksLikeChallenge(body)) {
    throw new ProviderError("The provider presented an access challenge.", "provider_challenge", true, true);
  }
  if (response.status >= 500) {
    throw new ProviderError("The provider is temporarily unavailable.", "provider_unavailable", true, true);
  }
  if (!response.ok) {
    throw new ProviderError("The provider endpoint changed.", "provider_schema_changed", true, true);
  }

  return { body, cookie: cookiesFrom(response), response };
}

function normalizedContainer(format: ParsedFormat): string {
  const explicit = format.container?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (explicit) {
    return explicit.slice(0, 24);
  }

  const labelMatch = format.label.toLowerCase().match(/\b(mp4|webm|m4a|mp3)\b/);
  if (labelMatch?.[1]) {
    return labelMatch[1];
  }

  try {
    const extension = new URL(format.url).pathname.toLowerCase().match(/\.([a-z0-9]{2,8})$/)?.[1];
    return extension ?? (format.hasVideo ? "mp4" : "mp3");
  } catch {
    return format.hasVideo ? "mp4" : "mp3";
  }
}

function mimeTypeFor(container: string, hasVideo: boolean): string {
  if (container === "webm") {
    return hasVideo ? "video/webm" : "audio/webm";
  }
  if (container === "m4a") {
    return "audio/mp4";
  }
  if (container === "mp3") {
    return "audio/mpeg";
  }
  return hasVideo ? `video/${container}` : `audio/${container}`;
}

function safeUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function createResolveResult(
  providerId: string,
  providerKind: ProviderKind,
  input: ResolveInput,
  parsed: ParsedMedia,
  options: { deliveryPending?: boolean } = {}
): ResolveResult {
  const validFormats = parsed.formats.filter((format) => safeUrl(format.url));
  if (validFormats.length === 0) {
    throw new ProviderError(
      "The provider returned no downloadable video formats.",
      "unsupported_url",
      false,
      true
    );
  }

  const mediaId = createHash("sha256").update(input.canonicalUrl).digest("hex").slice(0, 16);
  const warnings = [...(parsed.warnings ?? [])];
  if (!parsed.title) {
    warnings.push("The provider did not return a media title.");
  }
  if (options.deliveryPending ?? true) {
    warnings.push("Media delivery persistence is not enabled for this provider yet.");
  }

  return ResolveResultSchema.parse({
    schemaVersion: "1.0",
    source: {
      platform: input.platform,
      canonicalUrl: input.canonicalUrl
    },
    media: {
      id: mediaId,
      title: parsed.title ?? `${input.platform} public media`,
      author: parsed.author ?? null,
      thumbnailUrl: safeUrl(parsed.thumbnailUrl),
      durationSeconds: parsed.durationSeconds ?? null,
      isLive: false
    },
    formats: validFormats.map((format) => {
      const container = normalizedContainer(format);
      const heightMatch = (format.quality ?? format.label).match(/\b(\d{3,4})p\b/i);
      return {
        id: `fmt_${createHash("sha256")
          .update(`${providerId}\u0000${format.url}\u0000${format.label}`)
          .digest("hex")
          .slice(0, 20)}`,
        container,
        mimeType: mimeTypeFor(container, format.hasVideo),
        quality: (format.quality ?? format.label).slice(0, 80),
        width: null,
        height: heightMatch?.[1] ? Number.parseInt(heightMatch[1], 10) : null,
        fps: null,
        bitrateKbps: null,
        estimatedBytes: null,
        videoCodec: null,
        audioCodec: null,
        hasVideo: format.hasVideo,
        hasAudio: format.hasAudio
      };
    }),
    provenance: {
      provider: providerId,
      kind: providerKind,
      cacheHit: false,
      resolvedAt: new Date().toISOString()
    },
    warnings
  });
}

export function createRedirectResolution(
  providerId: string,
  providerKind: ProviderKind,
  input: ResolveInput,
  parsed: ParsedMedia,
  options: { hostPolicyId: string; maximumLifetimeMs: number }
): ProviderResolution {
  const validFormats = parsed.formats.filter((format) => safeUrl(format.url));
  const result = createResolveResult(
    providerId,
    providerKind,
    input,
    { ...parsed, formats: validFormats },
    { deliveryPending: false }
  );
  const expiresAt = new Date(Date.now() + options.maximumLifetimeMs).toISOString();
  const resolution = ProviderResolutionSchema.parse({
    result,
    candidates: result.formats.map((format, index) => ({
      formatId: format.id,
      mode: "redirect",
      targetUrl: validFormats[index]?.url,
      hostPolicyId: options.hostPolicyId,
      expiresAt,
      secretHeaders: {}
    }))
  });
  resolution.candidates.forEach((candidate) =>
    assertDeliveryTargetPolicy({
      providerId,
      mode: candidate.mode,
      hostPolicyId: candidate.hostPolicyId,
      targetUrl: candidate.targetUrl
    })
  );
  return resolution;
}
