import { Queue, QueueEvents } from "bullmq";
import Redis from "ioredis";

const token = process.env.LOCAL_STACK_READINESS_TOKEN;
if (!token || !/^[a-f0-9]{32}$/.test(token)) {
  throw new Error("LOCAL_STACK_READINESS_TOKEN is required for the local Worker probe.");
}

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:16379";
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
const queueName = `tikdd-local-readiness-${token}`;
const queue = new Queue<{ nonce: string }>(queueName, { connection });
const events = new QueueEvents(queueName, { connection });

try {
  await events.waitUntilReady();
  const job = await queue.add(
    "probe",
    { nonce: token },
    { removeOnComplete: true, removeOnFail: true }
  );
  const result = (await job.waitUntilFinished(events, 10_000)) as { nonce?: unknown };
  if (result.nonce !== token) {
    throw new Error("The local Worker readiness response did not match the launch token.");
  }
  process.stdout.write("Local Worker queue readiness passed.\n");
} finally {
  await queue.obliterate({ force: true }).catch(() => undefined);
  await events.close();
  await queue.close();
  connection.disconnect();
}
