import { readFile } from "node:fs/promises";
import type { ProviderAttempt } from "@tikdd/contracts";
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { TaskRepository } from "../src/index";

interface RecordedQuery {
  text: string;
  values?: readonly unknown[];
}

class RecordingClient {
  readonly queries: RecordedQuery[] = [];

  async query(text: string, values?: readonly unknown[]) {
    this.queries.push(values ? { text, values } : { text });
    return { rows: [], rowCount: 1 };
  }

  release() {}
}

function repositoryWith(client: RecordingClient): TaskRepository {
  const pool = {
    connect: async () => client
  } as unknown as Pool;
  return new TaskRepository(pool);
}

const attempt: ProviderAttempt = {
  providerId: "persistence-probe",
  providerKind: "site-adapter",
  platform: "x",
  region: "ap-southeast-1",
  priority: 800,
  routeScore: 800_100,
  status: "failed",
  failureCode: "provider_timeout",
  retryable: true,
  fallbackAllowed: true,
  startedAt: "2026-08-07T10:00:00.000Z",
  finishedAt: "2026-08-07T10:00:01.000Z",
  durationMs: 1_000
};

describe("provider attempt region persistence", () => {
  it("writes the validated region into the sanitized attempt ledger", async () => {
    const client = new RecordingClient();
    await repositoryWith(client).recordProviderAttempts("tsk_0123456789abcdef0123456789abcdef", [
      attempt
    ]);

    const insert = client.queries.find(({ text }) => text.includes("INSERT INTO provider_attempts"));
    expect(insert?.text).toContain("platform, region, priority");
    expect(insert?.values?.[4]).toBe("ap-southeast-1");
    expect(client.queries.map(({ text }) => text)).toEqual([
      "BEGIN",
      expect.stringContaining("INSERT INTO provider_attempts"),
      "COMMIT"
    ]);
  });

  it("rejects wildcard observations and rolls back without an insert", async () => {
    const client = new RecordingClient();
    const invalidAttempt = { ...attempt, region: "*" } as unknown as ProviderAttempt;

    await expect(
      repositoryWith(client).recordProviderAttempts(
        "tsk_0123456789abcdef0123456789abcdef",
        [invalidAttempt]
      )
    ).rejects.toThrow();

    expect(client.queries.map(({ text }) => text)).toEqual(["BEGIN", "ROLLBACK"]);
  });

  it("backfills global, constrains concrete regions, and creates the tuple index", async () => {
    const migration = await readFile(
      new URL("../../../infra/migrations/0004_provider_attempt_region.sql", import.meta.url),
      "utf8"
    );

    expect(migration).toContain("ADD COLUMN IF NOT EXISTS region TEXT");
    expect(migration).toContain("SET region = 'global'");
    expect(migration).toContain("ALTER COLUMN region SET NOT NULL");
    expect(migration).toContain("provider_attempts_region_check");
    expect(migration).toContain("provider_id, platform, region, created_at DESC");
  });

  it("reads one latest sanitized observation per task and circuit key", async () => {
    let queryText = "";
    const pool = {
      async query(text: string) {
        queryText = text;
        return {
          rows: [
            {
              task_id: "tsk_0123456789abcdef0123456789abcdef",
              provider_id: "persistence-probe",
              platform: "x",
              region: "ap-southeast-1",
              status: "failed",
              failure_code: "provider_timeout",
              duration_ms: 1_000,
              finished_at: new Date("2026-08-07T10:00:01.000Z")
            }
          ]
        };
      }
    } as unknown as Pool;

    const observations = await new TaskRepository(pool).listProviderHealthObservations(
      new Date("2026-08-07T09:59:00.000Z")
    );

    expect(queryText).toContain("DISTINCT ON (task_id, provider_id, platform, region)");
    expect(observations).toEqual([
      {
        taskId: "tsk_0123456789abcdef0123456789abcdef",
        providerId: "persistence-probe",
        platform: "x",
        region: "ap-southeast-1",
        status: "failed",
        failureCode: "provider_timeout",
        durationMs: 1_000,
        finishedAt: "2026-08-07T10:00:01.000Z"
      }
    ]);
  });
});
