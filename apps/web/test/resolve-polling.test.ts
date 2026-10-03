import { describe, expect, it } from "vitest";
import {
  DAILYMOTION_RESOLVE_POLL_MAX_ATTEMPTS,
  DAILYMOTION_RESOLVE_POLL_WINDOW_MS,
  RESOLVE_POLL_INTERVAL_MS,
  RESOLVE_POLL_MAX_ATTEMPTS,
  RESOLVE_POLL_WINDOW_MS,
  YOUTUBE_RESOLVE_POLL_MAX_ATTEMPTS,
  YOUTUBE_RESOLVE_POLL_WINDOW_MS,
  resolvePollMaxAttempts
} from "../lib/resolve-polling";

describe("resolve polling budget", () => {
  it("outlives the bounded Instagram route without changing polling cadence", () => {
    expect(RESOLVE_POLL_INTERVAL_MS).toBe(750);
    expect(RESOLVE_POLL_MAX_ATTEMPTS).toBe(80);
    expect(RESOLVE_POLL_WINDOW_MS).toBe(60_000);
    expect(RESOLVE_POLL_WINDOW_MS).toBeGreaterThan(45_000);
  });

  it("keeps polling through the bounded YouTube primary and fallback route", () => {
    expect(YOUTUBE_RESOLVE_POLL_MAX_ATTEMPTS).toBe(120);
    expect(YOUTUBE_RESOLVE_POLL_WINDOW_MS).toBe(90_000);
    expect(YOUTUBE_RESOLVE_POLL_WINDOW_MS).toBeGreaterThan(75_000);
    expect(resolvePollMaxAttempts("youtube")).toBe(YOUTUBE_RESOLVE_POLL_MAX_ATTEMPTS);
    expect(resolvePollMaxAttempts("instagram")).toBe(RESOLVE_POLL_MAX_ATTEMPTS);
  });

  it("keeps polling through the bounded Dailymotion artifact preparation", () => {
    expect(DAILYMOTION_RESOLVE_POLL_WINDOW_MS).toBe(195_000);
    expect(DAILYMOTION_RESOLVE_POLL_WINDOW_MS).toBeGreaterThan(180_000);
    expect(resolvePollMaxAttempts("dailymotion")).toBe(DAILYMOTION_RESOLVE_POLL_MAX_ATTEMPTS);
  });
});
