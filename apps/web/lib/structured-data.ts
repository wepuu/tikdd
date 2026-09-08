import type { PublishedContentSnapshot } from "@tikdd/admin-contracts";
import type { SiteCopy } from "./copy";
import { localizedPath } from "./published-content";

type PublishedPage = PublishedContentSnapshot["pages"][number];
type StructuredDataNode = Record<string, unknown>;
export type StructuredDataDocument = {
  "@context": "https://schema.org";
  "@graph": StructuredDataNode[];
};

type StructuredDataInput = {
  page: PublishedPage;
  copy: SiteCopy;
  siteName: string;
  siteUrl: string;
  indexableEligible?: boolean;
};

const absoluteUrl = (siteUrl: string, path: string) => new URL(path, siteUrl).toString();
const pageTitle = (page: PublishedPage) => {
  if (page.content.template === "homepage") return page.content.heroTitle;
  return page.content.title;
};

function faqNodes(page: PublishedPage, copy: SiteCopy): StructuredDataNode[] {
  const items = page.content.template === "homepage"
    ? copy.faq.items.map(([question, answer]) => ({ question, answerMarkdown: answer }))
    : page.content.template === "platform"
      ? page.content.faqItems
      : page.content.template === "faq"
        ? page.content.items
        : [];
  return items.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answerMarkdown }
  }));
}

function howToSteps(page: PublishedPage, copy: SiteCopy) {
  if (page.content.template === "homepage") {
    return copy.process.steps.map(([name, text], index) => ({ "@type": "HowToStep", position: index + 1, name, text }));
  }
  if (page.content.template === "platform") {
    return page.content.howToSteps.map((step, index) => ({ "@type": "HowToStep", position: index + 1, name: step.title, text: step.description }));
  }
  return [];
}

/**
 * Web does not have a second eligibility authority. Publication marks an indexable platform page
 * as sitemap-visible only after the existing catalog/provider/locale gate has passed. The extra
 * check keeps experimental/noindex platform pages free of structured data during review.
 */
export function isStructuredDataEligible(page: PublishedPage): boolean {
  return page.seo.indexable && (page.pageType !== "platform" || page.seo.includeInSitemap);
}

export function buildStructuredData(input: StructuredDataInput): StructuredDataDocument | null {
  if (input.indexableEligible === false || !isStructuredDataEligible(input.page)) return null;

  const canonical = absoluteUrl(input.siteUrl, localizedPath(input.page.locale, input.page.seo.localPath));
  const graph: StructuredDataNode[] = [];
  const content = input.page.content;
  const title = pageTitle(input.page);

  if (content.template === "homepage") {
    graph.push({
      "@type": "SoftwareApplication",
      "@id": `${canonical}#software`,
      name: input.siteName,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      url: canonical,
      inLanguage: input.page.locale,
      description: input.copy.hero.description
    });
  }

  const questions = faqNodes(input.page, input.copy);
  if (questions.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${canonical}#faq`,
      url: canonical,
      inLanguage: input.page.locale,
      mainEntity: questions
    });
  }

  const steps = howToSteps(input.page, input.copy);
  if (steps.length && (content.template === "homepage" || content.template === "platform")) {
    graph.push({
      "@type": "HowTo",
      "@id": `${canonical}#howto`,
      name: content.template === "homepage" ? input.copy.process.title : title,
      description: content.template === "homepage" ? input.copy.hero.description : content.introduction,
      inLanguage: input.page.locale,
      step: steps
    });
  }

  if (input.page.seo.localPath !== "/") {
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${canonical}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: input.siteName, item: absoluteUrl(input.siteUrl, `/${input.page.locale}`) },
        { "@type": "ListItem", position: 2, name: title, item: canonical }
      ]
    });
  }

  return graph.length ? { "@context": "https://schema.org", "@graph": graph } : null;
}

/** Escape characters that could terminate an inline script element. */
export function serializeStructuredData(document: StructuredDataDocument): string {
  return JSON.stringify(document).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
