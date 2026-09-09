"use client";

import { ChartLineUp, CheckCircle, ClockCounterClockwise, WarningCircle } from "@phosphor-icons/react";
import type { AdminBetaHealth } from "@tikdd/admin-contracts";
import { formatCount, formatRate, formatTime } from "../lib/console-model";

type BetaHealthResource =
  | { status: "ready"; data: AdminBetaHealth }
  | { status: "unavailable"; data: null };

function rate(total: number, value: number | null): string {
  return total === 0 ? "—" : formatRate(value);
}

function FailureList({ title, values }: { title: string; values: Record<string, number> }) {
  const entries = Object.entries(values).sort((left, right) => right[1] - left[1]).slice(0, 5);
  return (
    <div className="beta-failures">
      <small>{title}</small>
      {entries.length === 0 ? <span className="beta-empty-line">No classified failures</span> : entries.map(([code, count]) => (
        <div key={code}><span>{code.replaceAll("_", " ")}</span><b>{formatCount(count)}</b></div>
      ))}
    </div>
  );
}

function PlatformCard({ platform, bucket }: { platform: string; bucket: AdminBetaHealth["totals"] }) {
  return (
    <article className="beta-platform-card">
      <header><span className="beta-platform-mark"><ChartLineUp size={18} /></span><div><strong>{platform.toUpperCase()}</strong><small>Public Beta aggregate</small></div></header>
      <div className="beta-metric-grid">
        <div><small>Tasks</small><strong>{formatCount(bucket.tasks.total)}</strong><span>{formatCount(bucket.tasks.succeeded)} succeeded · {formatCount(bucket.tasks.failed)} failed</span></div>
        <div><small>Provider attempts</small><strong>{rate(bucket.attempts.total, bucket.attempts.successRateBps)}</strong><span>{formatCount(bucket.attempts.total)} attempts</span></div>
        <div><small>Delivery handoff</small><strong>{rate(bucket.deliveries.total, bucket.deliveries.successRateBps)}</strong><span>{formatCount(bucket.deliveries.total)} observed</span></div>
      </div>
      <div className="beta-card-failures">
        <FailureList title="Attempt failures" values={bucket.attempts.failureCounts} />
        <FailureList title="Task failures" values={bucket.tasks.failureCounts} />
      </div>
    </article>
  );
}

export function BetaHealthDashboard({ view, hours, onHoursChange }: { view: BetaHealthResource; hours: number; onHoursChange: (hours: number) => void }) {
  if (view.status === "unavailable") {
    return <div className="panel unavailable-panel beta-health-unavailable"><WarningCircle size={28} /><strong>Beta health is temporarily unavailable</strong><p>Aggregate reads failed closed; no traffic or Provider state was changed.</p></div>;
  }
  const report = view.data;
  const platforms = ["x", "instagram"].filter((platform) => report.byPlatform[platform as keyof typeof report.byPlatform]);
  return (
    <div className="beta-health-dashboard panel">
      <header className="beta-health-toolbar">
        <div><small>READ-ONLY AGGREGATES</small><strong>{report.window.hours}-hour Beta window <span>· latest {formatTime(report.latestEventAt)}</span></strong><p>SaveFromIns remains an experimental Instagram Beta route. This view observes outcomes only; it cannot change rollout or gates.</p></div>
        <label>Window<select value={hours} onChange={(event) => onHoursChange(Number(event.target.value))}><option value={24}>Last 24 hours</option><option value={168}>Last 7 days</option></select></label>
      </header>
      <div className="beta-health-summary">
        <article><span><CheckCircle size={17} /></span><div><small>Tasks succeeded</small><strong>{formatCount(report.totals.tasks.succeeded)} / {formatCount(report.totals.tasks.total)}</strong></div></article>
        <article><span><ChartLineUp size={17} /></span><div><small>Attempt success</small><strong>{rate(report.totals.attempts.total, report.totals.attempts.successRateBps)}</strong></div></article>
        <article><span><ClockCounterClockwise size={17} /></span><div><small>Delivery success</small><strong>{rate(report.totals.deliveries.total, report.totals.deliveries.successRateBps)}</strong></div></article>
        <article><span><WarningCircle size={17} /></span><div><small>Expired / active</small><strong>{formatCount(report.totals.tasks.expired)} / {formatCount(report.totals.tasks.active)}</strong></div></article>
      </div>
      <div className="beta-platform-grid">{platforms.map((platform) => <PlatformCard key={platform} platform={platform} bucket={report.byPlatform[platform as keyof typeof report.byPlatform]} />)}</div>
      <footer className="beta-health-footer">Window: {formatTime(report.window.from)} – {formatTime(report.window.to)} · Values are sanitized aggregates; URLs, task IDs, Provider payloads and media addresses are never returned.</footer>
    </div>
  );
}
