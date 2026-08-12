import { ADMIN_PUBLISHED_SNAPSHOT_FIXTURE } from "@tikdd/admin-contracts/fixtures";
import { describe, expect, it, vi } from "vitest";
import { type Pool } from "pg";
import { AdminControlPlaneReadRepository } from "../src/admin-control-plane";

function createPool(rows: readonly unknown[]): Pool {
  return { query: vi.fn().mockResolvedValue({ rows }) } as unknown as Pool;
}

describe("Admin control-plane read repository", () => {
  it("maps seeded published locales through the runtime contract", async () => {
    const repository = new AdminControlPlaneReadRepository(createPool([
      {
        locale_tag: "en",
        revision: "1",
        display_name: "English",
        direction: "ltr",
        fallback_locale_tag: null,
        enabled: true,
        is_default: true,
        state: "published",
        reason: "Seed the reviewed default locale.",
        actor_subject: "system_seed",
        created_at: new Date("2026-08-11T12:00:00.000Z")
      }
    ]));

    await expect(repository.listLocales("published")).resolves.toEqual([
      expect.objectContaining({ locale: "en", revision: 1, state: "published" })
    ]);
  });

  it("returns only a snapshot whose envelope matches its validated payload", async () => {
    const validRow = {
      snapshot_id: ADMIN_PUBLISHED_SNAPSHOT_FIXTURE.snapshotId,
      deployment: ADMIN_PUBLISHED_SNAPSHOT_FIXTURE.deployment,
      revision: String(ADMIN_PUBLISHED_SNAPSHOT_FIXTURE.revision),
      content_hash: ADMIN_PUBLISHED_SNAPSHOT_FIXTURE.contentHash,
      payload: ADMIN_PUBLISHED_SNAPSHOT_FIXTURE
    };
    await expect(
      new AdminControlPlaneReadRepository(createPool([validRow])).getActivePublishedSnapshot("tikdd")
    ).resolves.toEqual(ADMIN_PUBLISHED_SNAPSHOT_FIXTURE);

    await expect(
      new AdminControlPlaneReadRepository(createPool([{ ...validRow, content_hash: "b".repeat(64) }]))
        .getActivePublishedSnapshot("tikdd")
    ).rejects.toThrow("envelope");
  });

  it("uses a fixed revision-column choice for draft and published reads", async () => {
    const pool = createPool([]);
    const repository = new AdminControlPlaneReadRepository(pool);
    await repository.getRoutePolicy("x", "nl", "draft");
    await repository.getRoutePolicy("x", "nl", "published");
    const query = vi.mocked(pool.query);
    expect(String(query.mock.calls[0]?.[0])).toContain("h.draft_revision");
    expect(String(query.mock.calls[1]?.[0])).toContain("h.published_revision");
  });
});
