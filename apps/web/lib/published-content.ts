import {
  PublishedContentSnapshotSchema,
  PublicContentHealthSchema,
  type PublishedContentSnapshot,
  type PublicContentHealth
} from "@tikdd/admin-contracts";
import type { Pool as PoolType, QueryResultRow } from "pg";
import { BUNDLED_PUBLIC_CONTENT_SNAPSHOT } from "./seed-snapshot";

interface SnapshotRow extends QueryResultRow { payload: unknown }
export interface PublicContentSource { loadActive(deployment: string): Promise<unknown | null>; loadCandidate(deployment: string, snapshotId: string): Promise<unknown | null> }
type CacheEntry = { snapshot: PublishedContentSnapshot; source: PublicContentHealth["source"]; checkedAt: string };

const state: { current: CacheEntry | null; pool: PoolType | null } = { current: null, pool: null };
const deployment = () => process.env.PUBLIC_CONTENT_DEPLOYMENT_ID ?? process.env.TIKDD_DEPLOYMENT_ID ?? "tikdd";
const staleAfterMs = () => {
  const value = Number.parseInt(process.env.PUBLIC_CONTENT_STALE_AFTER_MS ?? "900000", 10);
  return Number.isInteger(value) && value >= 60_000 ? value : 900_000;
};

async function pool(): Promise<PoolType> {
  if (!state.pool) {
    const connectionString = process.env.PUBLIC_CONTENT_DATABASE_URL ?? (process.env.NODE_ENV === "production" ? undefined : process.env.DATABASE_URL);
    if (!connectionString) throw new Error("PUBLIC_CONTENT_DATABASE_URL is unavailable.");
    const { Pool } = await import("pg");
    state.pool = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 1_500, statement_timeout: 1_500 });
  }
  return state.pool;
}

export class PostgresPublicContentSource implements PublicContentSource {
  async loadActive(target: string) {
    const result = await (await pool()).query<SnapshotRow>(
      `SELECT s.payload FROM admin_published_snapshot_heads h
       JOIN admin_published_snapshots s ON s.snapshot_id=h.active_snapshot_id
       WHERE h.deployment=$1 AND s.propagation_state='propagated'`, [target]);
    return result.rows[0]?.payload ?? null;
  }
  async loadCandidate(target: string, snapshotId: string) {
    const result = await (await pool()).query<SnapshotRow>(
      `SELECT payload FROM admin_published_snapshots
       WHERE deployment=$1 AND snapshot_id=$2 AND propagation_state IN ('propagating','propagation_failed','propagated')`,
      [target, snapshotId]);
    return result.rows[0]?.payload ?? null;
  }
}

export class PublishedContentLoader {
  constructor(private readonly source: PublicContentSource = new PostgresPublicContentSource(), private readonly seed = BUNDLED_PUBLIC_CONTENT_SNAPSHOT) {}

  async load(): Promise<PublishedContentSnapshot> {
    try {
      const raw = await this.source.loadActive(deployment());
      if (raw) {
        const snapshot = PublishedContentSnapshotSchema.parse(raw);
        state.current = { snapshot, source: "database", checkedAt: new Date().toISOString() };
        return snapshot;
      }
    } catch { /* availability falls back to a complete known-good snapshot */ }
    if (state.current) return state.current.snapshot;
    state.current = { snapshot: this.seed, source: "bundled-seed", checkedAt: new Date().toISOString() };
    return this.seed;
  }

  async acknowledge(snapshotId: string): Promise<PublishedContentSnapshot> {
    const raw = await this.source.loadCandidate(deployment(), snapshotId);
    if (!raw) throw new Error("Published-content candidate is unavailable.");
    const snapshot = PublishedContentSnapshotSchema.parse(raw);
    if (snapshot.snapshotId !== snapshotId || snapshot.deployment !== deployment()) throw new Error("Published-content candidate scope is invalid.");
    if (!snapshot.pages.some((page) => page.pageType === "homepage" && page.locale === snapshot.locales.find((locale) => locale.isDefault)?.locale)) throw new Error("Published-content candidate has no default homepage.");
    return snapshot;
  }

  health(): PublicContentHealth {
    const entry = state.current ?? { snapshot: this.seed, source: "bundled-seed" as const, checkedAt: new Date().toISOString() };
    const age = Date.now() - new Date(entry.checkedAt).getTime();
    return PublicContentHealthSchema.parse({
      schemaVersion: "1",
      status: entry.source === "bundled-seed" ? "seed" : age > staleAfterMs() ? "stale" : "ready",
      source: entry.source === "database" && age > staleAfterMs() ? "last-known-good" : entry.source,
      snapshotId: entry.snapshot.snapshotId,
      revision: entry.snapshot.revision,
      generatedAt: entry.snapshot.generatedAt,
      checkedAt: entry.checkedAt
    });
  }
}

const loader = new PublishedContentLoader();
export const getPublishedSnapshot = () => loader.load();
export const acknowledgePublishedSnapshot = (snapshotId: string) => loader.acknowledge(snapshotId);
export const getPublishedContentHealth = () => loader.health();

export function resolvePublishedLocale(snapshot: PublishedContentSnapshot, candidate: string) {
  return snapshot.locales.find((locale) => locale.locale === candidate) ?? null;
}

export function localizedPath(locale: string, path: string) { return `/${locale}${path === "/" ? "" : path}`; }

export function findPublishedPage(snapshot: PublishedContentSnapshot, locale: string, segments: readonly string[]) {
  const path = segments.length ? `/${segments.join("/")}` : "/";
  return snapshot.pages.find((page) => page.locale === locale && page.seo.localPath === path) ?? null;
}

export function findPublishedRedirect(snapshot: PublishedContentSnapshot, locale: string, segments: readonly string[]) {
  const path = segments.length ? `/${segments.join("/")}` : "/";
  return snapshot.pages.find((page) => page.locale === locale && page.seo.redirectFrom.includes(path)) ?? null;
}

export function publicPaths(snapshot: PublishedContentSnapshot) {
  return snapshot.pages.map((page) => localizedPath(page.locale, page.seo.localPath));
}

export function resetPublishedContentStateForTest() { state.current = null; state.pool = null; }
