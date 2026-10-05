import { describe, expect, it } from "vitest";
import { YtDlpAdmissionGate } from "../src/admission";

describe("yt-dlp YouTube admission gate", () => {
  it("limits concurrent and too-close YouTube requests while leaving Dailymotion untouched", () => {
    let now = 1_800_000_000_000;
    const gate = new YtDlpAdmissionGate(15_000, () => now);
    const release = gate.tryAcquire("youtube");
    expect(release).toBeTypeOf("function");
    expect(gate.tryAcquire("youtube")).toBeNull();
    release?.();
    expect(gate.tryAcquire("youtube")).toBeNull();
    expect(gate.tryAcquire("dailymotion")).toBeTypeOf("function");
    now += 15_000;
    const next = gate.tryAcquire("youtube");
    expect(next).toBeTypeOf("function");
    next?.();
  });
});
