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
  XIcon,
  XLogoIcon,
  YoutubeLogoIcon
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import type { SiteCopy } from "../lib/copy";

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

  const detectedPlatform = useMemo(() => {
    if (!url.trim()) return null;
    try { return detectPlatform(url.trim()).platform; } catch { return null; }
  }, [url]);

  useEffect(() => {
    const firstFormatId = task?.status === "succeeded" ? task.result?.formats[0]?.id : null;
    setSelectedFormatId(firstFormatId ?? null);
  }, [task]);

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
    setUrl(""); setTask(null); setSelectedFormatId(null); setError(null); setDeliveryError(null);
  }

  const result = task?.status === "succeeded" ? task.result : null;
  const resultFormats = result?.formats ?? [];
  const selectedFormat = resultFormats.find((format) => format.id === selectedFormatId) ?? resultFormats[0];
  const statusText = isWorking
    ? copy.resolving
    : result
      ? copy.ready
      : detectedPlatform
        ? `${platformName(detectedPlatform)} ${copy.recognized}`
        : copy.waiting;

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
              onChange={(event) => { setUrl(event.target.value); setTask(null); setError(null); setDeliveryError(null); }}
              placeholder={copy.placeholder} aria-describedby="url-status" required
            />
            {url ? <button className="clear-link" type="button" onClick={clearLink} aria-label={copy.clear}><XIcon size={18} weight="bold" /></button> : null}
          </div>
          <span className="resolver-divider" aria-hidden="true" />
          <button className="resolve-action" type="submit" disabled={!detectedPlatform || !confirmedRights || isWorking}>
            {isWorking ? <CircleNotchIcon className="spin" size={21} weight="bold" /> : <DownloadSimpleIcon size={21} weight="bold" />}
            <span>{isWorking ? copy.working : copy.action}</span>
          </button>
        </div>
        <label className="mobile-rights">
          <input type="checkbox" checked={confirmedRights} onChange={(event) => setConfirmedRights(event.target.checked)} />
          <LockSimpleIcon size={15} weight="bold" aria-hidden="true" /><span>{copy.rights}</span>
        </label>
        <p id="url-status" className="sr-only" aria-live="polite">{url.trim() && !detectedPlatform ? copy.invalid : statusText}</p>
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

      <section className="feature-strip" id="features" aria-label={featureLabel}>
        {features.map(([title, description], index) => {
          const Icon = featureIcons[index] ?? ShieldCheckIcon;
          return <article key={title}><span className="feature-icon" aria-hidden="true"><Icon size={30} weight="duotone" /></span><div><h2>{title}</h2><p>{description}</p></div></article>;
        })}
      </section>

      <div className="workspace-grid" id="process">
        <section className="process-card" aria-labelledby="process-title">
          <h2 id="process-title">{process.title}</h2>
          <ol>
            {process.steps.map(([title, description], index) => {
              const Icon = processIcons[index] ?? CheckIcon;
              return <li key={title}><span className="step-number">{index + 1}</span><span className="step-icon" aria-hidden="true"><Icon size={23} weight="duotone" /></span><div><h3>{title}</h3><p>{description}</p></div></li>;
            })}
          </ol>
          <label className="process-rights">
            <input type="checkbox" checked={confirmedRights} onChange={(event) => setConfirmedRights(event.target.checked)} />
            <LockSimpleIcon size={14} weight="bold" aria-hidden="true" /><span>{copy.rights}</span>
          </label>
        </section>

        <section className="result-card" aria-labelledby="result-title">
          <div className="preview-column">
            <h2>{copy.preview}</h2>
            <div className="preview-media">
              <img src="/assets/tikdd-mountain-preview.png" alt="" />
              <span className="play-button" aria-hidden="true"><PlayIcon size={28} weight="fill" /></span>
              <span className="preview-chip">{result ? platformName(task!.platform) : "4K"}</span>
            </div>
          </div>
          <div className="format-column">
            <div className="result-heading">
              <div><span>{result ? copy.ready : copy.example}</span><h2 id="result-title">{result?.media.title ?? copy.exampleTitle}</h2></div>
              <p>{result ? `${resultFormats.length} ${copy.result.toLowerCase()}` : copy.exampleMeta}</p>
            </div>
            <h3>{copy.result}</h3>
            <div className="compact-format-list" role={result ? "radiogroup" : undefined} aria-label={copy.result}>
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
            </div>
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
