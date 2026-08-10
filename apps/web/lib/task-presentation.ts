import type { ResolveTask, TaskError } from "@tikdd/contracts";

const unavailableCodes = new Set([
  "CONTENT_NOT_FOUND",
  "CONTENT_PRIVATE",
  "AUTHENTICATION_REQUIRED",
  "PAYMENT_REQUIRED",
  "DRM_PROTECTED",
  "GEO_RESTRICTED",
  "UNSUPPORTED_URL"
]);

export type PublicFailureIntent = "retryable" | "unavailable" | "expired";

export function publicFailureIntent(
  task: ResolveTask | null,
  admissionError: TaskError | null
): PublicFailureIntent | null {
  if (task?.status === "expired") return "expired";
  const taskError = task?.status === "failed" ? task.error : null;
  const error = taskError ?? admissionError;
  if (!error) return null;
  if (error.retryable) return "retryable";
  return unavailableCodes.has(error.code) ? "unavailable" : "unavailable";
}

export function isDeliveryExpired(expiresAt: string, nowMs: number): boolean {
  const expiryMs = Date.parse(expiresAt);
  return !Number.isFinite(expiryMs) || expiryMs <= nowMs;
}
