export interface SaveFromInsActivationConfiguration {
  enabled: boolean;
  termsApproved: boolean;
  deliveryAuditApproved: boolean;
  requestAuth: string;
}

export function loadSaveFromInsActivationConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): SaveFromInsActivationConfiguration {
  const configuration = {
    enabled: (environment.ENABLE_SAVEFROMINS_PROVIDER ?? "false") === "true",
    termsApproved: (environment.SAVEFROMINS_TERMS_APPROVED ?? "false") === "true",
    deliveryAuditApproved:
      (environment.SAVEFROMINS_DELIVERY_AUDIT_APPROVED ?? "false") === "true",
    requestAuth: environment.SAVEFROMINS_REQUEST_AUTH ?? ""
  };
  if (configuration.enabled && !configuration.termsApproved) {
    throw new Error("SAVEFROMINS_TERMS_APPROVED must be true before enabling SaveFromIns.");
  }
  if (configuration.enabled && !configuration.deliveryAuditApproved) {
    throw new Error(
      "SAVEFROMINS_DELIVERY_AUDIT_APPROVED must be true before enabling SaveFromIns."
    );
  }
  if (configuration.enabled && !/^[A-Za-z0-9]{8,80}$/.test(configuration.requestAuth)) {
    throw new Error("SAVEFROMINS_REQUEST_AUTH must be configured before enabling SaveFromIns.");
  }
  return configuration;
}
