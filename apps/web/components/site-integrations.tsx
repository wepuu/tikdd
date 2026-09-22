import type { SiteIntegrations } from "@tikdd/admin-contracts";
import Script from "next/script";

function escapeInlineScript(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function analyticsInlineScript(measurementId: string): string {
  const safeId = escapeInlineScript(measurementId);
  return `window.dataLayer = window.dataLayer || []; function gtag(){window.dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', ${safeId});`;
}

export function adsTxtLine(publisherId: string): string {
  const account = publisherId.replace(/^ca-/, "");
  return `google.com, ${account}, DIRECT, f08c47fec0942fa0`;
}

/** Render only code-owned Google tags from validated published identifiers. */
export function SiteIntegrations({ integrations }: { integrations: SiteIntegrations }) {
  const analyticsId = integrations.googleAnalyticsMeasurementId;
  const adsenseId = integrations.googleAdsensePublisherId;
  if (!analyticsId && !adsenseId) return null;

  return <>
    {analyticsId ? <>
      <Script id="tikdd-google-analytics-loader" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsId)}`} strategy="afterInteractive" />
      <Script id="tikdd-google-analytics-bootstrap" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: analyticsInlineScript(analyticsId) }} />
    </> : null}
    {adsenseId ? <Script id="tikdd-google-adsense" src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsenseId)}`} strategy="afterInteractive" crossOrigin="anonymous" /> : null}
  </>;
}
