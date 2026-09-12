import { describe, expect, it, vi } from "vitest";
import { navigateToDelivery } from "../lib/delivery-navigation";

describe("Delivery browser navigation", () => {
  it("navigates to an opaque HTTPS ticket in one call", () => {
    const navigate = vi.fn();
    expect(navigateToDelivery("https://dl.tikdd.test/d/dlt_ticket", navigate)).toBe(true);
    expect(navigate).toHaveBeenCalledWith("https://dl.tikdd.test/d/dlt_ticket");
  });

  it("allows local HTTP development URLs without exposing an upstream target", () => {
    const navigate = vi.fn();
    expect(navigateToDelivery("http://localhost:4002/d/dlt_ticket", navigate)).toBe(true);
    expect(navigate).toHaveBeenCalledWith("http://localhost:4002/d/dlt_ticket");
  });

  it("fails closed for malformed or non-web URLs", () => {
    const navigate = vi.fn();
    expect(navigateToDelivery("not a URL", navigate)).toBe(false);
    expect(navigateToDelivery("javascript:alert(1)", navigate)).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
