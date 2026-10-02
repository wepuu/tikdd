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
  if (input.providerId === "pinterest-videodownloader") {
    return false;
  }
  if (input.providerId === "viddown-net") {
    return false;
  }
  if (input.providerId === "vidomon") {
    return false;
  }
  if (input.providerId === "savefromins") {
    return false;
  }
  if (input.providerId === "locoloader") {
    return false;
  }
  if (input.providerId === "9xbuddy") {
    return false;
  }
  if (input.providerId === "getxhamster") {
    return false;
  }
  if (input.providerId === "snapyt-app") {
    return false;
  }
  if (input.providerId === "noadsdl") {
    return false;
  }
  if (input.providerId === "cobalt-selfhosted") {
    return false;
  }
  if (input.providerId === "ytdlp-isolated") {
    return false;
  }
  return true;
}

/** The API queue includes the initial run in this count. */
export function resolveJobAttemptsForPlatform(platform: string): number {
  if (platform === "instagram") return 1;
  if (platform === "facebook" || platform === "pinterest") return 1;
  if (platform === "xhamster") return 1;
  if (platform === "youtube") return 1;
  if (platform === "odnoklassniki") return 1;
  if (platform === "dailymotion") return 1;
  return 3;
}
