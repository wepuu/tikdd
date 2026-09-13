import type { ProviderFetch } from "./shared";
import type { ProviderManifest, ResolveInput, ResolverProvider } from "../index";
import { resolveFreeSite } from "./free-site";

const CONFIG = {
  origin: "https://tikvid.cc",
  landingPath: "/en1/",
  fallbackEndpointPath: "/en1/download",
  allowedHosts: new Set(["tikvid.cc", "www.tikvid.cc"]),
  platform: "tiktok",
  providerId: "tikvid",
  providerKind: "site-adapter" as const
};

export interface TikVidProviderOptions {
  enabled?: boolean;
  fetchImpl?: ProviderFetch;
}

/**
 * TikVid is intentionally resolution-only until its media host and redirect behavior receive a
 * separate review. Keeping the adapter in the manifest lets the route-policy UI preview a bounded
 * secondary while production still filters out non-deliverable capabilities.
 */
export class TikVidProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  private readonly fetchImpl: ProviderFetch;

  constructor(options: TikVidProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.manifest = {
      id: CONFIG.providerId,
      displayName: "TikVid.cc",
      kind: CONFIG.providerKind,
      enabled: options.enabled ?? false,
      regions: ["nl"],
      timeoutMs: 12_000,
      costWeight: 30,
      platforms: [{
        platform: "tiktok",
        priority: 780,
        deliveryModes: [],
        verificationStatus: "canary_failed"
      }]
    };
  }

  async resolve(input: ResolveInput) {
    return resolveFreeSite(CONFIG, input, this.fetchImpl);
  }
}
