export interface SnapTikActivationConfiguration {
  enabled: boolean;
  termsApproved: boolean;
  deliveryAuditApproved: boolean;
}
export function loadSnapTikActivationConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): SnapTikActivationConfiguration {
  const configuration = {
    enabled: (environment.ENABLE_SNAPTIK_MONSTER_PROVIDER ?? "false") === "true",
    termsApproved: (environment.SNAPTIK_MONSTER_TERMS_APPROVED ?? "false") === "true",
    deliveryAuditApproved:
      (environment.SNAPTIK_MONSTER_DELIVERY_AUDIT_APPROVED ?? "false") === "true"
  };

  if (configuration.enabled && !configuration.termsApproved) {
    throw new Error(
      "SNAPTIK_MONSTER_TERMS_APPROVED must be true before enabling the SnapTik Monster adapter."
    );
  }
  if (configuration.enabled && !configuration.deliveryAuditApproved) {
    throw new Error(
      "SNAPTIK_MONSTER_DELIVERY_AUDIT_APPROVED must be true before enabling the SnapTik Monster adapter."
    );
  }

  return configuration;
}
