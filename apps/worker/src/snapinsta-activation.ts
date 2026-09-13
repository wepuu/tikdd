export interface SnapInstaActivationConfiguration {
  enabled: boolean;
  termsApproved: boolean;
  deliveryAuditApproved: boolean;
}

export function loadSnapInstaActivationConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): SnapInstaActivationConfiguration {
  const configuration = {
    enabled: (environment.ENABLE_SNAPINSTA_PROVIDER ?? "false") === "true",
    termsApproved: (environment.SNAPINSTA_TERMS_APPROVED ?? "false") === "true",
    deliveryAuditApproved: (environment.SNAPINSTA_DELIVERY_AUDIT_APPROVED ?? "false") === "true"
  };
  if (configuration.enabled && !configuration.termsApproved) {
    throw new Error("SNAPINSTA_TERMS_APPROVED must be true before enabling the SnapInsta adapter.");
  }
  if (configuration.enabled && !configuration.deliveryAuditApproved) {
    throw new Error("SNAPINSTA_DELIVERY_AUDIT_APPROVED must be true before enabling the SnapInsta adapter.");
  }
  return configuration;
}
