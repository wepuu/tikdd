import { describe, expect, it } from "vitest";
import {
  TaskAdmissionHasher,
  createTaskAdmissionHasherFromEnvironment
} from "../src/task-admission";

describe("task admission fingerprints", () => {
  it("uses domain-separated stable HMACs", () => {
    const hasher = new TaskAdmissionHasher(Buffer.alloc(32, 9));
    const source = hasher.canonicalSource("x", "https://x.com/user/status/1");
    const request = hasher.request({
      platform: "x",
      canonicalUrl: "https://x.com/user/status/1",
      confirmedRights: true
    });
    expect(Buffer.from(source)).toHaveLength(32);
    expect(Buffer.from(hasher.canonicalSource("x", "https://x.com/user/status/1"))).toEqual(
      Buffer.from(source)
    );
    expect(Buffer.from(request)).not.toEqual(Buffer.from(source));
    expect(Buffer.from(hasher.idempotencyKey("018f47a8-1234-7abc-8def-0123456789ab"))).not.toEqual(
      Buffer.from(request)
    );
    expect(Buffer.from(hasher.clientAddress("203.0.113.7"))).not.toEqual(
      Buffer.from(hasher.idempotencyKey("203.0.113.7"))
    );
    expect(Buffer.from(hasher.quotaPermit("018f47a8-1234-7abc-8def-0123456789ab"))).not.toEqual(
      Buffer.from(hasher.idempotencyKey("018f47a8-1234-7abc-8def-0123456789ab"))
    );
  });

  it("requires a private canonical base64url key in production", () => {
    expect(() => createTaskAdmissionHasherFromEnvironment({ NODE_ENV: "production" })).toThrow(
      /required in production/
    );
    expect(() =>
      createTaskAdmissionHasherFromEnvironment({
        NODE_ENV: "production",
        TASK_ADMISSION_HMAC_KEY_BASE64URL: "not+base64url"
      })
    ).toThrow(/base64url/);
    expect(
      createTaskAdmissionHasherFromEnvironment({ NODE_ENV: "development" })
    ).toBeInstanceOf(TaskAdmissionHasher);
  });
});
