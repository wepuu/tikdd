import { describe, expect, it, vi } from "vitest";
import { analyticsFailureClass, analyticsPlatform, trackWebEvent } from "../lib/analytics";

describe("privacy-bounded Web analytics", () => {
  it("sends only the fixed event payload when gtag is available", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag });
    expect(trackWebEvent("resolve_submit", { platform: "x", locale: "en", page_type: "homepage" })).toBe(true);
    expect(gtag).toHaveBeenCalledWith("event", "resolve_submit", { platform: "x", locale: "en", page_type: "homepage" });
    vi.unstubAllGlobals();
  });

  it("fails closed for unknown events or sensitive fields", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag });
    expect(trackWebEvent("resolve_submit", { platform: "x", locale: "en", page_type: "homepage", url: "https://x.com/example/status/1" } as never)).toBe(false);
    expect(trackWebEvent("resolve_ready", { platform: "x", locale: "en", page_type: "homepage", task_id: "tsk_secret" } as never)).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("keeps failures coarse and rejects unknown platforms", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag });
    expect(trackWebEvent("resolve_failed", { platform: "instagram", locale: "zh-CN", page_type: "platform", failure_class: "rate_limited" })).toBe(true);
    expect(analyticsFailureClass("PROVIDER_TIMEOUT", true)).toBe("retryable");
    expect(analyticsFailureClass("RATE_LIMITED", false)).toBe("rate_limited");
    expect(analyticsFailureClass("RESOLUTION_EXPIRED", false)).toBe("expired");
    expect(analyticsPlatform("provider-x")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("does not claim that a cross-origin handoff completed a download", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag });
    expect(trackWebEvent("download_handoff", { platform: "x", locale: "en", page_type: "homepage" })).toBe(true);
    expect(gtag).not.toHaveBeenCalledWith("event", "download_complete", expect.anything());
    vi.unstubAllGlobals();
  });
});
