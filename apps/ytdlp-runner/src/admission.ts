import type { YtDlpRunnerPlatform } from "@tikdd/contracts";

/**
 * Small in-process guard for the YouTube guest session. It deliberately
 * refuses concurrent or too-close requests instead of queueing a burst that
 * would amplify an upstream 429/bot response. Dailymotion is unaffected.
 */
export class YtDlpAdmissionGate {
  private active = false;
  private nextAllowedAt = 0;

  constructor(
    private readonly minimumIntervalMs = 15_000,
    private readonly now: () => number = Date.now
  ) {}

  tryAcquire(platform: YtDlpRunnerPlatform): (() => void) | null {
    if (platform !== "youtube") return () => undefined;
    const current = this.now();
    if (this.active || current < this.nextAllowedAt) return null;
    this.active = true;
    return () => {
      if (!this.active) return;
      this.active = false;
      this.nextAllowedAt = this.now() + Math.max(0, this.minimumIntervalMs);
    };
  }

  snapshot(): { active: boolean; nextAllowedAt: number } {
    return { active: this.active, nextAllowedAt: this.nextAllowedAt };
  }
}
