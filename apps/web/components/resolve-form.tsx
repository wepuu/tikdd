"use client";

import type { ApiError, Delivery, MediaFormat, ResolveTask, TaskError } from "@tikdd/contracts";
import { detectPlatform, listPlatformDefinitions } from "@tikdd/platform";
import {
  CheckIcon,
  CircleNotchIcon,
  DotsThreeIcon,
  DownloadSimpleIcon,
  GlobeHemisphereWestIcon,
  LinkSimpleIcon,
  PlayIcon,
  ScanIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  VideoCameraIcon,
  WarningCircleIcon,
  XIcon,
  XLogoIcon,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SiteCopy } from "../lib/copy";
import { formatMediaDuration, publicResultTitle } from "../lib/result-presentation";
import { isDeliveryExpired, publicFailureIntent } from "../lib/task-presentation";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const deliveryBaseUrl = process.env.NEXT_PUBLIC_DELIVERY_BASE_URL ?? "http://localhost:4002";
const terminalStates = new Set<ResolveTask["status"]>(["succeeded", "failed", "expired"]);
const qaUrl = "https://x.com/tikddqa/status/1234567890";

type QaScenario =
  | "recognized"
  | "ready-fast"
  | "ready-slow"
  | "failure-retryable"
  | "failure-private"
  | "delivery-ready"
  | "delivery-expired"
  | "duplicate";

interface ResolveFormProps {
  copy: SiteCopy["form"];
  featureLabel: string;
  features: SiteCopy["features"];
  process: SiteCopy["process"];
  supported: SiteCopy["supported"];
}

function platformName(value: ResolveTask["platform"]): string {
  return listPlatformDefinitions().find(({ id }) => id === value)?.displayName ?? value;
}

function formatComposition(format: MediaFormat, copy: SiteCopy["form"]): string {
  if (format.hasVideo && format.hasAudio) return copy.videoAudio;
  if (format.hasVideo) return copy.videoOnly;
  return copy.audioOnly;
}

function readQaScenario(): QaScenario | null {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("qa");
  return [
    "recognized",
    "ready-fast",
    "ready-slow",
    "failure-retryable",
    "failure-private",
    "delivery-ready",
    "delivery-expired",
    "duplicate"
  ].includes(value ?? "") ? value as QaScenario : null;
}

function qaTask(status: ResolveTask["status"], error: TaskError | null = null): ResolveTask {
  const now = new Date();
  return {
    id: `tsk_${"1".repeat(32)}`,
    status,
    platform: "x",
    canonicalUrl: qaUrl,
    result: status === "succeeded" ? {
      schemaVersion: "1.0",
      source: { platform: "x", canonicalUrl: qaUrl },
      media: {
        id: "qa-media",
        title: "Public video post",
        author: "@creator",
        thumbnailUrl: null,
        durationSeconds: 47,
        isLive: false
      },
      formats: [
        {
          id: "qa-720p",
          container: "mp4",
          mimeType: "video/mp4",
          quality: "720p",
          width: 1280,
          height: 720,
          fps: 30,
          bitrateKbps: null,
          estimatedBytes: 2_100_269,
          videoCodec: null,
          audioCodec: null,
          hasVideo: true,
          hasAudio: true
        },
        {
          id: "qa-360p",
          container: "mp4",
          mimeType: "video/mp4",
          quality: "360p",
          width: 640,
          height: 360,
          fps: 30,
          bitrateKbps: null,
          estimatedBytes: 1_040_035,
          videoCodec: null,
          audioCodec: null,
          hasVideo: true,
          hasAudio: true
        }
      ],
      provenance: { provider: "tikdd", kind: "api", cacheHit: false, resolvedAt: now.toISOString() },
      warnings: []
    } : null,
    error,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString()
  };
}

function admissionMessage(code: string, copy: SiteCopy["form"]): string {
  switch (code) {
    case "DUPLICATE_IN_PROGRESS": return copy.duplicateInProgress;
    case "RATE_LIMITED": return copy.rateLimited;
    case "CONCURRENCY_LIMITED": return copy.concurrencyLimited;
    case "IDEMPOTENCY_CONFLICT": return copy.idempotencyConflict;
    case "ADMISSION_UNAVAILABLE": return copy.admissionUnavailable;
    default: return copy.resolveError;
  }
}

const platformIcons = [XLogoIcon] as const;
const processIcons = [LinkSimpleIcon, ScanIcon, DownloadSimpleIcon] as const;
const featureIcons = [GlobeHemisphereWestIcon, SlidersHorizontalIcon, ShieldCheckIcon] as const;

