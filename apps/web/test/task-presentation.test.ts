import type { ResolveTask, TaskError } from "@tikdd/contracts";
import { describe, expect, it } from "vitest";
import { isDeliveryExpired, publicFailureIntent } from "../lib/task-presentation";

const baseTask: ResolveTask = {
  id: `tsk_${"a".repeat(32)}`,
  status: "failed",
  platform: "x",
  canonicalUrl: "https://x.com/tikddqa/status/1234567890",
  result: null,
  error: { code: "PROVIDER_UNAVAILABLE", message: "Unavailable", retryable: true },
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:01.000Z",
  expiresAt: "2026-08-10T00:10:00.000Z"
};

describe("public task presentation", () => {
  it("keeps retryable infrastructure failures distinct from unavailable content", () => {
    expect(publicFailureIntent(baseTask, null)).toBe("retryable");
    expect(publicFailureIntent({
      ...baseTask,
      error: { code: "CONTENT_PRIVATE", message: "Private", retryable: false }
    }, null)).toBe("unavailable");
  });

  it("presents an expired task without relying on provider details", () => {
    expect(publicFailureIntent({ ...baseTask, status: "expired", error: null }, null)).toBe("expired");
  });

  it("classifies admission errors using their public retry intent", () => {
    const admissionError: TaskError = {
      code: "DUPLICATE_IN_PROGRESS",
      message: "Duplicate",
      retryable: true
    };
    expect(publicFailureIntent(null, admissionError)).toBe("retryable");
  });

  it("treats invalid or elapsed delivery expiry values as expired", () => {
    const now = Date.parse("2026-08-10T00:01:00.000Z");
    expect(isDeliveryExpired("2026-08-10T00:00:59.999Z", now)).toBe(true);
    expect(isDeliveryExpired("2026-08-10T00:01:00.001Z", now)).toBe(false);
    expect(isDeliveryExpired("not-a-date", now)).toBe(true);
  });
});
