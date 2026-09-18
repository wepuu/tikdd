"use client";

import { ArrowRight, ChartLineUp, CheckCircle, ClockCounterClockwise, Pulse, ShieldWarning, WarningCircle } from "@phosphor-icons/react";
import type { AdminBetaHealth, AdminRouteSummary } from "@tikdd/admin-contracts";
import type { AdminEffectiveRoutePlanView } from "../lib/console-model";
import { formatCount, formatRate, formatTime } from "../lib/console-model";
import { deriveRouteOperationsPulse, type RouteOperationsPulse, type RoutePulseState } from "../lib/route-operations-model";

type BetaHealthResource =
  | { status: "ready"; data: AdminBetaHealth }
  | { status: "unavailable"; data: null };

const platformLabels: Record<string, string> = {
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook"
};

const stateLabels: Record<RoutePulseState, string> = {
  ready: "正常观察",
  observe: "需要关注",
  blocked: "当前无生产路线",
  "no-data": "等待自然流量"
};

function StateIcon({ state }: { state: RoutePulseState }) {
  if (state === "ready") return <CheckCircle size={16} weight="fill" />;
  if (state === "observe") return <WarningCircle size={16} weight="fill" />;
  if (state === "blocked") return <ShieldWarning size={16} />;
  return <ClockCounterClockwise size={16} />;
}

function BetaLine({ pulse }: { pulse: RouteOperationsPulse }) {
  if (!pulse.beta) return <span className="route-pulse-muted">没有 Beta 聚合</span>;
  return <span>{formatCount(pulse.beta.tasks.total)} 个任务 · {formatRate(pulse.beta.attempts.successRateBps)} 尝试成功</span>;
}

function PulseCard({ pulse, selected, onSelect }: { pulse: RouteOperationsPulse; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" className={`route-pulse-card state-${pulse.state} ${selected ? "is-selected" : ""}`} onClick={onSelect} aria-pressed={selected}>
      <header>
        <span className="route-pulse-icon"><Pulse size={17} /></span>
        <span><strong>{platformLabels[pulse.platform] ?? pulse.platform}</strong><small>{pulse.region.toUpperCase()} · {stateLabels[pulse.state]}</small></span>
        <StateIcon state={pulse.state} />
      </header>
      <div className="route-pulse-chain" aria-label={`${pulse.platform} 当前生产路由`}>
        {pulse.activeProviderNames.length > 0
          ? pulse.activeProviderNames.map((name, index) => <span key={`${name}:${index}`}><b>{index + 1}</b>{name}{index < pulse.activeProviderNames.length - 1 ? <ArrowRight size={13} aria-hidden="true" /> : null}</span>)
          : <span className="route-pulse-muted">没有可尝试的生产路线</span>}
      </div>
      <div className="route-pulse-metrics">
        <span><small>样本</small><b>{formatCount(pulse.sampleCount)}</b></span>
        <span><small>成功率</small><b>{formatRate(pulse.successRateBps)}</b></span>
        <span><small>回退</small><b>{formatRate(pulse.fallbackRateBps)}</b></span>
      </div>
      <footer><span><ChartLineUp size={13} /><BetaLine pulse={pulse} /></span><small>最近 {formatTime(pulse.latestObservedAt)}</small></footer>
    </button>
  );
}

export function RouteOperationsPulse({
  routes,
  plans,
  betaHealth,
  selectedPlatform,
  onSelectPlatform
}: {
  routes: readonly AdminRouteSummary[];
  plans: readonly AdminEffectiveRoutePlanView[];
  betaHealth: BetaHealthResource;
  selectedPlatform: string;
  onSelectPlatform: (platform: string) => void;
}) {
  const pulses = deriveRouteOperationsPulse(routes, plans, betaHealth.status === "ready" ? betaHealth.data : null);
  if (pulses.length === 0) return null;
  return (
    <section className="route-pulse-panel panel" aria-labelledby="route-pulse-title">
      <header className="route-pulse-heading">
        <div><p className="eyebrow">NATURAL TRAFFIC / ROUTE PULSE</p><h3 id="route-pulse-title">平台路由体温</h3><p>只读拼接路由健康与自然流量聚合；没有数据时显示等待，不会主动请求 Provider。</p></div>
        <span className="read-only-label"><ShieldWarning size={14} />只读观察</span>
      </header>
      <div className="route-pulse-grid">{pulses.map((pulse) => <PulseCard key={`${pulse.platform}:${pulse.region}`} pulse={pulse} selected={selectedPlatform === pulse.platform} onSelect={() => onSelectPlatform(pulse.platform)} />)}</div>
      <footer className="route-pulse-footer">样本来自已持久化的 Provider 与 Delivery 聚合；回退比例为空表示当前窗口没有足够样本，不代表零失败。</footer>
    </section>
  );
}
