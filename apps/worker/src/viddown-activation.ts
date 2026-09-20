export interface VidDownActivationConfiguration {
  enabled: boolean;
  termsApproved: boolean;
  deliveryAuditApproved: boolean;
}

export function loadVidDownActivationConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): VidDownActivationConfiguration {
  const configuration = {
    enabled: (environment.ENABLE_VIDDOWN_PROVIDER ?? "false") === "true",
    termsApproved: (environment.VIDDOWN_TERMS_APPROVED ?? "false") === "true",
    deliveryAuditApproved: (environment.VIDDOWN_DELIVERY_AUDIT_APPROVED ?? "false") === "true"
  };
  if (configuration.enabled && !configuration.termsApproved) {
    throw new Error("VIDDOWN_TERMS_APPROVED must be true before enabling VidDown.");
  }
  if (configuration.enabled && !configuration.deliveryAuditApproved) {
    throw new Error("VIDDOWN_DELIVERY_AUDIT_APPROVED must be true before enabling VidDown.");
  }
  return configuration;
}
