import type { Platform } from "@tikdd/contracts";

const SUPPORTED_PLATFORMS = ["xhamster", "dailymotion"] as const;

export interface NineXBuddyActivationConfiguration {
  enabled: boolean;
  automationUseApproved: boolean;
  deliveryAuditApproved: boolean;
  approvedPlatforms: readonly Platform[];
  deliveryVerifiedPlatforms: readonly Platform[];
  maxConcurrency: number;
  minIntervalMs: number;
}

function parseList(value: string | undefined, variableName: string, fallback: readonly Platform[]): Platform[] {
  const values = (value ?? fallback.join(",")).split(",").map((item) => item.trim()).filter(Boolean);
  const unique = [...new Set(values)];
  const unsupported = unique.find((platform) => !SUPPORTED_PLATFORMS.includes(platform as (typeof SUPPORTED_PLATFORMS)[number]));
  if (unsupported) throw new Error(`${variableName} contains unsupported platform: ${unsupported}.`);
  return unique as Platform[];
}

function boundedInteger(environment: NodeJS.ProcessEnv, name: string, fallback: number, minimum: number, maximum: number): number {
  const value = Number.parseInt(environment[name] ?? String(fallback), 10);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} is outside its allowed range.`);
  }
  return value;
}

export function loadNineXBuddyActivationConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): NineXBuddyActivationConfiguration {
  const configuration = {
    enabled: (environment.ENABLE_9XBUDDY_PROVIDER ?? "false") === "true",
    automationUseApproved: (environment.NINE_X_BUDDY_AUTOMATION_USE_APPROVED ?? "false") === "true",
    deliveryAuditApproved: (environment.NINE_X_BUDDY_DELIVERY_AUDIT_APPROVED ?? "false") === "true",
    approvedPlatforms: parseList(environment.NINE_X_BUDDY_APPROVED_PLATFORMS, "NINE_X_BUDDY_APPROVED_PLATFORMS", ["xhamster"]),
    deliveryVerifiedPlatforms: parseList(environment.NINE_X_BUDDY_DELIVERY_VERIFIED_PLATFORMS, "NINE_X_BUDDY_DELIVERY_VERIFIED_PLATFORMS", ["xhamster"]),
    maxConcurrency: boundedInteger(environment, "NINE_X_BUDDY_MAX_CONCURRENCY", 1, 1, 4),
    minIntervalMs: boundedInteger(environment, "NINE_X_BUDDY_MIN_INTERVAL_MS", 2_000, 0, 60_000)
  };
  if (configuration.enabled && !configuration.automationUseApproved) {
    throw new Error("NINE_X_BUDDY_AUTOMATION_USE_APPROVED must be true before enabling 9xBuddy.");
  }
  if (configuration.enabled && !configuration.deliveryAuditApproved) {
    throw new Error("NINE_X_BUDDY_DELIVERY_AUDIT_APPROVED must be true before enabling 9xBuddy.");
  }
  if (configuration.deliveryVerifiedPlatforms.some((platform) => platform !== "xhamster")) {
    throw new Error("NINE_X_BUDDY_DELIVERY_VERIFIED_PLATFORMS may only contain xhamster until a platform policy is audited.");
  }
  if (configuration.deliveryVerifiedPlatforms.some((platform) => !configuration.approvedPlatforms.includes(platform))) {
    throw new Error("NINE_X_BUDDY_DELIVERY_VERIFIED_PLATFORMS must be a subset of NINE_X_BUDDY_APPROVED_PLATFORMS.");
  }
  return configuration;
}
