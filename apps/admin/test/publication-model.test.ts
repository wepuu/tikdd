import { describe, expect, it } from "vitest";
import { derivePublicationCenter } from "../lib/publication-model";
import { consoleSnapshot } from "./fixture";

describe("publication center model", () => {
  it("keeps missing sources unavailable instead of reporting a healthy release", () => {
    const overview = derivePublicationCenter({ content: null, publication: null, seo: null, settings: null });
    expect(overview.status).toBe("unavailable");
    expect(overview.configuredIntegrationCount).toBe(0);
  });

  it("combines content, SEO and propagation blockers", () => {
    const overview = derivePublicationCenter({
      content: {
        schemaVersion: "1",
        generatedAt: "2026-08-11T12:00:00.000Z",
        locales: [],
        definitions: [],
        pages: [],
        sharedContent: [],
        coverage: [],
        readiness: { enabledLocaleCount: 1, requiredPageCount: 1, readyCellCount: 0, missingCellCount: 2, fallbackCellCount: 0 }
      } as never,
      publication: {
        schemaVersion: "1",
        deployment: "tikdd",
        currentRevision: 4,
        activeSnapshotId: null,
        pendingSnapshotId: "snap_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        propagationState: "propagating",
        draftCount: 2,
        readyPageCount: 1,
        blockers: ["default_homepage_not_ready"],
        affectedPaths: ["/en", "/zh-CN"],
        diff: [],
        rollbackCandidates: []
      },
      seo: { schemaVersion: "1", generatedAt: "2026-08-11T12:00:00.000Z", privateRoutePrefixes: [], passports: [], sitemapPaths: [], blockerCount: 3 },
      settings: null
    });
    expect(overview.status).toBe("propagating");
    expect(overview.blockers).toEqual(expect.arrayContaining(["default_homepage_not_ready", "seo_blockers", "content_gaps"]));
    expect(overview.affectedPathCount).toBe(2);
  });

  it("surfaces propagation failure as a blocked release", () => {
    const overview = derivePublicationCenter({
      content: { readiness: { missingCellCount: 0 } } as never,
      publication: { propagationState: "propagation_failed", blockers: [] } as never,
      seo: { blockerCount: 0 } as never,
      settings: null
    });
    expect(overview.status).toBe("blocked");
    expect(overview.blockers).toContain("propagation_failed");
  });

  it("counts configured site integrations from the existing settings view", () => {
    const settings = consoleSnapshot.controls.status === "ready" ? consoleSnapshot.controls.data.settingsRecovery : null;
    if (!settings) return;
    const overview = derivePublicationCenter({ content: null, publication: null, seo: null, settings });
    expect(overview.integrationCount).toBe(2);
  });
});
