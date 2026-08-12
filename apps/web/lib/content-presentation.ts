import type { PublishedContentSnapshot } from "@tikdd/admin-contracts";
import { getCopy, type Locale, type SiteCopy } from "./copy";

type PublishedPage = PublishedContentSnapshot["pages"][number];

export function copyForPage(page: PublishedPage): SiteCopy {
  const base = structuredClone(getCopy((page.locale === "zh-CN" ? "zh-CN" : "en") as Locale));
  if (page.content.template !== "homepage") return base;
  const content = page.content;
  base.hero.lead = "";
  base.hero.accent = content.heroTitle;
  base.hero.tail = "";
  base.hero.description = content.heroSubtitle;
  base.form.label = content.inputLabel;
  base.form.placeholder = content.inputPlaceholder;
  base.form.action = content.primaryActionLabel;
  base.supported.label = content.supportedPlatformsTitle;
  base.process.title = content.howItWorksTitle;
  base.process.steps = content.howItWorksSteps.map(({ title, description }) => [title, description]);
  base.faq.title = content.faqTitle;
  base.faq.items = content.faqItems.map(({ question, answerMarkdown }) => [question, answerMarkdown]);
  return base;
}

export function alternatesForPage(snapshot: PublishedContentSnapshot, page: PublishedPage) {
  const group = snapshot.pages.filter((candidate) => candidate.pageId === page.pageId && candidate.seo.indexable);
  const languages = Object.fromEntries(group.map((candidate) => [candidate.locale, `/${candidate.locale}${candidate.seo.localPath === "/" ? "" : candidate.seo.localPath}`]));
  const fallback = snapshot.locales.find((locale) => locale.isDefault);
  const fallbackPage = fallback && group.find((candidate) => candidate.locale === fallback.locale);
  return { ...languages, ...(fallbackPage ? { "x-default": `/${fallbackPage.locale}${fallbackPage.seo.localPath === "/" ? "" : fallbackPage.seo.localPath}` } : {}) };
}
