export interface CleanupConfiguration {
  deployment: string;
  intervalMs: number;
  batchSize: number;
  taskHardRetentionMs: number;
  statementTimeoutMs: number;
  timeBudgetMs: number;
  maxBatches: number;
  leaseTtlMs: number;
}

function integerFromEnvironment(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const raw = environment[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} is invalid.`);
  }
  return value;
}

export function loadCleanupConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): CleanupConfiguration {
  const deployment = environment.CLEANUP_DEPLOYMENT ?? "development";
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(deployment)) {
    throw new Error("CLEANUP_DEPLOYMENT is invalid.");
  }
  if (environment.NODE_ENV === "production" && environment.CLEANUP_DEPLOYMENT === undefined) {
    throw new Error("CLEANUP_DEPLOYMENT is required in production.");
  }

  const configuration: CleanupConfiguration = {
    deployment,
    intervalMs: integerFromEnvironment(environment, "CLEANUP_INTERVAL_MS", 60_000, 5_000, 86_400_000),
    batchSize: integerFromEnvironment(environment, "CLEANUP_BATCH_SIZE", 100, 1, 10_000),
    taskHardRetentionMs: integerFromEnvironment(
      environment,
      "TASK_HARD_RETENTION_MS",
      86_400_000,
      0,
      31_536_000_000
    ),
    statementTimeoutMs: integerFromEnvironment(
      environment,
      "CLEANUP_STATEMENT_TIMEOUT_MS",
      2_000,
      100,
      60_000
    ),
    timeBudgetMs: integerFromEnvironment(environment, "CLEANUP_TIME_BUDGET_MS", 5_000, 500, 300_000),
    maxBatches: integerFromEnvironment(environment, "CLEANUP_MAX_BATCHES", 24, 1, 10_000),
    leaseTtlMs: integerFromEnvironment(environment, "CLEANUP_LEASE_TTL_MS", 15_000, 2_000, 600_000)
  };
  if (configuration.leaseTtlMs < configuration.timeBudgetMs + 5_000) {
    throw new Error("CLEANUP_LEASE_TTL_MS must exceed the time budget by at least five seconds.");
  }
  return configuration;
}
