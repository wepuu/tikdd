import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  mode?: "redirect" | "proxy";
  secretHeaders?: Record<string, string>;
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
    mode: fixture.mode ?? "redirect",
    hostPolicyId: fixture.hostPolicyId,
    envelope: candidateCipher.seal(
      { kind: "target", targetUrl: fixture.targetUrl, secretHeaders: fixture.secretHeaders ?? {} },
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
    return {
      mode: this.encryptedCandidate.mode,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      providerId: this.encryptedCandidate.providerId,
      hostPolicyId: this.encryptedCandidate.hostPolicyId
    };
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
    return { taskId, candidate: this.encryptedCandidate, evidence: {
      ticketId: "dtk_dddddddddddddddddddddddddddddddd", providerId: this.encryptedCandidate.providerId,
      platform: "x", region: "global", observationClass: "public", mode: this.encryptedCandidate.mode
    } };
  }

  async recordDeliveryRedemptionOutcome(): Promise<void> {}
}

async function appFor(address: string, fixture: DeliveryFixture = defaultFixture, fetchImpl?: typeof fetch) {
  const candidateCipher = cipher();
  return createDeliveryApp({
    repository: new MemoryDeliveryRepository(candidate(candidateCipher, fixture)),
    cipher: candidateCipher,
    publicBaseUrl: "https://download.tikdd.test",
    webOrigin: "https://tikdd.test",
    readyCheck: async () => undefined,
    dnsLookup: async () => [{ address, family: 4 }],
    tokenFactory: () => token,
    ticketIdFactory: () => "dddddddddddddddddddddddddddddddd",
    ...(fetchImpl ? { fetchImpl } : {})
  });
}

async function processingApp() {
  const candidateCipher = cipher();
  const exp = String(Date.now() + 120_000);
  const descriptor = `https://media.tikdd.cc/tunnel?id=${"a".repeat(21)}&exp=${exp}&sig=${"b".repeat(43)}&sec=${"c".repeat(43)}&iv=${"d".repeat(22)}`;
  const encryptedCandidate: EncryptedDeliveryCandidate = {
    id: candidateId,
    formatId,
    providerId: "cobalt-selfhosted",
    mode: "proxy",
    hostPolicyId: "cobalt-selfhosted-processing-media-v1",
    envelope: candidateCipher.seal({
      kind: "processing",
      processing: {
        operation: "remux",
        platform: "x",
        inputs: [{ url: descriptor, role: "media" }],
        output: { mimeType: "video/mp4", filename: "TikDD-X-processed.mp4" },
        isHls: false
      }
    }, { purpose: "delivery-candidate", candidateId, taskId, formatId }),
    expiresAt: new Date(Date.now() + 120_000).toISOString()
  };
  return createDeliveryApp({
    repository: new MemoryDeliveryRepository(encryptedCandidate),
    cipher: candidateCipher,
    publicBaseUrl: "https://download.tikdd.test",
    webOrigin: "https://tikdd.test",
    readyCheck: async () => undefined,
    dnsLookup: async () => [{ address: "8.8.8.8", family: 4 }],
    tokenFactory: () => token,
    ticketIdFactory: () => "dddddddddddddddddddddddddddddddd"
  });
}

async function artifactApp(root: string, bytes: Buffer, expectedHash = createHash("sha256").update(bytes).digest("hex")) {
  const candidateCipher = cipher();
  const artifactId = `yta_${"a".repeat(32)}`;
  await writeFile(join(root, `${artifactId}.mp4`), bytes);
  const encryptedCandidate: EncryptedDeliveryCandidate = {
    id: candidateId, formatId, providerId: "ytdlp-isolated", mode: "temporary-object",
    hostPolicyId: "ytdlp-dailymotion-artifact-v1",
    envelope: candidateCipher.seal({ kind: "artifact", artifact: { id: artifactId,
      sizeBytes: bytes.length, sha256: expectedHash, mimeType: "video/mp4",
      filename: "TikDD-Dailymotion-example-720p.mp4" } },
    { purpose: "delivery-candidate", candidateId, taskId, formatId }),
    expiresAt: new Date(Date.now() + 120_000).toISOString()
  };
  return createDeliveryApp({ repository: new MemoryDeliveryRepository(encryptedCandidate), cipher: candidateCipher,
    publicBaseUrl: "https://download.tikdd.test", webOrigin: "https://tikdd.test", artifactRoot: root,
    readyCheck: async () => undefined, tokenFactory: () => token,
    ticketIdFactory: () => "dddddddddddddddddddddddddddddddd" });
}

