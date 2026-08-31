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

  it("grants the production API only the deletes required by admission cleanup", async () => {
    const migration = await readFile(
      new URL("../../../infra/migrations/0019_task_admission_api_delete_grants.sql", import.meta.url),
      "utf8"
    );

    expect(migration).toContain("rolname = 'tikdd_api'");
    expect(migration).toContain(
      "GRANT DELETE ON TABLE resolve_task_idempotency TO tikdd_api"
    );
    expect(migration).toContain(
      "GRANT DELETE ON TABLE active_source_admissions TO tikdd_api"
    );
    expect(migration).toContain("rolname = 'tikdd_worker'");
    expect(migration).toContain(
      "GRANT DELETE ON TABLE active_source_admissions TO tikdd_worker"
    );
    expect(migration).not.toMatch(
      /GRANT\s+DELETE\s+ON\s+TABLE\s+resolve_task_idempotency\s+TO\s+tikdd_worker/i
    );
    expect(migration).not.toMatch(/GRANT\s+(?:ALL|DELETE)\s+ON\s+TABLE\s+resolve_tasks/i);
    expect(migration).not.toMatch(/GRANT\s+(?:INSERT|UPDATE|TRUNCATE)\b/i);
  });
});
