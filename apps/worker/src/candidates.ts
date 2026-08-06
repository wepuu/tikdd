import { randomUUID } from "node:crypto";
import {
  AesGcmCandidateCipher,
  CompleteProviderResolutionSchema,
  createStaticCandidateCipher,
  EncryptedDeliveryCandidateSchema,
  ProviderResolutionSchema,
  type EncryptedDeliveryCandidate,
  type ProviderResolution
} from "@tikdd/delivery-core";

export class CandidateEncryptionUnavailableError extends Error {
  constructor() {
    super("Delivery candidates require a configured encryption key.");
    this.name = "CandidateEncryptionUnavailableError";
  }
}

export function createCandidateCipherFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env
): AesGcmCandidateCipher | null {
  const keyId = environment.DELIVERY_ENCRYPTION_KEY_ID;
  const encodedKey = environment.DELIVERY_ENCRYPTION_KEY_BASE64URL;
  if (!keyId && !encodedKey) {
    return null;
  }
  if (!keyId || !encodedKey || !/^[A-Za-z0-9_-]+$/.test(encodedKey)) {
    throw new Error(
      "DELIVERY_ENCRYPTION_KEY_ID and DELIVERY_ENCRYPTION_KEY_BASE64URL must both be valid."
    );
  }

  return createStaticCandidateCipher(keyId, encodedKey);
}

export interface PrepareCandidateOptions {
  taskId: string;
  resolution: ProviderResolution;
  cipher: AesGcmCandidateCipher | null;
  allowResolutionOnly: boolean;
  idFactory?: () => string;
}

export function prepareEncryptedCandidates({
  taskId,
  resolution: rawResolution,
  cipher,
  allowResolutionOnly,
  idFactory = () => randomUUID().replaceAll("-", "")
}: PrepareCandidateOptions): EncryptedDeliveryCandidate[] {
  const resolution = ProviderResolutionSchema.parse(rawResolution);
  if (resolution.candidates.length === 0 && allowResolutionOnly) {
    return [];
  }

  const complete = CompleteProviderResolutionSchema.parse(resolution);
  if (!cipher) {
    throw new CandidateEncryptionUnavailableError();
  }

  return complete.candidates.map((candidate) => {
    const id = `dvc_${idFactory()}`;
    const context = {
      purpose: "delivery-candidate" as const,
      candidateId: id,
      taskId,
      formatId: candidate.formatId
    };
    const envelope = cipher.seal(
      { targetUrl: candidate.targetUrl, secretHeaders: candidate.secretHeaders },
      context
    );
    return EncryptedDeliveryCandidateSchema.parse({
      id,
      formatId: candidate.formatId,
      providerId: complete.result.provenance.provider,
      mode: candidate.mode,
      hostPolicyId: candidate.hostPolicyId,
      envelope,
      expiresAt: candidate.expiresAt
    });
  });
}
