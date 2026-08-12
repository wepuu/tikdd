import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

interface CsrfPayload {
  subject: string;
  origin: string;
  expiresAt: number;
  nonce: string;
}

function sign(secret: string, encoded: string): Buffer {
  return createHmac("sha256", secret).update(`tikdd-admin-csrf-v1\0${encoded}`).digest();
}

export class AdminCsrfProtector {
  constructor(private readonly secret: string, private readonly ttlMs = 5 * 60_000) {
    if (secret.length < 32 || ttlMs < 30_000 || ttlMs > 15 * 60_000) {
      throw new Error("Admin CSRF configuration is invalid.");
    }
  }

  issue(subject: string, origin: string, now = new Date()): string {
    const payload: CsrfPayload = {
      subject,
      origin,
      expiresAt: now.getTime() + this.ttlMs,
      nonce: randomBytes(16).toString("base64url")
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `v1.${encoded}.${sign(this.secret, encoded).toString("base64url")}`;
  }

  verify(input: {
    token: string | undefined;
    subject: string;
    origin: string | undefined;
    expectedOrigin: string;
    contentType: string | undefined;
    fetchSite: string | undefined;
    now?: Date;
  }): boolean {
    if (
      !input.token ||
      input.origin !== input.expectedOrigin ||
      !input.contentType?.toLowerCase().startsWith("application/json") ||
      (input.fetchSite !== undefined && input.fetchSite !== "same-origin")
    ) {
      return false;
    }
    const [version, encoded, signature] = input.token.split(".");
    if (version !== "v1" || !encoded || !signature) return false;
    let provided: Buffer;
    let payload: CsrfPayload;
    try {
      provided = Buffer.from(signature, "base64url");
      payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as CsrfPayload;
    } catch {
      return false;
    }
    const expected = sign(this.secret, encoded);
    if (provided.byteLength !== expected.byteLength || !timingSafeEqual(provided, expected)) return false;
    const now = input.now ?? new Date();
    return (
      payload.subject === input.subject &&
      payload.origin === input.expectedOrigin &&
      Number.isInteger(payload.expiresAt) &&
      payload.expiresAt > now.getTime() &&
      payload.expiresAt <= now.getTime() + this.ttlMs &&
      typeof payload.nonce === "string" &&
      /^[A-Za-z0-9_-]{16,64}$/.test(payload.nonce)
    );
  }
}
