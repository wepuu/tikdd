import { describe, expect, it } from "vitest";
import { DeliverySchema } from "../src/index";

const base = {
  id: "dtk_fixture",
  mode: "redirect" as const,
  url: "https://download.example.test/d/token",
  expiresAt: "2026-08-04T12:10:00.000Z"
};

describe("Delivery browser handoff contract", () => {
  it("keeps older responses valid when browserHandoff is omitted", () => {
    expect(DeliverySchema.parse(base).browserHandoff).toBeUndefined();
  });

  it("accepts the reviewed CORS save strategy", () => {
    expect(DeliverySchema.parse({ ...base, browserHandoff: "cors-download" }).browserHandoff)
      .toBe("cors-download");
  });
});
