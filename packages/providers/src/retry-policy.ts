import type { ProviderFailureCode } from "@tikdd/contracts";

/**
 * Provider queue retries are deliberately narrow. Providers that expose a
 * bounded sequential fallback should not be replayed by BullMQ after the
 * router has already recorded its attempt ledger.
 */
export function shouldAutomaticallyRetryProviderFailure(input: {
  platform: string;
  providerId: string | null;
  failureCode: ProviderFailureCode;
}): boolean {
  if (input.providerId === "fdown-isuru") {
    return false;
  }
  if (input.providerId === "socialdownloader-space") {
    return false;
  }
  if (input.platform !== "instagram" || input.providerId !== "savefromins") {
    return true;
  }
  return input.failureCode === "provider_unavailable" || input.failureCode === "provider_timeout";
}

/** The API queue includes the initial run in this count. */
export function resolveJobAttemptsForPlatform(platform: string): number {
  if (platform === "instagram") return 2;
  if (platform === "facebook") return 1;
  return 3;
}
