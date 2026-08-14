import {
  AdminLocaleRevisionSchema,
  AdminPageRevisionSchema,
  AdminPlatformPresentationRevisionSchemaV2,
  AdminRoutePolicyRevisionSchema,
  LocaleTagSchema,
  PublishedContentSnapshotSchema,
  type AdminLocaleRevision,
  type AdminPageRevision,
  type AdminPlatformPresentationRevisionV2,
  type AdminRoutePolicyRevision,
  type PublishedContentSnapshot
} from "@tikdd/admin-contracts";
import { PlatformIdSchema, RegionIdSchema } from "@tikdd/contracts";
import { type Pool, type QueryResultRow } from "pg";

interface RoutePolicyRevisionRow extends QueryResultRow {
  policy_id: string;
  platform: string;
  region: string;
  revision: string;
  revision_kind: "draft" | "published" | "rollback";
  previous_revision: string | null;
  ordered_provider_ids: unknown;
  rollout_rule_ids: unknown;
  staged_allocations: unknown;
  traffic_shares: unknown;
  concurrency_caps: unknown;
  reason: string;
  actor_subject: string;
  created_at: Date;
}

interface LocaleRevisionRow extends QueryResultRow {
  locale_tag: string;
  revision: string;
  display_name: string;
  direction: "ltr" | "rtl";
  fallback_locale_tag: string | null;
  enabled: boolean;
  is_default: boolean;
  state: "draft" | "ready" | "published" | "archived";
  reason: string;
  actor_subject: string;
  created_at: Date;
}

interface PageRevisionRow extends QueryResultRow {
  page_id: string;
  locale_tag: string;
  revision: string;
  page_type: "homepage" | "platform" | "guide" | "faq" | "legal";
  platform: string | null;
  state: "draft" | "ready" | "published" | "archived";
  content: unknown;
  seo: unknown;
  reason: string;
  actor_subject: string;
  created_at: Date;
}

interface PublishedSnapshotRow extends QueryResultRow {
  snapshot_id: string;
  deployment: string;
  revision: string;
  content_hash: string;
  payload: unknown;
}

interface PlatformPresentationRow extends QueryResultRow {
  platform: string; region: string; revision: string;
  revision_kind: "draft" | "published" | "rollback"; previous_revision: string | null;
  public_display_name: string; support_label: string;
  public_availability: "hidden" | "preview" | "listed" | "paused";
  page_id: string | null; reason: string; actor_subject: string; created_at: Date;
}

interface AdminOverviewMetricsRow extends QueryResultRow {
  delivery_handoff_count: number;
  delivery_failure_count: number;
  pending_draft_count: number;
  locale_gap_count: number;
  seo_blocker_count: number;
  active_snapshot_revision: string | null;
}

export interface AdminOverviewPersistenceMetrics {
  deliveryHandoffCount: number;
  deliveryFailureCount: number;
  pendingDraftCount: number;
  localeGapCount: number;
  seoBlockerCount: number;
  activeSnapshotRevision: number | null;
}

export interface AdminRoutePolicyHeadState {
  headRevision: number | null;
  draft: AdminRoutePolicyRevision | null;
  published: AdminRoutePolicyRevision | null;
  durableRevision: number | null;
  projectedRevision: number | null;
  propagationState: "propagating" | "propagated" | "propagation_failed" | null;
}

function mapRoutePolicy(row: RoutePolicyRevisionRow): AdminRoutePolicyRevision {
  return AdminRoutePolicyRevisionSchema.parse({
    schemaVersion: "1",
    policyId: row.policy_id,
    platform: row.platform,
    region: row.region,
    revision: Number(row.revision),
    revisionKind: row.revision_kind,
    previousRevision: row.previous_revision === null ? null : Number(row.previous_revision),
    orderedProviderIds: row.ordered_provider_ids,
    rolloutRuleIds: row.rollout_rule_ids,
    stagedAllocations: row.staged_allocations,
    trafficShares: row.traffic_shares,
    concurrencyCaps: row.concurrency_caps,
    reason: row.reason,
    actorSubject: row.actor_subject,
    createdAt: row.created_at.toISOString()
  });
}

