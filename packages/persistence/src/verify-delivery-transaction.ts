import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { ProviderAttempt, ResolveResult } from "@tikdd/contracts";
import {
  AesGcmCandidateCipher,
  createDeliveryToken,
  hashDeliveryToken,
  StaticEnvelopeKeyring,
  type EncryptedDeliveryCandidate
} from "@tikdd/delivery-core";
import { createDatabasePool, TaskCompletionError, TaskRepository } from "./index";

const suffix = randomUUID().replaceAll("-", "");
const taskId = `tsk_${suffix}`;
const formatId = `fmt_${suffix.slice(0, 20)}`;
const firstCandidateId = `dvc_${randomUUID().replaceAll("-", "")}`;
const replacementCandidateId = `dvc_${randomUUID().replaceAll("-", "")}`;
const now = new Date();
const pool = createDatabasePool();
const tasks = new TaskRepository(pool);
const cipher = new AesGcmCandidateCipher(
  new StaticEnvelopeKeyring(
    [{ keyId: "transaction-probe-v1", key: Buffer.alloc(32, 11) }],
    "transaction-probe-v1"
  )
);

const result: ResolveResult = {
  schemaVersion: "1.0",
  source: { platform: "x", canonicalUrl: "https://x.com/transaction-probe/status/1" },
  media: {
    id: suffix.slice(0, 16),
    title: "Transaction probe",
    author: null,
    thumbnailUrl: null,
    durationSeconds: null,
    isLive: false
  },
  formats: [
    {
      id: formatId,
      container: "mp4",
      mimeType: "video/mp4",
      quality: "Fixture",
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
    provider: "transaction-probe",
    kind: "site-adapter",
    cacheHit: false,
    resolvedAt: now.toISOString()
  },
  warnings: []
};

function encryptedCandidate(id: string, expiresAt: Date): EncryptedDeliveryCandidate {
  return {
    id,
    formatId,
    providerId: "transaction-probe",
    mode: "redirect",
    hostPolicyId: "transaction-probe-media-v1",
    envelope: cipher.seal(
      { targetUrl: "https://media.example.test/probe.mp4?token=not-persisted", secretHeaders: {} },
      { purpose: "delivery-candidate", candidateId: id, taskId, formatId }
    ),
    expiresAt: expiresAt.toISOString()
  };
}

const attempt: ProviderAttempt = {
  providerId: "transaction-probe",
  providerKind: "site-adapter",
  platform: "x",
  priority: 900,
  routeScore: 900_100,
  status: "succeeded",
  failureCode: null,
  retryable: null,
  fallbackAllowed: null,
  startedAt: now.toISOString(),
  finishedAt: new Date(now.getTime() + 5).toISOString(),
  durationMs: 5
};

try {
  await tasks.create({
    id: taskId,
    platform: "x",
    canonicalUrl: result.source.canonicalUrl,
    expiresAt: new Date(now.getTime() + 60 * 60 * 1_000)
  });
  await tasks.completeWithResolution(
    taskId,
    result,
    [encryptedCandidate(firstCandidateId, new Date(now.getTime() + 10 * 60 * 1_000))],
    [attempt]
  );

  const committed = await pool.query<{
    status: string;
    candidate_count: string;
    attempt_count: string;
  }>(
    `SELECT rt.status,
       (SELECT COUNT(*) FROM delivery_candidates dc WHERE dc.task_id = rt.id) AS candidate_count,
       (SELECT COUNT(*) FROM provider_attempts pa WHERE pa.task_id = rt.id) AS attempt_count
     FROM resolve_tasks rt WHERE rt.id = $1`,
    [taskId]
  );
  assert.equal(committed.rows[0]?.status, "succeeded");
  assert.equal(committed.rows[0]?.candidate_count, "1");
  assert.equal(committed.rows[0]?.attempt_count, "1");

  const deliveryToken = createDeliveryToken();
  const issued = await tasks.issueDeliveryTicket({
    id: `dtk_${randomUUID().replaceAll("-", "")}`,
    taskId,
    formatId,
    tokenHash: hashDeliveryToken(deliveryToken),
    maximumTtlMs: 60_000
  });
  assert.equal(issued?.mode, "redirect");
  const redeemed = await tasks.redeemDeliveryTicket(hashDeliveryToken(deliveryToken));
  assert.equal(redeemed?.candidate.id, firstCandidateId);
  assert.equal(await tasks.redeemDeliveryTicket(hashDeliveryToken(deliveryToken)), null);

  await assert.rejects(
    tasks.completeWithResolution(
      taskId,
      result,
      [encryptedCandidate(replacementCandidateId, new Date(now.getTime() - 60_000))],
      [attempt]
    ),
    TaskCompletionError
  );

  const rolledBack = await pool.query<{
    first_candidate_count: string;
    replacement_candidate_count: string;
    attempt_count: string;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM delivery_candidates WHERE id = $2) AS first_candidate_count,
       (SELECT COUNT(*) FROM delivery_candidates WHERE id = $3) AS replacement_candidate_count,
       (SELECT COUNT(*) FROM provider_attempts WHERE task_id = $1) AS attempt_count`,
    [taskId, firstCandidateId, replacementCandidateId]
  );
  assert.equal(rolledBack.rows[0]?.first_candidate_count, "1");
  assert.equal(rolledBack.rows[0]?.replacement_candidate_count, "0");
  assert.equal(rolledBack.rows[0]?.attempt_count, "1");
  process.stdout.write("Delivery transaction commit and rollback verification passed.\n");
} finally {
  await pool.query("DELETE FROM resolve_tasks WHERE id = $1", [taskId]);
  await pool.end();
}
