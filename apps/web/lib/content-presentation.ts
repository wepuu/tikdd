import type { PublishedContentSnapshot } from "@tikdd/admin-contracts";
import { getCopy, type Locale, type SiteCopy } from "./copy";

type PublishedPage = PublishedContentSnapshot["pages"][number];

export function copyForPage(page: PublishedPage): SiteCopy {
  const base = structuredClone(getCopy((page.locale === "zh-CN" ? "zh-CN" : "en") as Locale));
  if (page.content.template !== "homepage") return base;
  // The public X Beta copy is release-owned while Admin remains off. This also prevents a
  // previously published homepage snapshot from restoring the removed submission gate.
  return base;
}

export function alternatesForPage(snapshot: PublishedContentSnapshot, page: PublishedPage) {
  const group = snapshot.pages.filter((candidate) => candidate.pageId === page.pageId && candidate.seo.indexable);
  const languages = Object.fromEntries(group.map((candidate) => [candidate.locale, `/${candidate.locale}${candidate.seo.localPath === "/" ? "" : candidate.seo.localPath}`]));
  const fallback = snapshot.locales.find((locale) => locale.isDefault);
  const fallbackPage = fallback && group.find((candidate) => candidate.locale === fallback.locale);
  return { ...languages, ...(fallbackPage ? { "x-default": `/${fallbackPage.locale}${fallbackPage.seo.localPath === "/" ? "" : fallbackPage.seo.localPath}` } : {}) };
}
