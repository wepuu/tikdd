import type { MediaFormat, ResolveTask } from "@tikdd/contracts";

const MAX_FILENAME_LENGTH = 120;
const SAFE_CONTAINER_EXTENSIONS = new Set(["mp4", "webm", "m4a", "mp3"]);

function cleanPart(value: string, fallback: string, maximumLength = 48): string {
  const cleaned = value
    .normalize("NFKC")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, maximumLength)
    .replace(/^[._-]+|[._-]+$/g, "");
  return cleaned || fallback;
}

function sourceIdFor(task: Pick<ResolveTask, "platform" | "canonicalUrl" | "id">): string {
  const patterns = task.platform === "x"
    ? [/(?:x|twitter)\.com\/[^/]+\/status\/([0-9]+)/i]
    : task.platform === "instagram"
      ? [/instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/i]
      : [];

  for (const pattern of patterns) {
    const match = task.canonicalUrl.match(pattern)?.[1];
    if (match) return cleanPart(match, "media");
  }
  return cleanPart(task.id.replace(/^tsk_/, "").slice(-8), "media", 16);
}

function extensionFor(format: Pick<MediaFormat, "container" | "hasVideo">): string {
  const candidate = format.container.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (SAFE_CONTAINER_EXTENSIONS.has(candidate)) return candidate;
  return format.hasVideo ? "mp4" : "mp3";
}

/**
 * Returns a browser download-name hint. Cross-origin redirects may cause the
 * browser/CDN to choose a different name; this function never exposes a URL.
 */
export function suggestedDownloadFilename(
  task: Pick<ResolveTask, "platform" | "canonicalUrl" | "id">,
  format: Pick<MediaFormat, "container" | "quality" | "hasVideo">
): string {
  const platform = task.platform === "x"
    ? "X"
    : task.platform === "instagram"
      ? "Instagram"
      : cleanPart(task.platform, "Media", 24);
  const sourceId = sourceIdFor(task);
  const quality = cleanPart(format.quality, "Original", 24);
  const extension = extensionFor(format);
  const base = `TikDD-${platform}-${sourceId}-${quality}`;
  const availableBaseLength = Math.max(1, MAX_FILENAME_LENGTH - extension.length - 1);
  return `${base.slice(0, availableBaseLength).replace(/[._-]+$/g, "")}.${extension}`;
}
