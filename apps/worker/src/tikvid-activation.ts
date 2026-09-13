export interface TikVidActivationConfiguration {
  enabled: boolean;
  termsApproved: boolean;
  deliveryAuditApproved: boolean;
}

export function loadTikVidActivationConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): TikVidActivationConfiguration {
  const configuration = {
    enabled: (environment.ENABLE_TIKVID_PROVIDER ?? "false") === "true",
    termsApproved: (environment.TIKVID_TERMS_APPROVED ?? "false") === "true",
    deliveryAuditApproved: (environment.TIKVID_DELIVERY_AUDIT_APPROVED ?? "false") === "true"
  };
  if (configuration.enabled && !configuration.termsApproved) {
    throw new Error("TIKVID_TERMS_APPROVED must be true before enabling the TikVid adapter.");
  }
  if (configuration.enabled && !configuration.deliveryAuditApproved) {
    throw new Error("TIKVID_DELIVERY_AUDIT_APPROVED must be true before enabling the TikVid adapter.");
  }
  return configuration;
}
