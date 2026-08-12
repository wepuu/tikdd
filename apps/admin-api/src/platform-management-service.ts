import { createHash, createHmac, randomBytes } from "node:crypto";
import {
  AdminMutationReceiptSchema,
  AdminPlatformDiscardCommandSchema,
  AdminPlatformDraftCommandSchema,
  AdminPlatformManagementViewSchema,
  AdminPlatformPublishCommandSchema,
  AdminPlatformRollbackCommandSchema,
  type AdminMutationReceipt,
  type AdminPlatformManagementView,
  type AdminPlatformPresentationRevisionV2
} from "@tikdd/admin-contracts";
import type { ProviderManifest } from "@tikdd/contracts";
import { AdminPlatformPresentationRepository } from "@tikdd/persistence";
import type { PlatformDefinition } from "@tikdd/platform";

interface PlatformReadSource {
  listRoutes(): Promise<import("@tikdd/admin-contracts").AdminRouteList>;
  listLocales(channel: "draft" | "published"): Promise<import("@tikdd/admin-contracts").AdminLocaleList>;
  listPages(channel: "draft" | "published", locale?: string): Promise<import("@tikdd/admin-contracts").AdminPageList>;
}

export interface PlatformManagementServiceOptions {
  region: string;
  commandSecret: string;
  platforms: readonly PlatformDefinition[];
  manifests: readonly ProviderManifest[];
  reads: PlatformReadSource;
  writes: AdminPlatformPresentationRepository;
  now?: () => Date;
}

export class AdminPlatformReadinessError extends Error {
  constructor(message = "The platform is not ready for public listing.") {
    super(message); this.name = "AdminPlatformReadinessError";
  }
}

export class AdminPlatformManagementService {
  private readonly now: () => Date;
  constructor(private readonly options: PlatformManagementServiceOptions) {
    if (options.commandSecret.length < 32) throw new Error("Admin command secret is invalid.");
    this.now = options.now ?? (() => new Date());
  }

  private definition(platform: string): PlatformDefinition {
    const definition = this.options.platforms.find(({ id }) => id === platform);
    if (!definition) throw new Error("The platform is not in the code-owned catalog.");
    return definition;
  }

  private identity(idempotencyKey: string, command: unknown, actorSubject: string) {
    const acceptedAt = this.now();
    return {
      commandId: `cmd_${randomBytes(16).toString("hex")}`,
      idempotencyDigest: createHmac("sha256", this.options.commandSecret).update(`idem\0${idempotencyKey}`).digest(),
      commandDigest: createHash("sha256").update(JSON.stringify(command)).digest(), actorSubject,
      expiresAt: new Date(acceptedAt.getTime() + 24 * 60 * 60_000)
    };
  }

  async getView(platform: string, region: string): Promise<AdminPlatformManagementView> {
    if (region !== this.options.region) throw new Error("The platform region is outside this Admin instance.");
    const definition = this.definition(platform);
    const statePromise = this.options.writes.getState(platform, region);
    const [routeResult, localeResult, pageResult, state] = await Promise.all([
      this.options.reads.listRoutes().then((data) => ({ data, failed: false })).catch(() => ({ data: null, failed: true })),
      this.options.reads.listLocales("published").then((data) => ({ data, failed: false })).catch(() => ({ data: null, failed: true })),
      this.options.reads.listPages("published").then((data) => ({ data, failed: false })).catch(() => ({ data: null, failed: true })),
      statePromise
    ]);
    const routes = routeResult.data?.routes.filter((route) => route.tuple.platform === platform && route.tuple.region === region) ?? [];
    const monitoredEligible = routes.filter((route) => route.manifestEnabled && route.allocationBps > 0 && route.observedAt !== null &&
      !["open", "paused", "unavailable"].includes(route.state));
    const healthyRouteCount = routes.filter(({ state: routeState }) => routeState === "healthy").length;
    const locales = localeResult.data?.locales.filter(({ enabled, state: localeState }) => enabled && localeState === "published") ?? [];
    const published = pageResult.data?.pages.filter((page) => page.pageType === "platform" && page.platform === platform && page.state === "published") ?? [];
    const associatedPageId = state.draft?.pageId ?? state.published?.pageId ?? null;
    const associated = associatedPageId === null ? [] : published.filter(({ pageId }) => pageId === associatedPageId);
    const seoReady = associated.length > 0 && associated.every(({ seo }) => seo.indexable && seo.includeInSitemap);
    const blockers: AdminPlatformManagementView["readiness"]["blockers"] = [];
    if (definition.status !== "stable") blockers.push("catalog_not_stable");
    if (routeResult.failed || localeResult.failed || pageResult.failed) blockers.push("operational_data_unavailable");
    if (monitoredEligible.length === 0) blockers.push("no_monitored_eligible_route");
    if (associatedPageId === null) blockers.push("page_not_associated");
    else if (associated.length === 0) blockers.push("page_not_published");
    if (locales.length === 0 || associated.length < locales.length) blockers.push("locale_coverage_incomplete");
    if (!seoReady) blockers.push("seo_not_ready");
    const baselineAvailability = definition.status === "paused" ? "paused" : definition.status === "experimental" ? "preview" : "hidden";
    const baseline = {
      publicDisplayName: definition.displayName,
      supportLabel: definition.status === "stable" ? "Supported" : definition.status === "experimental" ? "Preview" : definition.status === "paused" ? "Temporarily paused" : "Planned",
      publicAvailability: baselineAvailability,
      pageId: null
    } as const;
    const selected = state.draft ?? state.published;
    const effective = selected ? {
      publicDisplayName: selected.publicDisplayName, supportLabel: selected.supportLabel,
      publicAvailability: selected.publicAvailability, pageId: selected.pageId
    } : baseline;
    return AdminPlatformManagementViewSchema.parse({
      schemaVersion: "1", platform, region, headRevision: state.headRevision,
      catalog: { displayName: definition.displayName, status: definition.status, source: definition.source,
        recognizedHosts: definition.hosts, extractorKeys: definition.extractorKeys },
      adapterCapabilities: this.options.manifests.filter((manifest) => manifest.platforms.some((item) => item.platform === platform)).map((manifest) => ({
        providerId: manifest.id, displayName: manifest.displayName, enabled: manifest.enabled, regions: manifest.regions,
        basePriority: manifest.platforms.find((item) => item.platform === platform)?.priority ?? 0,
        deliveryModes: manifest.platforms.find((item) => item.platform === platform)?.deliveryModes ?? [],
        productionEligible: manifest.enabled && manifest.kind !== "mock" &&
          (manifest.platforms.find((item) => item.platform === platform)?.deliveryModes.length ?? 0) > 0
      })),
      readiness: { monitoredEligibleRouteCount: monitoredEligible.length, healthyRouteCount,
        publishedLocaleCount: locales.length, publishedPageLocaleCount: associated.length,
        seoReady, indexableEligible: blockers.length === 0, blockers },
      baseline, published: state.published, draft: state.draft, effective
    });
  }

