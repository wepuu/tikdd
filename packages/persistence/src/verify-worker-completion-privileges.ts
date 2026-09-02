import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import type { QueryResultRow } from "pg";
import { createDatabasePool } from "./index";

export const WORKER_COMPLETION_ROLE = "tikdd_worker";

export const WORKER_COMPLETION_CHECK_LABELS = [
  "public.USAGE",
  "resolve_tasks.SELECT",
  "resolve_tasks.UPDATE",
  "delivery_candidates.INSERT",
  "delivery_candidates.DELETE",
  "provider_attempts.INSERT",
  "active_source_admissions.DELETE"
] as const;

export type WorkerCompletionCheckLabel = typeof WORKER_COMPLETION_CHECK_LABELS[number];

interface WorkerCompletionPrivilegeRow extends QueryResultRow {
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

export interface WorkerCompletionPrivilegeQueryable {
  query<T extends QueryResultRow>(sql: string): Promise<{ rows: T[] }>;
}

export interface WorkerCompletionPrivilegeReport {
  role: string;
  sessionRole: string;
  roleMatches: boolean;
  checks: Readonly<Record<WorkerCompletionCheckLabel, boolean>>;
  passed: boolean;
}

export async function inspectWorkerCompletionPrivileges(
  database: WorkerCompletionPrivilegeQueryable
): Promise<WorkerCompletionPrivilegeReport> {
  const result = await database.query<WorkerCompletionPrivilegeRow>(`
    SELECT
      current_user,
      session_user,
      has_schema_privilege(current_user, 'public', 'USAGE') AS public_schema_usage,
      has_table_privilege(current_user, 'public.resolve_tasks', 'SELECT') AS resolve_tasks_select,
      has_table_privilege(current_user, 'public.resolve_tasks', 'UPDATE') AS resolve_tasks_update,
      has_table_privilege(current_user, 'public.delivery_candidates', 'INSERT') AS delivery_candidates_insert,
      has_table_privilege(current_user, 'public.delivery_candidates', 'DELETE') AS delivery_candidates_delete,
      has_table_privilege(current_user, 'public.provider_attempts', 'INSERT') AS provider_attempts_insert,
      has_table_privilege(current_user, 'public.active_source_admissions', 'DELETE') AS active_source_admissions_delete
  `);
  const row = result.rows[0];
  if (!row) throw new Error("Worker completion privilege inspection returned no database identity.");

  const checks: Record<WorkerCompletionCheckLabel, boolean> = {
    "public.USAGE": row.public_schema_usage,
    "resolve_tasks.SELECT": row.resolve_tasks_select,
    "resolve_tasks.UPDATE": row.resolve_tasks_update,
    "delivery_candidates.INSERT": row.delivery_candidates_insert,
    "delivery_candidates.DELETE": row.delivery_candidates_delete,
    "provider_attempts.INSERT": row.provider_attempts_insert,
    "active_source_admissions.DELETE": row.active_source_admissions_delete
  };
  const roleMatches = row.current_user === WORKER_COMPLETION_ROLE && row.session_user === WORKER_COMPLETION_ROLE;

  return {
    role: row.current_user,
    sessionRole: row.session_user,
    roleMatches,
    checks,
    passed: roleMatches && Object.values(checks).every(Boolean)
  };
}

export function formatWorkerCompletionPrivilegeReport(
  report: WorkerCompletionPrivilegeReport
): string {
  const lines = [
    `role: ${report.role}`,
    `role_identity: ${report.roleMatches ? "PASS" : "FAIL"}`,
    ""
  ];
  for (const label of WORKER_COMPLETION_CHECK_LABELS) {
    lines.push(`${label}: ${report.checks[label] ? "PASS" : "FAIL"}`);
  }
  lines.push("", `worker_completion_privilege_contract: ${report.passed ? "PASS" : "FAIL"}`);
  return `${lines.join("\n")}\n`;
}

async function run(): Promise<void> {
  const pool = createDatabasePool();
  try {
    const report = await inspectWorkerCompletionPrivileges(pool);
    process.stdout.write(formatWorkerCompletionPrivilegeReport(report));
    if (!report.passed) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await run();
}
