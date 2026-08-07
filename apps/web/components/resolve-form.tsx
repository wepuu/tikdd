"use client";

import type { Delivery, MediaFormat, ResolveTask } from "@tikdd/contracts";
import { detectPlatform, listPlatformDefinitions } from "@tikdd/platform";
import {
  CheckIcon,
  CircleNotchIcon,
  DotsThreeIcon,
  DownloadSimpleIcon,
  GlobeHemisphereWestIcon,
  LinkSimpleIcon,
  LockSimpleIcon,
  PlayIcon,
  ScanIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  TiktokLogoIcon,
  VideoCameraIcon,
  XIcon,
  XLogoIcon,
  YoutubeLogoIcon
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SiteCopy } from "../lib/copy";
import { formatMediaDuration, publicResultTitle } from "../lib/result-presentation";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const deliveryBaseUrl = process.env.NEXT_PUBLIC_DELIVERY_BASE_URL ?? "http://localhost:4002";
const terminalStates = new Set<ResolveTask["status"]>(["succeeded", "failed", "expired"]);

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

const platformIcons = [YoutubeLogoIcon, TiktokLogoIcon, XLogoIcon, DotsThreeIcon] as const;
const processIcons = [LinkSimpleIcon, ScanIcon, DownloadSimpleIcon] as const;
const featureIcons = [GlobeHemisphereWestIcon, SlidersHorizontalIcon, ShieldCheckIcon] as const;

