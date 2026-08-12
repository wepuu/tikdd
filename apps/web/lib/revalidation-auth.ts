import { createHmac, timingSafeEqual } from "node:crypto";

export const REVALIDATION_WINDOW_MS = 30_000;

export function signContentRevalidation(secret: string, timestamp: string, body: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifyContentRevalidation(secret: string, timestamp: string | null, signature: string | null, body: string, now = Date.now()) {
  if (secret.length < 32 || !timestamp || !/^\d{13}$/.test(timestamp) || !signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  if (Math.abs(now - Number(timestamp)) > REVALIDATION_WINDOW_MS) return false;
  const expected = Buffer.from(signContentRevalidation(secret, timestamp, body), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
