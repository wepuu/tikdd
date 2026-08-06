import { createStaticCandidateCipher } from "@tikdd/delivery-core";
import { createDatabasePool, TaskRepository } from "@tikdd/persistence";
import { createDeliveryApp } from "./app";

const port = Number.parseInt(process.env.DELIVERY_PORT ?? "4002", 10);
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
const publicBaseUrl = process.env.DELIVERY_PUBLIC_BASE_URL ?? `http://localhost:${port}`;
const keyId = process.env.DELIVERY_ENCRYPTION_KEY_ID;
const encodedKey = process.env.DELIVERY_ENCRYPTION_KEY_BASE64URL;
if ((keyId && !encodedKey) || (!keyId && encodedKey)) {
  throw new Error("Both delivery encryption key variables must be configured together.");
}
if (process.env.NODE_ENV === "production" && new URL(publicBaseUrl).protocol !== "https:") {
  throw new Error("DELIVERY_PUBLIC_BASE_URL must use HTTPS in production.");
}

const cipher = keyId && encodedKey ? createStaticCandidateCipher(keyId, encodedKey) : null;
const pool = createDatabasePool();
const tasks = new TaskRepository(pool);
const app = await createDeliveryApp({
  repository: tasks,
  cipher,
  publicBaseUrl,
  webOrigin,
  readyCheck: async () => {
    await pool.query("SELECT 1");
  }
});

const close = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await pool.end();
  process.exit(0);
};

process.once("SIGINT", () => void close("SIGINT"));
process.once("SIGTERM", () => void close("SIGTERM"));

await app.listen({ port, host: "0.0.0.0" });
