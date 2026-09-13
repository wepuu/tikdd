export interface TikCDActivationConfiguration {
  enabled: boolean;
  termsApproved: boolean;
  deliveryAuditApproved: boolean;
}

export function loadTikCDActivationConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): TikCDActivationConfiguration {
  const configuration = {
    enabled: (environment.ENABLE_TIKCD_PROVIDER ?? "false") === "true",
    termsApproved: (environment.TIKCD_TERMS_APPROVED ?? "false") === "true",
    deliveryAuditApproved: (environment.TIKCD_DELIVERY_AUDIT_APPROVED ?? "false") === "true"
  };
  if (configuration.enabled && !configuration.termsApproved) {
    throw new Error("TIKCD_TERMS_APPROVED must be true before enabling the TikCD adapter.");
  }
  if (configuration.enabled && !configuration.deliveryAuditApproved) {
    throw new Error("TIKCD_DELIVERY_AUDIT_APPROVED must be true before enabling the TikCD adapter.");
  }
  return configuration;
}
