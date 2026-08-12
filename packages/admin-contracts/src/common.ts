import { PlatformIdSchema, RegionIdSchema } from "@tikdd/contracts";
import { z } from "zod";

export const AdminSchemaVersionSchema = z.literal("1");

export const AdminProviderIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);

export const AdminDeploymentIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const AdminRevisionSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const AdminActorSubjectSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9]+(?:[._:@/-][A-Za-z0-9]+)*$/);

export const AdminReasonSchema = z.string().trim().min(1).max(500);

export const AdminTimestampSchema = z.string().datetime();

export const AdminOperationalStateSchema = z.enum([
  "healthy",
  "warning",
  "open",
  "paused",
  "insufficient_data",
  "stale",
  "unavailable",
  "draft"
]);

export const AdminPropagationStateSchema = z.enum([
  "accepted",
  "propagating",
  "propagated",
  "conflicted",
  "failed",
  "propagation_failed",
  "rolled_back"
]);

export const RouteTupleSchema = z.strictObject({
  providerId: AdminProviderIdSchema,
  platform: PlatformIdSchema,
  region: RegionIdSchema
});

export type AdminOperationalState = z.infer<typeof AdminOperationalStateSchema>;
export type AdminPropagationState = z.infer<typeof AdminPropagationStateSchema>;
export type RouteTuple = z.infer<typeof RouteTupleSchema>;