  private async validatePageAssociation(platform: string, pageId: string | null): Promise<void> {
    if (pageId === null) return;
    const [drafts, published] = await Promise.all([this.options.reads.listPages("draft"), this.options.reads.listPages("published")]);
    const page = [...drafts.pages, ...published.pages].find((candidate) => candidate.pageId === pageId);
    if (!page || page.pageType !== "platform" || page.platform !== platform) {
      throw new AdminPlatformReadinessError("The page association is not a platform page for this catalog slug.");
    }
  }

  private async requireListable(revision: AdminPlatformPresentationRevisionV2): Promise<void> {
    if (revision.publicAvailability !== "listed") return;
    const view = await this.getView(revision.platform, revision.region);
    const blockers = view.readiness.blockers.filter((blocker) => blocker !== "page_not_associated" || revision.pageId === null);
    if (revision.pageId !== view.effective.pageId) {
      await this.validatePageAssociation(revision.platform, revision.pageId);
      const pages = await this.options.reads.listPages("published");
      const locales = await this.options.reads.listLocales("published");
      const associated = pages.pages.filter((page) => page.pageId === revision.pageId && page.platform === revision.platform && page.state === "published");
      if (associated.length < locales.locales.filter(({ enabled, state }) => enabled && state === "published").length ||
          associated.some(({ seo }) => !seo.indexable || !seo.includeInSitemap)) {
        throw new AdminPlatformReadinessError();
      }
      const operational = blockers.filter((blocker) => !["page_not_associated", "page_not_published", "locale_coverage_incomplete", "seo_not_ready"].includes(blocker));
      if (operational.length > 0) throw new AdminPlatformReadinessError();
      return;
    }
    if (!view.readiness.indexableEligible) throw new AdminPlatformReadinessError();
  }

  async saveDraft(raw: unknown, actorSubject: string): Promise<AdminMutationReceipt> {
    const command = AdminPlatformDraftCommandSchema.parse(raw);
    if (command.region !== this.options.region) throw new Error("The platform region is outside this Admin instance.");
    this.definition(command.platform);
    await this.validatePageAssociation(command.platform, command.pageId);
    return AdminMutationReceiptSchema.parse(await this.options.writes.saveDraft(command, this.identity(command.idempotencyKey, command, actorSubject)));
  }

  async publish(raw: unknown, actorSubject: string): Promise<AdminMutationReceipt> {
    const command = AdminPlatformPublishCommandSchema.parse(raw);
    const state = await this.options.writes.getState(command.platform, command.region);
    if (!state.draft || state.draft.revision !== command.draftRevision) throw new AdminPlatformReadinessError("The named platform draft is unavailable.");
    await this.validatePageAssociation(command.platform, state.draft.pageId);
    await this.requireListable(state.draft);
    return AdminMutationReceiptSchema.parse(await this.options.writes.publish(command, this.identity(command.idempotencyKey, command, actorSubject)));
  }

  async discard(raw: unknown, actorSubject: string): Promise<AdminMutationReceipt> {
    const command = AdminPlatformDiscardCommandSchema.parse(raw);
    return AdminMutationReceiptSchema.parse(await this.options.writes.discard(command, this.identity(command.idempotencyKey, command, actorSubject)));
  }

  async rollback(raw: unknown, actorSubject: string): Promise<AdminMutationReceipt> {
    const command = AdminPlatformRollbackCommandSchema.parse(raw);
    const target = await this.options.writes.getRevision(command.platform, command.region, command.targetRevision);
    if (!target || target.revisionKind === "draft") throw new AdminPlatformReadinessError("The rollback target is unavailable.");
    await this.validatePageAssociation(command.platform, target.pageId);
    await this.requireListable(target);
    return AdminMutationReceiptSchema.parse(await this.options.writes.rollback(command, this.identity(command.idempotencyKey, command, actorSubject)));
  }
}
