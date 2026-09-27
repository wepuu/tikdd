export interface SnapYTActivationConfiguration {
  enabled: boolean;
  termsApproved: boolean;
  deliveryAuditApproved: boolean;
  maxConcurrency: number;
  minIntervalMs: number;
}

function boundedInteger(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const value = Number.parseInt(environment[name] ?? String(fallback), 10);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} is outside its allowed range.`);
  }
  return value;
}

export function loadSnapYTActivationConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): SnapYTActivationConfiguration {
  const configuration = {
    enabled: (environment.ENABLE_SNAPYT_PROVIDER ?? "false") === "true",
    termsApproved: (environment.SNAPYT_TERMS_APPROVED ?? "false") === "true",
    deliveryAuditApproved: (environment.SNAPYT_DELIVERY_AUDIT_APPROVED ?? "false") === "true",
    maxConcurrency: boundedInteger(environment, "SNAPYT_MAX_CONCURRENCY", 1, 1, 2),
    minIntervalMs: boundedInteger(environment, "SNAPYT_MIN_INTERVAL_MS", 5_000, 0, 60_000)
  };
  if (configuration.enabled && !configuration.termsApproved) {
    throw new Error("SNAPYT_TERMS_APPROVED must be true before enabling SnapYT.");
  }
  if (configuration.enabled && !configuration.deliveryAuditApproved) {
    throw new Error("SNAPYT_DELIVERY_AUDIT_APPROVED must be true before enabling SnapYT.");
  }
  return configuration;
}
