import type { ResolveTask } from "@tikdd/contracts";

export function formatMediaDuration(durationSeconds: number | null): string | null {
  if (durationSeconds === null) return null;
  const totalSeconds = Math.round(durationSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function publicResultTitle(
  result: NonNullable<ResolveTask["result"]>,
  fallbackTitle: string
): string {
  const title = result.media.title.trim();
  if (result.provenance.kind === "mock" || /\b(development|provider|adapter)\b/i.test(title)) {
    return fallbackTitle;
  }
  return title;
}
