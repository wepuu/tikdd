import { PlatformIdSchema, ProviderFailureCodeSchema, RegionIdSchema } from "@tikdd/contracts";
import { z } from "zod";
import { RolloutProviderIdSchema, RolloutSnapshotSchema, type PilotEvidence, type RolloutSnapshot } from "./model";

export const PilotObservationClassSchema = z.enum(["canary", "internal", "public"]);
export type PilotObservationClass = z.infer<typeof PilotObservationClassSchema>;

export const DeliveryOutcomeStageSchema = z.enum([
  "ticket_creation", "redirect_validation", "ticket_expiry", "browser_handoff"
]);
export const DeliveryOutcomeResultSchema = z.enum([
  "succeeded", "candidate_missing", "candidate_expired", "task_unavailable", "rejected",
  "internal_error", "passed", "ticket_invalid", "ticket_expired", "host_rejected",
  "dns_rejected", "mode_rejected", "expired_unredeemed", "redirect_issued"
]);
const allowedDeliveryResults: Record<z.infer<typeof DeliveryOutcomeStageSchema>, ReadonlySet<string>> = {
  ticket_creation: new Set(["succeeded", "candidate_missing", "candidate_expired", "task_unavailable", "rejected", "internal_error"]),
  redirect_validation: new Set(["passed", "ticket_invalid", "ticket_expired", "candidate_expired", "host_rejected", "dns_rejected", "mode_rejected", "internal_error"]),
  ticket_expiry: new Set(["expired_unredeemed"]),
  browser_handoff: new Set(["redirect_issued"])
};

export const DeliveryOutcomeSchema = z.object({
  outcomeId: z.string().uuid(),
  providerId: RolloutProviderIdSchema,
  platform: PlatformIdSchema,
  region: RegionIdSchema,
  observationClass: PilotObservationClassSchema,
  mode: z.enum(["redirect", "proxy", "temporary-object"]),
  stage: DeliveryOutcomeStageSchema,
  result: DeliveryOutcomeResultSchema,
  durationMs: z.number().int().min(0).max(120_000),
  occurredAt: z.string().datetime(),
  ingestedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  deliveryPolicyVersion: z.number().int().positive(),
  taxonomyVersion: z.number().int().positive()
}).strict().superRefine((outcome, context) => {
  if (!allowedDeliveryResults[outcome.stage].has(outcome.result)) {
    context.addIssue({ code: "custom", message: "Delivery stage and result are inconsistent.", path: ["result"] });
  }
  if (new Date(outcome.expiresAt) <= new Date(outcome.occurredAt)) {
    context.addIssue({ code: "custom", message: "Delivery outcome expiry must follow occurrence.", path: ["expiresAt"] });
  }
});
export type DeliveryOutcome = z.infer<typeof DeliveryOutcomeSchema>;

