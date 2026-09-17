export interface SocialDownloaderActivationConfiguration {
  enabled: boolean;
  termsApproved: boolean;
  deliveryAuditApproved: boolean;
}

export function loadSocialDownloaderActivationConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): SocialDownloaderActivationConfiguration {
  const configuration = {
    enabled: (environment.ENABLE_SOCIALDOWNLOADER_PROVIDER ?? "false") === "true",
    termsApproved: (environment.SOCIALDOWNLOADER_TERMS_APPROVED ?? "false") === "true",
    deliveryAuditApproved: (environment.SOCIALDOWNLOADER_DELIVERY_AUDIT_APPROVED ?? "false") === "true"
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
