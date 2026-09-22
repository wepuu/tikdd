import type { ReactNode } from "react";
import { SiteIntegrations } from "../../components/site-integrations";
import { getPublishedSnapshot, resolvePublishedLocale } from "../../lib/published-content";

export default async function LocaleLayout({ children, params }: Readonly<{ children: ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale: candidate } = await params;
  const snapshot = await getPublishedSnapshot();
  const locale = resolvePublishedLocale(snapshot, candidate);
  return <div lang={locale?.locale ?? candidate} dir={locale?.direction ?? "ltr"}><SiteIntegrations integrations={snapshot.siteIntegrations} />{children}</div>;
}
