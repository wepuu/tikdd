import type { Platform } from "@tikdd/contracts";
import type { YtDlpDeliveryCapability } from "@tikdd/providers";

const SUPPORTED = new Set(["dailymotion", "youtube"]);
export interface YtDlpActivationConfiguration {
  enabled: boolean; runtimeApproved: boolean; deliveryAuditApproved: boolean;
  approvedPlatforms: readonly Platform[];
  deliveryVerifiedCapabilities: Readonly<Record<string, YtDlpDeliveryCapability>>;
  apiUrl: string;
}
export function loadYtDlpActivationConfiguration(environment: NodeJS.ProcessEnv = process.env): YtDlpActivationConfiguration {
  const approvedPlatforms = (environment.YTDLP_APPROVED_PLATFORMS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (approvedPlatforms.some((platform) => !SUPPORTED.has(platform))) throw new Error("YTDLP_APPROVED_PLATFORMS contains an unsupported platform.");
  const capabilities: Record<string, YtDlpDeliveryCapability> = {};
  for (const entry of (environment.YTDLP_DELIVERY_VERIFIED_CAPABILITIES ?? "").split(",").map((value) => value.trim()).filter(Boolean)) {
    const [platform, capability, extra] = entry.split(":");
    if (extra || !platform || !SUPPORTED.has(platform) || !["direct", "relay"].includes(capability ?? "")) throw new Error("YTDLP_DELIVERY_VERIFIED_CAPABILITIES is invalid.");
    capabilities[platform] = capability as YtDlpDeliveryCapability;
  }
  const configuration = { enabled: environment.ENABLE_YTDLP_PROVIDER === "true", runtimeApproved: environment.YTDLP_RUNTIME_APPROVED === "true",
    deliveryAuditApproved: environment.YTDLP_DELIVERY_AUDIT_APPROVED === "true", approvedPlatforms: approvedPlatforms as Platform[],
    deliveryVerifiedCapabilities: capabilities, apiUrl: environment.YTDLP_RUNNER_API_URL ?? "http://ytdlp-runner:9100/" };
  if (configuration.enabled && (!configuration.runtimeApproved || !configuration.deliveryAuditApproved)) throw new Error("yt-dlp runtime and delivery audit gates must be approved before activation.");
  if (configuration.enabled && (approvedPlatforms.length === 0 || Object.keys(capabilities).length === 0)) throw new Error("yt-dlp activation requires an approved platform and delivery capability.");
  return configuration;
}
