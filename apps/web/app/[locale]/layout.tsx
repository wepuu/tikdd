import "@fontsource-variable/noto-sans-sc/wght.css";
import "@fontsource-variable/plus-jakarta-sans/wght.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getCopy, isLocale, locales, type Locale } from "../../lib/copy";
import "../globals.css";

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: candidate } = await params;
  const locale: Locale = isLocale(candidate) ? candidate : "en";
  const copy = getCopy(locale);
  const title = `TikDD — ${copy.hero.lead}${copy.hero.accent}${copy.hero.tail}`;

  return {
    metadataBase: new URL(siteUrl),
    title,
    description: copy.hero.description,
    alternates: {
      canonical: `/${locale}`,
      languages: { en: "/en", "zh-CN": "/zh-CN", "x-default": "/en" }
    },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: locale === "zh-CN" ? "zh_CN" : "en_US",
      title,
      description: copy.hero.description,
      url: `/${locale}`,
      siteName: "TikDD"
    }
  };
}

export default async function LocaleLayout({ children, params }: Readonly<{ children: ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale: candidate } = await params;
  const locale = isLocale(candidate) ? candidate : "en";
  return <html lang={locale}><body>{children}</body></html>;
}
