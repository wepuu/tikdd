import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import Redis from "ioredis";
import { AdmissionControlPolicySchema } from "./model";
import { RedisAdmissionStore } from "./redis";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL is required.");
}
const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
const runId = randomUUID().replaceAll("-", "").slice(0, 12);
const deployment = `verify-${runId}`;

function taskId(): string {
  return `tsk_${randomUUID().replaceAll("-", "")}`;
}

function idempotentPermitId(): string {
  return `adp_${randomBytes(32).toString("hex")}`;
}

function referenceId(): string {
  return `adr_${randomUUID().replaceAll("-", "")}`;
}

function policy(version: string, overrides: Record<string, unknown> = {}) {
  return AdmissionControlPolicySchema.parse({
    version,
    deployment,
    region: "global",
    requestWindowMs: 60_000,
    clientRequestLimit: 10,
    globalRequestLimit: 100,
    clientActiveTaskLimit: 10,
    globalActiveTaskLimit: 100,
    taskPermitTtlMs: 300_000,
    providerDefaultConcurrency: 1,
    providerLeaseTtlMs: 30_000,
    providerLimits: [],
    ...overrides
  });
}

async function keysForRun(): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";
  do {
    const [next, page] = await redis.scan(
      cursor,
      "MATCH",
      `tikdd:admission:v1:${deployment}:*`,
      "COUNT",
      100
    );
    cursor = next;
    keys.push(...page);
  } while (cursor !== "0");
  return keys;
}

try {
  await redis.ping();

  const rateStore = new RedisAdmissionStore(
    redis,
    policy("rate", { clientRequestLimit: 2, globalRequestLimit: 3 })
  );
  const clientA = randomBytes(32);
  const clientB = randomBytes(32);
  const rateTaskIds = [taskId(), taskId(), taskId(), taskId(), taskId()];
  assert.equal(
    (
      await rateStore.admitTask({
        clientIdentityDigest: clientA,
        permitId: rateTaskIds[0] as string,
        referenceId: referenceId()
      })
    ).kind,
    "accepted"
  );
  assert.equal(
    (
      await rateStore.admitTask({
        clientIdentityDigest: clientA,
        permitId: rateTaskIds[1] as string,
        referenceId: referenceId()
      })
    ).kind,
    "accepted"
  );
  assert.equal(
    (
      await rateStore.admitTask({
        clientIdentityDigest: clientA,
        permitId: rateTaskIds[2] as string,
        referenceId: referenceId()
      })
    ).kind,
    "rate-limited"
  );
  assert.equal(
    (
      await rateStore.admitTask({
        clientIdentityDigest: clientB,
        permitId: rateTaskIds[3] as string,
        referenceId: referenceId()
      })
    ).kind,
    "accepted"
  );
  assert.equal(
    (
      await rateStore.admitTask({
        clientIdentityDigest: randomBytes(32),
        permitId: rateTaskIds[4] as string,
        referenceId: referenceId()
      })
    ).kind,
    "rate-limited"
  );
  // These rate fixtures intentionally rely on namespace cleanup; their random references are not
  // retained because this section verifies ceilings rather than early release.

  const activeStore = new RedisAdmissionStore(
    redis,
    policy("active", { clientActiveTaskLimit: 1, globalActiveTaskLimit: 2 })
  );
  const activeA = randomBytes(32);
  const activeB = randomBytes(32);
  const first = taskId();
  const second = taskId();
  const third = taskId();
  const fourth = taskId();
  assert.equal(
    (
      await activeStore.admitTask({
        clientIdentityDigest: activeA,
        permitId: first,
        referenceId: `adr_${"1".repeat(32)}`
      })
    ).kind,
    "accepted"
  );
  assert.equal(
    (
      await activeStore.admitTask({
        clientIdentityDigest: activeA,
        permitId: second,
        referenceId: `adr_${"2".repeat(32)}`
      })
    ).kind,
    "concurrency-limited"
  );
  assert.equal(
    (
      await activeStore.admitTask({
        clientIdentityDigest: activeB,
        permitId: third,
        referenceId: `adr_${"3".repeat(32)}`
      })
    ).kind,
    "accepted"
  );
  assert.equal(
    (
      await activeStore.admitTask({
        clientIdentityDigest: randomBytes(32),
        permitId: fourth,
        referenceId: `adr_${"4".repeat(32)}`
      })
    ).kind,
    "concurrency-limited"
  );
  await activeStore.releaseTask(first, `adr_${"1".repeat(32)}`);
  assert.equal(
    (
      await activeStore.admitTask({
        clientIdentityDigest: activeA,
        permitId: second,
        referenceId: `adr_${"5".repeat(32)}`
      })
    ).kind,
    "accepted"
  );

  const sharedStore = new RedisAdmissionStore(
    redis,
    policy("shared", { clientActiveTaskLimit: 1, globalActiveTaskLimit: 10 })
  );
  const sharedClient = randomBytes(32);
  const sharedPermit = idempotentPermitId();
  const blockedPermit = taskId();
  const sharedFirstReference = referenceId();
  const sharedSecondReference = referenceId();
  assert.equal(
    (
      await sharedStore.admitTask({
        clientIdentityDigest: sharedClient,
        permitId: sharedPermit,
        referenceId: sharedFirstReference
      })
    ).kind,
    "accepted"
  );
  assert.equal(
    (
      await sharedStore.admitTask({
        clientIdentityDigest: sharedClient,
        permitId: sharedPermit,
        referenceId: sharedSecondReference
      })
    ).kind,
    "accepted"
  );
  assert.equal(
    (
      await sharedStore.admitTask({
        clientIdentityDigest: sharedClient,
        permitId: blockedPermit,
        referenceId: `adr_${"6".repeat(32)}`
      })
    ).kind,
    "concurrency-limited"
  );
  await sharedStore.releaseTask(sharedPermit, sharedFirstReference);
  assert.equal(
    (
      await sharedStore.admitTask({
        clientIdentityDigest: sharedClient,
        permitId: blockedPermit,
        referenceId: `adr_${"7".repeat(32)}`
      })
    ).kind,
    "concurrency-limited"
  );
  await sharedStore.releaseTask(sharedPermit, sharedSecondReference);
  assert.equal(
    (
      await sharedStore.admitTask({
        clientIdentityDigest: sharedClient,
        permitId: blockedPermit,
        referenceId: `adr_${"8".repeat(32)}`
      })
    ).kind,
    "accepted"
  );

  const providerStore = new RedisAdmissionStore(redis, policy("provider"));
  const providerKey = { providerId: "twitter-saver", platform: "x", region: "global" } as const;
  const permit = await providerStore.acquireProvider(providerKey);
  assert.ok(permit);
  assert.equal(await providerStore.acquireProvider(providerKey), null);
  await permit.release();
  const replacement = await providerStore.acquireProvider(providerKey);
  assert.ok(replacement);
  await permit.release();
  assert.equal(await providerStore.acquireProvider(providerKey), null);
  await replacement.release();

  process.stdout.write("Admission control Redis verification passed.\n");
} finally {
  const keys = await keysForRun().catch(() => []);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  assert.deepEqual(await keysForRun(), []);
  await redis.quit();
}
