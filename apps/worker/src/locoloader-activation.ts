import type { Platform } from "@tikdd/contracts";

const SUPPORTED_PLATFORMS = ["xhamster", "x", "tiktok", "facebook"] as const;

export interface LocoLoaderActivationConfiguration {
  enabled: boolean;
  termsApproved: boolean;
  deliveryAuditApproved: boolean;
  approvedPlatforms: readonly Platform[];
  deliveryVerifiedPlatforms: readonly Platform[];
  maxExtractions: number;
  quotaWindowMs: number;
  maxConcurrency: number;
  minIntervalMs: number;
}

function parseList(value: string | undefined, variableName: string, fallback: readonly Platform[]): Platform[] {
  const result = (value ?? fallback.join(",")).split(",").map((item) => item.trim()).filter(Boolean);
  const unique = [...new Set(result)];
  const unsupported = unique.find((platform) => !SUPPORTED_PLATFORMS.includes(platform as (typeof SUPPORTED_PLATFORMS)[number]));
  if (unsupported) throw new Error(`${variableName} contains unsupported platform: ${unsupported}.`);
  return unique as Platform[];
}

function boundedInteger(environment: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(environment[name] ?? String(fallback), 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`${name} is outside its allowed range.`);
  return parsed;
}

export function loadLocoLoaderActivationConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): LocoLoaderActivationConfiguration {
  const configuration = {
    enabled: (environment.ENABLE_LOCOLOADER_PROVIDER ?? "false") === "true",
    termsApproved: (environment.LOCOLOADER_TERMS_APPROVED ?? "false") === "true",
    deliveryAuditApproved: (environment.LOCOLOADER_DELIVERY_AUDIT_APPROVED ?? "false") === "true",
    approvedPlatforms: parseList(environment.LOCOLOADER_APPROVED_PLATFORMS, "LOCOLOADER_APPROVED_PLATFORMS", ["xhamster"]),
    deliveryVerifiedPlatforms: parseList(environment.LOCOLOADER_DELIVERY_VERIFIED_PLATFORMS, "LOCOLOADER_DELIVERY_VERIFIED_PLATFORMS", ["xhamster"]),
    maxExtractions: boundedInteger(environment, "LOCOLOADER_MAX_EXTRACTIONS", 2, 1, 100),
    quotaWindowMs: boundedInteger(environment, "LOCOLOADER_QUOTA_WINDOW_MS", 6 * 60 * 60 * 1_000, 1_000, 24 * 60 * 60 * 1_000),
    maxConcurrency: boundedInteger(environment, "LOCOLOADER_MAX_CONCURRENCY", 1, 1, 16),
    minIntervalMs: boundedInteger(environment, "LOCOLOADER_MIN_INTERVAL_MS", 1_000, 0, 60_000)
  };
  if (configuration.enabled && !configuration.termsApproved) {
    throw new Error("LOCOLOADER_TERMS_APPROVED must be true before enabling LocoLoader.");
  }
  if (configuration.enabled && !configuration.deliveryAuditApproved) {
    throw new Error("LOCOLOADER_DELIVERY_AUDIT_APPROVED must be true before enabling LocoLoader.");
  }
  if (configuration.deliveryVerifiedPlatforms.some((platform) => platform !== "xhamster")) {
    throw new Error("LOCOLOADER_DELIVERY_VERIFIED_PLATFORMS may only contain xhamster until a platform policy is audited.");
  }
  if (configuration.deliveryVerifiedPlatforms.some((platform) => !configuration.approvedPlatforms.includes(platform))) {
    throw new Error("LOCOLOADER_DELIVERY_VERIFIED_PLATFORMS must be a subset of LOCOLOADER_APPROVED_PLATFORMS.");
  }
  return configuration;
}
