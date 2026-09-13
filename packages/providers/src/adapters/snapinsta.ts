import type { ProviderFetch } from "./shared";
import type { ProviderManifest, ResolveInput, ResolverProvider } from "../index";
import { resolveFreeSite } from "./free-site";

const CONFIG = {
  origin: "https://snapinsta.to",
  landingPath: "/en46",
  fallbackEndpointPath: "/en46",
  allowedHosts: new Set(["snapinsta.to", "www.snapinsta.to"]),
  platform: "instagram",
  providerId: "snapinsta",
  providerKind: "site-adapter" as const
};

export interface SnapInstaProviderOptions {
  enabled?: boolean;
  fetchImpl?: ProviderFetch;
}

/**
 * SnapInsta is kept resolution-only until an exact media host policy and redirect canary are
 * reviewed. It can participate in development fallback tests but cannot receive production traffic.
 */
export class SnapInstaProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  private readonly fetchImpl: ProviderFetch;

  constructor(options: SnapInstaProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.manifest = {
      id: CONFIG.providerId,
      displayName: "SnapInsta.to",
      kind: CONFIG.providerKind,
      enabled: options.enabled ?? false,
      regions: ["nl"],
      timeoutMs: 12_000,
      costWeight: 30,
      platforms: [{
        platform: "instagram",
        priority: 820,
        deliveryModes: [],
        verificationStatus: "fixture_verified"
      }]
    };
  }

  async resolve(input: ResolveInput) {
    return resolveFreeSite(CONFIG, input, this.fetchImpl);
  }
}
