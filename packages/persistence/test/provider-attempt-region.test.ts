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

const completionFailure = {
  code: "TASK_COMPLETION_FAILED",
  message: "The resolved task could not be completed.",
  retryable: false
};

describe("provider attempt region persistence", () => {
  it("atomically preserves a successful Provider attempt while terminalizing local completion", async () => {
    const client = new RecordingClient();
    client.query = async (text: string, values?: readonly unknown[]) => {
      client.queries.push(values ? { text, values } : { text });
      if (text.includes("SELECT status")) return { rows: [{ status: "resolving" }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    };
    const successfulAttempt = {
      ...attempt,
      status: "succeeded" as const,
      failureCode: null,
      retryable: null,
      fallbackAllowed: null
    };

    await expect(
      repositoryWith(client).failAfterProviderResolution(
        "tsk_0123456789abcdef0123456789abcdef",
        [successfulAttempt],
        completionFailure
      )
    ).resolves.toBe("failed");

    const statements = client.queries.map(({ text }) => text);
    expect(statements).toEqual([
      "BEGIN",
      expect.stringContaining("SELECT status"),
      expect.stringContaining("INSERT INTO provider_attempts"),
      expect.stringContaining("SET status = 'failed'"),
      expect.stringContaining("DELETE FROM active_source_admissions"),
      "COMMIT"
    ]);
    const providerInsert = client.queries.find(({ text }) => text.includes("INSERT INTO provider_attempts"));
    expect(providerInsert?.values?.[7]).toBe("succeeded");
    const taskUpdate = client.queries.find(({ text }) => text.includes("SET status = 'failed'"));
    expect(taskUpdate?.values?.[1]).toBe(JSON.stringify(completionFailure));
  });

  it("does not overwrite a task that completed despite an ambiguous persistence error", async () => {
    const client = new RecordingClient();
    client.query = async (text: string, values?: readonly unknown[]) => {
      client.queries.push(values ? { text, values } : { text });
      if (text.includes("SELECT status")) return { rows: [{ status: "succeeded" }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    };

    await expect(
      repositoryWith(client).failAfterProviderResolution(
        "tsk_0123456789abcdef0123456789abcdef",
        [{ ...attempt, status: "succeeded", failureCode: null, retryable: null, fallbackAllowed: null }],
        completionFailure
      )
    ).resolves.toBe("terminal_unchanged");
    expect(client.queries.map(({ text }) => text)).toEqual([
      "BEGIN",
      expect.stringContaining("SELECT status"),
      "COMMIT"
    ]);
  });

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
