export interface NoAdsDLActivationConfiguration {
  enabled: boolean;
  termsApproved: boolean;
  deliveryAuditApproved: boolean;
  maxConcurrency: number;
  minIntervalMs: number;
  pollIntervalMs: number;
  pollBudgetMs: number;
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

export function loadNoAdsDLActivationConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): NoAdsDLActivationConfiguration {
  const configuration = {
    enabled: (environment.ENABLE_NOADSDL_PROVIDER ?? "false") === "true",
    termsApproved: (environment.NOADSDL_TERMS_APPROVED ?? "false") === "true",
    deliveryAuditApproved: (environment.NOADSDL_DELIVERY_AUDIT_APPROVED ?? "false") === "true",
    maxConcurrency: boundedInteger(environment, "NOADSDL_MAX_CONCURRENCY", 1, 1, 2),
    minIntervalMs: boundedInteger(environment, "NOADSDL_MIN_INTERVAL_MS", 5_000, 0, 60_000),
    pollIntervalMs: boundedInteger(environment, "NOADSDL_POLL_INTERVAL_MS", 2_000, 250, 10_000),
    pollBudgetMs: boundedInteger(environment, "NOADSDL_POLL_BUDGET_MS", 40_000, 2_000, 40_000)
  };
  if (configuration.enabled && !configuration.termsApproved) {
    throw new Error("NOADSDL_TERMS_APPROVED must be true before enabling NoAdsDL.");
  }
  if (configuration.enabled && !configuration.deliveryAuditApproved) {
    throw new Error("NOADSDL_DELIVERY_AUDIT_APPROVED must be true before enabling NoAdsDL.");
  }
  return configuration;
}
