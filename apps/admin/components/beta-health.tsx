"use client";

import { ChartLineUp, WarningCircle } from "@phosphor-icons/react";
import type { AdminBetaHealth } from "@tikdd/admin-contracts";
import { deriveBetaCadenceSignal, formatCount, formatRate, formatTime } from "../lib/console-model";
import { visibleDownloadPlatforms } from "../lib/beta-health-model";

type BetaHealthResource =
  | { status: "ready"; data: AdminBetaHealth }
  | { status: "unavailable"; data: null };

const platformLabels: Record<string, string> = { x: "X", instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", pinterest: "Pinterest", vimeo: "Vimeo" };
const failureLabels: Record<string, string> = {
  timeout: "超时",
  provider_timeout: "超时",
  rate_limited: "限流",
  provider_rate_limited: "限流",
  challenge: "挑战",
  provider_challenge: "挑战",
  schema: "结构变化",
  provider_schema_changed: "结构变化",
  availability: "上游不可用",
  provider_unavailable: "上游不可用",
  invalid_result: "结果无效",
  terminal_content: "内容不可处理",
  other: "其他"
};

function rate(total: number, value: number | null): string {
  return total === 0 ? "—" : formatRate(value);
}

function failureLabel(value: string | undefined): string {
  const code = String(value ?? "other");
  return failureLabels[code] ?? code.replaceAll("_", " ");
}

function FailureList({ title, values }: { title: string; values: Record<string, number> }) {
  const entries = Object.entries(values).sort((left, right) => right[1] - left[1]).slice(0, 5);
  return (
    <div className="beta-failures">
      <small>{title}</small>
      {entries.length === 0 ? <span className="beta-empty-line">暂无已分类失败</span> : entries.map(([code, count]) => (
        <div key={code}><span>{failureLabel(code)}</span><b>{formatCount(count)}</b></div>
      ))}
    </div>
  );
}

function PlatformCard({ platform, report, bucket }: { platform: string; report: AdminBetaHealth; bucket: AdminBetaHealth["totals"] }) {
  const signal = deriveBetaCadenceSignal(report, bucket);
  return (
    <article className="beta-platform-card">
      <header><span className="beta-platform-mark"><ChartLineUp size={18} /></span><div><strong>{platformLabels[platform] ?? platform}</strong><small>公开 Beta 汇总 · 最近活动 {formatTime(bucket.latestEventAt)}</small></div></header>
      <div className={`beta-cadence-strip cadence-${signal.state}`} role="status" aria-label={`${platformLabels[platform] ?? platform} 请求节奏：${signal.label}`}><span className="beta-cadence-dot" aria-hidden="true" /><div><strong>请求节奏：{signal.label}</strong><small>{signal.advice}</small></div></div>
      <div className="beta-metric-grid">
        <div><small>用户任务</small><strong>{formatCount(bucket.tasks.total)}</strong><span>{rate(bucket.tasks.succeeded + bucket.tasks.failed + bucket.tasks.expired, bucket.tasks.successRateBps)} 解析成功</span></div>
        <div><small>Provider 尝试</small><strong>{rate(bucket.attempts.total, bucket.attempts.successRateBps)}</strong><span>{formatCount(bucket.attempts.total)} 次尝试</span></div>
        <div><small>下载票据</small><strong>{formatCount(bucket.deliveries.ticketCount)}</strong><span>{rate(bucket.deliveries.total, bucket.deliveries.successRateBps)} 校验通过</span></div>
        <div><small>浏览器交接</small><strong>{formatCount(bucket.deliveries.handoffCount)}</strong><span>不等于文件已保存</span></div>
      </div>
      <div className="beta-card-failures">
        <FailureList title="尝试失败" values={bucket.attempts.failureCounts} />
        <FailureList title="任务失败" values={bucket.tasks.failureCounts} />
      </div>
    </article>
  );
}

export function BetaHealthDashboard({ view, hours, onHoursChange }: { view: BetaHealthResource; hours: number; onHoursChange: (hours: number) => void }) {
  if (view.status === "unavailable") {
    return <div className="panel unavailable-panel beta-health-unavailable"><WarningCircle size={28} /><strong>Beta 健康暂时不可用</strong><p>汇总读取已安全失败；没有修改流量或 Provider 状态。</p></div>;
  }
  const report = view.data;
  const platforms = visibleDownloadPlatforms(report);
  return (
    <div className="beta-health-dashboard panel">
      <header className="beta-health-toolbar">
        <div><small>可信下载漏斗</small><strong>最近 {report.window.hours} 小时 <span>· 最近活动 {formatTime(report.latestEventAt)}</span></strong><p>任务按创建时间形成同一批次；Provider 尝试、票据和交接按各自事件时间统计，含义不再混用。</p></div>
        <label>观察窗口<select aria-label="观察窗口" value={hours} onChange={(event) => onHoursChange(Number(event.target.value))}><option value={1}>最近 1 小时</option><option value={24}>最近 24 小时</option><option value={168}>最近 7 天</option></select></label>
      </header>
      <div className="beta-flow" aria-label="下载链路统计">
        <article><span>1</span><div><small>用户任务</small><strong>{formatCount(report.totals.tasks.total)}</strong><em>{formatCount(report.totals.tasks.active)} 进行中</em></div></article>
        <article><span>2</span><div><small>解析成功</small><strong>{formatCount(report.totals.tasks.succeeded)}</strong><em>{rate(report.totals.tasks.succeeded + report.totals.tasks.failed + report.totals.tasks.expired, report.totals.tasks.successRateBps)} 终态成功率</em></div></article>
        <article><span>3</span><div><small>下载票据</small><strong>{formatCount(report.totals.deliveries.ticketCount)}</strong><em>{rate(report.totals.deliveries.total, report.totals.deliveries.successRateBps)} 校验通过</em></div></article>
        <article><span>4</span><div><small>浏览器交接</small><strong>{formatCount(report.totals.deliveries.handoffCount)}</strong><em>媒体请求已交给浏览器</em></div></article>
      </div>
      {platforms.length > 0
        ? <div className="beta-platform-grid">{platforms.map((platform) => <PlatformCard key={platform} platform={platform} report={report} bucket={report.byPlatform[platform]!} />)}</div>
        : <div className="beta-platform-empty"><ChartLineUp size={24} /><strong>当前窗口还没有下载事件</strong><span>等待真实用户流量；Provider 能力与启用状态请在 Providers 工作区查看。</span></div>}
      <footer className="beta-health-footer">窗口：{formatTime(report.window.from)} – {formatTime(report.window.to)} · “浏览器交接”只证明一次性票据已兑换，不声称跨域媒体文件已经保存。</footer>
    </div>
  );
}
