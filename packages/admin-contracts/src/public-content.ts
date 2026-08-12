import { z } from "zod";
import { AdminSchemaVersionSchema } from "./common";
import { PublishedContentSnapshotSchema } from "./editorial";

export const PublicContentPathSchema = z
  .string()
  .min(1)
  .max(280)
  .regex(/^\/[A-Za-z0-9/_-]*$/);

export const PublicContentRevalidationCommandSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  snapshotId: z.string().regex(/^snap_[a-f0-9]{32}$/),
  paths: z.array(PublicContentPathSchema).max(100)
});

export const PublicContentRevalidationAcknowledgementSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  acknowledged: z.literal(true),
  snapshotId: z.string().regex(/^snap_[a-f0-9]{32}$/),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  checkedAt: z.iso.datetime({ offset: true })
});

export const PublicContentHealthSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  status: z.enum(["ready", "stale", "seed"]),
  source: z.enum(["database", "last-known-good", "bundled-seed"]),
  snapshotId: PublishedContentSnapshotSchema.shape.snapshotId,
  revision: PublishedContentSnapshotSchema.shape.revision,
  generatedAt: PublishedContentSnapshotSchema.shape.generatedAt,
  checkedAt: z.iso.datetime({ offset: true })
});

export type PublicContentRevalidationCommand = z.infer<typeof PublicContentRevalidationCommandSchema>;
export type PublicContentRevalidationAcknowledgement = z.infer<typeof PublicContentRevalidationAcknowledgementSchema>;
export type PublicContentHealth = z.infer<typeof PublicContentHealthSchema>;
