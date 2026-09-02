import type {
  ProviderAttempt,
  ResolveJobData,
  ResolveTask,
  TaskError
} from "@tikdd/contracts";
import type { ProviderResolution } from "@tikdd/delivery-core";
import { ProviderRoutingError, type ProviderRouter } from "@tikdd/providers";
import { UnrecoverableError } from "bullmq";
import { describe, expect, it, vi } from "vitest";
import {
  handleExhaustedResolveJob,
  processResolveJob,
  taskCompletionFailedError,
  type ResolveJobProcessorDependencies,
  type ResolveJobTasks
} from "../src/resolve-job-processor";

const taskId = "tsk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const data: ResolveJobData = {
  taskId,
  sourceUrl: "https://x.com/example/status/123456789",
  platform: "x",
  admissionPermitId: "tsk_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  admissionReferenceId: "adr_cccccccccccccccccccccccccccccccc"
};

const attempt: ProviderAttempt = {
  providerId: "ssstwitter",
  providerKind: "site-adapter",
  platform: "x",
  region: "nl",
  priority: 900,
  routeScore: 900_100,
  status: "succeeded",
  failureCode: null,
  retryable: null,
  fallbackAllowed: null,
  startedAt: "2026-09-02T00:00:00.000Z",
  finishedAt: "2026-09-02T00:00:01.000Z",
  durationMs: 1_000
};

const resolution: ProviderResolution = {
  result: {
    schemaVersion: "1.0",
    source: { platform: "x", canonicalUrl: "https://x.com/example/status/123456789" },
    media: {
      id: "fixture-media",
      title: "Local fixture",
      author: null,
      thumbnailUrl: null,
      durationSeconds: null,
      isLive: false
    },
    formats: [{
      id: "fixture",
      container: "mp4",
      mimeType: "video/mp4",
      quality: "Fixture",
      width: null,
      height: null,
      fps: null,
      bitrateKbps: null,
      estimatedBytes: null,
      videoCodec: null,
      audioCodec: null,
      hasVideo: true,
      hasAudio: true
    }],
    provenance: {
      provider: "ssstwitter",
      kind: "site-adapter",
      cacheHit: false,
      resolvedAt: "2026-09-02T00:00:01.000Z"
    },
    warnings: []
  },
  candidates: []
};

function task(status: ResolveTask["status"], error: TaskError | null = null): ResolveTask {
  return {
    id: taskId,
    status,
    platform: "x",
    canonicalUrl: resolution.result.source.canonicalUrl,
    result: status === "succeeded" ? resolution.result : null,
    error,
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:01.000Z",
    expiresAt: "2026-09-02T01:00:00.000Z"
  };
}

function harness() {
  const tasks: ResolveJobTasks = {
    markResolving: vi.fn(async () => undefined),
    completeWithResolution: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
    failAfterProviderResolution: vi.fn(async () => "failed" as const),
    recordProviderAttempts: vi.fn(async () => undefined)
  };
  const resolve = vi.fn(async () => ({ resolution, attempts: [attempt] }));
  const releaseAdmission = vi.fn(async () => undefined);
  const logInternal = vi.fn();
  const prepareCandidates = vi.fn(() => []);
  const dependencies: ResolveJobProcessorDependencies = {
    tasks,
    router: { resolve } as Pick<ProviderRouter, "resolve">,
    routeTimeoutMs: 1_000,
    candidateCipher: null,
    allowResolutionOnly: true,
    releaseAdmission,
    logInternal,
    prepareCandidates
  };
  return { tasks, resolve, releaseAdmission, logInternal, prepareCandidates, dependencies };
}

