import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { BlockList } from "node:net";
import { ResolveResultSchema } from "@tikdd/contracts";
import { z } from "zod";

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const FORMAT_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

export const DeliveryModeSchema = z.enum(["redirect", "proxy", "temporary-object"]);
export type DeliveryMode = z.infer<typeof DeliveryModeSchema>;

export const DeliveryCandidateIdSchema = z.string().regex(/^dvc_[a-f0-9]{32}$/);
export const DeliveryTicketRecordIdSchema = z.string().regex(/^dtk_[a-f0-9]{32}$/);
export const DeliveryTokenSchema = z.string().regex(/^dlt_[A-Za-z0-9_-]{43}$/);
export const HostPolicyIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);
export const InternalProviderIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);
export const EnvelopeKeyIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9]+(?:[._:/-][A-Za-z0-9]+)*$/);

export const HttpsTargetUrlSchema = z
  .string()
  .url()
  .max(8_192)
  .superRefine((value, context) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return;
    }
    if (url.protocol !== "https:") {
      context.addIssue({ code: "custom", message: "Delivery targets must use HTTPS." });
    }
    if (url.username || url.password) {
      context.addIssue({ code: "custom", message: "Delivery targets cannot embed credentials." });
    }
  });

export const SecretHeadersSchema = z
  .record(
    z.string().min(1).max(100).regex(/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/),
    z.string().max(4_096)
  )
  .superRefine((headers, context) => {
    if (Object.keys(headers).length > 32) {
      context.addIssue({ code: "custom", message: "Too many secret headers." });
    }
    for (const name of Object.keys(headers)) {
      if (/^(?:connection|content-length|cookie|host|proxy-|sec-|transfer-encoding)/i.test(name)) {
        context.addIssue({
          code: "custom",
          message: `The header ${name} is not eligible for candidate storage.`
        });
      }
    }
  });

export const DeliveryCandidateInputSchema = z.object({
  formatId: z.string().min(1).max(160).regex(FORMAT_ID_PATTERN),
  mode: DeliveryModeSchema,
  targetUrl: HttpsTargetUrlSchema,
  hostPolicyId: HostPolicyIdSchema,
  expiresAt: z.string().datetime({ offset: true }),
  secretHeaders: SecretHeadersSchema
});
export type DeliveryCandidateInput = z.infer<typeof DeliveryCandidateInputSchema>;

export const ProviderResolutionSchema = z
  .object({
    result: ResolveResultSchema,
    candidates: z.array(DeliveryCandidateInputSchema).max(100)
  })
  .superRefine((resolution, context) => {
    const formatIds = new Set(resolution.result.formats.map(({ id }) => id));
    const candidateIds = new Set<string>();
    resolution.candidates.forEach((candidate, index) => {
      if (!formatIds.has(candidate.formatId)) {
        context.addIssue({
          code: "custom",
          message: "A delivery candidate does not match a public format.",
          path: ["candidates", index, "formatId"]
        });
      }
      if (candidateIds.has(candidate.formatId)) {
        context.addIssue({
          code: "custom",
          message: "A public format has more than one delivery candidate.",
          path: ["candidates", index, "formatId"]
        });
      }
      candidateIds.add(candidate.formatId);
    });
  });
export type ProviderResolution = z.infer<typeof ProviderResolutionSchema>;

export const CompleteProviderResolutionSchema = ProviderResolutionSchema.superRefine(
  (resolution, context) => {
    const candidateIds = new Set(resolution.candidates.map(({ formatId }) => formatId));
    resolution.result.formats.forEach((format, index) => {
      if (!candidateIds.has(format.id)) {
        context.addIssue({
          code: "custom",
          message: "A production format is missing its delivery candidate.",
          path: ["result", "formats", index, "id"]
        });
      }
    });
  }
);

export const CandidateSecretSchema = z.object({
  targetUrl: HttpsTargetUrlSchema,
  secretHeaders: SecretHeadersSchema
});
export type CandidateSecret = z.infer<typeof CandidateSecretSchema>;

const Base64UrlSchema = z.string().min(1).max(100_000).regex(BASE64URL_PATTERN);

export const EncryptedEnvelopeSchema = z
  .object({
    algorithm: z.literal("aes-256-gcm"),
    keyId: EnvelopeKeyIdSchema,
    iv: Base64UrlSchema,
    ciphertext: Base64UrlSchema,
    authTag: Base64UrlSchema
  })
  .superRefine((envelope, context) => {
    if (Buffer.from(envelope.iv, "base64url").byteLength !== 12) {
      context.addIssue({ code: "custom", message: "AES-GCM IV must be 12 bytes.", path: ["iv"] });
    }
    if (Buffer.from(envelope.authTag, "base64url").byteLength !== 16) {
      context.addIssue({
        code: "custom",
        message: "AES-GCM authentication tag must be 16 bytes.",
        path: ["authTag"]
      });
    }
    const ciphertextLength = Buffer.from(envelope.ciphertext, "base64url").byteLength;
    if (ciphertextLength < 1 || ciphertextLength > 65_536) {
      context.addIssue({
        code: "custom",
        message: "Encrypted candidate payload has an invalid size.",
        path: ["ciphertext"]
      });
    }
  });
