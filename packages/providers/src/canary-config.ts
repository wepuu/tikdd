import { z } from "zod";

export const ProviderCanaryIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const CanaryProviderIdSchema = z.enum(["twittersaver", "dlpanda", "ssstwitter"]);

export type CanaryProviderId = z.infer<typeof CanaryProviderIdSchema>;

export const ProviderCanaryConfigSchema = z
  .object({
    version: z.literal(2),
    authorization: z.object({
      assertedBy: z.string().min(1),
      assertedAt: z.iso.date(),
      scope: z.string().min(1)
    }),
    scheduledCanaryIds: z.array(ProviderCanaryIdSchema).max(16).default([]),
    canaries: z
      .array(
        z.object({
          id: ProviderCanaryIdSchema,
          provider: CanaryProviderIdSchema,
          platform: z.string().min(1),
          url: z.string().url()
        })
      )
      .min(1)
  })
  .superRefine((config, context) => {
    const scheduledIds = new Set<string>();
    for (const [index, scheduledId] of config.scheduledCanaryIds.entries()) {
      if (scheduledIds.has(scheduledId)) {
        context.addIssue({ code: "custom", message: "Scheduled Canary IDs must be unique.", path: ["scheduledCanaryIds", index] });
      }
      scheduledIds.add(scheduledId);
      if (!config.canaries.some((canary) => canary.id === scheduledId)) {
        context.addIssue({ code: "custom", message: "Scheduled Canary ID must reference a configured Canary.", path: ["scheduledCanaryIds", index] });
      }
    }
    const ids = new Set<string>();
    const tuples = new Set<string>();
    config.canaries.forEach((canary, index) => {
      if (ids.has(canary.id)) {
        context.addIssue({
          code: "custom",
          message: "Canary IDs must be unique.",
          path: ["canaries", index, "id"]
        });
      }
      ids.add(canary.id);

      const tuple = `${canary.provider}\u0000${canary.platform}\u0000${canary.url}`;
      if (tuples.has(tuple)) {
        context.addIssue({
          code: "custom",
          message: "Canary provider/platform/URL tuples must be unique.",
          path: ["canaries", index]
        });
      }
      tuples.add(tuple);
    });
  });

export type ProviderCanaryConfig = z.infer<typeof ProviderCanaryConfigSchema>;
export type ProviderCanary = ProviderCanaryConfig["canaries"][number];

export interface ProviderCanaryFilters {
  id?: string | undefined;
  provider?: string | undefined;
}

export function selectProviderCanaries(
  config: ProviderCanaryConfig,
  filters: ProviderCanaryFilters
): readonly ProviderCanary[] {
  const id = filters.id ? ProviderCanaryIdSchema.parse(filters.id) : null;
  const provider = filters.provider ? CanaryProviderIdSchema.parse(filters.provider) : null;
  const selected = config.canaries.filter(
    (canary) =>
      (id === null || canary.id === id) &&
      (provider === null || canary.provider === provider)
  );

  if (selected.length === 0) {
    throw new Error("No canaries matched CANARY_ID and CANARY_PROVIDER.");
  }
  return selected;
}

export function selectScheduledProviderCanaries(config: ProviderCanaryConfig): readonly ProviderCanary[] {
  if (config.scheduledCanaryIds.length === 0) throw new Error("No recurring scheduled Canary authorization is configured.");
  const selected = config.scheduledCanaryIds.map((id) => config.canaries.find((canary) => canary.id === id));
  if (selected.some((canary) => !canary)) throw new Error("A scheduled Canary authorization references an unknown ID.");
  const result = selected as ProviderCanary[];
  for (const canary of result) {
    if (canary.provider !== "ssstwitter" || canary.platform !== "x" || !canary.url.startsWith("https://x.com/SpaceX/status/2093477720638341395")) {
      throw new Error("Scheduled Canary authorization is outside the reviewed recurring tuple.");
    }
  }
  return result;
}
