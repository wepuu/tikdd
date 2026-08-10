export interface SSSTwitterActivationConfiguration {
  enabled: boolean;
  termsApproved: boolean;
  deliveryAuditApproved: boolean;
}

export function loadSSSTwitterActivationConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): SSSTwitterActivationConfiguration {
  const configuration = {
    enabled: (environment.ENABLE_SSSTWITTER_PROVIDER ?? "false") === "true",
    termsApproved: (environment.SSSTWITTER_TERMS_APPROVED ?? "false") === "true",
    deliveryAuditApproved:
      (environment.SSSTWITTER_DELIVERY_AUDIT_APPROVED ?? "false") === "true"
  };

  if (configuration.enabled && !configuration.termsApproved) {
    throw new Error(
      "SSSTWITTER_TERMS_APPROVED must be true before enabling the SSSTwitter adapter."
    );
  }
  if (configuration.enabled && !configuration.deliveryAuditApproved) {
    throw new Error(
      "SSSTWITTER_DELIVERY_AUDIT_APPROVED must be true before enabling the SSSTwitter adapter."
    );
  }

  return configuration;
}
