import assert from "node:assert/strict";
import test from "node:test";
import catalog from "../catalog.json" with { type: "json" };

test("catalog contains only explicit candidates and marks self-host sources local-only", () => {
  const ids = new Set(catalog.providers.map((provider) => provider.id));
  for (const id of ["prexzy", "ahm7_alldl", "cobalt-directory", "tdownv4", "clipx", "postvault", "cliplatch", "tikwm", "instagram-video-downloader-vercel", "reelsaver-fun", "fdown-isuru", "vidown-netlify", "anydownloader", "reclip", "socialdownloader-space", "social-media-downloader-eight", "gram-grabberz", "facebookone", "reeldown"]) {
    assert.equal(ids.has(id), true, id);
  }
  assert.equal(catalog.providers.find((provider) => provider.id === "anydownloader").localOnly, true);
  assert.equal(catalog.providers.find((provider) => provider.id === "reclip").localOnly, true);
  assert.equal(catalog.providers.find((provider) => provider.id === "socialdownloader-space").activeEndpoints.length, 5);
  assert.equal(catalog.providers.find((provider) => provider.id === "gram-grabberz").activeEndpoints[0].pathTemplate, "instagram-shortcode");
  assert.equal(catalog.providers.every((provider) => !Object.hasOwn(provider, "active")), true);
});
