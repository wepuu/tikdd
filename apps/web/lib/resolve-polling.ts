import type { Platform } from "@tikdd/contracts";

export const RESOLVE_POLL_INTERVAL_MS = 750;
export const RESOLVE_POLL_MAX_ATTEMPTS = 80;
export const RESOLVE_POLL_WINDOW_MS = RESOLVE_POLL_INTERVAL_MS * RESOLVE_POLL_MAX_ATTEMPTS;
export const YOUTUBE_RESOLVE_POLL_MAX_ATTEMPTS = 120;
export const YOUTUBE_RESOLVE_POLL_WINDOW_MS =
  RESOLVE_POLL_INTERVAL_MS * YOUTUBE_RESOLVE_POLL_MAX_ATTEMPTS;

export function resolvePollMaxAttempts(platform: Platform): number {
  return platform === "youtube"
    ? YOUTUBE_RESOLVE_POLL_MAX_ATTEMPTS
    : RESOLVE_POLL_MAX_ATTEMPTS;
}
