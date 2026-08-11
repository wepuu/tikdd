import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import {
  createDatabasePool,
  TaskAdmissionRepository,
  TaskIdempotencyConflictError,
  TaskRepository
} from "./index";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}
const pool = createDatabasePool(databaseUrl);
const admission = new TaskAdmissionRepository(pool);
const tasks = new TaskRepository(pool);
const taskIds: string[] = [];
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const sourceFingerprint = randomBytes(32);
const requestFingerprint = randomBytes(32);
const idempotencyKeyDigest = randomBytes(32);
const expiresAt = new Date(Date.now() + 60 * 60 * 1_000);
const activeSourceExpiresAt = new Date(Date.now() + 5 * 60 * 1_000);

function nextTaskId(): string {
  const id = `tsk_${randomUUID().replaceAll("-", "")}`;
  taskIds.push(id);
  return id;
}

function input(taskId: string, overrides: Partial<Parameters<TaskAdmissionRepository["admit"]>[0]> = {}) {
  return {
    task: {
      id: taskId,
      platform: "x" as const,
      canonicalUrl: `https://x.com/admission-verification/status/${suffix}`,
      expiresAt
    },
    sourceFingerprint,
    requestFingerprint,
    idempotencyKeyDigest,
    activeSourceExpiresAt,
    ...overrides
  };
}

try {
  const firstTaskId = nextTaskId();
  const concurrentTaskId = nextTaskId();
  const concurrent = await Promise.all([
    admission.admit(input(firstTaskId)),
    admission.admit(input(concurrentTaskId))
  ]);
  assert.equal(concurrent.filter(({ kind }) => kind === "created").length, 1);
  assert.equal(concurrent.filter(({ kind }) => kind === "replayed").length, 1);
  const created = concurrent.find(({ kind }) => kind === "created");
  const replayed = concurrent.find(({ kind }) => kind === "replayed");
  assert.ok(created && created.kind === "created");
  assert.ok(replayed && replayed.kind === "replayed");
  assert.equal(replayed.task.id, created.task.id);

  await assert.rejects(
    admission.admit(
      input(nextTaskId(), { requestFingerprint: randomBytes(32) })
    ),
    TaskIdempotencyConflictError
  );
  await assert.rejects(
    admission.admit(
      input(nextTaskId(), { task: { ...input("unused").task, id: taskIds.at(-1) as string, observationClass: "internal" } })
    ),
    TaskIdempotencyConflictError
  );

  const duplicate = await admission.admit(
    input(nextTaskId(), { idempotencyKeyDigest: randomBytes(32) })
  );
  assert.equal(duplicate.kind, "duplicate");
  assert.deepEqual(Object.keys(duplicate).sort(), ["kind", "retryAfterSeconds"]);

  await tasks.fail(created.task.id, {
    code: "VERIFICATION_RELEASE",
    message: "Release the active source admission for verification.",
    retryable: false
  });
  const afterTerminal = await admission.admit(
    input(nextTaskId(), { idempotencyKeyDigest: randomBytes(32) })
  );
  assert.equal(afterTerminal.kind, "created");
  assert.ok(afterTerminal.kind === "created");
  await tasks.complete(afterTerminal.task.id, {
    schemaVersion: "1.0",
    source: {
      platform: "x",
      canonicalUrl: `https://x.com/admission-verification/status/${suffix}`
    },
    media: {
      id: `verification-${suffix}`,
      title: "Task admission verification",
      author: null,
      thumbnailUrl: null,
      durationSeconds: null,
      isLive: false
    },
    formats: [
      {
        id: `fmt_${suffix}`,
        container: "mp4",
        mimeType: "video/mp4",
        quality: "Verification",
        width: null,
        height: null,
        fps: null,
        bitrateKbps: null,
        estimatedBytes: null,
        videoCodec: null,
        audioCodec: null,
        hasVideo: true,
        hasAudio: true
      }
    ],
    provenance: {
      provider: "verification-provider",
      kind: "site-adapter",
      cacheHit: false,
      resolvedAt: new Date().toISOString()
    },
    warnings: []
  });

  const internal = await admission.admit(
    input(nextTaskId(), {
      task: { ...input("unused").task, id: taskIds.at(-1) as string, observationClass: "internal" },
      idempotencyKeyDigest: randomBytes(32)
    })
  );
  assert.equal(internal.kind, "created");

  const persisted = await pool.query(
    `SELECT
       (SELECT count(*) FROM resolve_tasks WHERE canonical_url = $1)::int AS task_count,
       (SELECT count(*) FROM resolve_task_idempotency i
          JOIN resolve_tasks t ON t.id = i.task_id WHERE t.canonical_url = $1)::int AS key_count,
       (SELECT count(*) FROM active_source_admissions a
          JOIN resolve_tasks t ON t.id = a.task_id WHERE t.canonical_url = $1)::int AS active_count,
       (SELECT count(*) FROM resolve_tasks WHERE canonical_url = $1
          AND observation_class = 'internal')::int AS internal_count`,
    [`https://x.com/admission-verification/status/${suffix}`]
  );
  assert.equal(persisted.rows[0]?.task_count, 3);
  assert.equal(persisted.rows[0]?.key_count, 3);
  assert.equal(persisted.rows[0]?.active_count, 1);
  assert.equal(persisted.rows[0]?.internal_count, 1);
  process.stdout.write("Task admission PostgreSQL concurrency verification passed.\n");
} finally {
  if (taskIds.length > 0) {
    await pool.query("DELETE FROM resolve_tasks WHERE id = ANY($1::text[])", [taskIds]);
    const cleanup = await pool.query(
      `SELECT
         (SELECT count(*) FROM resolve_tasks WHERE id = ANY($1::text[]))::int AS task_count,
         (SELECT count(*) FROM resolve_task_idempotency WHERE task_id = ANY($1::text[]))::int AS key_count,
         (SELECT count(*) FROM active_source_admissions WHERE task_id = ANY($1::text[]))::int AS active_count`,
      [taskIds]
    );
    assert.deepEqual(cleanup.rows[0], { task_count: 0, key_count: 0, active_count: 0 });
  }
  await pool.end();
}