export function ResolveForm({ copy, featureLabel, features, process, supported }: ResolveFormProps) {
  const [url, setUrl] = useState("");
  const [task, setTask] = useState<ResolveTask | null>(null);
  const [selectedFormatId, setSelectedFormatId] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<TaskError | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [deliveryExpired, setDeliveryExpired] = useState(false);
  const [deliveryHandedOff, setDeliveryHandedOff] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [workingLonger, setWorkingLonger] = useState(false);
  const [deliveringFormatId, setDeliveringFormatId] = useState<string | null>(null);
  const resultCardRef = useRef<HTMLElement>(null);
  const focusedStateRef = useRef<string | null>(null);
  const submissionKeyRef = useRef<{ url: string; key: string } | null>(null);
  const qaScenarioRef = useRef<QaScenario | null>(null);
  const formatButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  const detectedPlatform = useMemo(() => {
    if (!url.trim()) return null;
    try { return detectPlatform(url.trim()).platform; } catch { return null; }
  }, [url]);

  useEffect(() => {
    const scenario = readQaScenario();
    qaScenarioRef.current = scenario;
    if (!scenario) return;
    setUrl(qaUrl);
    if (scenario === "recognized") return;
    if (scenario === "ready-slow") {
      setTask(qaTask("resolving"));
      setIsWorking(true);
      const timer = window.setTimeout(() => {
        setTask(qaTask("succeeded"));
        setIsWorking(false);
      }, 8_000);
      return () => window.clearTimeout(timer);
    }
    if (["ready-fast", "delivery-ready", "delivery-expired"].includes(scenario)) {
      setTask(qaTask("succeeded"));
      if (scenario === "delivery-expired") {
        const timer = window.setTimeout(() => {
          setDelivery({
            id: "dtk_qa_expired",
            mode: "redirect",
            url: `${deliveryBaseUrl}/d/dlt_${"A".repeat(43)}`,
            expiresAt: new Date(Date.now() - 1_000).toISOString()
          });
          setDeliveryExpired(true);
        }, 0);
        return () => window.clearTimeout(timer);
      }
      return;
    }
    if (scenario === "failure-retryable") {
      setTask(qaTask("failed", { code: "PROVIDER_UNAVAILABLE", message: "Unavailable", retryable: true }));
      return;
    }
    if (scenario === "failure-private") {
      setTask(qaTask("failed", { code: "CONTENT_PRIVATE", message: "Private", retryable: false }));
      return;
    }
    setSubmissionError({ code: "DUPLICATE_IN_PROGRESS", message: "Duplicate", retryable: true });
  }, []);

  useEffect(() => {
    const firstFormatId = task?.status === "succeeded" ? task.result?.formats[0]?.id : null;
    setSelectedFormatId(firstFormatId ?? null);
  }, [task?.id, task?.status]);

  useEffect(() => {
    if (!isWorking) {
      setWorkingLonger(false);
      return;
    }
    const timer = window.setTimeout(() => setWorkingLonger(true), 3_500);
    return () => window.clearTimeout(timer);
  }, [isWorking]);

  useEffect(() => {
    if (!delivery || deliveryExpired) return;
    const remainingMs = Date.parse(delivery.expiresAt) - Date.now();
    if (remainingMs <= 0) {
      setDeliveryExpired(true);
      return;
    }
    const timer = window.setTimeout(() => setDeliveryExpired(true), remainingMs + 25);
    return () => window.clearTimeout(timer);
  }, [delivery, deliveryExpired]);

  const focusKey = task && terminalStates.has(task.status)
    ? `${task.id}:${task.status}`
    : submissionError
      ? `admission:${submissionError.code}`
      : null;

  useEffect(() => {
    if (!focusKey || focusedStateRef.current === focusKey) return;
    focusedStateRef.current = focusKey;
    const animationFrame = window.requestAnimationFrame(() => {
      const target = resultCardRef.current;
      if (!target) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start"
      });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [focusKey]);

  async function pollTask(taskId: string): Promise<void> {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 750));
      const response = await fetch(`${apiBaseUrl}/v1/resolve-tasks/${taskId}`, { cache: "no-store" });
      if (!response.ok) throw new Error(copy.resolveError);
      const nextTask = (await response.json()) as ResolveTask;
      setTask(nextTask);
      if (terminalStates.has(nextTask.status)) return;
    }
    throw new Error(copy.timeout);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!detectedPlatform || isWorking) return;
    setIsWorking(true);
    setSubmissionError(null);
    setTask(null);
    setDelivery(null);
    setDeliveryExpired(false);
    setDeliveryHandedOff(false);
    setDeliveryError(null);
    try {
      const normalizedUrl = url.trim();
      if (qaScenarioRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 650));
        setTask(qaTask("succeeded"));
        return;
      }
      const idempotencyKey = submissionKeyRef.current?.url === normalizedUrl
        ? submissionKeyRef.current.key
        : crypto.randomUUID();
      submissionKeyRef.current = { url: normalizedUrl, key: idempotencyKey };
      const response = await fetch(`${apiBaseUrl}/v1/resolve-tasks`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify({ url: normalizedUrl })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiError | null;
        const publicError: TaskError = {
          code: payload?.error.code ?? "RESOLVE_REQUEST_FAILED",
          message: admissionMessage(payload?.error.code ?? "", copy),
          retryable: payload?.error.retryable ?? true
        };
        throw publicError;
      }
      const createdTask = (await response.json()) as ResolveTask;
      submissionKeyRef.current = null;
      setTask(createdTask);
      await pollTask(createdTask.id);
    } catch (caught) {
      const taskError = caught as Partial<TaskError>;
      setSubmissionError({
        code: taskError.code ?? "RESOLVE_REQUEST_FAILED",
        message: taskError.message ?? copy.resolveError,
        retryable: taskError.retryable ?? true
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function requestDelivery(formatId: string): Promise<void> {
    if (!task || task.status !== "succeeded" || deliveringFormatId) return;
    setDeliveringFormatId(formatId);
    setDeliveryError(null);
    setDelivery(null);
    setDeliveryExpired(false);
    setDeliveryHandedOff(false);
    try {
      if (qaScenarioRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        setDelivery({
          id: "dtk_qa_ready",
          mode: "redirect",
          url: `${deliveryBaseUrl}/d/dlt_${"B".repeat(43)}`,
          expiresAt: new Date(Date.now() + 60_000).toISOString()
        });
        return;
      }
      const response = await fetch(`${deliveryBaseUrl}/v1/deliveries`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: task.id, formatId })
      });
      if (!response.ok) throw new Error(copy.deliveryError);
      const nextDelivery = (await response.json()) as Delivery;
      setDelivery(nextDelivery);
      setDeliveryExpired(isDeliveryExpired(nextDelivery.expiresAt, Date.now()));
    } catch {
      setDeliveryError(copy.deliveryError);
    } finally {
      setDeliveringFormatId(null);
    }
  }

  function clearLink(): void {
    submissionKeyRef.current = null;
    focusedStateRef.current = null;
    setUrl("");
    setTask(null);
    setSelectedFormatId(null);
    setSubmissionError(null);
    setDelivery(null);
    setDeliveryExpired(false);
    setDeliveryHandedOff(false);
    setDeliveryError(null);
  }

  function selectFormat(formatId: string): void {
    setSelectedFormatId(formatId);
    setDelivery(null);
    setDeliveryExpired(false);
    setDeliveryHandedOff(false);
    setDeliveryError(null);
  }

  function moveFormatSelection(formatId: string, key: string): void {
    const index = resultFormats.findIndex((format) => format.id === formatId);
    if (index < 0 || resultFormats.length === 0) return;
    const nextIndex = key === "Home"
      ? 0
      : key === "End"
        ? resultFormats.length - 1
        : (index + (key === "ArrowRight" || key === "ArrowDown" ? 1 : -1) + resultFormats.length) % resultFormats.length;
    const nextFormat = resultFormats[nextIndex];
    if (!nextFormat) return;
    selectFormat(nextFormat.id);
    formatButtonRefs.current.get(nextFormat.id)?.focus();
  }

  const result = task?.status === "succeeded" ? task.result : null;
  const resultFormats = result?.formats ?? [];
  const selectedFormat = resultFormats.find((format) => format.id === selectedFormatId) ?? resultFormats[0];
  const failureIntent = publicFailureIntent(task, submissionError);
  const failureTitle = failureIntent === "retryable"
    ? copy.retryableTitle
    : failureIntent === "expired"
      ? copy.expiredTitle
      : copy.unavailableTitle;
  const failureDescription = submissionError
    ? admissionMessage(submissionError.code, copy)
    : failureIntent === "retryable"
      ? copy.retryableDescription
      : failureIntent === "expired"
        ? copy.expiredDescription
        : copy.unavailableDescription;
  const isTaskFocused = isWorking || Boolean(task) || Boolean(submissionError);
  const statusText = isWorking
    ? copy.resolving
    : result
      ? copy.ready
      : detectedPlatform
        ? `${platformName(detectedPlatform)} ${copy.recognized}`
        : copy.waiting;
  const resultTitle = result
    ? publicResultTitle(result, copy.resolvedTitle)
    : isWorking
      ? copy.resolving
      : failureIntent
        ? failureTitle
        : copy.exampleTitle;
  const resultMeta = result
    ? [result.media.author, formatMediaDuration(result.media.durationSeconds), `${resultFormats.length} ${copy.formatsAvailable}`].filter(Boolean).join(" · ")
    : isWorking
      ? (workingLonger ? copy.workingLonger : copy.workingMeta)
      : failureIntent
        ? failureDescription
        : copy.exampleMeta;

  return (
    <div className="resolve-experience" id="resolver">
      <form className="resolver-form" id="resolver-form" onSubmit={submit}>
        <div className="resolver-shell">
          <span className="source-icon" aria-hidden="true"><LinkSimpleIcon size={26} weight="bold" /></span>
          <label className="sr-only" htmlFor="source-url">{copy.label}</label>
          <div className="source-input-wrap">
            <input
              id="source-url" type="url" inputMode="url" autoComplete="url" spellCheck={false}
              value={url}
              onChange={(event) => {
                submissionKeyRef.current = null;
                focusedStateRef.current = null;
                setUrl(event.target.value);
                setTask(null);
                setSubmissionError(null);
                setDelivery(null);
                setDeliveryExpired(false);
                setDeliveryHandedOff(false);
                setDeliveryError(null);
              }}
              placeholder={copy.placeholder} aria-describedby="url-status" aria-invalid={Boolean(url.trim() && !detectedPlatform)} required
            />
            {url ? <button className="clear-link" type="button" onClick={clearLink} aria-label={copy.clear}><XIcon size={18} weight="bold" /></button> : null}
          </div>
          <span className="resolver-divider" aria-hidden="true" />
          <button className="resolve-action" type="submit" disabled={!detectedPlatform || isWorking}>
            {isWorking ? <CircleNotchIcon className="spin" size={21} weight="bold" /> : <DownloadSimpleIcon size={21} weight="bold" />}
            <span>{isWorking ? copy.working : copy.action}</span>
          </button>
        </div>
        <div className="resolver-guidance">
          <p id="url-status" className="url-status" aria-live="polite">{url.trim() && !detectedPlatform ? copy.invalid : statusText}</p>
        </div>
      </form>

      <div className="platform-pills" id="supported">
        <span>{supported.label}</span>
        {supported.platforms.map((platform, index) => {
          const Icon = platformIcons[index] ?? DotsThreeIcon;
          return <span className="platform-pill" key={platform}><Icon size={18} weight="fill" aria-hidden="true" />{platform}</span>;
        })}
      </div>

      <div className={`experience-grid ${isTaskFocused ? "is-task-focused" : ""}`} id="process">
        <section className="feature-strip" id="features" aria-label={featureLabel}>
          {features.map(([title, description], index) => {
            const Icon = featureIcons[index] ?? ShieldCheckIcon;
            return <article key={title}><span className="feature-icon" aria-hidden="true"><Icon size={30} weight="duotone" /></span><div><h2>{title}</h2><p>{description}</p></div></article>;
          })}
        </section>

        <section className="process-card" aria-labelledby="process-title">
          <h2 id="process-title">{process.title}</h2>
          <ol>
            {process.steps.map(([title, description], index) => {
              const Icon = processIcons[index] ?? CheckIcon;
              return <li key={title}><span className="step-number">{index + 1}</span><span className="step-icon" aria-hidden="true"><Icon size={23} weight="duotone" /></span><div><h3>{title}</h3><p>{description}</p></div></li>;
            })}
          </ol>
        </section>

        <section
          className="result-card"
          ref={resultCardRef}
          tabIndex={-1}
          aria-labelledby="result-title"
          data-state={result ? "ready" : isWorking ? "working" : failureIntent ? "failure" : "example"}
        >
          <div className="preview-column">
            <h2>{copy.preview}</h2>
            {result ? (
              <div className="preview-media resolved-preview" aria-label={`${platformName(task!.platform)} ${copy.resolvedPreview}`}>
                <span className="resolved-preview-icon" aria-hidden="true"><VideoCameraIcon size={44} weight="duotone" /></span>
                <span className="preview-chip">{platformName(task!.platform)}</span>
              </div>
            ) : isWorking ? (
              <div className="preview-media resolved-preview" aria-label={copy.resolving}>
                <span className="resolved-preview-icon" aria-hidden="true"><CircleNotchIcon className="spin" size={42} weight="bold" /></span>
              </div>
            ) : failureIntent ? (
              <div className="preview-media resolved-preview is-failure" aria-label={failureTitle}>
                <span className="resolved-preview-icon" aria-hidden="true"><WarningCircleIcon size={46} weight="duotone" /></span>
              </div>
            ) : (
              <div className="preview-media">
                <img src="/assets/tikdd-mountain-preview.png" alt="" />
                <span className="play-button" aria-hidden="true"><PlayIcon size={28} weight="fill" /></span>
                <span className="preview-chip">4K</span>
              </div>
            )}
          </div>
          <div className="format-column">
            <div className="result-heading">
              <div><span>{result ? copy.ready : isWorking ? copy.working : failureIntent ? copy.statusLabel : copy.example}</span><h2 id="result-title">{resultTitle}</h2></div>
              {!failureIntent && !isWorking ? <p>{resultMeta}</p> : null}
            </div>
            {failureIntent ? (
              <div className="result-state-panel" role={failureIntent === "unavailable" ? "alert" : "status"}>
                <p>{failureDescription}</p>
                {failureIntent !== "unavailable" ? (
                  <button className="secondary-action" type="submit" form="resolver-form" disabled={isWorking}>{copy.action}</button>
                ) : null}
              </div>
            ) : isWorking ? (
              <p className="result-progress" role="status">{workingLonger ? copy.workingLonger : copy.workingMeta}</p>
            ) : (
              <>
                <h3>{copy.result}</h3>
                <div className="compact-format-list" role={result ? "radiogroup" : undefined} aria-label={copy.result}>
                  {result ? resultFormats.map((format) => {
                    const selected = selectedFormatId === format.id;
                    return (
                      <button
                        className={`compact-format ${selected ? "is-selected" : ""}`}
                        key={format.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        tabIndex={selected ? 0 : -1}
                        ref={(element) => {
                          if (element) formatButtonRefs.current.set(format.id, element);
                          else formatButtonRefs.current.delete(format.id);
                        }}
                        onClick={() => selectFormat(format.id)}
                        onKeyDown={(event) => {
                          if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)) return;
                          event.preventDefault();
                          moveFormatSelection(format.id, event.key);
                        }}
                      >
                        <span className="radio-dot" /><strong>{format.container.toUpperCase()}</strong><span>{format.quality}</span><small>{formatComposition(format, copy)}</small>
                      </button>
                    );
                  }) : ["2160p (4K)", "1080p (FHD)", "720p (HD)", "480p"].map((quality, index) => (
                    <div className={`compact-format ${index === 0 ? "is-selected" : ""}`} key={quality}><span className="radio-dot" /><strong>MP4</strong><span>{quality}</span><small>{index === 0 ? "120 MB" : "—"}</small></div>
                  ))}
                </div>
                {delivery && !deliveryExpired ? (
                  <div className="delivery-ready" role="status">
                    <p>{copy.deliveryReady}</p>
                    <a
                      className="download-action"
                      href={delivery.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => {
                        setDeliveryHandedOff(true);
                        setDeliveryExpired(true);
                      }}
                    >
                      <DownloadSimpleIcon size={20} weight="bold" /><span>{copy.startDownload}</span>
                    </a>
                  </div>
                ) : (
                  <>
                    {deliveryHandedOff ? (
                      <p className="delivery-note" role="status">{copy.deliveryHandedOff}</p>
                    ) : deliveryExpired ? (
                      <p className="delivery-note" role="status">{copy.deliveryExpired}</p>
                    ) : null}
                    {deliveryError ? <p className="delivery-note is-error" role="alert">{deliveryError}</p> : null}
                    <button
                      className="download-action"
                      type="button"
                      disabled={!selectedFormat || Boolean(deliveringFormatId)}
                      onClick={() => selectedFormat && void requestDelivery(selectedFormat.id)}
                    >
                      {deliveringFormatId ? <CircleNotchIcon className="spin" size={20} weight="bold" /> : <DownloadSimpleIcon size={20} weight="bold" />}
                      <span>{deliveringFormatId ? copy.preparingDownload : deliveryExpired ? copy.regenerateDownload : copy.download}</span>
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
