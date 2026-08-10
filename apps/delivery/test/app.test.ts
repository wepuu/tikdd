import { describe, expect, it } from "vitest";
import {
  AesGcmCandidateCipher,
  StaticEnvelopeKeyring,
  hashDeliveryToken,
  type EncryptedDeliveryCandidate
} from "@tikdd/delivery-core";
import type {
  IssuedDeliveryTicket,
  RedeemedDeliveryCandidate
} from "@tikdd/persistence";
import { createDeliveryApp, type DeliveryRepository } from "../src/app";

const taskId = "tsk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const candidateId = "dvc_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const formatId = "fmt_cccccccccccccccccccc";
const token = `dlt_${"A".repeat(43)}`;

interface DeliveryFixture {
  providerId: string;
  hostPolicyId: string;
  formatId: string;
  targetUrl: string;
}

const defaultFixture: DeliveryFixture = {
  providerId: "twittersaver",
  hostPolicyId: "twittersaver-media-v1",
  formatId,
  targetUrl: "https://dl.snapcdn.app/fixture/video.mp4?token=secret"
};

function cipher() {
  return new AesGcmCandidateCipher(
    new StaticEnvelopeKeyring([{ keyId: "local-v1", key: Buffer.alloc(32, 5) }], "local-v1")
  );
}

function candidate(
  candidateCipher: AesGcmCandidateCipher,
  fixture: DeliveryFixture = defaultFixture
): EncryptedDeliveryCandidate {
  return {
    id: candidateId,
    formatId: fixture.formatId,
    providerId: fixture.providerId,
    mode: "redirect",
    hostPolicyId: fixture.hostPolicyId,
    envelope: candidateCipher.seal(
      { targetUrl: fixture.targetUrl, secretHeaders: {} },
      { purpose: "delivery-candidate", candidateId, taskId, formatId: fixture.formatId }
    ),
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString()
  };
}

class MemoryDeliveryRepository implements DeliveryRepository {
  private issuedHash: Buffer | null = null;
  private redeemed = false;

  constructor(private readonly encryptedCandidate: EncryptedDeliveryCandidate) {}

  async issueDeliveryTicket(input: {
    tokenHash: Uint8Array;
  }): Promise<IssuedDeliveryTicket | null> {
    this.issuedHash = Buffer.from(input.tokenHash);
    return { mode: "redirect", expiresAt: new Date(Date.now() + 60_000).toISOString() };
  }

  async redeemDeliveryTicket(tokenHash: Uint8Array): Promise<RedeemedDeliveryCandidate | null> {
    if (
      this.redeemed ||
      !this.issuedHash ||
      !this.issuedHash.equals(Buffer.from(tokenHash))
    ) {
      return null;
    }
    this.redeemed = true;
    return { taskId, candidate: this.encryptedCandidate };
  }
}

async function appFor(address: string, fixture: DeliveryFixture = defaultFixture) {
  const candidateCipher = cipher();
  return createDeliveryApp({
    repository: new MemoryDeliveryRepository(candidate(candidateCipher, fixture)),
    cipher: candidateCipher,
    publicBaseUrl: "https://download.tikdd.test",
    webOrigin: "https://tikdd.test",
    readyCheck: async () => undefined,
    dnsLookup: async () => [{ address, family: 4 }],
    tokenFactory: () => token,
    ticketIdFactory: () => "dddddddddddddddddddddddddddddddd"
  });
}

describe("delivery application", () => {
  it.each([
    {
      providerId: "twittersaver",
      hostPolicyId: "twittersaver-media-v1",
      formatId: "fmt_twittersaver_720p",
      targetUrl: "https://dl.snapcdn.app/fixture/video-720.mp4?token=secret"
    },
    {
      providerId: "twittersaver",
      hostPolicyId: "twittersaver-media-v1",
      formatId: "fmt_twittersaver_360p",
      targetUrl: "https://dl.snapcdn.app/fixture/video-360.mp4?token=secret"
    },
    {
      providerId: "ssstwitter",
      hostPolicyId: "ssstwitter-media-v1",
      formatId: "fmt_ssstwitter_720p",
      targetUrl: "https://ssscdn.io/fixture/video-720.mp4?token=secret"
    },
    {
      providerId: "ssstwitter",
      hostPolicyId: "ssstwitter-media-v1",
      formatId: "fmt_ssstwitter_360p",
      targetUrl: "https://ssscdn.io/fixture/video-360.mp4?token=secret"
    }
  ] satisfies DeliveryFixture[])(
    "issues and redeems one opaque ticket for $providerId/$formatId without fetching media",
    async (fixture) => {
      const app = await appFor("8.8.8.8", fixture);
      try {
        const created = await app.inject({
          method: "POST",
          url: "/v1/deliveries",
          payload: { taskId, formatId: fixture.formatId }
        });
        expect(created.statusCode).toBe(201);
        expect(created.json()).toMatchObject({
          id: "dtk_dddddddddddddddddddddddddddddddd",
          mode: "redirect",
          url: `https://download.tikdd.test/d/${token}`
        });
        expect(created.body).not.toContain(new URL(fixture.targetUrl).hostname);
        expect(hashDeliveryToken(token)).toHaveLength(32);

        const redeemed = await app.inject({ method: "GET", url: `/d/${token}` });
        expect(redeemed.statusCode).toBe(302);
        expect(redeemed.headers.location).toBe(fixture.targetUrl);
        expect(redeemed.headers["referrer-policy"]).toBe("no-referrer");

        const replayed = await app.inject({ method: "GET", url: `/d/${token}` });
        expect(replayed.statusCode).toBe(410);
      } finally {
        await app.close();
      }
    }
  );

  it("consumes the ticket but rejects a private DNS destination", async () => {
    const app = await appFor("127.0.0.1");
    try {
      await app.inject({
        method: "POST",
        url: "/v1/deliveries",
        payload: { taskId, formatId }
      });
      const rejected = await app.inject({ method: "GET", url: `/d/${token}` });
      expect(rejected.statusCode).toBe(502);
      const replayed = await app.inject({ method: "GET", url: `/d/${token}` });
      expect(replayed.statusCode).toBe(410);
    } finally {
      await app.close();
    }
  });
});
