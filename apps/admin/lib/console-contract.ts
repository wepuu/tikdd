import {
  AdminOverviewSchema,
  AdminOperationalTruthSchema,
  AdminPlatformListSchema,
  AdminProviderListSchema,
  AdminRouteDetailSchema,
  AdminRouteListSchema,
  AdminCsrfTokenSchema,
  AdminContentManagementViewSchema,
  AdminContentPublicationViewSchema,
  AdminRoutePolicyViewSchema,
  AdminPlatformManagementViewSchema,
  AdminQualificationViewSchema,
  AdminRuntimeSchema,
  AdminSettingsRecoveryViewSchema,
  AdminSeoOverviewSchema
  ,AdminSeoTechnicalViewSchema
} from "@tikdd/admin-contracts";
import { z } from "zod";

function resource<T extends z.ZodType>(schema: T) {
  return z.discriminatedUnion("status", [
    z.strictObject({ status: z.literal("ready"), data: schema }),
    z.strictObject({ status: z.literal("unavailable"), data: z.null() })
  ]);
}

export const AdminConsoleSnapshotSchema = z.strictObject({
  schemaVersion: z.literal("1"),
  generatedAt: z.iso.datetime({ offset: true }),
  refreshIntervalMs: z.number().int().min(15_000).max(300_000),
  overview: resource(AdminOverviewSchema),
  operationalTruth: resource(AdminOperationalTruthSchema),
  routes: resource(AdminRouteListSchema),
  selectedRoute: resource(AdminRouteDetailSchema.nullable()),
  qualification: resource(AdminQualificationViewSchema.nullable()),
  providers: resource(AdminProviderListSchema),
  platforms: resource(AdminPlatformListSchema),
  runtime: resource(AdminRuntimeSchema),
  seo: resource(AdminSeoOverviewSchema),
  controls: resource(z.strictObject({
    csrf: AdminCsrfTokenSchema,
    routePolicy: AdminRoutePolicyViewSchema.nullable(),
    platformPresentation: AdminPlatformManagementViewSchema.nullable()
    ,contentManagement: AdminContentManagementViewSchema.nullable()
    ,contentPublication: AdminContentPublicationViewSchema.nullable()
    ,seoTechnical: AdminSeoTechnicalViewSchema.nullable()
    ,settingsRecovery: AdminSettingsRecoveryViewSchema.nullable()
  }))
});

export type AdminConsoleSnapshot = z.infer<typeof AdminConsoleSnapshotSchema>;
