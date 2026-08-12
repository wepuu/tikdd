import type { ReactNode } from "react";
import { getPublishedSnapshot, resolvePublishedLocale } from "../../lib/published-content";

export default async function LocaleLayout({ children, params }: Readonly<{ children: ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale: candidate } = await params;
  const locale = resolvePublishedLocale(await getPublishedSnapshot(), candidate);
  return <div lang={locale?.locale ?? candidate} dir={locale?.direction ?? "ltr"}>{children}</div>;
}
