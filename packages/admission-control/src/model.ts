import { PlatformIdSchema, RegionIdSchema } from "@tikdd/contracts";
import { z } from "zod";

const PolicyIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);
const ProviderIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);

export const ProviderConcurrencyKeySchema = z.object({
  providerId: ProviderIdSchema,
  platform: PlatformIdSchema,
  region: RegionIdSchema
});
export type ProviderConcurrencyKey = z.infer<typeof ProviderConcurrencyKeySchema>;

export const ProviderConcurrencyLimitSchema = z.object({
  providerId: ProviderIdSchema,
  platform: z.union([z.literal("*"), PlatformIdSchema]),
  region: z.union([z.literal("*"), RegionIdSchema]),
  limit: z.number().int().min(1).max(10_000)
});
export type ProviderConcurrencyLimit = z.infer<typeof ProviderConcurrencyLimitSchema>;

export const AdmissionControlPolicySchema = z
  .object({
    version: PolicyIdSchema,
    deployment: PolicyIdSchema,
    region: RegionIdSchema,
    requestWindowMs: z.number().int().min(1_000).max(24 * 60 * 60 * 1_000),
    clientRequestLimit: z.number().int().min(1).max(1_000_000),
    globalRequestLimit: z.number().int().min(1).max(10_000_000),
    clientActiveTaskLimit: z.number().int().min(1).max(10_000),
    globalActiveTaskLimit: z.number().int().min(1).max(1_000_000),
    taskPermitTtlMs: z.number().int().min(30_000).max(24 * 60 * 60 * 1_000),
    providerDefaultConcurrency: z.number().int().min(1).max(10_000),
    providerLeaseTtlMs: z.number().int().min(1_000).max(10 * 60 * 1_000),
    providerLimits: z.array(ProviderConcurrencyLimitSchema).max(1_000).default([])
  })
  .superRefine((policy, context) => {
    if (policy.globalRequestLimit < policy.clientRequestLimit) {
      context.addIssue({
        code: "custom",
        message: "globalRequestLimit must be at least clientRequestLimit.",
        path: ["globalRequestLimit"]
      });
    }
    if (policy.globalActiveTaskLimit < policy.clientActiveTaskLimit) {
      context.addIssue({
        code: "custom",
        message: "globalActiveTaskLimit must be at least clientActiveTaskLimit.",
        path: ["globalActiveTaskLimit"]
      });
    }
    const seen = new Set<string>();
    for (const [index, limit] of policy.providerLimits.entries()) {
      const key = `${limit.providerId}:${limit.platform}:${limit.region}`;
      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate provider concurrency limit: ${key}`,
          path: ["providerLimits", index]
        });
      }
      seen.add(key);
    }
  });
export type AdmissionControlPolicy = z.infer<typeof AdmissionControlPolicySchema>;

export function resolveProviderConcurrencyLimit(
  policyInput: AdmissionControlPolicy,
  keyInput: ProviderConcurrencyKey
): number {
  const policy = AdmissionControlPolicySchema.parse(policyInput);
  const key = ProviderConcurrencyKeySchema.parse(keyInput);
  const matching = policy.providerLimits
    .filter(
      (candidate) =>
        candidate.providerId === key.providerId &&
        (candidate.platform === "*" || candidate.platform === key.platform) &&
        (candidate.region === "*" || candidate.region === key.region)
    )
    .sort((left, right) => {
      const leftSpecificity = Number(left.platform !== "*") * 2 + Number(left.region !== "*");
      const rightSpecificity =
        Number(right.platform !== "*") * 2 + Number(right.region !== "*");
      return rightSpecificity - leftSpecificity;
    });
  return matching[0]?.limit ?? policy.providerDefaultConcurrency;
}
