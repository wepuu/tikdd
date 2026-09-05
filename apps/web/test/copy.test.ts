import { describe, expect, it } from "vitest";
import { getCopy } from "../lib/copy";
import { copyForPage } from "../lib/content-presentation";
import { BUNDLED_PUBLIC_CONTENT_SNAPSHOT } from "../lib/seed-snapshot";

describe("delivery handoff copy", () => {
  it("sets the new-tab expectation before and after browser handoff in both locales", () => {
    const english = getCopy("en").form;
    const chinese = getCopy("zh-CN").form;

    expect(english.deliveryReady).toContain("new tab");
    expect(english.deliveryHandedOff).toContain("browser");
    expect(chinese.deliveryReady).toContain("新标签页");
    expect(chinese.deliveryHandedOff).toContain("浏览器");
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

  it("keeps the release-owned X Beta surface when an older homepage snapshot is active", () => {
    const homepage = BUNDLED_PUBLIC_CONTENT_SNAPSHOT.pages.find(({ locale }) => locale === "en");
    expect(homepage).toBeDefined();
    const current = copyForPage(homepage!);

    expect(current.hero.badge).toContain("Public Beta");
    expect(current.supported.platforms).toEqual(["X"]);
    expect(current.faq.items[0]?.[1]).toContain("x.com");
    expect(current.legal).toBe("TikDD is an independent tool and is not affiliated with X.");
  });
});
