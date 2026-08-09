import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("bounded cleanup migration", () => {
  it("adds stable expiry indexes for every cleanup-owned table", async () => {
    const migration = await readFile(
      new URL("../../../infra/migrations/0007_bounded_cleanup.sql", import.meta.url),
      "utf8"
    );

    expect(migration).toContain("resolve_tasks (expires_at, id)");
    expect(migration).toContain("delivery_candidates (expires_at, id)");
    expect(migration).toContain("delivery_tickets (expires_at, id)");
    expect(migration).toContain("resolve_task_idempotency (expires_at, key_digest)");
    expect(migration).toContain("active_source_admissions (expires_at, source_fingerprint)");
  });
});