export const ResolutionEvidenceObservationSchema = z.object({
  taskId: z.string().min(1).max(128),
  providerId: RolloutProviderIdSchema,
  platform: PlatformIdSchema,
  region: RegionIdSchema,
  observationClass: PilotObservationClassSchema,
  status: z.enum(["succeeded", "failed"]),
  failureCode: ProviderFailureCodeSchema.nullable(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  fallbackDepth: z.number().int().min(0).max(99),
  resultFormatCount: z.number().int().nonnegative(),
  candidateCount: z.number().int().nonnegative(),
  absoluteStop: z.boolean().default(false)
});
export type ResolutionEvidenceObservation = z.infer<typeof ResolutionEvidenceObservationSchema>;

const CountMapSchema = z.record(z.string(), z.number().int().nonnegative());
export const PilotDailyEvidenceSchema = z.object({
  providerId: RolloutProviderIdSchema,
  platform: PlatformIdSchema,
  region: RegionIdSchema,
  observationClass: PilotObservationClassSchema,
  utcDay: z.string().date(),
  windowStartedAt: z.string().datetime(),
  windowEndedAt: z.string().datetime(),
  completeness: z.enum(["open", "complete", "sealed"]),
  aggregationVersion: z.number().int().positive(),
  taxonomyVersion: z.number().int().positive(),
  sourceWatermark: z.string().datetime(),
  aggregateRevision: z.number().int().positive(),
  generatedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  distinctResolutionTasks: z.number().int().nonnegative(),
  resolutionObservationCount: z.number().int().nonnegative(),
  resolutionSuccessCount: z.number().int().nonnegative(),
  resolutionFailureCounts: CountMapSchema,
  latencyHistogram: CountMapSchema,
  latencyP50Ms: z.number().int().nonnegative(),
  latencyP95Ms: z.number().int().nonnegative(),
  fallbackDepthHistogram: CountMapSchema,
  fallbackDepthP95: z.number().int().min(0).max(99),
  resultFormatCount: z.number().int().nonnegative(),
  candidateCount: z.number().int().nonnegative(),
  deliveryCounts: CountMapSchema,
  absoluteStopCount: z.number().int().nonnegative(),
  lateAfterSealCount: z.number().int().nonnegative()
});
export type PilotDailyEvidence = z.infer<typeof PilotDailyEvidenceSchema>;

const latencyBounds = [1_000, 3_000, 5_000, 8_000, 15_000, 30_000, 60_000, 120_000] as const;
function bucket(value: number, bounds: readonly number[]): string {
  return String(bounds.find((bound) => value <= bound) ?? bounds.at(-1));
}
function increment(target: Record<string, number>, key: string, value = 1): void {
  target[key] = (target[key] ?? 0) + value;
}
function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.max(0, Math.ceil(ordered.length * ratio) - 1)] ?? 0;
}
function failureClass(code: string | null): string {
  if (!code) return "other";
  if (["content_private", "authentication_required", "payment_required", "drm_protected", "geo_restricted", "content_not_found", "unsupported_url", "invalid_url"].includes(code)) return `terminal:${code}`;
  if (["invalid_result", "provider_schema_changed"].includes(code)) return "invalid_result";
  if (["provider_challenge", "provider_rate_limited"].includes(code)) return "challenge";
  if (["provider_timeout", "provider_unavailable"].includes(code)) return "timeout";
  return "other";
}
function failureRank(item: ResolutionEvidenceObservation): number {
  if (item.absoluteStop) return 6;
  const category=failureClass(item.failureCode);
  if (category.startsWith("terminal:")) return 5;
  return category==="invalid_result"?4:category==="challenge"?3:category==="timeout"?2:1;
}
function collapseTask(items: readonly ResolutionEvidenceObservation[]): ResolutionEvidenceObservation {
  const successes=items.filter((item)=>item.status==="succeeded").sort((a,b)=>a.finishedAt.localeCompare(b.finishedAt));
  const selected=successes.at(-1)??[...items].sort((a,b)=>failureRank(b)-failureRank(a)||b.finishedAt.localeCompare(a.finishedAt))[0]!;
  const earliest=Math.min(...items.map((item)=>new Date(item.startedAt).getTime()));
  const finished=new Date(selected.finishedAt).getTime();
  return {...selected,durationMs:Math.max(0,Math.min(120_000,finished-earliest)),
    fallbackDepth:Math.max(...items.map((item)=>item.fallbackDepth)),
    absoluteStop:items.some((item)=>item.absoluteStop),
    resultFormatCount:selected.status==="succeeded"?Math.max(...successes.map((item)=>item.resultFormatCount)):0,
    candidateCount:selected.status==="succeeded"?Math.max(...successes.map((item)=>item.candidateCount)):0};
}
function tupleKey(value: { providerId: string; platform: string; region: string; observationClass: string }): string {
  return `${value.providerId}\0${value.platform}\0${value.region}\0${value.observationClass}`;
}

