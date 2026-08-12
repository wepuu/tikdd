import { describe, expect, it, vi } from "vitest";
import { WebContentRevalidator } from "../src/web-content-revalidator";

describe("Web content acknowledgement adapter", () => {
  it("accepts only the matching typed acknowledgement", async () => {
    const fetcher = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => new Response(JSON.stringify({ schemaVersion: "1", acknowledged: true, snapshotId: `snap_${"a".repeat(32)}`, contentHash: "b".repeat(64), checkedAt: new Date().toISOString() }), { status: 200 }));
    const adapter = new WebContentRevalidator({ origin: "http://localhost:3000", secret: "content-revalidation-secret-at-least-32-bytes", fetcher: fetcher as typeof fetch });
    await expect(adapter.revalidate(["/en"], `snap_${"a".repeat(32)}`)).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[1]?.redirect).toBe("error");
  });
  it("fails closed without credentials or on a mismatched response", async () => {
    const disabled = new WebContentRevalidator({ origin: null, secret: null });
    await expect(disabled.revalidate([], `snap_${"a".repeat(32)}`)).resolves.toBe(false);
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 }));
    await expect(new WebContentRevalidator({ origin: "http://localhost:3000", secret: "content-revalidation-secret-at-least-32-bytes", fetcher }).revalidate([], `snap_${"a".repeat(32)}`)).resolves.toBe(false);
  });
});
