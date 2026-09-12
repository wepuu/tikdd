"use client";

import type { AdminContentManagementView, AdminSettingsRecoveryView } from "@tikdd/admin-contracts";
import { useEffect, useState } from "react";

type Props = {
  view: AdminSettingsRecoveryView | null;
  content: AdminContentManagementView | null;
  csrfToken: string | null;
  onReload: () => void;
};

const analyticsPattern = /^G-[A-Z0-9]{4,32}$/i;
const adsensePattern = /^ca-pub-\d{10,32}$/;

export function SiteIntegrationsSettings({ view, content, csrfToken, onReload }: Props) {
  const defaultLocale = view?.publicationDefaults.defaultLocale ?? "en";
  const identity = view?.siteIdentity.find((item) => item.locale === defaultLocale);
  const shared = content?.sharedContent.find((item) => item.locale === defaultLocale);
  const [analyticsId, setAnalyticsId] = useState(view?.siteIntegrations.googleAnalyticsMeasurementId ?? "");
  const [adsenseId, setAdsenseId] = useState(view?.siteIntegrations.googleAdsensePublisherId ?? "");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setAnalyticsId(view?.siteIntegrations.googleAnalyticsMeasurementId ?? "");
    setAdsenseId(view?.siteIntegrations.googleAdsensePublisherId ?? "");
  }, [view?.siteIntegrations.googleAnalyticsMeasurementId, view?.siteIntegrations.googleAdsensePublisherId]);

  if (!view || !identity) {
    return <section className="panel site-integrations-settings"><strong>Google 统计与广告</strong><p>默认 Locale 尚不可用，暂时不能配置站点集成。</p></section>;
  }

  const analyticsValid = !analyticsId.trim() || analyticsPattern.test(analyticsId.trim());
  const adsenseValid = !adsenseId.trim() || adsensePattern.test(adsenseId.trim());
  const save = async () => {
    if (!csrfToken || !analyticsValid || !adsenseValid) return;
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
            siteIntegrations: {
              googleAnalyticsMeasurementId: analyticsId.trim() || null,
              googleAdsensePublisherId: adsenseId.trim() || null
            }
          },
          expectedRevision: shared?.revision ?? null,
          reason: "Owner Google integrations update",
          confirmation: defaultLocale,
          idempotencyKey: crypto.randomUUID().replaceAll("-", "")
        }
      })
    });
    setMessage(response.ok ? "集成配置已保存为默认 Locale 的就绪草稿；发布快照后才会生效。" : "配置未保存，请刷新后重试。");
    if (response.ok) onReload();
  };

  return <section className="panel site-integrations-settings" id="site-integrations">
    <header><div><small>SITE INTEGRATIONS / DEFAULT LOCALE</small><h3>Google 统计与广告</h3></div><span className="settings-state state-ready">受控配置</span></header>
    <p>只填写 Google 提供的 ID。Web 会在发布快照中生成固定官方脚本；这里不接受任意 HTML 或 JavaScript。清空 ID 可停用对应脚本。</p>
    <div className="site-integrations-fields">
      <label>Google Analytics 衡量 ID<input value={analyticsId} onChange={(event) => setAnalyticsId(event.target.value)} maxLength={40} placeholder="G-XXXXXXXXXX" aria-invalid={!analyticsValid} />{!analyticsValid ? <small role="alert">请输入 G- 开头的衡量 ID。</small> : null}</label>
      <label>Google AdSense 发布者 ID<input value={adsenseId} onChange={(event) => setAdsenseId(event.target.value)} maxLength={45} placeholder="ca-pub-1234567890123456" aria-invalid={!adsenseValid} />{!adsenseValid ? <small role="alert">请输入 ca-pub- 开头的发布者 ID。</small> : null}</label>
    </div>
    <footer><span className="settings-owner-note">单人运营：保存后发布快照即可生效。</span><button onClick={() => void save()} disabled={!csrfToken || !analyticsValid || !adsenseValid}>保存集成草稿</button></footer>
    {message ? <p className="command-message" role="status">{message}</p> : null}
  </section>;
}