describe("resolve job Provider-success retry boundary", () => {
  it("completes after one Provider call without failing the task", async () => {
    const h = harness();
    await expect(processResolveJob(data, h.dependencies)).resolves.toEqual({
      taskId,
      provider: "ssstwitter"
    });
    expect(h.resolve).toHaveBeenCalledTimes(1);
    expect(h.tasks.completeWithResolution).toHaveBeenCalledOnce();
    expect(h.tasks.fail).not.toHaveBeenCalled();
    expect(h.tasks.failAfterProviderResolution).not.toHaveBeenCalled();
  });

  it("propagates a retryable Provider failure before success", async () => {
    const h = harness();
    const error = new ProviderRoutingError("temporary", "provider_timeout", true, []);
    h.resolve.mockRejectedValueOnce(error);
    await expect(processResolveJob(data, h.dependencies)).rejects.toBe(error);
    expect(h.tasks.recordProviderAttempts).toHaveBeenCalledWith(taskId, []);
    expect(h.tasks.failAfterProviderResolution).not.toHaveBeenCalled();
    expect(h.releaseAdmission).not.toHaveBeenCalled();
  });

  it("terminalizes a non-retryable Provider failure without changing its meaning", async () => {
    const h = harness();
    const failedAttempt = { ...attempt, status: "failed" as const, failureCode: "content_private" as const, retryable: false, fallbackAllowed: false };
    h.resolve.mockRejectedValueOnce(
      new ProviderRoutingError("The content is private.", "content_private", false, [failedAttempt])
    );
    await expect(processResolveJob(data, h.dependencies)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(h.tasks.recordProviderAttempts).toHaveBeenCalledWith(taskId, [failedAttempt]);
    expect(h.tasks.fail).toHaveBeenCalledWith(taskId, {
      code: "CONTENT_PRIVATE",
      message: "The content is private.",
      retryable: false
    });
  });

  it("does not replay Provider resolution after candidate preparation fails", async () => {
    const h = harness();
    h.prepareCandidates.mockImplementationOnce(() => {
      throw new Error("candidate encryption unavailable");
    });
    await expect(processResolveJob(data, h.dependencies)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(h.resolve).toHaveBeenCalledTimes(1);
    expect(h.tasks.failAfterProviderResolution).toHaveBeenCalledWith(
      taskId,
      [attempt],
      taskCompletionFailedError
    );
    expect(h.releaseAdmission).toHaveBeenCalledOnce();
  });

  it("preserves the successful attempt and does not replay after completion persistence fails", async () => {
    const h = harness();
    vi.mocked(h.tasks.completeWithResolution).mockRejectedValueOnce(new Error("transaction failed"));
    await expect(processResolveJob(data, h.dependencies)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(h.resolve).toHaveBeenCalledTimes(1);
    expect(h.tasks.failAfterProviderResolution).toHaveBeenCalledWith(
      taskId,
      [attempt],
      { code: "TASK_COMPLETION_FAILED", message: "The resolved task could not be completed.", retryable: false }
    );
  });

  it("keeps 42501 details internal and exposes only the generic task error", async () => {
    const h = harness();
    const permissionError = Object.assign(
      new Error("permission denied for table delivery_candidates"),
      { code: "42501" }
    );
    vi.mocked(h.tasks.completeWithResolution).mockRejectedValueOnce(permissionError);
    await expect(processResolveJob(data, h.dependencies)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(h.tasks.failAfterProviderResolution).toHaveBeenCalledWith(
      taskId,
      [attempt],
      taskCompletionFailedError
    );
    expect(JSON.stringify(taskCompletionFailedError)).not.toContain("delivery_candidates");
    expect(h.logInternal).toHaveBeenCalledWith(expect.objectContaining({
      stage: "completion_persistence",
      databaseCode: "42501"
    }));
  });
});

describe("exhausted resolve job handling", () => {
  const exhaustedJob = { attemptsMade: 3, opts: { attempts: 3 }, data };

  it("does not overwrite TASK_COMPLETION_FAILED", async () => {
    const tasks = {
      getById: vi.fn(async () => task("failed", taskCompletionFailedError)),
      failIfNonTerminal: vi.fn(async () => false)
    };
    await handleExhaustedResolveJob(exhaustedJob, tasks, vi.fn(), vi.fn());
    expect(tasks.failIfNonTerminal).not.toHaveBeenCalled();
  });

  it("does not overwrite a succeeded task", async () => {
    const tasks = {
      getById: vi.fn(async () => task("succeeded")),
      failIfNonTerminal: vi.fn(async () => false)
    };
    await handleExhaustedResolveJob(exhaustedJob, tasks, vi.fn(), vi.fn());
    expect(tasks.failIfNonTerminal).not.toHaveBeenCalled();
  });

  it("does not overwrite an expired task", async () => {
    const tasks = {
      getById: vi.fn(async () => task("expired")),
      failIfNonTerminal: vi.fn(async () => false)
    };
    await handleExhaustedResolveJob(exhaustedJob, tasks, vi.fn(), vi.fn());
    expect(tasks.failIfNonTerminal).not.toHaveBeenCalled();
  });

  it("persists PROVIDER_UNAVAILABLE only for genuine exhaustion", async () => {
    const tasks = {
      getById: vi.fn(async () => task("resolving")),
      failIfNonTerminal: vi.fn(async () => true)
    };
    const release = vi.fn(async () => undefined);
    await handleExhaustedResolveJob(exhaustedJob, tasks, release, vi.fn());
    expect(tasks.failIfNonTerminal).toHaveBeenCalledWith(taskId, {
      code: "PROVIDER_UNAVAILABLE",
      message: "No resolver provider completed the task.",
      retryable: true
    });
    expect(release).toHaveBeenCalledOnce();
  });

  it("retains the local terminal error when completion fails on the final attempt", async () => {
    const h = harness();
    const retryable = new ProviderRoutingError("temporary", "provider_timeout", true, []);
    h.resolve.mockRejectedValueOnce(retryable).mockRejectedValueOnce(retryable);
    vi.mocked(h.tasks.completeWithResolution).mockRejectedValueOnce(new Error("local completion failed"));

    await expect(processResolveJob(data, h.dependencies)).rejects.toBe(retryable);
    await expect(processResolveJob(data, h.dependencies)).rejects.toBe(retryable);
    await expect(processResolveJob(data, h.dependencies)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(h.resolve).toHaveBeenCalledTimes(3);

    const persisted = task("failed", taskCompletionFailedError);
    const listenerTasks = {
      getById: vi.fn(async () => persisted),
      failIfNonTerminal: vi.fn(async () => false)
    };
    await handleExhaustedResolveJob(exhaustedJob, listenerTasks, vi.fn(), vi.fn());
    expect(listenerTasks.failIfNonTerminal).not.toHaveBeenCalled();
    expect(persisted.error?.code).toBe("TASK_COMPLETION_FAILED");
  });
});