export function aggregatePilotEvidenceDay(input: {
  utcDay: string;
  resolutions: readonly ResolutionEvidenceObservation[];
  deliveries: readonly DeliveryOutcome[];
  now?: Date;
  revisionByTuple?: ReadonlyMap<string, number>;
  aggregationVersion?: number;
  taxonomyVersion?: number;
}): PilotDailyEvidence[] {
  const dayStart = new Date(`${input.utcDay}T00:00:00.000Z`);
  if (Number.isNaN(dayStart.getTime())) throw new Error("UTC evidence day is invalid.");
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const now = input.now ?? new Date();
  const completeness = now < dayEnd ? "open" : now < new Date(dayEnd.getTime() + 48 * 3_600_000) ? "complete" : "sealed";
  const groups = new Map<string, { resolutions: ResolutionEvidenceObservation[]; deliveries: DeliveryOutcome[] }>();
  const ensure = (value: { providerId: string; platform: string; region: string; observationClass: PilotObservationClass }) => {
    const key = tupleKey(value);
    const current = groups.get(key) ?? { resolutions: [], deliveries: [] };
    groups.set(key, current);
    return current;
  };
  for (const raw of input.resolutions) {
    const item = ResolutionEvidenceObservationSchema.parse(raw);
    const finished = new Date(item.finishedAt);
    if (finished >= dayStart && finished < dayEnd) ensure(item).resolutions.push(item);
  }
  for (const raw of input.deliveries) {
    const item = DeliveryOutcomeSchema.parse(raw);
    const occurred = new Date(item.occurredAt);
    if (occurred >= dayStart && occurred < dayEnd) ensure(item).deliveries.push(item);
  }
  return [...groups.entries()].map(([key, group]) => {
    const [providerId = "", platform = "", region = "", observationClass = "public"] = key.split("\0");
    const groupedTasks = new Map<string, ResolutionEvidenceObservation[]>();
    for (const item of group.resolutions) {
      const task=groupedTasks.get(item.taskId)??[];task.push(item);groupedTasks.set(item.taskId,task);
    }
    const observations = [...groupedTasks.values()].map(collapseTask);
    const failures: Record<string, number> = {};
    const latencyHistogram: Record<string, number> = {};
    const fallbackHistogram: Record<string, number> = {};
    const deliveryCounts: Record<string, number> = {};
    const durations: number[] = [];
    const fallbackDepths: number[] = [];
    for (const item of observations) {
      const duration = Math.min(item.durationMs, 120_000);
      durations.push(duration); fallbackDepths.push(item.fallbackDepth);
      increment(latencyHistogram, bucket(duration, latencyBounds));
      increment(fallbackHistogram, String(item.fallbackDepth));
      if (item.status === "failed") increment(failures, failureClass(item.failureCode));
    }
    for (const item of group.deliveries) increment(deliveryCounts, `${item.stage}:${item.result}`);
    const watermark = [...group.resolutions.map((item) => item.finishedAt), ...group.deliveries.map((item) => item.ingestedAt)].sort().at(-1) ?? dayStart.toISOString();
    return PilotDailyEvidenceSchema.parse({
      providerId, platform, region, observationClass, utcDay: input.utcDay,
      windowStartedAt: dayStart.toISOString(), windowEndedAt: dayEnd.toISOString(), completeness,
      aggregationVersion: input.aggregationVersion ?? 1, taxonomyVersion: input.taxonomyVersion ?? 1,
      sourceWatermark: watermark, aggregateRevision: (input.revisionByTuple?.get(key) ?? 0) + 1,
      generatedAt: now.toISOString(), expiresAt: new Date(dayEnd.getTime() + 400 * 86_400_000).toISOString(),
      distinctResolutionTasks: observationClass === "canary" ? 0 : observations.length,
      resolutionObservationCount: observations.length,
      resolutionSuccessCount: observations.filter((item) => item.status === "succeeded").length,
      resolutionFailureCounts: failures, latencyHistogram, latencyP50Ms: percentile(durations, 0.5), latencyP95Ms: percentile(durations, 0.95),
      fallbackDepthHistogram: fallbackHistogram, fallbackDepthP95: percentile(fallbackDepths, 0.95),
      resultFormatCount: observations.reduce((sum, item) => sum + item.resultFormatCount, 0),
      candidateCount: observations.reduce((sum, item) => sum + item.candidateCount, 0),
      deliveryCounts, absoluteStopCount: observations.filter((item) => item.absoluteStop).length, lateAfterSealCount: 0
    });
  });
}

