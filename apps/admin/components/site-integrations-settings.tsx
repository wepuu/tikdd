"use client";

import type { AdminContentManagementView, AdminContentPublicationView, AdminSettingsRecoveryView } from "@tikdd/admin-contracts";
import { CheckCircle, CircleNotch, CloudArrowUp, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";

type Props = {
  view: AdminSettingsRecoveryView | null;
  content: AdminContentManagementView | null;
  publication: AdminContentPublicationView | null;
  writeMode: "readonly" | "content-draft" | "full";
  csrfToken: string | null;
  onReload: () => void;
};

const analyticsPattern = /^G-[A-Z0-9]{4,32}$/i;
const adsensePattern = /^ca-pub-\d{10,32}$/;

function stateFor(draft: string | null, published: string | null) {
  if (draft !== published) return { tone: "pending", label: "待发布", detail: published ? "网站仍使用上一项配置" : "网站尚未加载此集成" } as const;
  if (published) return { tone: "live", label: "已生效", detail: "活动快照正在使用" } as const;
  return { tone: "off", label: "未启用", detail: "公共网站不会加载脚本" } as const;
}

export function SiteIntegrationsSettings({ view, content, publication, writeMode, csrfToken, onReload }: Props) {
  const defaultLocale = view?.publicationDefaults.defaultLocale ?? "en";
  const identity = view?.siteIdentity.find((item) => item.locale === defaultLocale);
  const shared = content?.sharedContent.find((item) => item.locale === defaultLocale);
  const draft = view?.siteIntegrations;
  const published = view?.publishedSiteIntegrations;
  const [analyticsId, setAnalyticsId] = useState(draft?.googleAnalyticsMeasurementId ?? "");
  const [adsenseId, setAdsenseId] = useState(draft?.googleAdsensePublisherId ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);

  useEffect(() => {
    setAnalyticsId(draft?.googleAnalyticsMeasurementId ?? "");
    setAdsenseId(draft?.googleAdsensePublisherId ?? "");
  }, [draft?.googleAnalyticsMeasurementId, draft?.googleAdsensePublisherId]);

  const normalized = useMemo(() => ({
    googleAnalyticsMeasurementId: analyticsId.trim() || null,
    googleAdsensePublisherId: adsenseId.trim() || null
  }), [analyticsId, adsenseId]);
  const analyticsValid = !analyticsId.trim() || analyticsPattern.test(analyticsId.trim());
  const adsenseValid = !adsenseId.trim() || adsensePattern.test(adsenseId.trim());
  const dirty = draft ? normalized.googleAnalyticsMeasurementId !== draft.googleAnalyticsMeasurementId || normalized.googleAdsensePublisherId !== draft.googleAdsensePublisherId : false;
  const pending = draft && published ? draft.googleAnalyticsMeasurementId !== published.googleAnalyticsMeasurementId || draft.googleAdsensePublisherId !== published.googleAdsensePublisherId : false;
  const publishReady = writeMode === "full" && Boolean(csrfToken && publication) && !dirty && pending && publication!.blockers.length === 0 && publication!.propagationState !== "propagating";

  if (!view || !identity || !draft || !published) {
    return <section className="panel site-integrations-settings"><strong>Google 统计与广告</strong><p>配置读取暂时不可用。当前网站状态不会被推断为已生效。</p></section>;
  }

  const save = async () => {
    if (!csrfToken || !analyticsValid || !adsenseValid || busy) return;
    setBusy("save");
    setMessage("");
    const existing = shared?.content;
    const response = await fetch("/api/admin/snapshot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "shared_draft",
        csrfToken,
        command: {
          locale: defaultLocale,
          state: "ready",
          content: {
            siteName: existing?.siteName ?? identity.siteName,
            navigationLabel: existing?.navigationLabel ?? identity.navigationLabel,
            footerTagline: existing?.footerTagline ?? identity.footerTagline,
            legalNoticeMarkdown: existing?.legalNoticeMarkdown ?? identity.legalNoticeMarkdown,
            defaultSocialTitle: existing?.defaultSocialTitle ?? identity.defaultSocial.title,
            defaultSocialDescription: existing?.defaultSocialDescription ?? identity.defaultSocial.description,
            defaultSocialImageAssetId: existing?.defaultSocialImageAssetId ?? identity.defaultSocial.imageAssetId,
            siteIntegrations: normalized
          },
          expectedRevision: shared?.revision ?? null,
          reason: "Owner Google integrations update",
          confirmation: defaultLocale,
          idempotencyKey: crypto.randomUUID().replaceAll("-", "")
        }
      })
    });
    setMessage(response.ok ? "草稿已保存。检查生效状态后再发布到网站。" : "配置未保存，请刷新后重试。");
    setBusy(null);
    if (response.ok) onReload();
  };

  const publish = async () => {
    if (!publishReady || !csrfToken || !publication || busy) return;
    setBusy("publish");
    setMessage("");
    const response = await fetch("/api/admin/snapshot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "content_publish",
        csrfToken,
        command: {
          deployment: publication.deployment,
          expectedRevision: publication.currentRevision,
          reason: "Owner site integrations publish",
          confirmation: publication.deployment,
          idempotencyKey: crypto.randomUUID().replaceAll("-", "")
        }
      })
    });
    setMessage(response.ok ? "配置已发布，正在确认公共网站读取。" : "发布未完成，请查看发布中心的阻塞项。");
    setBusy(null);
    if (response.ok) onReload();
  };

  const analyticsState = stateFor(draft.googleAnalyticsMeasurementId, published.googleAnalyticsMeasurementId);
  const adsenseState = stateFor(draft.googleAdsensePublisherId, published.googleAdsensePublisherId);
  const activeRevision = view.infrastructure.snapshot.activeRevision;

  return <section className="panel site-integrations-settings" id="site-integrations">
    <header><div><small>PUBLIC SITE INTEGRATIONS</small><h3>Google 统计与广告</h3></div><span className={`integration-overall state-${pending ? "pending" : published.googleAnalyticsMeasurementId || published.googleAdsensePublisherId ? "live" : "off"}`}>{pending ? "有待发布变更" : published.googleAnalyticsMeasurementId || published.googleAdsensePublisherId ? `网站已生效 · r${activeRevision ?? "—"}` : "当前未启用"}</span></header>
    <div className="integration-truth-grid">
      <article className={`integration-truth state-${analyticsState.tone}`}><span>{analyticsState.tone === "live" ? <CheckCircle weight="fill" /> : <WarningCircle />}</span><div><small>Google Analytics</small><strong>{analyticsState.label}</strong><p>{analyticsState.detail}</p></div></article>
      <article className={`integration-truth state-${adsenseState.tone}`}><span>{adsenseState.tone === "live" ? <CheckCircle weight="fill" /> : <WarningCircle />}</span><div><small>Google AdSense</small><strong>{adsenseState.label}</strong><p>{adsenseState.detail}</p></div></article>
    </div>
    <p className="integration-explainer">只接受 Google ID，不接受自定义脚本。AdSense 显示广告还取决于 Google 审核、Auto Ads 设置和客户端广告拦截器。</p>
    <div className="site-integrations-fields">
      <label>Google Analytics 衡量 ID<input value={analyticsId} onChange={(event) => setAnalyticsId(event.target.value)} maxLength={40} placeholder="G-XXXXXXXXXX" aria-invalid={!analyticsValid} />{!analyticsValid ? <small role="alert">请输入 G- 开头的衡量 ID。</small> : null}</label>
      <label>Google AdSense 发布者 ID<input value={adsenseId} onChange={(event) => setAdsenseId(event.target.value)} maxLength={45} placeholder="ca-pub-1234567890123456" aria-invalid={!adsenseValid} />{!adsenseValid ? <small role="alert">请输入 ca-pub- 开头的发布者 ID。</small> : null}</label>
    </div>
    <footer><div className="integration-publish-note"><strong>{publication?.diff.length ?? 0} 项待发布变更</strong><span>{writeMode === "full" ? "发布会使用现有完整快照校验。" : "切换到完整维护模式后才能发布。"}</span></div><div className="integration-actions"><button className="quiet" onClick={() => void save()} disabled={!csrfToken || !dirty || !analyticsValid || !adsenseValid || busy !== null}>{busy === "save" ? <CircleNotch className="spinning" /> : null}保存草稿</button><button onClick={() => void publish()} disabled={!publishReady || busy !== null}>{busy === "publish" ? <CircleNotch className="spinning" /> : <CloudArrowUp />}发布到网站</button></div></footer>
    {message ? <p className="command-message" role="status">{message}</p> : null}
  </section>;
}
