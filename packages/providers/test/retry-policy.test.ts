import { describe, expect, it } from "vitest";
import {
  resolveJobAttemptsForPlatform,
  shouldAutomaticallyRetryProviderFailure
} from "../src/retry-policy";

describe("provider automatic retry policy", () => {
  it("limits Instagram SaveFromIns jobs to one retry", () => {
    expect(resolveJobAttemptsForPlatform("instagram")).toBe(2);
    expect(resolveJobAttemptsForPlatform("x")).toBe(3);
  });

  it.each(["provider_unavailable", "provider_timeout"] as const)(
    "allows one automatic retry for transient Instagram failure %s",
    (failureCode) => {
      expect(shouldAutomaticallyRetryProviderFailure({
        platform: "instagram",
        providerId: "savefromins",
        failureCode
      })).toBe(true);
    }
  );

  it.each([
    "provider_rate_limited",
    "provider_challenge",
    "provider_schema_changed",
    "invalid_result",
    "content_not_found"
  ] as const)("does not automatically retry Instagram failure %s", (failureCode) => {
    expect(shouldAutomaticallyRetryProviderFailure({
      platform: "instagram",
      providerId: "savefromins",
      failureCode
    })).toBe(false);
  });

  it("leaves X and other providers on the existing retry policy", () => {
    expect(shouldAutomaticallyRetryProviderFailure({
      platform: "x",
      providerId: "ssstwitter",
      failureCode: "provider_schema_changed"
    })).toBe(true);
    expect(shouldAutomaticallyRetryProviderFailure({
      platform: "instagram",
      providerId: "other-provider",
      failureCode: "provider_schema_changed"
    })).toBe(true);
  });
});
