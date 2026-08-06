import type { Platform, ProviderAttempt, ProviderFailureCode } from "@tikdd/contracts";

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly failureCode: ProviderFailureCode,
    readonly retryable: boolean,
    readonly fallbackAllowed: boolean
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export class ProviderRoutingError extends Error {
  constructor(
    message: string,
    readonly failureCode: ProviderFailureCode,
    readonly retryable: boolean,
    readonly attempts: readonly ProviderAttempt[]
  ) {
    super(message);
    this.name = "ProviderRoutingError";
  }
}

export class NoProviderAvailableError extends ProviderRoutingError {
  constructor(platform: Platform) {
    super(
      `No enabled and healthy provider is available for ${platform}.`,
      "provider_unavailable",
      true,
      []
    );
    this.name = "NoProviderAvailableError";
  }
}

