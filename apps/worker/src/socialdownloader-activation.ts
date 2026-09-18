import type { Platform } from "@tikdd/contracts";

const SUPPORTED_SOCIALDOWNLOADER_PLATFORMS = new Set<Platform>([
  "facebook",
  "x",
  "tiktok",
  "instagram",
  "youtube"
]);
const DELIVERY_VERIFIED_SOCIALDOWNLOADER_PLATFORMS = new Set<Platform>(["facebook", "x", "tiktok"]);

export interface SocialDownloaderActivationConfiguration {
  enabled: boolean;
  termsApproved: boolean;
  deliveryAuditApproved: boolean;
  approvedPlatforms: readonly Platform[];
  deliveryVerifiedPlatforms: readonly Platform[];
  maxConcurrency: number;
  minIntervalMs: number;
  maxCooldownMs: number;
}

export function loadSocialDownloaderActivationConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): SocialDownloaderActivationConfiguration {
  const parsePlatforms = (value: string | undefined, variableName: string): Platform[] => (value ?? "facebook")
    .split(",")
    .map((value) => value.trim())
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index)
    .map((value) => {
      if (!SUPPORTED_SOCIALDOWNLOADER_PLATFORMS.has(value as Platform)) {
        throw new Error(`${variableName} contains unsupported platform: ${value}.`);
      }
      return value as Platform;
    });
  const approvedPlatforms = parsePlatforms(environment.SOCIALDOWNLOADER_APPROVED_PLATFORMS, "SOCIALDOWNLOADER_APPROVED_PLATFORMS");
  const deliveryVerifiedPlatforms = parsePlatforms(
    environment.SOCIALDOWNLOADER_DELIVERY_VERIFIED_PLATFORMS,
    "SOCIALDOWNLOADER_DELIVERY_VERIFIED_PLATFORMS"
  );
  if (deliveryVerifiedPlatforms.some((platform) => !DELIVERY_VERIFIED_SOCIALDOWNLOADER_PLATFORMS.has(platform))) {
    throw new Error("SOCIALDOWNLOADER_DELIVERY_VERIFIED_PLATFORMS contains a platform without a reviewed Delivery policy.");
  }
  if (deliveryVerifiedPlatforms.some((platform) => !approvedPlatforms.includes(platform))) {
    throw new Error("SOCIALDOWNLOADER_DELIVERY_VERIFIED_PLATFORMS must be a subset of SOCIALDOWNLOADER_APPROVED_PLATFORMS.");
  }
  const configuration = {
    enabled: (environment.ENABLE_SOCIALDOWNLOADER_PROVIDER ?? "false") === "true",
    termsApproved: (environment.SOCIALDOWNLOADER_TERMS_APPROVED ?? "false") === "true",
    deliveryAuditApproved: (environment.SOCIALDOWNLOADER_DELIVERY_AUDIT_APPROVED ?? "false") === "true",
    approvedPlatforms,
    deliveryVerifiedPlatforms,
    maxConcurrency: boundedInteger(environment.SOCIALDOWNLOADER_MAX_CONCURRENCY, 1, 1, 16),
    minIntervalMs: boundedInteger(environment.SOCIALDOWNLOADER_MIN_INTERVAL_MS, 750, 0, 60_000),
    maxCooldownMs: boundedInteger(environment.SOCIALDOWNLOADER_MAX_COOLDOWN_MS, 60_000, 1_000, 10 * 60_000)
  };
  if (configuration.enabled && !configuration.termsApproved) {
    throw new Error("SOCIALDOWNLOADER_TERMS_APPROVED must be true before enabling SocialDownloader.");
  }
  if (configuration.enabled && !configuration.deliveryAuditApproved) {
    throw new Error(
      "SOCIALDOWNLOADER_DELIVERY_AUDIT_APPROVED must be true before enabling SocialDownloader."
    );
  }
  return configuration;
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`SocialDownloader budget value must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
}
