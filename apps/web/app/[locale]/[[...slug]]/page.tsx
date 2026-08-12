import { DownloadSimpleIcon, ShieldCheckIcon, SparkleIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ResolveForm } from "../../../components/resolve-form";
import { alternatesForPage, copyForPage } from "../../../lib/content-presentation";
import { findPublishedPage, findPublishedRedirect, getPublishedSnapshot, localizedPath, resolvePublishedLocale } from "../../../lib/published-content";

export const dynamicParams = true;
export const dynamic = "force-dynamic";
const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
type RouteParams = { locale: string; slug?: string[] };

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const route = await params;
  const snapshot = await getPublishedSnapshot();
  const page = findPublishedPage(snapshot, route.locale, route.slug ?? []);
  if (!page) return { robots: { index: false, follow: false } };
  const canonical = localizedPath(page.locale, page.seo.localPath);
  return {
    metadataBase: new URL(siteUrl), title: page.seo.searchTitle, description: page.seo.searchDescription,
    alternates: { canonical, languages: alternatesForPage(snapshot, page) }, robots: { index: page.seo.indexable, follow: page.seo.indexable },
    openGraph: { type: "website", locale: page.locale.replace("-", "_"), title: page.seo.socialTitle ?? page.seo.searchTitle, description: page.seo.socialDescription ?? page.seo.searchDescription, url: canonical, siteName: "TikDD" }
  };
}

function Brand({ locale }: { locale: string }) { return <a className="brand" href={`/${locale}`} aria-label="TikDD home"><span className="brand-mark" aria-hidden="true"><DownloadSimpleIcon size={22} weight="bold" /></span><span className="brand-word">TikDD</span></a>; }

function StructuredPage({ page }: { page: NonNullable<ReturnType<typeof findPublishedPage>> }) {
  const content = page.content;
  if (content.template === "guide" || content.template === "legal") return <section className="published-document"><h1>{content.title}</h1><p>{content.template === "guide" ? content.introduction : content.summary}</p>{content.sections.map((section) => <section key={section.id} id={section.id}><h2>{section.heading}</h2><p>{section.bodyMarkdown}</p></section>)}</section>;
  if (content.template === "faq") return <section className="published-document"><h1>{content.title}</h1><p>{content.introduction}</p>{content.items.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answerMarkdown}</p></details>)}</section>;
  if (content.template === "platform") return <section className="published-document"><p className="hero-badge">{content.eyebrow}</p><h1>{content.title}</h1><p>{content.introduction}</p><h2>How it works</h2>{content.howToSteps.map((step) => <section key={step.title}><h3>{step.title}</h3><p>{step.description}</p></section>)}<p>{content.limitationsMarkdown}</p></section>;
  return null;
}

export default async function PublishedPageRoute({ params }: { params: Promise<RouteParams> }) {
  const route = await params;
  const snapshot = await getPublishedSnapshot();
  const locale = resolvePublishedLocale(snapshot, route.locale);
  if (!locale) notFound();
  const redirectPage = findPublishedRedirect(snapshot, route.locale, route.slug ?? []);
  if (redirectPage) redirect(localizedPath(redirectPage.locale, redirectPage.seo.localPath));
  const page = findPublishedPage(snapshot, route.locale, route.slug ?? []);
  if (!page) notFound();
  const copy = copyForPage(page);
  const shared = snapshot.sharedContent.find((item) => item.locale === locale.locale);
  return <div className="site-stage"><main className="app-canvas"><header className="site-header"><Brand locale={locale.locale} /><nav aria-label="Primary navigation"><a className="is-active" href={`/${locale.locale}`}>{shared?.navigationLabel ?? copy.nav.home}</a>{page.pageType === "homepage" && <><a href="#features">{copy.nav.features}</a><a href="#process">{copy.nav.process}</a><a href="#supported">{copy.nav.supported}</a><a href="#faq">{copy.nav.faq}</a></>}</nav><div className="header-actions"><div className="language-switch" aria-label="Language">{snapshot.locales.map((item) => <a key={item.locale} className={item.locale === locale.locale ? "is-active" : ""} href={localizedPath(item.locale, snapshot.pages.find((candidate) => candidate.pageId === page.pageId && candidate.locale === item.locale)?.seo.localPath ?? "/")} lang={item.locale}>{item.displayName}</a>)}</div>{page.pageType === "homepage" && <a className="header-cta" href="#resolver">{copy.form.action}</a>}</div></header>
  {page.content.template === "homepage" ? <section className="hero" id="home" aria-labelledby="hero-title"><div className="hero-copy"><p className="hero-badge"><SparkleIcon size={17} weight="fill" aria-hidden="true" />{copy.hero.badge}</p><h1 id="hero-title">{page.content.heroTitle}</h1><p className="hero-description">{page.content.heroSubtitle}</p></div><ResolveForm copy={copy.form} featureLabel={copy.nav.features} features={copy.features} process={copy.process} supported={copy.supported} /><section className="lower-grid" id="faq"><div className="faq-card"><h2>{copy.faq.title}</h2><div className="faq-list">{copy.faq.items.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></div><div className="trust-card" id="about"><span className="trust-orb" aria-hidden="true"><ShieldCheckIcon size={42} weight="duotone" /></span><h2>{copy.trust.title}</h2><strong>{copy.trust.labels}</strong><p>{copy.trust.description}</p></div></section></section> : <StructuredPage page={page} />}
  <footer><Brand locale={locale.locale} /><p>{shared?.legalNoticeMarkdown ?? copy.legal}</p><span>© {new Date().getUTCFullYear()} TikDD</span></footer></main></div>;
}
