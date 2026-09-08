import type { PublishedContentSnapshot } from "@tikdd/admin-contracts";

type PublishedPage = PublishedContentSnapshot["pages"][number];

export function pageMetadataCopy(snapshot: PublishedContentSnapshot, page: PublishedPage) {
  const shared = snapshot.sharedContent.find((item) => item.locale === page.locale);
  return {
    title: page.seo.searchTitle,
    description: page.seo.searchDescription,
    socialTitle: page.seo.socialTitle ?? shared?.defaultSocialTitle ?? page.seo.searchTitle,
    socialDescription:
      page.seo.socialDescription ?? shared?.defaultSocialDescription ?? page.seo.searchDescription,
    siteName: shared?.siteName ?? "TikDD"
  };
}