export type EncryptedEnvelope = z.infer<typeof EncryptedEnvelopeSchema>;

export const EncryptedDeliveryCandidateSchema = z.object({
  id: DeliveryCandidateIdSchema,
  formatId: z.string().min(1).max(160).regex(FORMAT_ID_PATTERN),
  providerId: InternalProviderIdSchema,
  mode: DeliveryModeSchema,
  hostPolicyId: HostPolicyIdSchema,
  envelope: EncryptedEnvelopeSchema,
  expiresAt: z.string().datetime({ offset: true })
});
export type EncryptedDeliveryCandidate = z.infer<typeof EncryptedDeliveryCandidateSchema>;

export const DeliveryHostPolicySchema = z.object({
  id: HostPolicyIdSchema,
  providerId: InternalProviderIdSchema,
  modes: z.array(DeliveryModeSchema).min(1),
  hosts: z.array(z.string().min(1).max(253).regex(/^[a-z0-9.-]+$/)).min(1)
});
export type DeliveryHostPolicy = z.infer<typeof DeliveryHostPolicySchema>;

export const TWITTERSAVER_MEDIA_HOST_POLICY = DeliveryHostPolicySchema.parse({
  id: "twittersaver-media-v1",
  providerId: "twittersaver",
  modes: ["redirect"],
  hosts: ["dl.snapcdn.app"]
});

export const SSSTWITTER_MEDIA_HOST_POLICY = DeliveryHostPolicySchema.parse({
  id: "ssstwitter-media-v1",
  providerId: "ssstwitter",
  modes: ["redirect"],
  hosts: ["ssscdn.io"]
});

const HOST_POLICIES = new Map<string, DeliveryHostPolicy>([
  [TWITTERSAVER_MEDIA_HOST_POLICY.id, TWITTERSAVER_MEDIA_HOST_POLICY],
  [SSSTWITTER_MEDIA_HOST_POLICY.id, SSSTWITTER_MEDIA_HOST_POLICY]
]);

export function getDeliveryHostPolicy(id: string): DeliveryHostPolicy | null {
  const policy = HOST_POLICIES.get(id);
  return policy ? DeliveryHostPolicySchema.parse(policy) : null;
}

export function assertDeliveryTargetPolicy(input: {
  providerId: string;
  mode: DeliveryMode;
  hostPolicyId: string;
  targetUrl: string;
}): URL {
  const policy = getDeliveryHostPolicy(input.hostPolicyId);
  if (!policy || policy.providerId !== input.providerId || !policy.modes.includes(input.mode)) {
    throw new Error("The delivery candidate does not match a reviewed host policy.");
  }
  const url = new URL(HttpsTargetUrlSchema.parse(input.targetUrl));
  if (!policy.hosts.includes(url.hostname.toLowerCase())) {
    throw new Error("The delivery target host is not allowed by its reviewed policy.");
  }
  return url;
}

// Keep IPv4 and IPv6 rules in separate BlockLists. A mixed BlockList treats
// IPv4 input as an IPv4-mapped IPv6 address, which makes ::ffff:0:0/96 match
// every IPv4 address instead of only rejecting mapped IPv6 candidates.
const BLOCKED_IPV4_ADDRESSES = new BlockList();
const BLOCKED_IPV6_ADDRESSES = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4]
] as const) {
  BLOCKED_IPV4_ADDRESSES.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:2::", 48],
  ["2001:10::", 28],
  ["2001:20::", 28],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8]
] as const) {
  BLOCKED_IPV6_ADDRESSES.addSubnet(network, prefix, "ipv6");
}

export function isPublicNetworkAddress(address: string, family: 4 | 6): boolean {
  return family === 4
    ? !BLOCKED_IPV4_ADDRESSES.check(address, "ipv4")
    : !BLOCKED_IPV6_ADDRESSES.check(address, "ipv6");
}

export type DeliveryDnsLookup = (
  hostname: string
) => Promise<readonly { address: string; family: 4 | 6 }[]>;

const defaultDeliveryDnsLookup: DeliveryDnsLookup = async (hostname) =>
  dnsLookup(hostname, { all: true, verbatim: true }) as Promise<
    readonly { address: string; family: 4 | 6 }[]
  >;

export async function assertPublicDeliveryDns(
  hostname: string,
  lookup: DeliveryDnsLookup = defaultDeliveryDnsLookup
): Promise<readonly { address: string; family: 4 | 6 }[]> {
  const addresses = await lookup(hostname);
  if (addresses.length === 0 || addresses.some(({ address, family }) => !isPublicNetworkAddress(address, family))) {
    throw new Error("The delivery target did not resolve exclusively to public addresses.");
  }
  return addresses;
}

