export interface EvidenceConfiguration {
  deployment: string;
  ownerId: string;
  intervalMs: number;
  leaseTtlMs: number;
  snapshotTtlMs: number;
  rebuildDays: number;
}

function integer(environment: NodeJS.ProcessEnv,name: string,fallback: number,min: number,max: number): number {
  const value = environment[name]===undefined ? fallback : Number(environment[name]);
  if (!Number.isInteger(value)||value<min||value>max) throw new Error(`${name} is invalid.`);
  return value;
}

export function loadEvidenceConfiguration(environment: NodeJS.ProcessEnv=process.env): EvidenceConfiguration {
  const deployment=environment.EVIDENCE_DEPLOYMENT??"development";
  const ownerId=environment.EVIDENCE_OWNER_ID??"evaluator.development";
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(deployment)) throw new Error("EVIDENCE_DEPLOYMENT is invalid.");
  if (!/^[A-Za-z0-9]+(?:[._:@-][A-Za-z0-9]+)*$/.test(ownerId)) throw new Error("EVIDENCE_OWNER_ID is invalid.");
  if (environment.NODE_ENV==="production" && (!environment.EVIDENCE_DEPLOYMENT||!environment.EVIDENCE_OWNER_ID)) {
    throw new Error("Evidence deployment and owner are required in production.");
  }
  const result={deployment,ownerId,
    intervalMs:integer(environment,"EVIDENCE_INTERVAL_MS",300_000,60_000,86_400_000),
    leaseTtlMs:integer(environment,"EVIDENCE_LEASE_TTL_MS",360_000,65_000,900_000),
    snapshotTtlMs:integer(environment,"PILOT_GUARD_SNAPSHOT_TTL_MS",30_000,5_000,86_400_000),
    rebuildDays:integer(environment,"EVIDENCE_REBUILD_DAYS",4,3,35)};
  if (result.leaseTtlMs<=result.intervalMs) throw new Error("Evidence lease TTL must exceed its interval.");
  return result;
}
