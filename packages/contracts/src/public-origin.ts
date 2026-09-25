export interface PublicOriginEnvironment {
  NODE_ENV?: string;
  TIKDD_WEB_PUBLIC_ORIGIN?: string;
  WEB_ORIGIN?: string;
}

function parseExactOrigin(value: string, name: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid origin.`);
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(`${name} must contain only one exact origin.`);
  }

  return parsed.origin;
}

/**
 * Loads the browser-facing Web origin used by API and Delivery CORS.
 *
 * TIKDD_WEB_PUBLIC_ORIGIN is intentionally preferred over the legacy WEB_ORIGIN
 * variable because Admin content revalidation may use an internal Web address.
 */
export function loadPublicWebOrigin(
  env: PublicOriginEnvironment = process.env
): string {
  const production = env.NODE_ENV === "production";
  const configured = env.TIKDD_WEB_PUBLIC_ORIGIN?.trim();
  if (production && !configured) {
    throw new Error("TIKDD_WEB_PUBLIC_ORIGIN is required in production.");
  }

  const origin = parseExactOrigin(
    configured ?? env.WEB_ORIGIN?.trim() ?? "http://localhost:3000",
    configured ? "TIKDD_WEB_PUBLIC_ORIGIN" : "WEB_ORIGIN"
  );

  if (production && new URL(origin).protocol !== "https:") {
    throw new Error("TIKDD_WEB_PUBLIC_ORIGIN must use HTTPS in production.");
  }

  return origin;
}
