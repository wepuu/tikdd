import type { Platform } from "@tikdd/contracts";
import { parseCobaltPlatformConfiguration } from "@tikdd/providers";

export interface CobaltActivationConfiguration {
  enabled: boolean;
  licenseAcknowledged: boolean;
  deliveryAuditApproved: boolean;
  approvedPlatforms: readonly Platform[];
  deliveryVerifiedPlatforms: readonly Platform[];
  apiUrl: string;
  maxConcurrency: number;
  minIntervalMs: number;
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Cobalt budget value must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
}

export function loadCobaltActivationConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): CobaltActivationConfiguration {
  const { approvedPlatforms, deliveryVerifiedPlatforms } = parseCobaltPlatformConfiguration({
    approvedPlatforms: environment.COBALT_APPROVED_PLATFORMS,
    deliveryVerifiedPlatforms: environment.COBALT_DELIVERY_VERIFIED_PLATFORMS
  });
  const enabled = (environment.ENABLE_COBALT_PROVIDER ?? "false") === "true";
  const configuration = {
    enabled,
    licenseAcknowledged: (environment.COBALT_LICENSE_ACKNOWLEDGED ?? "false") === "true",
    deliveryAuditApproved: (environment.COBALT_DELIVERY_AUDIT_APPROVED ?? "false") === "true",
    approvedPlatforms,
    deliveryVerifiedPlatforms,
    apiUrl: environment.COBALT_API_URL ?? "http://cobalt-api:9000/",
    maxConcurrency: boundedInteger(environment.COBALT_MAX_CONCURRENCY, 1, 1, 1),
    minIntervalMs: boundedInteger(environment.COBALT_MIN_INTERVAL_MS, 1_000, 0, 60_000)
  };
  if (enabled && !configuration.licenseAcknowledged) {
    throw new Error("COBALT_LICENSE_ACKNOWLEDGED must be true before enabling Cobalt.");
  }
  if (enabled && !configuration.deliveryAuditApproved) {
    throw new Error("COBALT_DELIVERY_AUDIT_APPROVED must be true before enabling Cobalt.");
  }
  return configuration;
}
