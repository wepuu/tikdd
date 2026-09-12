import { describe, expect, it } from "vitest";
import { getCopy } from "../lib/copy";
import { copyForPage } from "../lib/content-presentation";
import { BUNDLED_PUBLIC_CONTENT_SNAPSHOT } from "../lib/seed-snapshot";

describe("delivery handoff copy", () => {
  it("describes a direct browser handoff in both locales", () => {
    const english = getCopy("en").form;
    const chinese = getCopy("zh-CN").form;

    expect(english.deliveryReady).toContain("Click once");
    expect(english.deliveryHandedOff).toContain("browser");
    expect(english.deliveryFallback).toContain("Open download");
    expect(chinese.deliveryReady).toContain("点击一次");
    expect(chinese.deliveryHandedOff).toContain("浏览器");
    expect(chinese.deliveryFallback).toContain("再次打开");
    expect(english.deliveryReady).not.toContain("new tab");
    expect(chinese.deliveryReady).not.toContain("新标签页");
  });

  it("does not expose provider or routing details in handoff copy", () => {
    const handoffCopy = JSON.stringify([
      getCopy("en").form.deliveryHandedOff,
      getCopy("zh-CN").form.deliveryHandedOff
    ]).toLowerCase();

    expect(handoffCopy).not.toContain("twittersaver");
    expect(handoffCopy).not.toContain("ssstwitter");
    expect(handoffCopy).not.toContain("fallback");
  });

  it("keeps the release-owned X, Instagram, and TikTok Beta surface when an older homepage snapshot is active", () => {
    const homepage = BUNDLED_PUBLIC_CONTENT_SNAPSHOT.pages.find(({ locale }) => locale === "en");
    expect(homepage).toBeDefined();
    const current = copyForPage(homepage!);

    expect(current.hero.badge).toContain("Public Beta");
    expect(current.supported.platforms).toEqual(["X", "Instagram", "TikTok"]);
    expect(current.faq.items[0]?.[1]).toContain("x.com");
    expect(current.faq.items[0]?.[1]).toContain("Instagram");
    expect(current.form.label).toBe("Public video page URL");
    expect(current.trust.description).toContain("third-party processing service");
    expect(current.legal).toBe("TikDD is an independent tool and is not affiliated with X, Instagram, or TikTok.");
  });

  it("states the public-only and credential-free Instagram boundary in both locales", () => {
    const english = JSON.stringify(getCopy("en"));
    const chinese = JSON.stringify(getCopy("zh-CN"));

    expect(english).toContain("public Instagram Reels");
    expect(english).toContain("cookies");
    expect(chinese).toContain("公开的 Instagram Reel");
    expect(chinese).toContain("sessionid");
  });
});
