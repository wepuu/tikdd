"use client";

import { ChartLineUp, CheckCircle, ClockCounterClockwise, WarningCircle } from "@phosphor-icons/react";
import type { AdminBetaHealth } from "@tikdd/admin-contracts";
import { deriveBetaCadenceSignal, formatCount, formatRate, formatTime } from "../lib/console-model";

type BetaHealthResource =
  | { status: "ready"; data: AdminBetaHealth }
  | { status: "unavailable"; data: null };

const platformLabels: Record<string, string> = { x: "X", instagram: "Instagram", tiktok: "TikTok" };
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
        <div><small>任务</small><strong>{formatCount(bucket.tasks.total)}</strong><span>{formatCount(bucket.tasks.succeeded)} 成功 · {formatCount(bucket.tasks.failed)} 失败</span></div>
        <div><small>Provider 尝试</small><strong>{rate(bucket.attempts.total, bucket.attempts.successRateBps)}</strong><span>{formatCount(bucket.attempts.total)} 次尝试</span></div>
        <div><small>交付交接</small><strong>{rate(bucket.deliveries.total, bucket.deliveries.successRateBps)}</strong><span>{formatCount(bucket.deliveries.total)} 次交接</span></div>
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
  const platforms = ["x", "instagram", "tiktok"].filter((platform) => report.byPlatform[platform as keyof typeof report.byPlatform]);
  return (
    <div className="beta-health-dashboard panel">
      <header className="beta-health-toolbar">
        <div><small>只读运行汇总</small><strong>最近 {report.window.hours} 小时 Beta 窗口 <span>· 最近 {formatTime(report.latestEventAt)}</span></strong><p>本页汇总 X、Instagram 与 TikTok 的公开 Beta 结果，只读观察，不能修改 rollout 或门禁。</p></div>
        <label>观察窗口<select aria-label="观察窗口" value={hours} onChange={(event) => onHoursChange(Number(event.target.value))}><option value={1}>最近 1 小时</option><option value={24}>最近 24 小时</option><option value={168}>最近 7 天</option></select></label>
      </header>
      <div className="beta-health-summary">
        <article><span><CheckCircle size={17} /></span><div><small>任务成功</small><strong>{formatCount(report.totals.tasks.succeeded)} / {formatCount(report.totals.tasks.total)}</strong></div></article>
        <article><span><ChartLineUp size={17} /></span><div><small>尝试成功率</small><strong>{rate(report.totals.attempts.total, report.totals.attempts.successRateBps)}</strong></div></article>
        <article><span><ClockCounterClockwise size={17} /></span><div><small>交付成功率</small><strong>{rate(report.totals.deliveries.total, report.totals.deliveries.successRateBps)}</strong></div></article>
        <article><span><WarningCircle size={17} /></span><div><small>过期 / 进行中</small><strong>{formatCount(report.totals.tasks.expired)} / {formatCount(report.totals.tasks.active)}</strong></div></article>
      </div>
      <div className="beta-platform-grid">{platforms.map((platform) => <PlatformCard key={platform} platform={platform} report={report} bucket={report.byPlatform[platform as keyof typeof report.byPlatform]} />)}</div>
      <footer className="beta-health-footer">窗口：{formatTime(report.window.from)} – {formatTime(report.window.to)} · 返回的只有脱敏汇总，不包含 URL、任务 ID、Provider 内容或媒体地址。</footer>
    </div>
  );
}
