import { z } from "zod";

/**
 * Site integrations are identifiers, not arbitrary snippets. The Web application owns the
 * script templates so an owner cannot turn the content publication surface into an XSS sink.
 */
export const GoogleAnalyticsMeasurementIdSchema = z
  .string()
  .trim()
  .regex(/^G-[A-Z0-9]{4,32}$/i, "Google Analytics must use a G- measurement ID.");

export const GoogleAdsensePublisherIdSchema = z
  .string()
  .trim()
  .regex(/^ca-pub-\d{10,32}$/, "Google AdSense must use a ca-pub publisher ID.");

export const SiteIntegrationsSchema = z.strictObject({
  googleAnalyticsMeasurementId: GoogleAnalyticsMeasurementIdSchema.nullable().default(null),
  googleAdsensePublisherId: GoogleAdsensePublisherIdSchema.nullable().default(null)
});

export type SiteIntegrations = z.infer<typeof SiteIntegrationsSchema>;