export function ResolveForm({ copy, featureLabel, features, process, supported }: ResolveFormProps) {
  const [url, setUrl] = useState("");
  const [confirmedRights, setConfirmedRights] = useState(false);
  const [task, setTask] = useState<ResolveTask | null>(null);
  const [selectedFormatId, setSelectedFormatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [deliveringFormatId, setDeliveringFormatId] = useState<string | null>(null);
  const resultCardRef = useRef<HTMLElement>(null);
  const focusedTaskIdRef = useRef<string | null>(null);

  const detectedPlatform = useMemo(() => {
    if (!url.trim()) return null;
    try { return detectPlatform(url.trim()).platform; } catch { return null; }
  }, [url]);

  useEffect(() => {
    const firstFormatId = task?.status === "succeeded" ? task.result?.formats[0]?.id : null;
    setSelectedFormatId(firstFormatId ?? null);
  }, [task]);

  useEffect(() => {
    if (task?.status !== "succeeded" || focusedTaskIdRef.current === task.id) return;
    focusedTaskIdRef.current = task.id;
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
  }, [task?.id, task?.status]);

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
    if (!detectedPlatform || !confirmedRights || isWorking) return;
    setIsWorking(true); setError(null); setDeliveryError(null); setTask(null);
    try {
      const response = await fetch(`${apiBaseUrl}/v1/resolve-tasks`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim(), confirmedRights: true })
      });
      if (!response.ok) throw new Error(copy.resolveError);
      const createdTask = (await response.json()) as ResolveTask;
      setTask(createdTask);
      await pollTask(createdTask.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.resolveError);
    } finally { setIsWorking(false); }
  }

  async function requestDelivery(formatId: string): Promise<void> {
    if (!task || task.status !== "succeeded" || deliveringFormatId) return;
    setDeliveringFormatId(formatId); setDeliveryError(null);
    try {
      const response = await fetch(`${deliveryBaseUrl}/v1/deliveries`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: task.id, formatId })
      });
      if (!response.ok) throw new Error(copy.deliveryError);
      const delivery = (await response.json()) as Delivery;
      window.location.assign(delivery.url);
    } catch {
      setDeliveryError(copy.deliveryError); setDeliveringFormatId(null);
    }
  }

  function clearLink(): void {
    setUrl(""); setConfirmedRights(false); setTask(null); setSelectedFormatId(null); setError(null); setDeliveryError(null);
  }

  const result = task?.status === "succeeded" ? task.result : null;
  const resultFormats = result?.formats ?? [];
  const selectedFormat = resultFormats.find((format) => format.id === selectedFormatId) ?? resultFormats[0];
  const isTaskFocused = isWorking || Boolean(result);
  const statusText = isWorking
    ? copy.resolving
    : result
      ? copy.ready
      : detectedPlatform
        ? `${platformName(detectedPlatform)} ${copy.recognized}${confirmedRights ? "" : ` ${copy.confirmRights}`}`
        : copy.waiting;
  const resultTitle = result ? publicResultTitle(result, copy.resolvedTitle) : isWorking ? copy.resolving : copy.exampleTitle;
  const resultMeta = result
    ? [result.media.author, formatMediaDuration(result.media.durationSeconds), `${resultFormats.length} ${copy.formatsAvailable}`].filter(Boolean).join(" · ")
    : isWorking
      ? copy.workingMeta
      : copy.exampleMeta;

  return (
    <div className="resolve-experience" id="resolver">
      <form className="resolver-form" onSubmit={submit}>
        <div className="resolver-shell">
          <span className="source-icon" aria-hidden="true"><LinkSimpleIcon size={26} weight="bold" /></span>
          <label className="sr-only" htmlFor="source-url">{copy.label}</label>
          <div className="source-input-wrap">
            <input
              id="source-url" type="url" inputMode="url" autoComplete="url" spellCheck={false}
              value={url}
              onChange={(event) => { setUrl(event.target.value); setConfirmedRights(false); setTask(null); setError(null); setDeliveryError(null); }}
              placeholder={copy.placeholder} aria-describedby="url-status" aria-invalid={Boolean(url.trim() && !detectedPlatform)} required
            />
            {url ? <button className="clear-link" type="button" onClick={clearLink} aria-label={copy.clear}><XIcon size={18} weight="bold" /></button> : null}
          </div>
          <span className="resolver-divider" aria-hidden="true" />
          <button className="resolve-action" type="submit" disabled={!detectedPlatform || !confirmedRights || isWorking}>
            {isWorking ? <CircleNotchIcon className="spin" size={21} weight="bold" /> : <DownloadSimpleIcon size={21} weight="bold" />}
            <span>{isWorking ? copy.working : copy.action}</span>
          </button>
        </div>
        <div className="resolver-guidance">
          <label className="rights-confirmation">
            <input type="checkbox" checked={confirmedRights} onChange={(event) => setConfirmedRights(event.target.checked)} />
            <LockSimpleIcon size={15} weight="bold" aria-hidden="true" /><span>{copy.rights}</span>
          </label>
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

      <div className="task-status" aria-live="polite">
        {error ? <p className="error-message">{error}</p> : null}
        {task?.status === "failed" ? <p className="error-message">{copy.resolveError}</p> : null}
        {task?.status === "expired" ? <p className="error-message">{copy.expired}</p> : null}
        {deliveryError ? <p className="error-message">{deliveryError}</p> : null}
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

        <section className="result-card" ref={resultCardRef} tabIndex={-1} aria-labelledby="result-title" data-state={result ? "ready" : isWorking ? "working" : "example"}>
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
              <div><span>{result ? copy.ready : isWorking ? copy.working : copy.example}</span><h2 id="result-title">{resultTitle}</h2></div>
              <p>{resultMeta}</p>
            </div>
            <h3>{copy.result}</h3>
            {isWorking ? <p className="result-progress" role="status">{copy.workingMeta}</p> : <div className="compact-format-list" role={result ? "radiogroup" : undefined} aria-label={copy.result}>
              {result ? resultFormats.map((format) => {
                const selected = selectedFormatId === format.id;
                return (
                  <button className={`compact-format ${selected ? "is-selected" : ""}`} key={format.id} type="button" role="radio" aria-checked={selected} onClick={() => setSelectedFormatId(format.id)}>
                    <span className="radio-dot" /><strong>{format.container.toUpperCase()}</strong><span>{format.quality}</span><small>{formatComposition(format, copy)}</small>
                  </button>
                );
              }) : ["2160p (4K)", "1080p (FHD)", "720p (HD)", "480p"].map((quality, index) => (
                <div className={`compact-format ${index === 0 ? "is-selected" : ""}`} key={quality}><span className="radio-dot" /><strong>MP4</strong><span>{quality}</span><small>{index === 0 ? "120 MB" : "—"}</small></div>
              ))}
            </div>}
            <button className="download-action" type="button" disabled={!selectedFormat || Boolean(deliveringFormatId)} onClick={() => selectedFormat && void requestDelivery(selectedFormat.id)}>
              {deliveringFormatId ? <CircleNotchIcon className="spin" size={20} weight="bold" /> : <DownloadSimpleIcon size={20} weight="bold" />}
              <span>{deliveringFormatId ? copy.preparingDownload : copy.download}</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
