import { describe, expect, it } from "vitest";
import {
  AesGcmCandidateCipher,
  StaticEnvelopeKeyring,
  type ProviderResolution
} from "@tikdd/delivery-core";
import {
  CandidateEncryptionUnavailableError,
  createCandidateCipherFromEnvironment,
  prepareEncryptedCandidates
} from "../src/candidates";

const taskId = "tsk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const formatId = "fmt_bbbbbbbbbbbbbbbbbbbb";

function resolution(withCandidate: boolean): ProviderResolution {
  return {
    result: {
      schemaVersion: "1.0",
      source: { platform: "x", canonicalUrl: "https://x.com/example/status/1" },
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
          id: formatId,
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
        kind: "site-adapter",
        cacheHit: false,
        resolvedAt: "2026-08-04T12:00:00.000Z"
      },
      warnings: []
    },
    candidates: withCandidate
      ? [
          {
            formatId,
            mode: "redirect",
            targetUrl: "https://media.example.test/video.mp4?token=secret",
            hostPolicyId: "fixture-media-v1",
            expiresAt: "2026-08-04T12:10:00.000Z",
            secretHeaders: { Authorization: "Bearer fixture-secret" }
          }
        ]
      : []
  };
}

function cipher() {
  return new AesGcmCandidateCipher(
    new StaticEnvelopeKeyring(
      [{ keyId: "local-v1", key: Buffer.alloc(32, 7) }],
      "local-v1"
    )
  );
}

describe("prepareEncryptedCandidates", () => {
  it("encrypts candidate secrets and binds them to task, candidate, and format", () => {
    const candidateCipher = cipher();
    const [candidate] = prepareEncryptedCandidates({
      taskId,
      resolution: resolution(true),
      cipher: candidateCipher,
      allowResolutionOnly: false,
      idFactory: () => "cccccccccccccccccccccccccccccccc"
    });

    expect(candidate?.id).toBe("dvc_cccccccccccccccccccccccccccccccc");
    expect(JSON.stringify(candidate)).not.toContain("fixture-secret");
    expect(JSON.stringify(candidate)).not.toContain("token=secret");
    expect(
      candidateCipher.open(candidate!.envelope, {
        purpose: "delivery-candidate",
        candidateId: candidate!.id,
        taskId,
        formatId
      })
    ).toEqual({
      targetUrl: "https://media.example.test/video.mp4?token=secret",
      secretHeaders: { Authorization: "Bearer fixture-secret" }
    });
  });

  it("allows resolution-only output only when explicitly enabled", () => {
    expect(
      prepareEncryptedCandidates({
        taskId,
        resolution: resolution(false),
        cipher: null,
        allowResolutionOnly: true
      })
    ).toEqual([]);
    expect(() =>
      prepareEncryptedCandidates({
        taskId,
        resolution: resolution(false),
        cipher: null,
        allowResolutionOnly: false
      })
    ).toThrow(/missing its delivery candidate/);
  });

  it("refuses plaintext candidate persistence when no key is configured", () => {
    expect(() =>
      prepareEncryptedCandidates({
        taskId,
        resolution: resolution(true),
        cipher: null,
        allowResolutionOnly: false
      })
    ).toThrow(CandidateEncryptionUnavailableError);
  });
});

describe("createCandidateCipherFromEnvironment", () => {
  it("accepts a canonical 32-byte base64url key and rejects partial configuration", () => {
    expect(
      createCandidateCipherFromEnvironment({
        DELIVERY_ENCRYPTION_KEY_ID: "local-v1",
        DELIVERY_ENCRYPTION_KEY_BASE64URL: Buffer.alloc(32, 9).toString("base64url")
      })
    ).toBeInstanceOf(AesGcmCandidateCipher);
    expect(() =>
      createCandidateCipherFromEnvironment({ DELIVERY_ENCRYPTION_KEY_ID: "local-v1" })
    ).toThrow(/must both be valid/);
  });
});
