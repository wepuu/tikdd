import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("task admission migration", () => {
  it("stores only fixed-length digests with task-bound expiry and cascades", async () => {
    const migration = await readFile(
      new URL("../../../infra/migrations/0006_task_admission.sql", import.meta.url),
      "utf8"
    );

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS resolve_task_idempotency");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS active_source_admissions");
    expect(migration).toContain("octet_length(key_digest) = 32");
    expect(migration).toContain("octet_length(request_fingerprint) = 32");
    expect(migration).toContain("octet_length(source_fingerprint) = 32");
    expect(migration).toContain("REFERENCES resolve_tasks(id) ON DELETE CASCADE");
    expect(migration).not.toMatch(/source_url|idempotency_key\s+TEXT/i);
  });
});