function mapLocale(row: LocaleRevisionRow): AdminLocaleRevision {
  return AdminLocaleRevisionSchema.parse({
    schemaVersion: "1",
    locale: row.locale_tag,
    revision: Number(row.revision),
    displayName: row.display_name,
    direction: row.direction,
    fallbackLocale: row.fallback_locale_tag,
    enabled: row.enabled,
    isDefault: row.is_default,
    state: row.state,
    reason: row.reason,
    actorSubject: row.actor_subject,
    createdAt: row.created_at.toISOString()
  });
}

function mapPage(row: PageRevisionRow): AdminPageRevision {
  return AdminPageRevisionSchema.parse({
    schemaVersion: "1",
    pageId: row.page_id,
    locale: row.locale_tag,
    revision: Number(row.revision),
    pageType: row.page_type,
    platform: row.platform,
    state: row.state,
    content: row.content,
    seo: row.seo,
    reason: row.reason,
    actorSubject: row.actor_subject,
    createdAt: row.created_at.toISOString()
  });
}

function mapPlatformPresentation(row: PlatformPresentationRow): AdminPlatformPresentationRevisionV2 {
  return AdminPlatformPresentationRevisionSchemaV2.parse({
    schemaVersion: "1", platform: row.platform, region: row.region, revision: Number(row.revision),
    revisionKind: row.revision_kind, previousRevision: row.previous_revision === null ? null : Number(row.previous_revision),
    publicDisplayName: row.public_display_name, supportLabel: row.support_label,
    publicAvailability: row.public_availability, pageId: row.page_id,
    reason: row.reason, actorSubject: row.actor_subject, createdAt: row.created_at.toISOString()
  });
}

export type AdminRevisionChannel = "draft" | "published";

export class AdminControlPlaneReadRepository {
  constructor(private readonly pool: Pool) {}

  async getRoutePolicy(
    platformInput: string,
    regionInput: string,
    channel: AdminRevisionChannel
  ): Promise<AdminRoutePolicyRevision | null> {
    const platform = PlatformIdSchema.parse(platformInput);
    const region = RegionIdSchema.parse(regionInput);
    const revisionColumn = channel === "draft" ? "draft_revision" : "published_revision";
    const result = await this.pool.query<RoutePolicyRevisionRow>(
      `SELECT r.*
       FROM admin_route_policy_heads h
       JOIN admin_route_policy_revisions r
         ON r.policy_id = h.policy_id AND r.revision = h.${revisionColumn}
       WHERE h.platform = $1 AND h.region = $2`,
      [platform, region]
    );
    return result.rows[0] ? mapRoutePolicy(result.rows[0]) : null;
  }

  async getRoutePolicyState(platformInput: string, regionInput: string, deploymentInput: string): Promise<AdminRoutePolicyHeadState> {
    const platform = PlatformIdSchema.parse(platformInput);
    const region = RegionIdSchema.parse(regionInput);
    const result = await this.pool.query<{
      head_revision: string | null; draft_revision: string | null; published_revision: string | null;
      durable_revision: string | null; projected_revision: string | null;
      propagation_state: "propagating" | "propagated" | "propagation_failed" | null;
    }>(
      `SELECT h.head_revision::text,h.draft_revision::text,h.published_revision::text,
         projection.durable_revision::text,projection.projected_revision::text,projection.state AS propagation_state
       FROM admin_route_policy_heads h
       LEFT JOIN admin_route_policy_projection_heads projection
         ON projection.deployment=$3 AND projection.region=h.region
       WHERE h.platform=$1 AND h.region=$2`, [platform, region, deploymentInput]
    );
    const row = result.rows[0];
    if (!row) return { headRevision:null,draft:null,published:null,durableRevision:null,projectedRevision:null,propagationState:null };
    const revisions = [row.draft_revision, row.published_revision].filter((value): value is string => value !== null);
    const policies = revisions.length === 0 ? [] : (await this.pool.query<RoutePolicyRevisionRow>(
      `SELECT * FROM admin_route_policy_revisions WHERE platform=$1 AND region=$2 AND revision=ANY($3::bigint[])`,
      [platform, region, revisions]
    )).rows.map(mapRoutePolicy);
    return {
      headRevision: row.head_revision === null ? null : Number(row.head_revision),
      draft: row.draft_revision === null ? null : policies.find(({revision})=>revision===Number(row.draft_revision)) ?? null,
      published: row.published_revision === null ? null : policies.find(({revision})=>revision===Number(row.published_revision)) ?? null,
      durableRevision: row.durable_revision === null ? null : Number(row.durable_revision),
      projectedRevision: row.projected_revision === null ? null : Number(row.projected_revision),
      propagationState: row.propagation_state
    };
  }

