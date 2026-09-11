"use client";

import { ArrowUpRight, CheckCircle, EyeSlash, GlobeHemisphereWest, PlugsConnected, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import type { AdminContentManagementView, AdminContentPublicationView, AdminSeoTechnicalView, AdminSettingsRecoveryView } from "@tikdd/admin-contracts";
import { deriveGrowthReadiness, GROWTH_EVENT_CATALOG } from "../lib/growth-model";

type Props = {
  content: AdminContentManagementView | null;
  publication: AdminContentPublicationView | null;
  seo: AdminSeoTechnicalView | null;
  settings: AdminSettingsRecoveryView | null;
};

const statusText = {
  ready: { label: "可继续迭代", detail: "基础内容与测量边界已返回完整读模型。" },
  partial: { label: "仍有准备项", detail: "先处理内容或 SEO 缺口，再安排下一次发布。" },
  unavailable: { label: "数据不可用", detail: "未返回完整读模型，不推断为零或健康。" }
} as const;

function IntegrationState({ label, configured }: { label: string; configured: boolean }) {
  return <li className={configured ? "is-configured" : "is-missing"}><span>{configured ? <CheckCircle size={16} weight="fill" /> : <WarningCircle size={16} />}</span><div><strong>{label}</strong><small>{configured ? "当前读模型已配置" : "未配置，保持关闭"}</small></div></li>;
}

export function GrowthReadiness({ content, publication, seo, settings }: Props) {
  const model = deriveGrowthReadiness({ content, publication, seo, settings });
  const status = statusText[model.status];
  return <section className="growth-readiness" id="growth">
    <header className="growth-heading">
      <div><p className="eyebrow">GROW / MEASUREMENT READY</p><h2>增长准备度</h2><p>只查看内容资产和匿名事件边界，不读取 Google 账户报表，也不会改变 Provider 或公开流量。</p></div>
      <div className={`growth-status status-${model.status}`}><span>{model.status === "ready" ? <CheckCircle size={18} weight="fill" /> : model.status === "partial" ? <WarningCircle size={18} /> : <ShieldCheck size={18} />}</span><strong>{status.label}</strong><small>{status.detail}</small></div>
    </header>

    <div className="growth-metrics panel">
      <article><span><GlobeHemisphereWest size={18} /></span><small>启用语言</small><strong>{model.enabledLocaleCount || "—"}</strong><em>{model.readyCellCount} 个内容单元已就绪</em></article>
      <article><span><PlugsConnected size={18} /></span><small>GA4</small><strong>{model.analytics === "configured" ? "已配置" : "未配置"}</strong><em>仅发布快照后发送事件</em></article>
      <article><span><PlugsConnected size={18} /></span><small>AdSense</small><strong>{model.adsense === "configured" ? "已配置" : "未配置"}</strong><em>未配置时不会加载脚本</em></article>
      <article><span><ShieldCheck size={18} /></span><small>公共快照</small><strong>{model.currentRevision === null ? "—" : `r${model.currentRevision}`}</strong><em>{model.propagationState}</em></article>
    </div>

    <div className="growth-grid">
      <section className="panel growth-platforms"><header><div><small>CONTENT PORTFOLIO</small><h3>Beta 页面资产</h3></div><a href="#publishing">打开内容校样台 <ArrowUpRight size={13} /></a></header><div className="growth-platform-list">{model.platformPages.length ? model.platformPages.map((platform) => <article key={platform.platform}><div className="growth-platform-title"><span>{platform.platform === "x" ? "X" : "IG"}</span><div><strong>{platform.label} Beta</strong><small>{platform.path ?? "尚未创建页面路径"}</small></div><b>{platform.readyLocales}/{platform.locales} 语言</b></div><div className="growth-platform-bar"><span style={{ width: `${platform.locales ? Math.round((platform.readyLocales / platform.locales) * 100) : 0}%` }} /></div><div className="growth-platform-meta"><span>{platform.publishedLocales} 个已发布</span><span><EyeSlash size={12} />{platform.noindexLocales} 个保持 noindex</span></div><div className="growth-locale-list">{platform.coverage.map((cell) => <span className={`state-${cell.status}`} key={cell.locale}>{cell.locale}<b>{cell.status}</b></span>)}</div></article>) : <div className="growth-unavailable"><WarningCircle size={22} /><span>内容读模型暂不可用</span></div>}</div></section>
      <section className="panel growth-events"><header><div><small>FIXED EVENT CATALOG</small><h3>匿名事件边界</h3></div><span className="growth-readonly"><ShieldCheck size={13} />只读</span></header><p>事件只描述流程状态；不包含 URL、任务标识、Provider、媒体地址或下载文件名。</p><ul>{GROWTH_EVENT_CATALOG.map((event) => <li key={event.name}><code>{event.name}</code><span><strong>{event.label}</strong><small>{event.detail}</small></span></li>)}</ul><footer><ShieldCheck size={15} /><span>跨域 CDN 下载无法可靠证明“已保存”，因此不发送 download_complete。</span></footer></section>
    </div>
    {model.blockers.length ? <div className="growth-blockers"><WarningCircle size={16} /><span>待处理：{model.blockers.join(" · ")}</span><a href="#publishing">查看发布准备 <ArrowUpRight size={13} /></a></div> : <div className="growth-clear"><CheckCircle size={16} weight="fill" /><span>当前没有增长准备阻塞；平台仍按 Beta/noindex 规则运行。</span></div>}
  </section>;
}
