import { describe, expect, it } from "vitest";
import { getCopy } from "../lib/copy";

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
});
