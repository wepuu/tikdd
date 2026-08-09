import { createHash, createHmac } from "node:crypto";
import type { Platform } from "@tikdd/contracts";

const developmentKey = createHash("sha256")
  .update("tikdd-development-only-task-admission-key")
  .digest();

function readKey(environment: NodeJS.ProcessEnv): Uint8Array {
  const encoded = environment.TASK_ADMISSION_HMAC_KEY_BASE64URL;
  if (!encoded) {
    if (environment.NODE_ENV === "production") {
      throw new Error("TASK_ADMISSION_HMAC_KEY_BASE64URL is required in production.");
    }
    return developmentKey;
  }
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) {
    throw new Error("TASK_ADMISSION_HMAC_KEY_BASE64URL must use unpadded base64url encoding.");
  }
  const key = Buffer.from(encoded, "base64url");
  if (key.byteLength < 32 || key.toString("base64url") !== encoded) {
    throw new Error("The task admission HMAC key must contain at least 32 bytes.");
  }
  return key;
}

function encodeFields(fields: readonly [string, string][]): string {
  return fields
    .map(([name, value]) => `${name.length}:${name}${value.length}:${value}`)
    .join("");
}

export class TaskAdmissionHasher {
  constructor(private readonly key: Uint8Array) {
    if (key.byteLength < 32) {
      throw new Error("The task admission HMAC key must contain at least 32 bytes.");
    }
  }

  private digest(domain: string, fields: readonly [string, string][]): Uint8Array {
    return createHmac("sha256", this.key)
      .update(`tikdd-task-admission-v1\0${domain}\0`)
      .update(encodeFields(fields))
      .digest();
  }

  idempotencyKey(value: string): Uint8Array {
    return this.digest("idempotency-key", [["key", value]]);
  }

  canonicalSource(platform: Platform, canonicalUrl: string): Uint8Array {
    return this.digest("canonical-source", [
      ["platform", platform],
      ["canonicalUrl", canonicalUrl]
    ]);
  }

  clientAddress(address: string): Uint8Array {
    return this.digest("client-address", [["address", address]]);
  }

  quotaPermit(idempotencyKey: string): Uint8Array {
    return this.digest("quota-permit", [["idempotencyKey", idempotencyKey]]);
  }

  request(input: {
    platform: Platform;
    canonicalUrl: string;
    confirmedRights: true;
  }): Uint8Array {
    return this.digest("request", [
      ["platform", input.platform],
      ["canonicalUrl", input.canonicalUrl],
      ["confirmedRights", input.confirmedRights ? "true" : "false"]
    ]);
  }
}

export function createTaskAdmissionHasherFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env
): TaskAdmissionHasher {
  return new TaskAdmissionHasher(readKey(environment));
}
