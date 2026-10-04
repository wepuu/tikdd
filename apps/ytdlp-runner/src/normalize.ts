import {
  YtDlpRunnerResponseSchema,
  type YtDlpRunnerPlatform,
  type YtDlpRunnerResponse
} from "@tikdd/contracts";

const SAFE_HEADERS = new Map([
  ["user-agent", "User-Agent"],
  ["referer", "Referer"],
  ["origin", "Origin"]
] as const);

const THUMBNAIL_HOSTS: Readonly<Record<YtDlpRunnerPlatform, ReadonlySet<string>>> = {
  youtube: new Set(["i.ytimg.com", "img.youtube.com"]),
  dailymotion: new Set(["s1.dmcdn.net", "s2.dmcdn.net"])
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown, maximum: number): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum
    ? value.trim()
    : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function integer(value: unknown): number | null {
  const parsed = number(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function safeFormatId(value: unknown, index: number): string {
  const candidate = text(value, 160)?.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 160);
  return candidate && /^[A-Za-z0-9]/.test(candidate) ? candidate : `format-${index + 1}`;
}

function protocolFor(format: Record<string, unknown>, url: URL): "https" | "hls" | "dash" | "unknown" {
  const protocol = text(format.protocol, 80)?.toLowerCase() ?? "";
  if (protocol.includes("m3u8") || url.pathname.toLowerCase().endsWith(".m3u8")) return "hls";
  if (protocol.includes("dash") || protocol.includes("http_dash_segments")) return "dash";
  return url.protocol === "https:" ? "https" : "unknown";
}

function safeHeaders(value: unknown): Record<"User-Agent" | "Referer" | "Origin", string> {
  const source = record(value);
  const output: Partial<Record<"User-Agent" | "Referer" | "Origin", string>> = {};
  if (!source) return output as Record<"User-Agent" | "Referer" | "Origin", string>;
  for (const [name, raw] of Object.entries(source)) {
    const target = SAFE_HEADERS.get(name.toLowerCase() as "user-agent" | "referer" | "origin");
    const value = text(raw, 1_024);
    if (target && value) output[target] = value;
  }
  return output as Record<"User-Agent" | "Referer" | "Origin", string>;
}

/**
 * Keep thumbnails on the same reviewed boundary as normal media metadata.
 * The URL is optional presentation data; rejecting it must never reject media.
 */
export function reviewedYtDlpThumbnailUrl(platform: YtDlpRunnerPlatform, value: unknown): string | null {
  const candidate = text(value, 4_096);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (
      url.protocol !== "https:" || url.username || url.password || url.port ||
      !THUMBNAIL_HOSTS[platform].has(url.hostname.toLowerCase())
    ) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeYtDlpOutput(
  platform: YtDlpRunnerPlatform,
  value: unknown
): YtDlpRunnerResponse {
  const payload = record(value);
  if (!payload) throw new Error("yt-dlp returned an invalid root payload.");
  const formats = Array.isArray(payload.formats) ? payload.formats : [];
  const normalized = formats.flatMap((entry, index) => {
    const format = record(entry);
    const target = text(format?.url, 8_192);
    if (!format || !target) return [];
    let url: URL;
    try { url = new URL(target); } catch { return []; }
    if (url.protocol !== "https:" || url.username || url.password || url.port) return [];
    const vcodec = text(format.vcodec, 80);
    const acodec = text(format.acodec, 80);
    const height = integer(format.height);
    return [{
      sourceFormatId: safeFormatId(format.format_id, index),
      container: text(format.ext, 24)?.toLowerCase() ?? "unknown",
      protocol: protocolFor(format, url),
      quality: text(format.format_note, 80) ?? (height ? `${height}p` : "source"),
      width: integer(format.width),
      height,
      fps: number(format.fps),
      bitrateKbps: number(format.tbr),
      estimatedBytes: integer(format.filesize) ?? integer(format.filesize_approx),
      videoCodec: vcodec && vcodec !== "none" ? vcodec : null,
      audioCodec: acodec && acodec !== "none" ? acodec : null,
      hasVideo: Boolean(vcodec && vcodec !== "none"),
      hasAudio: Boolean(acodec && acodec !== "none"),
      targetUrl: url.toString(),
      headers: safeHeaders(format.http_headers)
    }];
  }).slice(0, 40);
  if (normalized.length === 0) throw new Error("yt-dlp returned no safe media formats.");
  return YtDlpRunnerResponseSchema.parse({
    platform,
    sourceId: text(payload.id, 200) ?? "unknown",
    title: text(payload.title, 500) ?? `${platform} media`,
    author: text(payload.uploader, 200) ?? text(payload.channel, 200),
    thumbnailUrl: reviewedYtDlpThumbnailUrl(platform, payload.thumbnail),
    durationSeconds: number(payload.duration),
    isLive: payload.is_live === true,
    extractor: text(payload.extractor_key, 100) ?? text(payload.extractor, 100) ?? platform,
    formats: normalized
  });
}
