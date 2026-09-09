import type { ProviderFailureCode } from "@tikdd/contracts";

/**
 * Instagram is currently backed by a single site adapter. Keep its automatic
 * retry budget small and only spend it on transport/availability failures;
 * the user can still manually retry other retryable outcomes.
 */
export function shouldAutomaticallyRetryProviderFailure(input: {
  platform: string;
  providerId: string | null;
  failureCode: ProviderFailureCode;
}): boolean {
  if (input.platform !== "instagram" || input.providerId !== "savefromins") {
    return true;
  }
  return input.failureCode === "provider_unavailable" || input.failureCode === "provider_timeout";
}

/** The API queue includes the initial run in this count. */
export function resolveJobAttemptsForPlatform(platform: string): number {
  return platform === "instagram" ? 2 : 3;
}
