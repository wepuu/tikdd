import type { GeoSourceId } from "@tikdd/admin-contracts";

type GeoSource = { label: string; href: string };

/**
 * This registry is code-owned. The published snapshot carries only source IDs,
 * so editorial input cannot smuggle a remote link into the public page.
 */
export const GEO_SOURCE_LINKS: Record<GeoSourceId, GeoSource> = {
  "tikdd-workflow": { label: "TikDD workflow", href: "https://www.tikdd.cc/" },
  "x-public-content": { label: "X public content guidance", href: "https://help.x.com/" },
  "instagram-public-content": { label: "Instagram public content guidance", href: "https://help.instagram.com/" },
  "tiktok-public-content": { label: "TikTok public content guidance", href: "https://support.tiktok.com/" }
};

export function geoSourceLabel(sourceId: GeoSourceId, locale: string): string {
  if (locale === "zh-CN") {
    return {
      "tikdd-workflow": "TikDD 使用说明",
      "x-public-content": "X 公开内容说明",
      "instagram-public-content": "Instagram 公开内容说明",
      "tiktok-public-content": "TikTok 公开内容说明"
    }[sourceId];
  }
  return GEO_SOURCE_LINKS[sourceId].label;
}
