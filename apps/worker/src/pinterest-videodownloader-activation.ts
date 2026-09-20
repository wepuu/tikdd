export interface PinterestVideoDownloaderActivationConfiguration {
  enabled: boolean;
  termsApproved: boolean;
  deliveryAuditApproved: boolean;
}

export function loadPinterestVideoDownloaderActivationConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): PinterestVideoDownloaderActivationConfiguration {
  const configuration = {
    enabled: (environment.ENABLE_PINTEREST_VIDEODOWNLOADER_PROVIDER ?? "false") === "true",
    termsApproved: (environment.PINTEREST_VIDEODOWNLOADER_TERMS_APPROVED ?? "false") === "true",
    deliveryAuditApproved:
      (environment.PINTEREST_VIDEODOWNLOADER_DELIVERY_AUDIT_APPROVED ?? "false") === "true"
  };
  if (configuration.enabled && !configuration.termsApproved) {
    throw new Error(
      "PINTEREST_VIDEODOWNLOADER_TERMS_APPROVED must be true before enabling Pinterest Video Downloader."
    );
  }
  if (configuration.enabled && !configuration.deliveryAuditApproved) {
    throw new Error(
      "PINTEREST_VIDEODOWNLOADER_DELIVERY_AUDIT_APPROVED must be true before enabling Pinterest Video Downloader."
    );
  }
  return configuration;
}
