import type { CanaryRunSummary } from "./runner";

export function classifyCanaryExecution(summary: CanaryRunSummary): {
  state: "completed" | "failed" | "lease_unavailable";
  leaseState: "released" | "unavailable";
  lastErrorCode: "runtime_failure" | "lease_unavailable" | null;
} {
  if (!summary.leaseAcquired) return { state: "lease_unavailable", leaseState: "unavailable", lastErrorCode: "lease_unavailable" };
  if (summary.errorCount > 0) return { state: "failed", leaseState: "released", lastErrorCode: "runtime_failure" };
  return { state: "completed", leaseState: "released", lastErrorCode: null };
}
