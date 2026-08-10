import {
  evaluateRollout
} from "./decision";
import {
  ProviderRolloutRequestSchema,
  RolloutDecisionSchema,
  PilotGuardSnapshotSchema,
  RolloutSnapshotSchema,
  type ProviderRolloutRequest,
  type ProviderRolloutSource,
  type RolloutDecision,
  type RolloutSnapshot,
  type PilotGuardSnapshot
} from "./model";
import type { RedisRolloutStore } from "./redis";

export type DurableRolloutLoader = () => Promise<RolloutSnapshot>;
export type DurablePilotGuardLoader = () => Promise<PilotGuardSnapshot>;

export class StaticRolloutSource implements ProviderRolloutSource {
  constructor(private readonly allowed: boolean, private readonly development = false) {}

  async decide(requestInput: ProviderRolloutRequest): Promise<RolloutDecision> {
    const request = ProviderRolloutRequestSchema.parse(requestInput);
    const allowed = this.allowed && request.providerKind !== "mock";
    return RolloutDecisionSchema.parse({
      allowed: this.development ? this.allowed : allowed,
      reason: this.development && this.allowed ? "development_bypass" : request.providerKind === "mock" ? "production_mock_denied" : "control_unavailable",
      ruleId: null,
      snapshotRevision: null,
      bucket: null
    });
  }
}

export class RuntimeProviderRolloutSource implements ProviderRolloutSource {
  private cached: RolloutSnapshot | null = null;

  constructor(
    private readonly store: RedisRolloutStore,
    private readonly loadDurable: DurableRolloutLoader,
    private readonly cohortKey: Uint8Array,
    private readonly maximumStaleMs: number,
    private readonly now: () => Date = () => new Date(),
    private readonly guard?: {
      loadDurable: DurablePilotGuardLoader;
      required: boolean;
      maximumStaleMs: number;
    }
  ) {
    if (!Number.isInteger(maximumStaleMs) || maximumStaleMs < 5_000 || maximumStaleMs > 60_000) {
      throw new Error("Rollout maximum stale interval is invalid.");
    }
  }

  private isFresh(snapshot: RolloutSnapshot, now: Date): boolean {
    const ageMs = now.getTime() - new Date(snapshot.generatedAt).getTime();
    return ageMs >= -5_000 && ageMs <= this.maximumStaleMs;
  }

  async decide(requestInput: ProviderRolloutRequest): Promise<RolloutDecision> {
    const request = ProviderRolloutRequestSchema.parse(requestInput);
    const now = this.now();
    let snapshot: RolloutSnapshot | null = null;
    try {
      snapshot = await this.store.getSnapshot();
    } catch {
      snapshot = null;
    }
    if (snapshot && this.cached && snapshot.revision < this.cached.revision) {
      snapshot = this.isFresh(this.cached, now) ? this.cached : null;
    }

    if (!snapshot || !this.isFresh(snapshot, now)) {
      try {
        const durable = RolloutSnapshotSchema.parse(await this.loadDurable());
        snapshot =
          this.cached && durable.revision < this.cached.revision
            ? this.isFresh(this.cached, now)
              ? this.cached
              : null
            : durable;
        if (snapshot) {
          this.cached = snapshot;
        }
      } catch {
        snapshot = this.cached && this.isFresh(this.cached, now) ? this.cached : null;
      }
    } else {
      this.cached = snapshot;
    }

    if (!snapshot) {
      return RolloutDecisionSchema.parse({
        allowed: false,
        reason: "control_unavailable",
        ruleId: null,
        snapshotRevision: null,
        bucket: null
      });
    }
    if (!this.isFresh(snapshot, now)) {
      return RolloutDecisionSchema.parse({
        allowed: false,
        reason: "stale_snapshot",
        ruleId: null,
        snapshotRevision: snapshot.revision,
        bucket: null
      });
    }
    let guardSnapshot: PilotGuardSnapshot | undefined;
    if (this.guard) {
      try {
        guardSnapshot = PilotGuardSnapshotSchema.parse(await this.guard.loadDurable());
      } catch {
        guardSnapshot = undefined;
      }
    }
    return evaluateRollout({
      snapshot,
      request,
      cohortKey: this.cohortKey,
      now,
      ...(guardSnapshot ? { guardSnapshot } : {}),
      guardRequired: this.guard?.required ?? false,
      ...(this.guard ? { maximumGuardStaleMs: this.guard.maximumStaleMs } : {})
    });
  }
}

export async function refreshRolloutSnapshot(input: {
  store: RedisRolloutStore;
  loadDurable: DurableRolloutLoader;
  ttlMs: number;
}): Promise<RolloutSnapshot> {
  const snapshot = RolloutSnapshotSchema.parse(await input.loadDurable());
  if (!(await input.store.putSnapshot(snapshot, input.ttlMs))) {
    throw new Error("The rollout snapshot publication was rejected as stale.");
  }
  return snapshot;
}
