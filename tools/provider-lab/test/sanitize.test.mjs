import assert from "node:assert/strict";
import test from "node:test";
import { isMp4Response, isPublicIp, isSafeHttpsUrl, sanitizeRecord } from "../sanitize.mjs";

test("rejects credentials, ports, HTTP and lookalike hosts", () => {
  assert.equal(isSafeHttpsUrl("https://cdn.example.com/video.mp4?token=secret"), true);
  assert.equal(isSafeHttpsUrl("https://user:pass@cdn.example.com/video.mp4"), false);
  assert.equal(isSafeHttpsUrl("https://cdn.example.com:8443/video.mp4"), false);
  assert.equal(isSafeHttpsUrl("http://cdn.example.com/video.mp4"), false);
});

test("rejects private and loopback addresses", () => {
  assert.equal(isPublicIp("10.0.0.1"), false);
  assert.equal(isPublicIp("127.0.0.1"), false);
  assert.equal(isPublicIp("192.168.1.1"), false);
  assert.equal(isPublicIp("1.1.1.1"), true);
});

test("accepts only MP4 media for the bounded media check", () => {
  const mp4 = new Headers({ "content-type": "video/mp4" });
  const webm = new Headers({ "content-type": "video/webm" });
  const missing = new Headers();
  assert.equal(isMp4Response(mp4), true);
  assert.equal(isMp4Response(webm, "https://cdn.example.com/video.mp4"), false);
  assert.equal(isMp4Response(missing, "https://cdn.example.com/video.mp4"), true);
});

test("sanitized records contain metadata only", () => {
  const record = sanitizeRecord({ providerId: "prexzy", sourceRef: "primary", result: "resolved", mediaHostSuffixes: ["cdn.example.com", "cdn.example.com"], httpStatus: 200, resourceCount: 2, validMediaCount: 1, latencyMs: 12.4 });
  assert.deepEqual(record.mediaHostSuffixes, ["cdn.example.com"]);
  assert.equal(JSON.stringify(record).includes("token"), false);
  assert.equal(Object.hasOwn(record, "sourceUrl"), false);
  assert.equal(Object.hasOwn(record, "responseBody"), false);
});