  async getRoutePolicyRevision(platformInput:string,regionInput:string,revisionInput:number):Promise<AdminRoutePolicyRevision|null>{
    const platform=PlatformIdSchema.parse(platformInput);const region=RegionIdSchema.parse(regionInput);
    if(!Number.isInteger(revisionInput)||revisionInput<1)throw new Error("Route-policy revision is invalid.");
    const result=await this.pool.query<RoutePolicyRevisionRow>(
      `SELECT * FROM admin_route_policy_revisions WHERE platform=$1 AND region=$2 AND revision=$3`,
      [platform,region,revisionInput]
    );return result.rows[0]?mapRoutePolicy(result.rows[0]):null;
  }

  async listRoutePolicies(
    channel: AdminRevisionChannel,
    regionInput?: string
  ): Promise<AdminRoutePolicyRevision[]> {
    const revisionColumn = channel === "draft" ? "draft_revision" : "published_revision";
    const parameters: string[] = [];
    const regionClause = regionInput === undefined ? "" : "WHERE h.region = $1";
    if (regionInput !== undefined) parameters.push(RegionIdSchema.parse(regionInput));
    const result = await this.pool.query<RoutePolicyRevisionRow>(
      `SELECT r.*
       FROM admin_route_policy_heads h
       JOIN admin_route_policy_revisions r
         ON r.policy_id = h.policy_id AND r.revision = h.${revisionColumn}
       ${regionClause}
       ORDER BY r.platform, r.region, r.policy_id`,
      parameters
    );
    return result.rows.map(mapRoutePolicy);
  }

  async listLocales(channel: AdminRevisionChannel): Promise<AdminLocaleRevision[]> {
    const revisionColumn = channel === "draft" ? "draft_revision" : "published_revision";
    const result = await this.pool.query<LocaleRevisionRow>(
      `SELECT r.*
       FROM admin_locale_heads h
       JOIN admin_locale_revisions r
         ON r.locale_tag = h.locale_tag AND r.revision = h.${revisionColumn}
       ORDER BY r.is_default DESC, r.locale_tag`
    );
    return result.rows.map(mapLocale);
  }

  async listPages(channel: AdminRevisionChannel, localeInput?: string): Promise<AdminPageRevision[]> {
    const revisionColumn = channel === "draft" ? "draft_revision" : "published_revision";
    const parameters: string[] = [];
    const localeClause = localeInput === undefined ? "" : "WHERE r.locale_tag = $1";
    if (localeInput !== undefined) {
      parameters.push(LocaleTagSchema.parse(localeInput));
    }
    const result = await this.pool.query<PageRevisionRow>(
      `SELECT r.*
       FROM admin_page_heads h
       JOIN admin_page_revisions r
         ON r.page_id = h.page_id AND r.locale_tag = h.locale_tag
        AND r.revision = h.${revisionColumn}
       ${localeClause}
       ORDER BY r.locale_tag, r.page_type, r.page_id`,
      parameters
    );
    return result.rows.map(mapPage);
  }

  async listPlatformPresentations(channel: AdminRevisionChannel, regionInput?: string): Promise<AdminPlatformPresentationRevisionV2[]> {
    const revisionColumn = channel === "draft" ? "draft_revision" : "published_revision";
    const parameters: string[] = [];
    const regionClause = regionInput === undefined ? "" : "WHERE h.region=$1";
    if (regionInput !== undefined) parameters.push(RegionIdSchema.parse(regionInput));
    const result = await this.pool.query<PlatformPresentationRow>(
      `SELECT r.* FROM admin_platform_presentation_heads h
       JOIN admin_platform_presentation_revisions r
         ON r.platform=h.platform AND r.region=h.region AND r.revision=h.${revisionColumn}
       ${regionClause} ORDER BY r.platform,r.region`, parameters);
    return result.rows.map(mapPlatformPresentation);
  }