function bps(numerator: number, denominator: number, empty = 0): number {
  return denominator === 0 ? empty : Math.max(0, Math.min(10_000, Math.round(numerator * 10_000 / denominator)));
}
export function buildPilotEvidence(daysInput: readonly PilotDailyEvidence[], collectedAt = new Date()): PilotEvidence {
  const days = daysInput.map((item) => PilotDailyEvidenceSchema.parse(item)).sort((a, b) => a.utcDay.localeCompare(b.utcDay));
  if (days.length === 0) throw new Error("Pilot evidence requires at least one daily summary.");
  const first = days[0] as PilotDailyEvidence;
  if(first.observationClass==="canary")throw new Error("Canary evidence cannot drive a pilot Guard.");
  if (days.some((day) => tupleKey(day) !== tupleKey(first) || day.aggregationVersion !== first.aggregationVersion || day.taxonomyVersion !== first.taxonomyVersion || day.completeness === "open")) {
    throw new Error("Pilot evidence days must be complete, version-compatible, and exact-tuple.");
  }
  for (let index = 1; index < days.length; index += 1) {
    if (new Date(days[index]!.windowStartedAt).getTime() !== new Date(days[index - 1]!.windowEndedAt).getTime()) throw new Error("Pilot evidence days must be consecutive.");
  }
  const samples = days.reduce((sum, day) => sum + day.distinctResolutionTasks, 0);
  const successes = days.reduce((sum, day) => sum + day.resolutionSuccessCount, 0);
  const failures = (key: string) => days.reduce((sum, day) => sum + (day.resolutionFailureCounts[key] ?? 0), 0);
  const deliveryTotal = days.reduce((sum, day) => sum + Object.entries(day.deliveryCounts).filter(([key]) => key.startsWith("redirect_validation:")).reduce((value, [, count]) => value + count, 0), 0);
  const deliveryPassed = days.reduce((sum, day) => sum + (day.deliveryCounts["redirect_validation:passed"] ?? 0), 0);
  const expiryTotal = days.reduce((sum, day) => sum + (day.deliveryCounts["ticket_expiry:expired_unredeemed"] ?? 0), 0);
  const formats = days.reduce((sum, day) => sum + day.resultFormatCount, 0);
  const candidates = days.reduce((sum, day) => sum + day.candidateCount, 0);
  const mergedHistogram=(name:"latencyHistogram"|"fallbackDepthHistogram")=>{const result:Record<string,number>={};for(const day of days)for(const [key,count] of Object.entries(day[name]))increment(result,key,count);return result;};
  const histogramPercentile=(histogram:Record<string,number>,ratio:number)=>{const entries=Object.entries(histogram).map(([key,count])=>[Number(key),count] as const).sort((a,b)=>a[0]-b[0]);const total=entries.reduce((sum,[,count])=>sum+count,0);const target=Math.max(1,Math.ceil(total*ratio));let seen=0;for(const [bound,count] of entries){seen+=count;if(seen>=target)return bound;}return 0;};
  return {
    providerId: first.providerId, platform: first.platform, region: first.region,
    observationClass: first.observationClass,
    aggregationVersion: first.aggregationVersion, taxonomyVersion: first.taxonomyVersion,
    dayRevisions: days.map((day) => day.aggregateRevision), completeDays: days.length,
    sealedDays: days.filter((day) => day.completeness === "sealed").length,
    windowStartedAt: first.windowStartedAt, windowEndedAt: days.at(-1)!.windowEndedAt,
    collectedAt: collectedAt.toISOString(), distinctSamples: samples,
    resolutionSuccessBps: bps(successes, samples), p95LatencyMs: histogramPercentile(mergedHistogram("latencyHistogram"),0.95),
    challengeRateBps: bps(failures("challenge"), samples), timeoutRateBps: bps(failures("timeout"), samples),
    invalidResultRateBps: bps(failures("invalid_result"), samples), deliverySuccessBps: bps(deliveryPassed, deliveryTotal),
    candidateCoverageBps: bps(candidates, formats), fallbackDepthP95: histogramPercentile(mergedHistogram("fallbackDepthHistogram"),0.95),
    expiryRateBps: bps(expiryTotal, Math.max(expiryTotal + deliveryPassed, 0)),
    absoluteStop: days.some((day) => day.absoluteStopCount > 0)
  };
}

export function resolveOperatorTupleAuthorization(input: {
  snapshot: RolloutSnapshot;
  providerId: string;
  platform: string;
  region: string;
  now?: Date;
}): { allowed: boolean; allocationBps: number; snapshotRevision: number; reason: "grant"|"deny"|"missing" } {
  const snapshot = RolloutSnapshotSchema.parse(input.snapshot);
  const now = input.now ?? new Date();
  const active = snapshot.rules.filter((rule) => new Date(rule.activatesAt) <= now &&
    (rule.expiresAt === null || new Date(rule.expiresAt) > now));
  const matches = (value: string, actual: string) => value === "*" || value === actual;
  const matching = active.filter((rule) => matches(rule.providerId,input.providerId) &&
    matches(rule.platform,input.platform) && matches(rule.region,input.region));
  if (matching.some((rule) => !rule.enabled)) return { allowed:false,allocationBps:0,snapshotRevision:snapshot.revision,reason:"deny" };
  const grants = matching.filter((rule) => rule.enabled).sort((left,right) => {
    const specificity = (rule: typeof left) => Number(rule.providerId!=="*")+Number(rule.platform!=="*")+Number(rule.region!=="*");
    return specificity(right)-specificity(left);
  });
  const grant = grants[0];
  return grant ? { allowed:true,allocationBps:grant.allocationBps,snapshotRevision:snapshot.revision,reason:"grant" } :
    { allowed:false,allocationBps:0,snapshotRevision:snapshot.revision,reason:"missing" };
}
