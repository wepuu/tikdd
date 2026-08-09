import { describe, expect, it } from "vitest";
import { loadCleanupConfiguration } from "../src/configuration";

describe("cleanup configuration", () => {
  it("requires a lease longer than the bounded run", () => {
    expect(() =>
      loadCleanupConfiguration({
        CLEANUP_TIME_BUDGET_MS: "5000",
        CLEANUP_LEASE_TTL_MS: "9999"
      })
    ).toThrow(/five seconds/);
  });

  it("requires an explicit production deployment namespace", () => {
    expect(() => loadCleanupConfiguration({ NODE_ENV: "production" })).toThrow(
      /required in production/
    );
  });
});
