import { describe, expect, it } from "vitest";
import { verifyWorkItem16Static } from "./verify-work-item-16-static.mjs";

describe("Work Item 16 production deployment contract", () => {
  it("keeps ingress, namespaces, networks, jobs, images, and secrets inside the approved boundary", () => {
    expect(verifyWorkItem16Static()).toEqual({
      serviceCount: 15,
      networkCount: 2,
      publishedServiceCount: 4
    });
  });
});
