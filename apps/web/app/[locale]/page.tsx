import { DownloadSimpleIcon, ShieldCheckIcon, SparkleIcon } from "@phosphor-icons/react/dist/ssr";
import { notFound } from "next/navigation";
import { ResolveForm } from "../../components/resolve-form";
import { getCopy, isLocale, type Locale } from "../../lib/copy";

export const dynamicParams = false;

function Brand({ locale }: { locale: Locale }) {
  return (
    <a className="brand" href={`/${locale}`} aria-label="TikDD home">
      <span className="brand-mark" aria-hidden="true"><DownloadSimpleIcon size={22} weight="bold" /></span>
      <span className="brand-word">TikDD</span>
    </a>
  );
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: candidate } = await params;
  if (!isLocale(candidate)) notFound();
  const locale = candidate;
  const copy = getCopy(locale);

  return (
    <div className="site-stage">
      <main className="app-canvas">
        <header className="site-header">
          <Brand locale={locale} />
          <nav aria-label="Primary navigation">
            <a className="is-active" href="#home">{copy.nav.home}</a>
            <a href="#features">{copy.nav.features}</a>
            <a href="#process">{copy.nav.process}</a>
            <a href="#supported">{copy.nav.supported}</a>
            <a href="#faq">{copy.nav.faq}</a>
          </nav>
          <div className="header-actions">
            <div className="language-switch" aria-label="Language">
              <a className={locale === "en" ? "is-active" : ""} href="/en" lang="en">EN</a>
              <span aria-hidden="true" />
              <a className={locale === "zh-CN" ? "is-active" : ""} href="/zh-CN" lang="zh-CN">中文</a>
            </div>
            <a className="header-cta" href="#resolver">{copy.form.action}</a>
          </div>
        </header>

        <section className="hero" id="home" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="hero-badge"><SparkleIcon size={17} weight="fill" aria-hidden="true" />{copy.hero.badge}</p>
            <h1 id="hero-title">{copy.hero.lead}<span>{copy.hero.accent}</span>{copy.hero.tail}</h1>
            <p className="hero-description">{copy.hero.description}</p>
          </div>
          <ResolveForm copy={copy.form} featureLabel={copy.nav.features} features={copy.features} process={copy.process} supported={copy.supported} />
          <section className="lower-grid" id="faq">
            <div className="faq-card"><h2>{copy.faq.title}</h2><div className="faq-list">
              {copy.faq.items.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
            </div></div>
            <div className="trust-card" id="about">
              <span className="trust-orb" aria-hidden="true"><ShieldCheckIcon size={42} weight="duotone" /></span>
              <h2>{copy.trust.title}</h2><strong>{copy.trust.labels}</strong><p>{copy.trust.description}</p>
            </div>
          </section>
        </section>
        <footer><Brand locale={locale} /><p>{copy.legal}</p><span>© {new Date().getUTCFullYear()} TikDD</span></footer>
      </main>
    </div>
  );
}
