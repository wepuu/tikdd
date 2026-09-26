import { describe, expect, it } from "vitest";
import { consoleSnapshot } from "./fixture";
import { deriveEffectiveRoutePlans } from "../lib/console-model";
import { deriveSupportTruth } from "../lib/support-truth-model";

function derive(snapshot = consoleSnapshot) {
  const routes = snapshot.routes.status === "ready" ? snapshot.routes.data.routes : [];
  const providers = snapshot.providers.status === "ready" ? snapshot.providers.data.providers : [];
  return deriveSupportTruth({
    platforms: snapshot.platforms.status === "ready" ? snapshot.platforms.data.platforms : [],
    routes,
    plans: deriveEffectiveRoutePlans(routes, providers),
    beta: snapshot.betaHealth.status === "ready" ? snapshot.betaHealth.data : null,
    content: snapshot.controls.status === "ready" ? snapshot.controls.data.contentManagement : null,
    seo: snapshot.controls.status === "ready" ? snapshot.controls.data.seoTechnical : null
  });
}

describe("support truth ledger", () => {
  it("keeps natural events separate from route and catalog facts", () => {
    const [x] = derive();
    expect(x).toMatchObject({ platform: "x", catalogStatus: "stable", tasks: expect.any(Number), attempts: expect.any(Number) });
    expect(x?.handoffs).toEqual(expect.any(Number));
  });

  it("flags active planned routes without inventing page or SEO facts", () => {
    const snapshot = structuredClone(consoleSnapshot);
    if (snapshot.platforms.status !== "ready" || snapshot.routes.status !== "ready") throw new Error("fixture unavailable");
    snapshot.platforms.data.platforms[0]!.catalogStatus = "planned";
    snapshot.platforms.data.platforms[0]!.publicAvailability = "hidden";
    snapshot.routes.data.routes = snapshot.routes.data.routes.map((route) => ({ ...route, productionEligible: true, allocationBps: 10_000, state: "healthy" }));
    const [x] = derive(snapshot);
    expect(x?.drifts).toContain("catalog_route_mismatch");
    expect(x?.drifts).toContain("route_not_listed");
    expect(x?.publishedLocaleCount).toBeNull();
  });

  it("flags an experimental page that enters the sitemap", () => {
    const snapshot = structuredClone(consoleSnapshot);
    if (snapshot.platforms.status !== "ready" || snapshot.controls.status !== "ready") throw new Error("fixture unavailable");
    snapshot.platforms.data.platforms[0]!.catalogStatus = "experimental";
    snapshot.controls.data.contentManagement = {
      schemaVersion: "1", generatedAt: snapshot.generatedAt,
      locales: [], definitions: [{ pageId: "page_x", pageType: "platform", platform: "x", label: "X", required: false, templateVersion: 1 }],
      pages: [], sharedContent: [], coverage: [],
      readiness: { enabledLocaleCount: 0, requiredPageCount: 0, readyCellCount: 0, missingCellCount: 0, fallbackCellCount: 0 }
    };
    snapshot.controls.data.seoTechnical = {
      schemaVersion: "1", generatedAt: snapshot.generatedAt, privateRoutePrefixes: [], blockerCount: 0,
      sitemapPaths: ["/en/x-downloader"],
      passports: [{ schemaVersion: "1", pageId: "page_x", locale: "en", canonicalPath: "/en/x-downloader", hreflang: [], search: { title: "TikDD X video downloader Beta", description: "A public Beta page that remains bounded for this model fixture." }, social: { title: "X", description: "X", imageAssetId: null }, sitemapEligible: true, indexableEligible: true, structuredDataTemplates: [], redirects: [], blockers: [] }]
    };
    expect(derive(snapshot)[0]?.drifts).not.toContain("beta_in_sitemap");
  });
});
