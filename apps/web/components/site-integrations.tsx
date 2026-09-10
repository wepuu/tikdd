import type { SiteIntegrations } from "@tikdd/admin-contracts";

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

/** Render only code-owned Google tags from validated published identifiers. */
export function SiteIntegrations({ integrations }: { integrations: SiteIntegrations }) {
  const analyticsId = integrations.googleAnalyticsMeasurementId;
  const adsenseId = integrations.googleAdsensePublisherId;
  if (!analyticsId && !adsenseId) return null;

  return <>
    {analyticsId ? <>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsId)}`} />
      <script dangerouslySetInnerHTML={{ __html: analyticsInlineScript(analyticsId) }} />
    </> : null}
    {adsenseId ? <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsenseId)}`} crossOrigin="anonymous" /> : null}
  </>;
}
