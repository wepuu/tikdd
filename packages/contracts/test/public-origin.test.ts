import { describe, expect, it } from "vitest";
import { loadPublicWebOrigin } from "../src/index";

describe("public Web origin configuration", () => {
  it("prefers the public origin when the legacy variable is internal", () => {
    expect(
      loadPublicWebOrigin({
        NODE_ENV: "production",
        TIKDD_WEB_PUBLIC_ORIGIN: "https://www.tikdd.cc",
        WEB_ORIGIN: "http://web:3000"
      })
    ).toBe("https://www.tikdd.cc");
  });

  it("supports the legacy variable for local development", () => {
    expect(loadPublicWebOrigin({ WEB_ORIGIN: "http://localhost:3000" })).toBe(
      "http://localhost:3000"
    );
  });

  it("fails closed when production has no explicit public origin", () => {
    expect(() => loadPublicWebOrigin({ NODE_ENV: "production", WEB_ORIGIN: "https://www.tikdd.cc" }))
      .toThrow("TIKDD_WEB_PUBLIC_ORIGIN is required");
  });

  it("rejects non-HTTPS production origins and path-bearing values", () => {
    expect(() =>
      loadPublicWebOrigin({ NODE_ENV: "production", TIKDD_WEB_PUBLIC_ORIGIN: "http://web:3000" })
    ).toThrow("HTTPS");
    expect(() =>
      loadPublicWebOrigin({ TIKDD_WEB_PUBLIC_ORIGIN: "https://www.tikdd.cc/app" })
    ).toThrow("exact origin");
  });
});
