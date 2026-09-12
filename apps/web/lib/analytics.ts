/**
 * Privacy-bounded browser analytics for the public Web experience.
 *
 * The public page never sends URLs, task identifiers, Provider names, media metadata,
 * delivery credentials, or free-form error text. Google Analytics is optional and is
 * enabled only when a validated ID is present in the published content snapshot.
 */

export const WEB_ANALYTICS_EVENTS = [
  "resolve_submit",
  "resolve_ready",
  "resolve_failed",
  "download_handoff"
] as const;

export type WebAnalyticsEvent = (typeof WEB_ANALYTICS_EVENTS)[number];
export type WebAnalyticsPlatform = "x" | "instagram" | "tiktok";
export type WebAnalyticsLocale = "en" | "zh-CN";
export type WebAnalyticsPageType = "homepage" | "platform";
export type WebAnalyticsFailureClass = "retryable" | "unavailable" | "rate_limited" | "expired";

type CommonParameters = Readonly<{
  platform: WebAnalyticsPlatform;
  locale: WebAnalyticsLocale;
  page_type: WebAnalyticsPageType;
}>;

export type WebAnalyticsParameters =
  | CommonParameters
  | (CommonParameters & { failure_class: WebAnalyticsFailureClass });

type Gtag = (command: "event", event: WebAnalyticsEvent, parameters: Record<string, string>) => void;

const commonKeys = new Set(["platform", "locale", "page_type"]);
const failureKeys = new Set([...commonKeys, "failure_class"]);

function isCommonParameters(value: unknown): value is CommonParameters {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const platformValid = candidate.platform === "x" || candidate.platform === "instagram" || candidate.platform === "tiktok";
  const localeValid = candidate.locale === "en" || candidate.locale === "zh-CN";
  const pageTypeValid = candidate.page_type === "homepage" || candidate.page_type === "platform";
  return platformValid && localeValid && pageTypeValid;
}

function isFailureClass(value: unknown): value is WebAnalyticsFailureClass {
  return value === "retryable" || value === "unavailable" || value === "rate_limited" || value === "expired";
}

function isAllowedParameters(event: WebAnalyticsEvent, value: unknown): value is WebAnalyticsParameters {
  if (!isCommonParameters(value)) return false;
  const candidate = value as Record<string, unknown>;
  const keys = new Set(Object.keys(candidate));
  const allowed = event === "resolve_failed" ? failureKeys : commonKeys;
  if (keys.size !== allowed.size || [...keys].some((key) => !allowed.has(key))) return false;
  return event !== "resolve_failed" || isFailureClass(candidate.failure_class);
}

/**
 * Sends one of the fixed funnel events when the optional gtag runtime is present.
 * Unknown fields fail closed instead of being silently forwarded to a third party.
 */
export function trackWebEvent(event: WebAnalyticsEvent, parameters: WebAnalyticsParameters): boolean {
  if (typeof window === "undefined" || !isAllowedParameters(event, parameters)) return false;
  const gtag = (window as Window & { gtag?: unknown }).gtag;
  if (typeof gtag !== "function") return false;
  (gtag as Gtag)("event", event, { ...parameters });
  return true;
}

export function analyticsPlatform(value: string | null | undefined): WebAnalyticsPlatform | null {
  return value === "x" || value === "instagram" || value === "tiktok" ? value : null;
}

export function analyticsFailureClass(code: string | null | undefined, retryable: boolean): WebAnalyticsFailureClass {
  const normalized = code?.toUpperCase() ?? "";
  if (normalized.includes("RATE_LIMIT") || normalized.includes("TOO_MANY")) return "rate_limited";
  if (normalized.includes("EXPIRED")) return "expired";
  return retryable ? "retryable" : "unavailable";
}
