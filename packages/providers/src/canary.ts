import { readFile } from "node:fs/promises";
import { detectPlatform } from "@tikdd/platform";
import { z } from "zod";
import { DLPandaProvider } from "./adapters/dlpanda";
import { TwitterSaverProvider } from "./adapters/twitter-saver";
import { ProviderError } from "./errors";
import { MockProvider, ProviderRouter, type ResolverProvider } from "./index";

const ProviderIdSchema = z.enum(["twittersaver", "dlpanda"]);
type ProviderId = z.infer<typeof ProviderIdSchema>;

const CanaryConfigSchema = z.object({
  version: z.literal(1),
  authorization: z.object({
    assertedBy: z.string().min(1),
    assertedAt: z.iso.date(),
    scope: z.string().min(1)
  }),
  canaries: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        provider: ProviderIdSchema,
        platform: z.string().min(1),
        url: z.string().url()
      })
    )
    .min(1)
});

const providers: Record<ProviderId, ResolverProvider> = {
  twittersaver: new TwitterSaverProvider({ enabled: true }),
  dlpanda: new DLPandaProvider({ enabled: true })
};

function failureCode(error: unknown): string {
  if (error instanceof ProviderError) {
    return error.failureCode;
  }
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return "provider_timeout";
  }
  return "internal_error";
}

async function main(): Promise<void> {
  if (process.env.TIKDD_CANARY_AUTHORIZED !== "true") {
    throw new Error(
      "Refusing live requests: set TIKDD_CANARY_AUTHORIZED=true after reviewing the canary authorization record."
    );
  }

  const configUrl = new URL("../../../config/provider-canaries.json", import.meta.url);
  const config = CanaryConfigSchema.parse(JSON.parse(await readFile(configUrl, "utf8")));
  const providerFilter = process.env.CANARY_PROVIDER
    ? ProviderIdSchema.parse(process.env.CANARY_PROVIDER)
    : null;
  const mode = z.enum(["direct", "routing"]).parse(process.env.CANARY_MODE ?? "direct");
  const selected = config.canaries.filter(
    (canary) => providerFilter === null || canary.provider === providerFilter
  );

  if (selected.length === 0) {
    throw new Error("No canaries matched CANARY_PROVIDER.");
  }

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
        sourceUrl: canary.url,
        canonicalUrl: detected.canonicalUrl,
        platform: detected.platform,
        signal: AbortSignal.timeout(25_000)
      };
      const routed =
        mode === "routing"
          ? await new ProviderRouter(
              [providers.twittersaver, providers.dlpanda, new MockProvider()],
              { maxAttempts: 4 }
            ).resolve(input)
          : null;
      const resolution = routed?.resolution ?? (await providers[canary.provider].resolve(input));
      const result = resolution.result;
      const candidateHosts = process.env.CANARY_REPORT_HOSTS === "true"
        ? [...new Set(resolution.candidates.map((candidate) => new URL(candidate.targetUrl).hostname))]
            .sort()
        : null;
      const deliveryAudit = process.env.CANARY_AUDIT_DELIVERY === "true"
        ? await Promise.all(
            resolution.candidates.map(async (candidate) => {
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
                contentType: response.headers.get("content-type")?.split(";", 1)[0] ?? null
              };
            })
          )
        : null;
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
