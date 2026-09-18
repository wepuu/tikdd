export interface SocialDownloaderRequestBudgetOptions {
  maxConcurrency?: number;
  minIntervalMs?: number;
  maxCooldownMs?: number;
  now?: () => number;
}

export interface SocialDownloaderBudgetPermit {
  release(): void;
}

/**
 * A small provider-wide admission guard. SocialDownloader applies one IP quota
 * across all platform endpoints, so a tuple-only concurrency cap is insufficient.
 * The guard fails fast instead of queueing work and amplifying an upstream limit.
 */
export class SocialDownloaderRequestBudget {
  private readonly maxConcurrency: number;
  private readonly minIntervalMs: number;
  private readonly maxCooldownMs: number;
  private readonly now: () => number;
  private active = 0;
  private nextAllowedAt = 0;
  private cooldownUntil = 0;

  constructor(options: SocialDownloaderRequestBudgetOptions = {}) {
    this.maxConcurrency = Math.max(1, Math.min(16, Math.floor(options.maxConcurrency ?? 1)));
    this.minIntervalMs = Math.max(0, Math.min(60_000, Math.floor(options.minIntervalMs ?? 750)));
    this.maxCooldownMs = Math.max(1_000, Math.min(10 * 60_000, Math.floor(options.maxCooldownMs ?? 60_000)));
    this.now = options.now ?? Date.now;
  }

  tryAcquire(): SocialDownloaderBudgetPermit | null {
    const now = this.now();
    if (this.active >= this.maxConcurrency || now < this.nextAllowedAt || now < this.cooldownUntil) {
      return null;
    }
    this.active += 1;
    this.nextAllowedAt = now + this.minIntervalMs;
    let released = false;
    return {
      release: () => {
        if (released) return;
        released = true;
        this.active = Math.max(0, this.active - 1);
      }
    };
  }

  applyRetryAfter(value: string | null): void {
    const now = this.now();
    const seconds = value === null ? NaN : Number.parseInt(value.trim(), 10);
    const retryAfterMs = Number.isFinite(seconds)
      ? seconds * 1_000
      : value
        ? Math.max(0, Date.parse(value) - now)
        : this.minIntervalMs;
    this.cooldownUntil = Math.max(
      this.cooldownUntil,
      now + Math.min(this.maxCooldownMs, Math.max(this.minIntervalMs, retryAfterMs))
    );
  }

  snapshot(): { active: number; maxConcurrency: number; cooldownActive: boolean } {
    return {
      active: this.active,
      maxConcurrency: this.maxConcurrency,
      cooldownActive: this.cooldownUntil > this.now()
    };
  }
}
