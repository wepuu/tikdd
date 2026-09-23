import { describe, expect, it } from "vitest";
import {
  resolveJobAttemptsForPlatform,
  shouldAutomaticallyRetryProviderFailure
} from "../src/retry-policy";

describe("provider automatic retry policy", () => {
  it("limits Instagram jobs to one execution", () => {
    expect(resolveJobAttemptsForPlatform("instagram")).toBe(1);
    expect(resolveJobAttemptsForPlatform("x")).toBe(3);
    expect(resolveJobAttemptsForPlatform("facebook")).toBe(1);
    expect(resolveJobAttemptsForPlatform("pinterest")).toBe(1);
  });

  it.each(["provider_unavailable", "provider_timeout"] as const)(
    "does not automatically replay transient SaveFromIns failure %s",
    (failureCode) => {
      expect(shouldAutomaticallyRetryProviderFailure({
        platform: "instagram",
        providerId: "savefromins",
        failureCode
      })).toBe(false);
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

  it("does not replay SaveFromIns even when a mismatched platform reaches the policy", () => {
    expect(shouldAutomaticallyRetryProviderFailure({
      platform: "x",
      providerId: "savefromins",
      failureCode: "provider_timeout"
    })).toBe(false);
  });

  it.each([
    "provider_unavailable",
    "provider_timeout",
    "provider_rate_limited",
    "provider_challenge",
    "provider_schema_changed",
    "invalid_result"
  ] as const)("does not replay FDown Isuru after %s", (failureCode) => {
    expect(shouldAutomaticallyRetryProviderFailure({
      platform: "facebook",
      providerId: "fdown-isuru",
      failureCode
    })).toBe(false);
  });

  it.each([
    "provider_unavailable",
    "provider_timeout",
    "provider_rate_limited",
    "provider_challenge",
    "provider_schema_changed",
    "invalid_result"
  ] as const)("does not replay SocialDownloader after %s", (failureCode) => {
    expect(shouldAutomaticallyRetryProviderFailure({
      platform: "facebook",
      providerId: "socialdownloader-space",
      failureCode
    })).toBe(false);
  });

  it.each([
    "provider_unavailable",
    "provider_timeout",
    "provider_rate_limited",
    "provider_challenge",
    "provider_schema_changed",
    "invalid_result"
  ] as const)("does not replay Pinterest Video Downloader after %s", (failureCode) => {
    expect(shouldAutomaticallyRetryProviderFailure({
      platform: "pinterest",
      providerId: "pinterest-videodownloader",
      failureCode
    })).toBe(false);
  });

  it.each([
    "provider_unavailable",
    "provider_timeout",
    "provider_rate_limited",
    "provider_challenge",
    "provider_schema_changed",
    "invalid_result"
  ] as const)("does not replay VidDown after %s", (failureCode) => {
    expect(shouldAutomaticallyRetryProviderFailure({
      platform: "vimeo",
      providerId: "viddown-net",
      failureCode
    })).toBe(false);
  });
});