export const CandidateEncryptionContextSchema = z.object({
  purpose: z.literal("delivery-candidate"),
  candidateId: DeliveryCandidateIdSchema,
  taskId: z.string().regex(/^tsk_[a-f0-9]{32}$/),
  formatId: z.string().min(1).max(160).regex(FORMAT_ID_PATTERN)
});
export type CandidateEncryptionContext = z.infer<typeof CandidateEncryptionContextSchema>;

export interface EnvelopeKeyMaterial {
  keyId: string;
  key: Uint8Array;
}

export interface EnvelopeKeyring {
  current(): EnvelopeKeyMaterial;
  get(keyId: string): Uint8Array | null;
}

export class StaticEnvelopeKeyring implements EnvelopeKeyring {
  private readonly keys = new Map<string, Buffer>();
  private readonly currentKeyId: string;

  constructor(entries: readonly EnvelopeKeyMaterial[], currentKeyId: string) {
    this.currentKeyId = EnvelopeKeyIdSchema.parse(currentKeyId);
    for (const entry of entries) {
      const keyId = EnvelopeKeyIdSchema.parse(entry.keyId);
      const key = Buffer.from(entry.key);
      if (key.byteLength !== 32) {
        throw new Error(`Envelope key ${keyId} must contain exactly 32 bytes.`);
      }
      if (this.keys.has(keyId)) {
        throw new Error(`Duplicate envelope key id: ${keyId}`);
      }
      this.keys.set(keyId, key);
    }
    if (!this.keys.has(this.currentKeyId)) {
      throw new Error("The current envelope key does not exist in the keyring.");
    }
  }

  current(): EnvelopeKeyMaterial {
    return {
      keyId: this.currentKeyId,
      key: Buffer.from(this.keys.get(this.currentKeyId) as Buffer)
    };
  }

  get(keyId: string): Uint8Array | null {
    const key = this.keys.get(keyId);
    return key ? Buffer.from(key) : null;
  }
}

export class EnvelopeDecryptionError extends Error {
  constructor() {
    super("The encrypted delivery candidate could not be decrypted.");
    this.name = "EnvelopeDecryptionError";
  }
}

function additionalAuthenticatedData(context: CandidateEncryptionContext): Buffer {
  const parsed = CandidateEncryptionContextSchema.parse(context);
  return Buffer.from(
    [parsed.purpose, parsed.candidateId, parsed.taskId, parsed.formatId].join("\u0000"),
    "utf8"
  );
}

export class AesGcmCandidateCipher {
  constructor(private readonly keyring: EnvelopeKeyring) {}

  seal(secret: CandidateSecret, context: CandidateEncryptionContext): EncryptedEnvelope {
    const payload = Buffer.from(JSON.stringify(CandidateSecretSchema.parse(secret)), "utf8");
    const { keyId, key } = this.keyring.current();
    if (key.byteLength !== 32) {
      throw new Error("The current envelope key must contain exactly 32 bytes.");
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(additionalAuthenticatedData(context));
    const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
    return EncryptedEnvelopeSchema.parse({
      algorithm: "aes-256-gcm",
      keyId,
      iv: iv.toString("base64url"),
      ciphertext: ciphertext.toString("base64url"),
      authTag: cipher.getAuthTag().toString("base64url")
    });
  }

  open(envelope: EncryptedEnvelope, context: CandidateEncryptionContext): CandidateSecret {
    try {
      const parsed = EncryptedEnvelopeSchema.parse(envelope);
      const key = this.keyring.get(parsed.keyId);
      if (!key || key.byteLength !== 32) {
        throw new Error("Unknown envelope key.");
      }
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(parsed.iv, "base64url")
      );
      decipher.setAAD(additionalAuthenticatedData(context));
      decipher.setAuthTag(Buffer.from(parsed.authTag, "base64url"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(parsed.ciphertext, "base64url")),
        decipher.final()
      ]);
      return CandidateSecretSchema.parse(JSON.parse(plaintext.toString("utf8")));
    } catch {
      throw new EnvelopeDecryptionError();
    }
  }
}

export function createStaticCandidateCipher(
  keyId: string,
  encodedKey: string
): AesGcmCandidateCipher {
  if (!/^[A-Za-z0-9_-]+$/.test(encodedKey)) {
    throw new Error("The delivery encryption key must use canonical base64url encoding.");
  }
  const key = Buffer.from(encodedKey, "base64url");
  if (key.byteLength !== 32 || key.toString("base64url") !== encodedKey) {
    throw new Error("The delivery encryption key must encode exactly 32 bytes.");
  }
  return new AesGcmCandidateCipher(new StaticEnvelopeKeyring([{ keyId, key }], keyId));
}

export function createDeliveryToken(): string {
  return DeliveryTokenSchema.parse(`dlt_${randomBytes(32).toString("base64url")}`);
}

export function hashDeliveryToken(token: string): Buffer {
  return createHash("sha256").update(DeliveryTokenSchema.parse(token), "utf8").digest();
}