describe("delivery application", () => {
  it("serves a checksum-verified temporary artifact through one opaque ticket", async () => {
    const root = await mkdtemp(join(tmpdir(), "tikdd-delivery-artifact-"));
    const app = await artifactApp(root, Buffer.from([1, 2, 3, 4]));
    try {
      const created = await app.inject({ method: "POST", url: "/v1/deliveries", payload: { taskId, formatId } });
      expect(created.json()).toMatchObject({ mode: "temporary-object", browserHandoff: "server-download" });
      expect(created.body).not.toContain("yta_");
      const delivered = await app.inject({ method: "GET", url: `/d/${token}` });
      expect(delivered.statusCode).toBe(200);
      expect(delivered.headers["content-disposition"]).toContain("TikDD-Dailymotion-example-720p.mp4");
      expect(delivered.rawPayload).toEqual(Buffer.from([1, 2, 3, 4]));
      expect((await app.inject({ method: "GET", url: `/d/${token}` })).statusCode).toBe(410);
    } finally { await app.close(); await rm(root, { recursive: true, force: true }); }
  });

  it("consumes the ticket but rejects an artifact checksum mismatch", async () => {
    const root = await mkdtemp(join(tmpdir(), "tikdd-delivery-artifact-"));
    const app = await artifactApp(root, Buffer.from([1, 2, 3]), "f".repeat(64));
    try {
      await app.inject({ method: "POST", url: "/v1/deliveries", payload: { taskId, formatId } });
      expect((await app.inject({ method: "GET", url: `/d/${token}` })).statusCode).toBe(502);
      expect((await app.inject({ method: "GET", url: `/d/${token}` })).statusCode).toBe(410);
    } finally { await app.close(); await rm(root, { recursive: true, force: true }); }
  });
  it("streams an audited server-download candidate as an attachment", async () => {
    const app = await appFor("8.8.8.8", {
      providerId: "ytdlp-isolated", hostPolicyId: "ytdlp-dailymotion-relay-v1", formatId,
      targetUrl: "https://vod-progressive.akamaized.net/fixture.mp4", mode: "proxy",
      secretHeaders: { Referer: "https://www.dailymotion.com/" }
    }, async (_url, init) => {
      expect(new Headers(init?.headers).get("referer")).toBe("https://www.dailymotion.com/");
      return new Response(new Uint8Array([1, 2, 3]), { status: 200,
        headers: { "content-type": "video/mp4", "content-length": "3" } });
    });
    try {
      await app.inject({ method: "POST", url: "/v1/deliveries", payload: { taskId, formatId } });
      const response = await app.inject({ method: "GET", url: `/d/${token}` });
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-disposition"]).toContain("attachment");
      expect(response.rawPayload.byteLength).toBe(3);
    } finally { await app.close(); }
  });

  it("returns the configured public Web origin for browser preflight", async () => {
    const app = await appFor("8.8.8.8");
    try {
      const preflight = await app.inject({
        method: "OPTIONS",
        url: "/v1/deliveries",
        headers: {
          origin: "https://tikdd.test",
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type"
        }
      });
      expect(preflight.statusCode).toBe(204);
      expect(preflight.headers["access-control-allow-origin"]).toBe("https://tikdd.test");
    } finally {
      await app.close();
    }
  });

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
    },
    {
      providerId: "snaptik-monster",
      hostPolicyId: "snaptik-monster-tiktok-media-v1",
      formatId: "fmt_snaptik_monster_original",
      targetUrl: "https://tikcdn.beubagah.com/fixture/video.mp4?token=secret"
    },
    {
      providerId: "fdown-isuru",
      hostPolicyId: "fdown-isuru-facebook-media-v2",
      formatId: "fmt_fdown_original",
      targetUrl: "https://video-edge.fbcdn.net/fixture/video.mp4?token=secret"
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
        if (fixture.providerId === "fdown-isuru") {
          expect(created.json().browserHandoff).toBe("cors-download");
        } else {
          expect(created.json().browserHandoff).toBe("navigate");
        }
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

  it("redeems a processing ticket as an allowlisted client plan without exposing it at issuance", async () => {
    const app = await processingApp();
    try {
      const created = await app.inject({ method: "POST", url: "/v1/deliveries", payload: { taskId, formatId } });
      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({ mode: "proxy", browserHandoff: "client-process" });
      expect(created.body).not.toContain("media.tikdd.cc");

      const redeemed = await app.inject({ method: "GET", url: `/d/${token}` });
      expect(redeemed.statusCode).toBe(200);
      expect(redeemed.headers["content-type"]).toContain("application/json");
      expect(redeemed.json()).toMatchObject({
        processing: {
          operation: "remux",
          output: { filename: "TikDD-X-processed.mp4" }
        }
      });
      expect((await app.inject({ method: "GET", url: `/d/${token}` })).statusCode).toBe(410);
    } finally {
      await app.close();
    }
  });
});
