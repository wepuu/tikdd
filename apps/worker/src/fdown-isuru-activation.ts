export interface FDownIsuruActivationConfiguration {
  enabled: boolean;
  termsApproved: boolean;
  deliveryAuditApproved: boolean;
}

export function loadFDownIsuruActivationConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): FDownIsuruActivationConfiguration {
  const configuration = {
    enabled: (environment.ENABLE_FDOWN_ISURU_PROVIDER ?? "false") === "true",
    termsApproved: (environment.FDOWN_ISURU_TERMS_APPROVED ?? "false") === "true",
    deliveryAuditApproved: (environment.FDOWN_ISURU_DELIVERY_AUDIT_APPROVED ?? "false") === "true"
  };
  if (configuration.enabled && !configuration.termsApproved) {
    throw new Error("FDOWN_ISURU_TERMS_APPROVED must be true before enabling FDown Isuru.");
  }
  if (configuration.enabled && !configuration.deliveryAuditApproved) {
    throw new Error("FDOWN_ISURU_DELIVERY_AUDIT_APPROVED must be true before enabling FDown Isuru.");
  }
  return configuration;
}
