export interface LocoLoaderBudgetPermit {
  /** Releases only the in-flight slot. The extraction token is never returned. */
  release(): Promise<void> | void;
}

export interface LocoLoaderRequestBudget {
  /** Reserves one upstream extraction. A null result must not call the Provider. */
  acquire(): Promise<LocoLoaderBudgetPermit | null>;
}

export interface MemoryLocoLoaderRequestBudgetOptions {
  maxExtractions?: number;
  windowMs?: number;
  maxConcurrency?: number;
  minIntervalMs?: number;
  now?: () => number;
}

/**
 * Deterministic budget used by adapter tests and local diagnostics. Production uses the
 * Redis implementation in apps/worker so all worker processes share one extraction window.
 */
export class MemoryLocoLoaderRequestBudget implements LocoLoaderRequestBudget {
  private readonly maxExtractions: number;
  private readonly windowMs: number;
  private readonly maxConcurrency: number;
  private readonly minIntervalMs: number;
  private readonly now: () => number;
  private windowStartedAt = 0;
  private extractions = 0;
  private active = 0;
  private nextAllowedAt = 0;

  constructor(options: MemoryLocoLoaderRequestBudgetOptions = {}) {
    this.maxExtractions = Math.max(1, Math.min(100, Math.floor(options.maxExtractions ?? 2)));
    this.windowMs = Math.max(1_000, Math.min(24 * 60 * 60 * 1_000, Math.floor(options.windowMs ?? 6 * 60 * 60 * 1_000)));
    this.maxConcurrency = Math.max(1, Math.min(16, Math.floor(options.maxConcurrency ?? 1)));
    this.minIntervalMs = Math.max(0, Math.min(60_000, Math.floor(options.minIntervalMs ?? 1_000)));
    this.now = options.now ?? Date.now;
  }

  async acquire(): Promise<LocoLoaderBudgetPermit | null> {
    const now = this.now();
    if (this.windowStartedAt === 0 || now - this.windowStartedAt >= this.windowMs) {
      this.windowStartedAt = now;
      this.extractions = 0;
    }
    if (this.extractions >= this.maxExtractions || this.active >= this.maxConcurrency || now < this.nextAllowedAt) {
      return null;
    }
    this.extractions += 1;
    this.active += 1;
    this.nextAllowedAt = now + this.minIntervalMs;
    let released = false;
    return {
      release: () => {
        if (!released) {
          released = true;
          this.active = Math.max(0, this.active - 1);
        }
      }
    };
  }

  snapshot(): { extractions: number; active: number; maxExtractions: number } {
    return { extractions: this.extractions, active: this.active, maxExtractions: this.maxExtractions };
  }
}
