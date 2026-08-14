import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { detectPlatform } from "@tikdd/platform";
import { z } from "zod";
import { DLPandaProvider } from "./adapters/dlpanda";
import { SSSTwitterProvider } from "./adapters/ssstwitter";
import { TwitterSaverProvider } from "./adapters/twitter-saver";
import {
  CanaryProviderIdSchema,
  ProviderCanaryConfigSchema,
  selectProviderCanaries,
  type CanaryProviderId
} from "./canary-config";
import { ProviderError } from "./errors";
import { MockProvider, ProviderRouter, type ResolverProvider } from "./index";

const providers: Record<CanaryProviderId, ResolverProvider> = {
  twittersaver: new TwitterSaverProvider({ enabled: true }),
  dlpanda: new DLPandaProvider({ enabled: true }),
  ssstwitter: new SSSTwitterProvider({ enabled: true })
};

function qualificationHosts(provider: ResolverProvider): readonly string[] {
  if (provider instanceof SSSTwitterProvider) {
    return provider.consumeQualificationEvidence()?.candidateHosts ?? [];
  }
  return [];
}

function failureCode(error: unknown): string {
  if (error instanceof ProviderError) {
    return error.failureCode;
  }
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return "provider_timeout";
  }
  return "internal_error";
}

async function auditDeliveryCandidate(
  candidate: { targetUrl: string },
  observedAfterMs: number
): Promise<{
  host: string;
  status: number;
  redirectHost: string | null;
  contentType: string | null;
  contentLength: string | null;
  durationMs: number;
  observedAfterMs: number;
}> {
  const auditStartedAt = Date.now();
  const response = await fetch(candidate.targetUrl, {
    method: "HEAD",
    redirect: "manual",
    signal: AbortSignal.timeout(10_000)
  });
  const location = response.headers.get("location");
  return {
    host: new URL(candidate.targetUrl).hostname,
    status: response.status,
    redirectHost: location ? new URL(location, candidate.targetUrl).hostname : null,
    contentType: response.headers.get("content-type")?.split(";", 1)[0] ?? null,
    contentLength: response.headers.get("content-length"),
    durationMs: Date.now() - auditStartedAt,
    observedAfterMs
  };
}

async function main(): Promise<void> {
  if (process.env.TIKDD_CANARY_AUTHORIZED !== "true") {
    throw new Error(
      "Refusing live requests: set TIKDD_CANARY_AUTHORIZED=true after reviewing the canary authorization record."
    );
  }

  const configUrl = new URL("../../../config/provider-canaries.json", import.meta.url);
  const config = ProviderCanaryConfigSchema.parse(JSON.parse(await readFile(configUrl, "utf8")));
  const providerFilter = process.env.CANARY_PROVIDER
    ? CanaryProviderIdSchema.parse(process.env.CANARY_PROVIDER)
    : undefined;
  const mode = z.enum(["direct", "routing"]).parse(process.env.CANARY_MODE ?? "direct");
  const deliveryLifetimeDelayMs = z.coerce
    .number()
    .int()
    .min(0)
    .max(5 * 60 * 1000)
    .parse(process.env.CANARY_AUDIT_LIFETIME_DELAY_MS ?? "0");
  const selected = selectProviderCanaries(config, {
    id: process.env.CANARY_ID,
    provider: providerFilter
  });

  process.stdout.write(
    `${JSON.stringify({
      event: "canary_start",
      authorization: "project-owner-asserted",
      assertedAt: config.authorization.assertedAt,
      mode,
      count: selected.length
    })}\n`
  );

  let failed = 0;
  for (const canary of selected) {
    const startedAt = Date.now();
    try {
      const detected = detectPlatform(canary.url);
      if (detected.platform !== canary.platform) {
        throw new Error("The detected platform does not match the canary declaration.");
      }

      const input = {
        taskId: `tsk_${randomUUID().replaceAll("-", "")}`,
        sourceUrl: canary.url,
        canonicalUrl: detected.canonicalUrl,
        platform: detected.platform,
        signal: AbortSignal.timeout(25_000)
      };
      const selectedProvider = providers[canary.provider];
      const routed =
        mode === "routing"
          ? await new ProviderRouter(
              [providers.twittersaver, providers.dlpanda, new MockProvider()],
              { maxAttempts: 4 }
            ).resolve(input)
          : null;
      const resolution = routed?.resolution ?? (await selectedProvider.resolve(input));
      const result = resolution.result;
      const candidateHosts = process.env.CANARY_REPORT_HOSTS === "true"
        ? [...new Set([
            ...resolution.candidates.map((candidate) => new URL(candidate.targetUrl).hostname),
            ...qualificationHosts(selectedProvider)
          ])]
            .sort()
        : null;
      let deliveryAudit = null;
      if (process.env.CANARY_AUDIT_DELIVERY === "true") {
        if (deliveryLifetimeDelayMs > 0) {
          const candidate = resolution.candidates[0];
          if (!candidate) {
            throw new Error("The provider returned no candidate for the delivery lifetime audit.");
          }
          const initial = await auditDeliveryCandidate(candidate, 0);
          await new Promise((resolve) => setTimeout(resolve, deliveryLifetimeDelayMs));
          const delayed = await auditDeliveryCandidate(candidate, deliveryLifetimeDelayMs);
          deliveryAudit = [initial, delayed];
        } else {
          deliveryAudit = await Promise.all(
            resolution.candidates
              .slice(0, 2)
              .map((candidate) => auditDeliveryCandidate(candidate, 0))
          );
        }
      }
      process.stdout.write(
        `${JSON.stringify({
          event: "canary_result",
          id: canary.id,
          provider: canary.provider,
          platform: detected.platform,
          status: "succeeded",
          selectedProvider: result.provenance.provider,
          formatCount: result.formats.length,
          ...(candidateHosts ? { candidateHosts } : {}),
          ...(deliveryAudit ? { deliveryAudit } : {}),
          ...(routed
            ? {
                attempts: routed.attempts.map((attempt) => ({
                  provider: attempt.providerId,
                  status: attempt.status,
                  failureCode: attempt.failureCode
                }))
              }
            : {}),
          durationMs: Date.now() - startedAt
        })}\n`
      );
    } catch (error) {
      failed += 1;
      process.stdout.write(
        `${JSON.stringify({
          event: "canary_result",
          id: canary.id,
          provider: canary.provider,
          platform: canary.platform,
          status: "failed",
          failureCode: failureCode(error),
          durationMs: Date.now() - startedAt
        })}\n`
      );
    }
  }

  process.stdout.write(
    `${JSON.stringify({ event: "canary_complete", passed: selected.length - failed, failed })}\n`
  );
  if (failed > 0) {
    process.exitCode = 1;
  }
}

await main();
