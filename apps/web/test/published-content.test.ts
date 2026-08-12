import { describe, expect, it } from "vitest";
import type { PublicContentSource } from "../lib/published-content";
import { PublishedContentLoader, findPublishedPage, resetPublishedContentStateForTest } from "../lib/published-content";
import { BUNDLED_PUBLIC_CONTENT_SNAPSHOT } from "../lib/seed-snapshot";

describe("public published-content loader", () => {
  it("uses only a runtime-validated active snapshot", async () => {
    resetPublishedContentStateForTest();
    const source: PublicContentSource = { loadActive: async () => BUNDLED_PUBLIC_CONTENT_SNAPSHOT, loadCandidate: async () => null };
    const snapshot = await new PublishedContentLoader(source).load();
    expect(snapshot.snapshotId).toBe(BUNDLED_PUBLIC_CONTENT_SNAPSHOT.snapshotId);
    expect(findPublishedPage(snapshot, "en", [])?.content.template).toBe("homepage");
  });

  it("keeps the last known-good snapshot during a content-store outage", async () => {
    resetPublishedContentStateForTest();
    let available = true;
    const source: PublicContentSource = {
      loadActive: async () => { if (!available) throw new Error("offline"); return BUNDLED_PUBLIC_CONTENT_SNAPSHOT; },
      loadCandidate: async () => null
    };
    const loader = new PublishedContentLoader(source);
    const first = await loader.load();
    available = false;
    expect(await loader.load()).toBe(first);
    expect(loader.health().source).toBe("database");
  });

  it("falls back to the bundled English and Chinese seed on a cold outage", async () => {
    resetPublishedContentStateForTest();
    const source: PublicContentSource = { loadActive: async () => { throw new Error("offline"); }, loadCandidate: async () => null };
    const loader = new PublishedContentLoader(source);
    const snapshot = await loader.load();
    expect(snapshot.locales.map(({ locale }) => locale)).toEqual(["en", "zh-CN"]);
    expect(loader.health()).toMatchObject({ status: "seed", source: "bundled-seed" });
  });

  it("preflights a named candidate without making it active", async () => {
    resetPublishedContentStateForTest();
    const candidate = { ...BUNDLED_PUBLIC_CONTENT_SNAPSHOT, snapshotId: `snap_${"1".repeat(32)}`, revision: 2 };
    const source: PublicContentSource = { loadActive: async () => BUNDLED_PUBLIC_CONTENT_SNAPSHOT, loadCandidate: async () => candidate };
    const loader = new PublishedContentLoader(source);
    expect((await loader.acknowledge(candidate.snapshotId)).snapshotId).toBe(candidate.snapshotId);
    expect((await loader.load()).snapshotId).toBe(BUNDLED_PUBLIC_CONTENT_SNAPSHOT.snapshotId);
  });
});
