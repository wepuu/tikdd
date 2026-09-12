"use client";

import { ArrowUpRight, CheckCircle, CircleNotch, FileText, Globe, MagnifyingGlass, PlugsConnected, WarningCircle } from "@phosphor-icons/react";
import type { AdminContentManagementView, AdminContentPublicationView, AdminSeoTechnicalView, AdminSettingsRecoveryView } from "@tikdd/admin-contracts";
import type { ReactNode } from "react";
import { derivePublicationCenter, type PublicationCenterStatus } from "../lib/publication-model";

type Props = {
  content: AdminContentManagementView | null;
  publication: AdminContentPublicationView | null;
  seo: AdminSeoTechnicalView | null;
  settings: AdminSettingsRecoveryView | null;
};

const blockerLabels: Record<string, string> = {
  default_locale_not_ready: "默认语言尚未就绪",
  default_homepage_not_ready: "默认首页尚未就绪",
  locale_not_ready: "语言版本尚未就绪",
  required_page_missing: "必需页面缺失",
  shared_content_missing: "公共内容缺失",
  validation_failed: "结构校验未通过",
  publication_in_progress: "已有发布正在进行",
  propagation_failed: "Web 快照传播失败",
  seo_blockers: "SEO 技术检查仍有阻塞",
  content_gaps: "页面或语言覆盖仍有缺口"
};

function statusCopy(status: PublicationCenterStatus, published: boolean): { label: string; tone: string; detail: string } {
  switch (status) {
    case "ready": return published
      ? { label: "已发布", tone: "ready", detail: "当前快照已传播，暂无待发布差异。" }
      : { label: "可以发布", tone: "ready", detail: "当前数据源已返回完整快照检查结果。" };
    case "blocked": return { label: "发布被阻塞", tone: "blocked", detail: "先处理下方阻塞项，再进入完整维护模式发布。" };
    case "propagating": return { label: "正在确认生效", tone: "propagating", detail: "快照已提交，等待 Web 确认新 revision。" };
    default: return { label: "发布数据不可用", tone: "unavailable", detail: "Admin API 未返回完整内容和发布视图。" };
  }
}

function Metric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return <article className="publication-metric"><span className="publication-metric-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong><span>{detail}</span></div></article>;
}

export function PublicationCenter({ content, publication, seo, settings }: Props) {
  const overview = derivePublicationCenter({ content, publication, seo, settings });
  const published = overview.currentRevision !== null && overview.diffCount === 0 && overview.pendingSnapshotId === null && publication?.propagationState === "propagated";
  const status = statusCopy(overview.status, published);
  const configured = overview.configuredIntegrationCount;
  const clearDetail = published
    ? `当前 r${overview.currentRevision} 已由 Web 确认，暂无待发布差异。`
    : "完整性检查通过；在完整维护模式输入部署确认后发布。";

  return <section className="publication-center" id="publication-center">
    <header className="publication-center-header">
      <div><p className="eyebrow">PUBLISH / CONTROL ROOM</p><h2>发布中心</h2><p>一次查看内容覆盖、SEO 阻塞、Google 集成和快照传播状态。这里仅汇总现有 Admin 数据，不会发起 Provider 请求。</p></div>
      <div className={`publication-status status-${status.tone}`}><span>{overview.status === "propagating" ? <CircleNotch className="spinning" size={18} /> : overview.status === "ready" ? <CheckCircle size={18} weight="fill" /> : <WarningCircle size={18} />}</span><strong>{status.label}</strong><small>{status.detail}</small></div>
    </header>

    <div className="publication-metrics panel">
      <Metric icon={<FileText size={18} />} label="待处理草稿" value={String(overview.draftCount)} detail={`${overview.readyPageCount} 个页面已标记就绪`} />
      <Metric icon={<Globe size={18} />} label="内容覆盖缺口" value={String(overview.missingCellCount)} detail="页面 × 语言矩阵" />
      <Metric icon={<MagnifyingGlass size={18} />} label="SEO 阻塞" value={String(overview.seoBlockerCount)} detail={`${overview.affectedPathCount} 条路径受本次变更影响`} />
      <Metric icon={<PlugsConnected size={18} />} label="Google 集成" value={`${configured}/${overview.integrationCount}`} detail="固定代码，发布后才生效" />
    </div>

    <div className="publication-center-grid">
      <section className="panel publication-blockers"><header><div><small>RELEASE PREFLIGHT</small><h3>发布前检查</h3></div><span className={`state-pill state-${status.tone}`}>{status.label}</span></header>{overview.blockers.length ? <ul>{overview.blockers.map((blocker) => <li key={blocker}><WarningCircle size={16} /><span>{blockerLabels[blocker] ?? blocker}</span><a href={blocker === "seo_blockers" ? "#seo-readiness" : "#publishing"}>处理<ArrowUpRight size={13} /></a></li>)}</ul> : <div className="publication-clear"><CheckCircle size={22} weight="fill" /><div><strong>没有发现发布阻塞</strong><p>{clearDetail}</p></div></div>}</section>
      <section className="panel publication-snapshot"><header><div><small>IMMUTABLE SNAPSHOT</small><h3>快照传播</h3></div><span className={`state-pill state-${publication?.propagationState ?? "unavailable"}`}>{publication?.propagationState ?? "unavailable"}</span></header><dl><div><dt>当前 revision</dt><dd>{overview.currentRevision === null ? "—" : `r${overview.currentRevision}`}</dd></div><div><dt>待确认快照</dt><dd>{overview.pendingSnapshotId ? overview.pendingSnapshotId.slice(0, 14) + "…" : "无"}</dd></div><div><dt>待发布差异</dt><dd>{overview.diffCount} 项</dd></div></dl><a className="publication-link" href="#publishing">打开内容校样台 <ArrowUpRight size={14} /></a></section>
    </div>
  </section>;
}
