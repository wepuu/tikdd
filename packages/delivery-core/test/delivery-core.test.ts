import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AesGcmCandidateCipher,
  assertDeliveryTargetPolicy,
  assertPublicDeliveryDns,
  CompleteProviderResolutionSchema,
  createDeliveryToken,
  DeliveryCandidateInputSchema,
  DeliveryTokenSchema,
  EnvelopeDecryptionError,
  hashDeliveryToken,
  isPublicNetworkAddress,
  ProviderResolutionSchema,
  StaticEnvelopeKeyring,
  type CandidateEncryptionContext,
  type EncryptedEnvelope
} from "../src/index";

const context: CandidateEncryptionContext = {
  purpose: "delivery-candidate",
  candidateId: "dvc_11111111111111111111111111111111",
  taskId: "tsk_22222222222222222222222222222222",
  formatId: "fmt_33333333333333333333"
};

function createCipher() {
  return new AesGcmCandidateCipher(
    new StaticEnvelopeKeyring([{ keyId: "local-v1", key: randomBytes(32) }], "local-v1")
  );
}

function normalizedResult() {
  return {
    schemaVersion: "1.0" as const,
    source: { platform: "x", canonicalUrl: "https://x.com/example/status/123" },
    media: {
      id: "media-1",
      title: "Authorized fixture",
      author: null,
      thumbnailUrl: null,
      durationSeconds: null,
      isLive: false
    },
    formats: [
      {
        id: context.formatId,
        container: "mp4",
        mimeType: "video/mp4",
        quality: "720p",
        width: null,
        height: 720,
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
      provider: "fixture-provider",
      kind: "site-adapter" as const,
      cacheHit: false,
      resolvedAt: "2026-08-04T12:00:00.000Z"
    },
    warnings: []
  };
}

describe("delivery candidate schemas", () => {
  it("accepts a complete internal provider resolution", () => {
    const resolution = CompleteProviderResolutionSchema.parse({
      result: normalizedResult(),
      candidates: [
        {
          formatId: context.formatId,
          mode: "redirect",
          targetUrl: "https://media.example.test/video.mp4?token=secret",
          hostPolicyId: "fixture-media-v1",
          expiresAt: "2026-08-04T12:10:00.000Z",
          secretHeaders: {}
        }
      ]
    });
    expect(resolution.candidates).toHaveLength(1);
  });

  it("rejects orphaned, duplicate, and missing candidates", () => {
    const candidate = {
      formatId: "fmt_orphan",
      mode: "redirect",
      targetUrl: "https://media.example.test/video.mp4",
      hostPolicyId: "fixture-media-v1",
      expiresAt: "2026-08-04T12:10:00.000Z",
      secretHeaders: {}
    };
    expect(() =>
      ProviderResolutionSchema.parse({
        result: normalizedResult(),
        candidates: [candidate, candidate]
      })
    ).toThrow();
    expect(() =>
      CompleteProviderResolutionSchema.parse({ result: normalizedResult(), candidates: [] })
    ).toThrow();
  });

  it("rejects unsafe targets and transport headers", () => {
    expect(() =>
      DeliveryCandidateInputSchema.parse({
        formatId: context.formatId,
        mode: "redirect",
        targetUrl: "http://user:password@media.example.test/video.mp4",
        hostPolicyId: "fixture-media-v1",
        expiresAt: "2026-08-04T12:10:00.000Z",
        secretHeaders: { Host: "internal.example" }
      })
    ).toThrow();
  });
});

describe("candidate envelope encryption", () => {
  it("round-trips a candidate secret without exposing plaintext in the envelope", () => {
    const cipher = createCipher();
    const secret = {
      targetUrl: "https://media.example.test/video.mp4?token=highly-sensitive",
      secretHeaders: { Authorization: "Bearer fixture-secret" }
    };
    const envelope = cipher.seal(secret, context);

    expect(JSON.stringify(envelope)).not.toContain("highly-sensitive");
    expect(JSON.stringify(envelope)).not.toContain("fixture-secret");
    expect(cipher.open(envelope, context)).toEqual(secret);
  });

  it("rejects ciphertext tampering and context substitution with one generic error", () => {
    const cipher = createCipher();
    const envelope = cipher.seal(
      { targetUrl: "https://media.example.test/video.mp4", secretHeaders: {} },
      context
    );
    const tamperedBytes = Buffer.from(envelope.ciphertext, "base64url");
    tamperedBytes[0] = (tamperedBytes[0] ?? 0) ^ 1;
    const tampered: EncryptedEnvelope = {
      ...envelope,
      ciphertext: tamperedBytes.toString("base64url")
    };
    expect(() => cipher.open(tampered, context)).toThrow(EnvelopeDecryptionError);
    expect(() =>
      cipher.open(envelope, { ...context, formatId: "fmt_44444444444444444444" })
    ).toThrow(EnvelopeDecryptionError);
  });

  it("rejects invalid key sizes and unknown current keys", () => {
    expect(() =>
      new StaticEnvelopeKeyring([{ keyId: "bad", key: randomBytes(16) }], "bad")
    ).toThrow(/32 bytes/);
    expect(() =>
      new StaticEnvelopeKeyring([{ keyId: "local-v1", key: randomBytes(32) }], "missing")
    ).toThrow(/does not exist/);
  });
});

describe("opaque delivery tokens", () => {
  it("creates high-entropy tokens and stores only stable hashes", () => {
    const first = createDeliveryToken();
    const second = createDeliveryToken();
    expect(DeliveryTokenSchema.parse(first)).toBe(first);
    expect(second).not.toBe(first);
    expect(hashDeliveryToken(first)).toHaveLength(32);
    expect(hashDeliveryToken(first)).toEqual(hashDeliveryToken(first));
    expect(hashDeliveryToken(second)).not.toEqual(hashDeliveryToken(first));
  });
});

describe("reviewed delivery network policy", () => {
  it("allows only the exact reviewed TwitterSaver media host", () => {
    expect(
      assertDeliveryTargetPolicy({
        providerId: "twittersaver",
        mode: "redirect",
        hostPolicyId: "twittersaver-media-v1",
        targetUrl: "https://dl.snapcdn.app/fixture/video.mp4"
      }).hostname
    ).toBe("dl.snapcdn.app");
    expect(() =>
      assertDeliveryTargetPolicy({
        providerId: "twittersaver",
        mode: "redirect",
        hostPolicyId: "twittersaver-media-v1",
        targetUrl: "https://evil.dl.snapcdn.app/video.mp4"
      })
    ).toThrow(/not allowed/);
  });

  it("rejects private, loopback, link-local, documentation, and mapped addresses", async () => {
    expect(isPublicNetworkAddress("8.8.8.8", 4)).toBe(true);
    expect(isPublicNetworkAddress("2606:4700:4700::1111", 6)).toBe(true);
    expect(isPublicNetworkAddress("10.0.0.1", 4)).toBe(false);
    expect(isPublicNetworkAddress("127.0.0.1", 4)).toBe(false);
    expect(isPublicNetworkAddress("169.254.169.254", 4)).toBe(false);
    expect(isPublicNetworkAddress("203.0.113.10", 4)).toBe(false);
    expect(isPublicNetworkAddress("::ffff:127.0.0.1", 6)).toBe(false);
    await expect(
      assertPublicDeliveryDns("dl.snapcdn.app", async () => [
        { address: "8.8.8.8", family: 4 },
        { address: "127.0.0.1", family: 4 }
      ])
    ).rejects.toThrow(/exclusively to public/);
  });
});