  async getActivePublishedSnapshot(deploymentInput: string): Promise<PublishedContentSnapshot | null> {
    const result = await this.pool.query<PublishedSnapshotRow>(
      `SELECT s.snapshot_id, s.deployment, s.revision::text, s.content_hash, s.payload
       FROM admin_published_snapshot_heads h
       JOIN admin_published_snapshots s ON s.snapshot_id = h.active_snapshot_id
       WHERE h.deployment = $1`,
      [deploymentInput]
    );
    const row = result.rows[0];
    if (!row) return null;
    const snapshot = PublishedContentSnapshotSchema.parse(row.payload);
    if (
      snapshot.snapshotId !== row.snapshot_id ||
      snapshot.deployment !== row.deployment ||
      snapshot.revision !== Number(row.revision) ||
      snapshot.contentHash !== row.content_hash
    ) {
      throw new Error("Published snapshot envelope does not match its validated payload.");
    }
    return snapshot;
  }

  async getOverviewMetrics(since: Date, deploymentInput: string): Promise<AdminOverviewPersistenceMetrics> {
    if (Number.isNaN(since.getTime())) throw new Error("Admin overview window is invalid.");
    const result = await this.pool.query<AdminOverviewMetricsRow>(
      `SELECT
         (SELECT count(*)::int FROM provider_delivery_outcomes
          WHERE occurred_at >= $1 AND stage = 'browser_handoff' AND result_class = 'redirect_issued')
           AS delivery_handoff_count,
         (SELECT count(*)::int FROM provider_delivery_outcomes
          WHERE occurred_at >= $1 AND stage IN ('ticket_creation', 'redirect_validation')
            AND result_class NOT IN ('succeeded', 'passed')) AS delivery_failure_count,
         (SELECT count(*)::int FROM admin_page_heads WHERE draft_revision IS NOT NULL)
           AS pending_draft_count,
         (SELECT count(*)::int
          FROM admin_locale_heads locale_head
          JOIN admin_locale_revisions locale_revision
            ON locale_revision.locale_tag = locale_head.locale_tag
           AND locale_revision.revision = locale_head.published_revision
          WHERE locale_revision.enabled AND NOT EXISTS (
            SELECT 1 FROM admin_page_heads page_head
            JOIN admin_page_revisions page_revision
              ON page_revision.page_id = page_head.page_id
             AND page_revision.locale_tag = page_head.locale_tag
             AND page_revision.revision = page_head.published_revision
            WHERE page_revision.locale_tag = locale_revision.locale_tag
              AND page_revision.page_type = 'homepage'
          )) AS locale_gap_count,
         (SELECT count(*)::int FROM admin_page_revisions page_revision
          JOIN admin_page_heads page_head
            ON page_head.page_id = page_revision.page_id
           AND page_head.locale_tag = page_revision.locale_tag
           AND page_revision.revision = COALESCE(page_head.draft_revision, page_head.published_revision)
          WHERE page_revision.state IN ('draft', 'ready')
             OR (page_revision.seo->>'indexable')::boolean IS DISTINCT FROM
                (page_revision.seo->>'includeInSitemap')::boolean) AS seo_blocker_count,
         (SELECT snapshot.revision::text
          FROM admin_published_snapshot_heads snapshot_head
          JOIN admin_published_snapshots snapshot ON snapshot.snapshot_id = snapshot_head.active_snapshot_id
          WHERE snapshot_head.deployment = $2) AS active_snapshot_revision`,
      [since, deploymentInput]
    );
    const row = result.rows[0];
    if (!row) throw new Error("Admin overview metrics are unavailable.");
    return {
      deliveryHandoffCount: row.delivery_handoff_count,
      deliveryFailureCount: row.delivery_failure_count,
      pendingDraftCount: row.pending_draft_count,
      localeGapCount: row.locale_gap_count,
      seoBlockerCount: row.seo_blocker_count,
      activeSnapshotRevision:
        row.active_snapshot_revision === null ? null : Number(row.active_snapshot_revision)
    };
  }
}
