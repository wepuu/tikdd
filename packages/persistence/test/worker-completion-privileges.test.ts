import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  formatWorkerCompletionPrivilegeReport,
  inspectWorkerCompletionPrivileges,
  type WorkerCompletionPrivilegeQueryable
} from "../src/verify-worker-completion-privileges";

interface FakePrivilegeRow {
  current_user: string;
  session_user: string;
  public_schema_usage: boolean;
  resolve_tasks_select: boolean;
  resolve_tasks_update: boolean;
  delivery_candidates_insert: boolean;
  delivery_candidates_delete: boolean;
  provider_attempts_insert: boolean;
  active_source_admissions_delete: boolean;
}

const passingRow: FakePrivilegeRow = {
  current_user: "tikdd_worker",
  session_user: "tikdd_worker",
  public_schema_usage: true,
  resolve_tasks_select: true,
  resolve_tasks_update: true,
  delivery_candidates_insert: true,
  delivery_candidates_delete: true,
  provider_attempts_insert: true,
  active_source_admissions_delete: true
};

function database(row: FakePrivilegeRow): WorkerCompletionPrivilegeQueryable {
  return {
    async query<T>() {
      return { rows: [row as T] };
    }
  };
}

describe("Worker completion privilege migration", () => {
  it("grants only the confirmed candidate DELETE to the conditional production Worker role", async () => {
    const migration = await readFile(
      new URL("../../../infra/migrations/0020_worker_delivery_candidate_delete_grant.sql", import.meta.url),
      "utf8"
    );

    expect(migration).toContain("rolname = 'tikdd_worker'");
    expect(migration).toContain("GRANT DELETE ON TABLE delivery_candidates TO tikdd_worker");
    expect(migration).toMatch(/IF EXISTS[\s\S]+pg_roles/);
    expect(migration).not.toMatch(/GRANT\s+ALL|ALL\s+PRIVILEGES/i);
    expect(migration).not.toMatch(/ALTER\s+(?:TABLE|ROLE)|OWNER\s+TO|SUPERUSER|REVOKE/i);
  });
});

describe("Worker completion privilege verifier", () => {
  it("passes only when the exact Worker identity has every completion privilege", async () => {
    const report = await inspectWorkerCompletionPrivileges(database(passingRow));
    expect(report.passed).toBe(true);
    expect(formatWorkerCompletionPrivilegeReport(report)).toContain(
      "worker_completion_privilege_contract: PASS"
    );
  });

  it("fails when delivery candidate DELETE is missing", async () => {
    const report = await inspectWorkerCompletionPrivileges(
      database({ ...passingRow, delivery_candidates_delete: false })
    );
    expect(report.passed).toBe(false);
    expect(report.checks["delivery_candidates.DELETE"]).toBe(false);
  });

  it("fails when the current or session role is not tikdd_worker", async () => {
    const report = await inspectWorkerCompletionPrivileges(
      database({ ...passingRow, current_user: "tikdd" })
    );
    expect(report.passed).toBe(false);
    expect(report.roleMatches).toBe(false);
  });

  it("fails when public schema usage is missing", async () => {
    const report = await inspectWorkerCompletionPrivileges(
      database({ ...passingRow, public_schema_usage: false })
    );
    expect(report.passed).toBe(false);
    expect(report.checks["public.USAGE"]).toBe(false);
  });
});
