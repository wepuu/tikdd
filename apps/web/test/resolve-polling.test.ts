import { describe, expect, it } from "vitest";
import {
  RESOLVE_POLL_INTERVAL_MS,
  RESOLVE_POLL_MAX_ATTEMPTS,
  RESOLVE_POLL_WINDOW_MS
} from "../lib/resolve-polling";

describe("resolve polling budget", () => {
  it("outlives the bounded Instagram route without changing polling cadence", () => {
    expect(RESOLVE_POLL_INTERVAL_MS).toBe(750);
    expect(RESOLVE_POLL_MAX_ATTEMPTS).toBe(80);
    expect(RESOLVE_POLL_WINDOW_MS).toBe(60_000);
    expect(RESOLVE_POLL_WINDOW_MS).toBeGreaterThan(45_000);
  });
});
