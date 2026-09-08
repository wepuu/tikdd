import { z } from "zod";
import { AdminTimestampSchema } from "./common";

/**
 * Citation identities are deliberately code-owned. Admin can select one of these
 * reviewed references, but it cannot submit an arbitrary URL or remote entity.
 */
export const GeoSourceIdSchema = z.enum([
  "tikdd-workflow",
  "x-public-content",
  "instagram-public-content"
]);

export const GeoContentSchema = z
  .strictObject({
    directAnswer: z
      .string()
      .trim()
      .min(20)
      .max(500)
      .refine((value) => !/[<>]/.test(value), "GEO answers cannot contain raw HTML.")
      .refine((value) => !/https?:\/\//i.test(value), "GEO answers cannot contain remote URLs."),
    reviewStatus: z.enum(["draft", "reviewed"]),
    reviewedAt: AdminTimestampSchema.nullable(),
    sourceRefs: z.array(GeoSourceIdSchema).max(4)
  })
  .superRefine((content, context) => {
    if (new Set(content.sourceRefs).size !== content.sourceRefs.length) {
      context.addIssue({ code: "custom", message: "GEO source references must be unique.", path: ["sourceRefs"] });
    }
    if (content.reviewStatus === "reviewed" && (!content.reviewedAt || content.sourceRefs.length === 0)) {
      context.addIssue({ code: "custom", message: "Reviewed GEO content requires a review timestamp and source reference.", path: ["reviewStatus"] });
    }
    if (content.reviewStatus === "draft" && content.reviewedAt !== null) {
      context.addIssue({ code: "custom", message: "Draft GEO content cannot carry a review timestamp.", path: ["reviewedAt"] });
    }
  });

export type GeoSourceId = z.infer<typeof GeoSourceIdSchema>;
export type GeoContent = z.infer<typeof GeoContentSchema>;

/** Labels are safe display metadata; URLs remain owned by the Web source catalog. */
export const GEO_SOURCE_LABELS: Record<GeoSourceId, string> = {
  "tikdd-workflow": "TikDD workflow",
  "x-public-content": "X public content guidance",
  "instagram-public-content": "Instagram public content guidance"
};

export function isGeoContentReady(content: unknown): boolean {
  const parsed = GeoContentSchema.safeParse(content);
  return parsed.success && parsed.data.reviewStatus === "reviewed" && parsed.data.sourceRefs.length > 0;
}
