export interface LocoLoaderActivationConfiguration {
  enabled: boolean;
  termsApproved: boolean;
  deliveryAuditApproved: boolean;
}

export function loadLocoLoaderActivationConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): LocoLoaderActivationConfiguration {
  const configuration = {
    enabled: (environment.ENABLE_LOCOLOADER_PROVIDER ?? "false") === "true",
    termsApproved: (environment.LOCOLOADER_TERMS_APPROVED ?? "false") === "true",
    deliveryAuditApproved: (environment.LOCOLOADER_DELIVERY_AUDIT_APPROVED ?? "false") === "true"
  };
  if (configuration.enabled && !configuration.termsApproved) {
    throw new Error("LOCOLOADER_TERMS_APPROVED must be true before enabling LocoLoader.");
  }
  if (configuration.enabled && !configuration.deliveryAuditApproved) {
    throw new Error("LOCOLOADER_DELIVERY_AUDIT_APPROVED must be true before enabling LocoLoader.");
  }
  return configuration;
}
