import { describe, expect, it, vi } from "vitest";
import { createAdminStopPlan, isTikddAdminProcess, waitForAdminStop } from "./admin-stack-core.mjs";

const root = "D:\\Codex项目\\TikDD";
const state = {
  root,
  buildId: "dev-current",
  processes: [
    { id: "admin-api", port: 4100, launcherPid: 101, servicePid: 102 },
    { id: "admin", port: 3001, launcherPid: 201, servicePid: 202 }
  ]
};

describe("Admin stack ownership", () => {
  it("recognizes only TikDD Admin commands rooted in this workspace", () => {
    expect(isTikddAdminProcess(`node ${root}\\apps\\admin-api\\src\\server.ts`, root, "admin-api")).toBe(true);
    expect(isTikddAdminProcess(`node C:\\elsewhere\\apps\\admin-api\\src\\server.ts`, root, "admin-api")).toBe(false);
    expect(isTikddAdminProcess(`node ${root}\\apps\\web\\server.ts`, root, "admin-api")).toBe(false);
  });

  it("does not target a reused stale PID or an unrelated port owner", () => {
    const plan = createAdminStopPlan({
      root,
      state,
      healthById: { "admin-api": null, admin: { buildId: "old-build" } },
      portPids: { "admin-api": 999, admin: 998 },
      commandLines: { 101: "node C:\\other\\server.js", 201: "node C:\\other\\server.js", 102: "", 202: "" }
    });
    expect(plan.targets).toEqual([]);
    expect(plan.verifiedServices).toEqual([]);
  });

  it("plans only the service whose health build or command line proves ownership", () => {
    const plan = createAdminStopPlan({
      root,
      state,
      healthById: { "admin-api": { buildId: "dev-current" }, admin: { buildId: "old-build" } },
      portPids: { "admin-api": 102, admin: 998 },
      commandLines: {
        101: `node ${root}\\apps\\admin-api\\src\\server.ts`,
        201: "node C:\\other\\next.js"
      }
    });
    expect(new Set(plan.targets)).toEqual(new Set([101, 102]));
    expect(plan.verifiedServices).toEqual(["admin-api"]);
    expect(plan.buildMatches).toEqual([{ id: "admin-api", matches: true }, { id: "admin", matches: false }]);
  });
});

describe("Admin stack stop verification", () => {
  it("waits until process trees and the recorded build are both gone", async () => {
    let pass = 0;
    const delay = vi.fn(async () => { pass += 1; });
    const stopped = await waitForAdminStop({
      targets: [101, 102],
      alive: () => pass < 2,
      buildStillRunning: async () => pass < 1,
      delay,
      attempts: 4
    });
    expect(stopped).toBe(true);
    expect(delay).toHaveBeenCalledTimes(2);
  });

  it("fails closed when the recorded build survives the stop budget", async () => {
    const stopped = await waitForAdminStop({
      targets: [],
      alive: () => false,
      buildStillRunning: async () => true,
      delay: async () => undefined,
      attempts: 2
    });
    expect(stopped).toBe(false);
  });
});
