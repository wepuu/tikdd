const FORBIDDEN_KEYS = new Set([
  "authorization",
  "candidateId",
  "canonicalUrl",
  "callerId",
  "cookie",
  "cookies",
  "downloadUrl",
  "dnsAnswers",
  "formatId",
  "headers",
  "ipAddress",
  "media",
  "mediaUrl",
  "providerPayload",
  "rawPayload",
  "redirectLocation",
  "sessionId",
  "sourceUrl",
  "stack",
  "targetUrl",
  "taskId",
  "thumbnailUrl",
  "ticketId",
  "token"
]);

const CAPABILITY_VALUE = /(?:https?:\/\/|tsk_[a-f0-9]{32}|fmt_[A-Za-z0-9._-]+|(?:ticket|candidate)_[A-Za-z0-9._-]+)/i;

export class AdminPrivacyBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminPrivacyBoundaryError";
  }
}

export function assertAdminSafeValue(value: unknown, path = "$"): void {
  if (typeof value === "string" && CAPABILITY_VALUE.test(value)) {
    throw new AdminPrivacyBoundaryError(`Forbidden URL or capability-like value at ${path}.`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertAdminSafeValue(item, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new AdminPrivacyBoundaryError(`Forbidden Admin field ${path}.${key}.`);
    }
    assertAdminSafeValue(nested, `${path}.${key}`);
  }
}
