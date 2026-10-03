import { createHmac, timingSafeEqual } from "node:crypto";
import type { YtDlpArtifactRequest, YtDlpRunnerRequest } from "@tikdd/contracts";

type SignedRunnerRequest = YtDlpRunnerRequest | YtDlpArtifactRequest;

export const RUNNER_SIGNATURE_HEADER = "x-tikdd-signature";
export const RUNNER_TIMESTAMP_HEADER = "x-tikdd-timestamp";

export function serializeRunnerRequest(request: SignedRunnerRequest): string {
  return JSON.stringify("maximumHeight" in request ? {
    requestId: request.requestId,
    platform: request.platform,
    url: request.url,
    deadlineMs: request.deadlineMs,
    maximumHeight: request.maximumHeight
  } : {
    requestId: request.requestId,
    platform: request.platform,
    url: request.url,
    deadlineMs: request.deadlineMs
  });
}

export function signRunnerRequest(
  secret: string,
  timestamp: string,
  request: SignedRunnerRequest
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}\n${serializeRunnerRequest(request)}`)
    .digest("base64url");
}

export function verifyRunnerRequestSignature(input: {
  secret: string;
  timestamp: string;
  signature: string;
  request: SignedRunnerRequest;
  now?: number;
  maximumSkewMs?: number;
}): boolean {
  const timestamp = Number.parseInt(input.timestamp, 10);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs((input.now ?? Date.now()) - timestamp) > (input.maximumSkewMs ?? 60_000)) {
    return false;
  }
  const expected = Buffer.from(
    signRunnerRequest(input.secret, input.timestamp, input.request),
    "utf8"
  );
  const actual = Buffer.from(input.signature, "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
