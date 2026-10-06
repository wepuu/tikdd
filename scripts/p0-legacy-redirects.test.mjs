import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const template = readFileSync(resolve(root, "deploy/nginx/tikdd.conf.template"), "utf8");
const mapBody = template.match(/map \$uri \$tikdd_legacy_home_redirect \{([\s\S]*?)\n\}/)?.[1];
if (!mapBody) throw new Error("The legacy redirect map is missing.");
const contentTargetBody = template.match(/map \$uri \$tikdd_legacy_content_target \{([\s\S]*?)\n\}/)?.[1];
if (!contentTargetBody) throw new Error("The legacy content-target map is missing.");

const legacySlugs = new Set(
  [...mapBody.matchAll(/^\s+~\^\/([a-z0-9-]+)\/\?\$ 1;$/gm)].map((match) => match[1])
);
const shouldRedirect = (value) => {
  const pathname = new URL(value, "https://www.tikdd.cc").pathname;
  return /^\/i(?:\/[^/]+)?\/?$/.test(pathname) || legacySlugs.has(pathname.replace(/^\//, "").replace(/\/$/, ""));
};

const targetFor = (value) => {
  const pathname = new URL(value, "https://www.tikdd.cc").pathname;
  const match = [...contentTargetBody.matchAll(/^\s+~\^\/([^$]+?)\/\?\$\s+(\/[^;]+);$/gm)]
    .find((candidate) => new RegExp(`^/${candidate[1]}/?$`).test(pathname));
  return match?.[2] ?? null;
};

describe("P0 legacy TikDD redirects", () => {
  it("redirects only the proven opaque-result family and explicit WordPress slugs", () => {
    for (const path of [
      "/i",
      "/i/",
      "/i/legacy-result",
      "/i/legacy-result/",
      "/ok-ru-video-downloader",
      "/ok-ru-video-downloader/",
      "/how-to-use-tikdd-to-download-videos?utm_source=legacy"
    ]) expect(shouldRedirect(path), path).toBe(true);

    expect(legacySlugs.size).toBe(100);
  });

  it("sends direct legacy downloader slugs to the localized canonical page", () => {
    expect(targetFor("/youtube-downloader?utm_source=legacy")).toBe("/en/youtube-downloader");
    expect(targetFor("/dailymotion-video-downloader/")).toBe("/en/dailymotion-downloader");
    expect(targetFor("/xhamster-downloader")).toBe("/en/xhamster-downloader");
    expect(targetFor("/arbitrary-new-page")).toBeNull();
  });

  it("does not catch current, private, asset, arbitrary, or future localized routes", () => {
    for (const path of [
      "/",
      "/en",
      "/zh-CN",
      "/en/youtube",
      "/zh-CN/x",
      "/robots.txt",
      "/sitemap.xml",
      "/_next/static/chunks/app.js",
      "/assets/tikdd-mountain-preview.png",
      "/tasks/tsk_example",
      "/results/example",
      "/api/internal/content/health",
      "/admin/",
      "/i/value/extra",
      "/arbitrary-new-page"
    ]) expect(shouldRedirect(path), path).toBe(false);
  });

  it("uses a clean one-hop 301 only on canonical Web and apex server blocks", () => {
    expect(template).not.toContain("map_hash_bucket_size");
    const legacyReturn = "if ($tikdd_legacy_home_redirect) { return 301 https://__TIKDD_WEB_HOST__/; }";
    const contentReturn = "if ($tikdd_legacy_content_target) { return 301 https://__TIKDD_WEB_HOST__$tikdd_legacy_content_target; }";
    expect(template.split(legacyReturn)).toHaveLength(3);
    expect(template.split(contentReturn)).toHaveLength(3);
    expect(template).toMatch(
      /server_name __TIKDD_WEB_HOST__;[\s\S]*?if \(\$tikdd_legacy_home_redirect\) \{ return 301 https:\/\/__TIKDD_WEB_HOST__\/; \}[\s\S]*?location \//
    );
    expect(template).toMatch(
      /server_name __TIKDD_WEB_APEX_HOST__;[\s\S]*?if \(\$tikdd_legacy_home_redirect\) \{ return 301 https:\/\/__TIKDD_WEB_HOST__\/; \}[\s\S]*?return 301 https:\/\/__TIKDD_WEB_HOST__\$request_uri;/
    );
    expect(legacyReturn).not.toContain("$request_uri");
    expect(contentReturn).not.toContain("$request_uri");
  });
});
