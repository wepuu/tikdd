import { describe, expect, it } from "vitest";
import { CANDIDATES, classifyTechnicalResponse } from "./provider-technical-preflight.mjs";

describe("technical Provider preflight classification", () => {
  it("marks ordinary HTTP success as reachable", () => {
    expect(classifyTechnicalResponse({ status: 200, challenge: false })).toEqual({ state: "reachable", failureCode: null });
  });

  it("marks challenge as blocked and temporary failures as deferred", () => {
    expect(classifyTechnicalResponse({ status: 403, challenge: true })).toEqual({ state: "blocked", failureCode: "access_challenge" });
    expect(classifyTechnicalResponse({ status: 503, challenge: false })).toEqual({ state: "deferred", failureCode: "upstream_unavailable" });
    expect(classifyTechnicalResponse({ status: 429, challenge: false })).toEqual({ state: "deferred", failureCode: "temporary_http_error" });
  });

  it("keeps the Instagram candidate mappings explicit", () => {
    expect(CANDIDATES).toMatchObject({
      fastdl: "https://fastdl.app/",
      snapinsta: "https://snapinsta.to/",
      "igram-world": "https://igram.world/",
      sssinstagram: "https://sssinstagram.com/",
      inflact: "https://inflact.com/instagram-downloader/",
      "savefrom-net": "https://en1.savefrom.net/25-instagram-reels-download-5Ie.html",
      collabstr: "https://collabstr.com/",
      igexport: "https://igexport.com/en/reels-download/",
      fastvideosave: "https://fastvideosave.net/",
      indown: "https://indown.io/reels/en2"
    });
  });
});
