import type {
  ProviderAttempt,
  ResolveJobData,
  ResolveTask,
  TaskError
} from "@tikdd/contracts";
import type { TaskRepository } from "@tikdd/persistence";
import { ProviderRoutingError, type ProviderRouter } from "@tikdd/providers";
import { UnrecoverableError } from "bullmq";
import { prepareEncryptedCandidates } from "./candidates";
import {
  ResolveJobPlatformMismatchError,
  verifyResolveJobPlatform
} from "./platform-consistency";

export const taskCompletionFailedError: TaskError = {
  code: "TASK_COMPLETION_FAILED",
  message: "The resolved task could not be completed.",
  retryable: false
};

type CompletionStage = "candidate_preparation" | "completion_persistence";

export interface ResolveJobTasks {
  markResolving(id: string): Promise<void>;
  completeWithResolution: TaskRepository["completeWithResolution"];
  fail(id: string, error: TaskError): Promise<void>;
  failAfterProviderResolution(
    id: string,
    attempts: readonly ProviderAttempt[],
    error: TaskError
  ): Promise<"failed" | "terminal_unchanged" | "missing">;
  recordProviderAttempts(id: string, attempts: readonly ProviderAttempt[]): Promise<void>;
}

export interface ResolveJobProcessorDependencies {
  tasks: ResolveJobTasks;
  router: Pick<ProviderRouter, "resolve">;
  routeTimeoutMs: number;
  candidateCipher: Parameters<typeof prepareEncryptedCandidates>[0]["cipher"];
  allowResolutionOnly: boolean;
  releaseAdmission(data: ResolveJobData): Promise<void>;
  logInternal(event: Record<string, unknown>): void;
  prepareCandidates?: typeof prepareEncryptedCandidates;
}

function safeErrorEvidence(error: unknown): Record<string, string> {
  if (!(error instanceof Error)) {
    return { errorName: "UnknownError", errorMessage: "Unknown local completion failure." };
  }
  const unsafeMessage = error.message.slice(0, 500);
  const errorMessage = unsafeMessage
    .replace(/https?:\/\/\S+/giu, "[redacted-url]")
    .replace(/\b(authorization|cookie|tt|ts)=\S+/giu, "$1=[redacted]");
  const code = "code" in error && typeof error.code === "string" && /^[A-Z0-9]{5}$/u.test(error.code)
    ? error.code
    : null;
  return {
    errorName: error.name,
    errorMessage,
    ...(code ? { databaseCode: code } : {})
  };
}

async function releaseAdmissionBestEffort(
  data: ResolveJobData,
  dependencies: ResolveJobProcessorDependencies
): Promise<void> {
  try {
    await dependencies.releaseAdmission(data);
  } catch (error) {
    dependencies.logInternal({
      event: "task_admission_release_failed",
      taskId: data.taskId,
      ...safeErrorEvidence(error)
    });
  }
}

async function persistPostProviderFailure(
  data: ResolveJobData,
  stage: CompletionStage,
  attempts: readonly ProviderAttempt[],
  error: unknown,
  dependencies: ResolveJobProcessorDependencies
): Promise<never> {
  dependencies.logInternal({
    event: "post_provider_completion_failed",
    taskId: data.taskId,
    stage,
    ...safeErrorEvidence(error)
  });

  try {
    await dependencies.tasks.failAfterProviderResolution(
      data.taskId,
      attempts,
      taskCompletionFailedError
    );
  } catch (persistenceError) {
    dependencies.logInternal({
      event: "post_provider_failure_persistence_failed",
      taskId: data.taskId,
      stage,
      ...safeErrorEvidence(persistenceError)
    });
  }
  await releaseAdmissionBestEffort(data, dependencies);
  throw new UnrecoverableError("Task completion failed after provider resolution.");
}

export async function processResolveJob(
  data: ResolveJobData,
  dependencies: ResolveJobProcessorDependencies
): Promise<{ taskId: string; provider: string }> {
  await dependencies.tasks.markResolving(data.taskId);

  let detected: ReturnType<typeof verifyResolveJobPlatform>;
  try {
    detected = verifyResolveJobPlatform(data);
  } catch (error) {
    if (!(error instanceof ResolveJobPlatformMismatchError)) throw error;
    await dependencies.tasks.fail(data.taskId, {
      code: error.code,
      message: error.message,
      retryable: false
    });
    await releaseAdmissionBestEffort(data, dependencies);
    throw new UnrecoverableError(error.message);
  }

  let routed: Awaited<ReturnType<ProviderRouter["resolve"]>>;
  try {
    routed = await dependencies.router.resolve({
      taskId: data.taskId,
      sourceUrl: data.sourceUrl,
      canonicalUrl: detected.canonicalUrl,
      platform: detected.platform,
      signal: AbortSignal.timeout(dependencies.routeTimeoutMs)
    });
  } catch (error) {
    if (!(error instanceof ProviderRoutingError)) throw error;
    await dependencies.tasks.recordProviderAttempts(data.taskId, error.attempts);
    if (error.retryable) throw error;
    await dependencies.tasks.fail(data.taskId, {
      code: error.failureCode.toUpperCase(),
      message: error.message,
      retryable: false
    });
    await releaseAdmissionBestEffort(data, dependencies);
    throw new UnrecoverableError(error.message);
  }

  // External resolution has succeeded. Nothing below this boundary may replay the Provider.
  let candidates: ReturnType<typeof prepareEncryptedCandidates>;
  try {
    candidates = (dependencies.prepareCandidates ?? prepareEncryptedCandidates)({
      taskId: data.taskId,
      resolution: routed.resolution,
      cipher: dependencies.candidateCipher,
      allowResolutionOnly: dependencies.allowResolutionOnly
    });
  } catch (error) {
    return persistPostProviderFailure(
      data,
      "candidate_preparation",
      routed.attempts,
      error,
      dependencies
    );
  }

  try {
    await dependencies.tasks.completeWithResolution(
      data.taskId,
      routed.resolution.result,
      candidates,
      routed.attempts
    );
  } catch (error) {
    return persistPostProviderFailure(
      data,
      "completion_persistence",
      routed.attempts,
      error,
      dependencies
    );
  }

  await releaseAdmissionBestEffort(data, dependencies);
  return {
    taskId: data.taskId,
    provider: routed.resolution.result.provenance.provider
  };
}

export interface ExhaustedResolveJob {
  attemptsMade: number;
  opts: { attempts?: number };
  data: ResolveJobData;
}

export interface ExhaustedJobTasks {
  getById(id: string): Promise<ResolveTask | null>;
  failIfNonTerminal(id: string, error: TaskError): Promise<boolean>;
}

export async function handleExhaustedResolveJob(
  job: ExhaustedResolveJob | undefined,
  tasks: ExhaustedJobTasks,
  releaseAdmission: (data: ResolveJobData) => Promise<void>,
  logInternal: (event: Record<string, unknown>) => void
): Promise<void> {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;

  const task = await tasks.getById(job.data.taskId);
  if (!task || ["failed", "succeeded", "expired"].includes(task.status)) return;

  const failed = await tasks.failIfNonTerminal(job.data.taskId, {
    code: "PROVIDER_UNAVAILABLE",
    message: "No resolver provider completed the task.",
    retryable: true
  });
  if (!failed) return;

  try {
    await releaseAdmission(job.data);
  } catch (error) {
    logInternal({
      event: "terminal_task_admission_release_failed",
      taskId: job.data.taskId,
      ...safeErrorEvidence(error)
    });
  }
}
