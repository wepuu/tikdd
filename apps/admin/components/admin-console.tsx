"use client";

import type { AdminRouteSummary } from "@tikdd/admin-contracts";
import {
  ArrowClockwise,
  ArrowRight,
  Bell,
  BookOpenText,
  CaretRight,
  ChartLineUp,
  CheckCircle,
  CirclesThreePlus,
  ClockCounterClockwise,
  DownloadSimple,
  Gauge,
  Gear,
  GlobeHemisphereWest,
  HouseLine,
  MagnifyingGlass,
  PlugsConnected,
  Pulse,
  ShieldCheck,
  Stack,
  Translate,
  Warning,
  WarningCircle
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AdminConsoleSnapshotSchema, type AdminConsoleSnapshot } from "../lib/console-contract";
import {
  deriveAlerts,
  formatCount,
  formatLatency,
  formatRate,
  formatTime,
  routeNextStep,
  sortRoutes,
  stateLabels,
  type ConsoleAlert
} from "../lib/console-model";
import { RoutePolicyControl } from "./route-policy-control";
import { PlatformManagement } from "./platform-management";
import { ContentManagement } from "./content-management";
import { SeoWorkbench } from "./seo-workbench";
import { AccountSecurity } from "./account-security";
import { ProviderCapabilityMatrix } from "./provider-capability-matrix";
import { SettingsRecovery } from "./settings-recovery";
import { QualificationWorkbench } from "./qualification-workbench";

type RefreshState = "idle" | "refreshing" | "failed";

const navGroups = [
  { label: "主页", items: [{ href: "#overview", label: "总览", icon: HouseLine }] },
  { label: "运行", items: [{ href: "#routing", label: "路由观测", icon: ChartLineUp }, { href: "#alerts", label: "告警", icon: Bell }] },
  { label: "配置", items: [{ href: "#routing", label: "Provider 路由", icon: CirclesThreePlus }, { href: "#platforms", label: "平台", icon: PlugsConnected }] },
  { label: "发布", items: [{ href: "#publishing", label: "页面与语言", icon: Translate }, { href: "#publishing", label: "SEO", icon: MagnifyingGlass }] },
  { label: "系统", items: [{ href: "#runtime", label: "设置", icon: Gear }] }
] as const;

const failureLabels: Record<string, string> = {
  timeout: "超时",
  rate_limited: "限流",
  challenge: "挑战页",
  schema: "页面结构变化",
  availability: "上游不可用",
  invalid_result: "结果校验失败",
  terminal_content: "内容终止条件",
  other: "其他"
};

function routeKey(route: AdminRouteSummary): string {
  return `${route.tuple.providerId}:${route.tuple.platform}:${route.tuple.region}`;
}

function StatusDot({ state }: { state: AdminRouteSummary["state"] | "ready" | "degraded" | "unavailable" }) {
  return <span className={`status-dot state-${state}`} aria-hidden="true" />;
}

function EmptyState({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="empty-state">{icon}<strong>{title}</strong><p>{detail}</p></div>;
}

function SectionHeading({ eyebrow, title, detail, aside }: { eyebrow: string; title: string; detail: string; aside?: ReactNode }) {
  return (
    <header className="section-heading">
      <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{detail}</p></div>
      {aside ? <div className="section-aside">{aside}</div> : null}
    </header>
  );
}

function AttentionItem({ alert }: { alert: ConsoleAlert }) {
  return (
    <a className={`attention-item severity-${alert.severity}`} href={`#${alert.target}`}>
      <span className="attention-icon">{alert.severity === "critical" ? <WarningCircle size={20} weight="fill" /> : alert.severity === "warning" ? <Warning size={20} weight="fill" /> : <ClockCounterClockwise size={20} />}</span>
      <span><strong>{alert.title}</strong><small>{alert.detail}</small></span>
      <span className="attention-action">{alert.actionLabel}<CaretRight size={15} /></span>
    </a>
  );
}

function SummaryBand({ snapshot }: { snapshot: AdminConsoleSnapshot }) {
  if (snapshot.overview.status === "unavailable") {
    return <EmptyState icon={<WarningCircle size={28} />} title="运行摘要暂不可用" detail="队列、交付、路线和发布数字均未被解释为零。" />;
  }
  const { queue, delivery, routes, publishing } = snapshot.overview.data;
  return (
    <div className="summary-band">
      <article><span className="metric-icon"><Stack size={19} /></span><span><small>队列</small><strong>{formatCount(queue.queued)}</strong><em>{formatCount(queue.active)} 正在处理</em></span></article>
      <article><span className="metric-icon"><DownloadSimple size={19} /></span><span><small>交付</small><strong>{formatRate(delivery.successRateBps)}</strong><em>{formatCount(delivery.handoffCount)} 次交接</em></span></article>
      <article><span className="metric-icon"><ChartLineUp size={19} /></span><span><small>路线</small><strong>{routes.degraded} / {routes.total}</strong><em>{routes.activeDenies} 条限制</em></span></article>
      <article><span className="metric-icon"><BookOpenText size={19} /></span><span><small>发布准备</small><strong>{publishing.pendingDrafts}</strong><em>{publishing.localeGaps + publishing.seoBlockers} 个阻塞</em></span></article>
    </div>
  );
}

function RouteNode({ route, selected, onSelect }: { route: AdminRouteSummary; selected: boolean; onSelect: () => void }) {
  return (
    <button className={`runway-route state-${route.state} ${selected ? "selected" : ""}`} type="button" onClick={onSelect} aria-pressed={selected}>
      <span className="route-order">{route.preferencePosition ?? "·"}</span>
      <span className="route-name"><strong>{route.providerDisplayName}</strong><small>{route.providerKind}</small></span>
      <span className="route-state"><StatusDot state={route.state} />{stateLabels[route.state]}</span>
      <span className="route-metrics"><span>首选分流<b>{formatRate(route.trafficShareBps)}</b></span><span>准入<b>{formatRate(route.allocationBps)}</b></span><span>P95<b>{formatLatency(route.p95LatencyMs)}</b></span></span>
    </button>
  );
}

function RouteInspector({ snapshot, summary }: { snapshot: AdminConsoleSnapshot; summary: AdminRouteSummary | null }) {
  const detail = snapshot.selectedRoute.status === "ready" && snapshot.selectedRoute.data?.summary.tuple.providerId === summary?.tuple.providerId
    ? snapshot.selectedRoute.data
    : null;
  if (!summary) return <aside className="route-inspector"><EmptyState icon={<Gauge size={28} />} title="没有可检查的路线" detail="当前 Provider 清单没有生成这个区域的路线投影。" /></aside>;
  return (
    <aside className="route-inspector" aria-label="精确路线详情">
      <header><div><p className="eyebrow">EXACT ROUTE</p><h3>{summary.providerDisplayName}</h3><span>{summary.tuple.platform.toUpperCase()} · {summary.tuple.region} · {summary.tuple.providerId}</span></div><span className={`state-pill state-${summary.state}`}><StatusDot state={summary.state} />{stateLabels[summary.state]}</span></header>
      <div className="inspector-metrics">
        <article><small>有效分配</small><strong>{formatRate(summary.allocationBps)}</strong><span>{summary.verificationStatus.replaceAll("_", " ")} · rollout r{summary.rolloutRevision ?? "—"}</span></article>
        <article><small>成功率</small><strong>{formatRate(summary.successRateBps)}</strong><span>{formatCount(summary.sampleCount)} 个样本</span></article>
        <article><small>P95 延迟</small><strong>{formatLatency(summary.p95LatencyMs)}</strong><span>最近聚合窗口</span></article>
        <article><small>熔断</small><strong>{summary.circuitState === "half_open" ? "半开" : summary.circuitState === "closed" ? "闭合" : summary.circuitState === "open" ? "开启" : "未知"}</strong><span>{formatTime(summary.observedAt)}</span></article>
      </div>
      <section className="next-step"><span><ShieldCheck size={18} /></span><div><strong>建议下一步</strong><p>{routeNextStep(summary)}</p></div></section>
      <section className="failure-list">
        <div className="mini-heading"><strong>失败分类</strong><span>{detail ? `${formatTime(detail.windowStartedAt)} 起` : "详情读取中或不可用"}</span></div>
        {detail && detail.failures.length > 0 ? detail.failures.map((failure) => <div key={failure.code}><span>{failureLabels[failure.code] ?? failure.code}</span><b>{formatCount(failure.count)}</b></div>) : <p className="quiet-empty">当前窗口没有可展示的失败聚合；这不等于成功率为 100%。</p>}
      </section>
      <section className="canary-state"><span><Pulse size={18} /></span><div><strong>预设探测</strong><p>{detail ? ({ fresh: "结果新鲜", stale: "结果过期", running: "正在运行", failed: "最近失败", unavailable: "不可用", not_configured: "尚未配置" })[detail.canary.state] : "详情不可用"}</p></div><small>{detail ? formatTime(detail.canary.observedAt) : "—"}</small></section>
      <footer><span>受保护控制</span><p>策略命令只接受精确范围、确认、CSRF、幂等键和期望版本；未验证传播时不会显示成功。</p></footer>
    </aside>
  );
}

export function AdminConsole({ initialSnapshot, buildId }: { initialSnapshot: AdminConsoleSnapshot; buildId: string }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const initialSummary = initialSnapshot.selectedRoute.status === "ready" ? initialSnapshot.selectedRoute.data?.summary ?? null : null;
  const [selectedKey, setSelectedKey] = useState(initialSummary ? routeKey(initialSummary) : "");
  const initialPlatform = initialSummary?.tuple.platform ?? (initialSnapshot.platforms.status === "ready" ? initialSnapshot.platforms.data.platforms[0]?.id : undefined) ?? "x";
  const [platform, setPlatform] = useState(initialPlatform);
  const [stateFilter, setStateFilter] = useState<AdminRouteSummary["state"] | "all">("all");
  const [refreshState, setRefreshState] = useState<RefreshState>("idle");
  const alerts = useMemo(() => deriveAlerts(snapshot), [snapshot]);
  const allRoutes = snapshot.routes.status === "ready" ? sortRoutes(snapshot.routes.data.routes) : [];
  const platformOptions = [...new Set([
    ...allRoutes.map(({ tuple }) => tuple.platform),
    ...(snapshot.platforms.status === "ready" ? snapshot.platforms.data.platforms.map(({id})=>id) : []),
    ...(snapshot.providers.status === "ready" ? snapshot.providers.data.providers.flatMap(({capabilities})=>capabilities.map(({platform})=>platform)) : [])
  ])].sort();
  const visibleRoutes = allRoutes.filter((route) => route.tuple.platform === platform && (stateFilter === "all" || route.state === stateFilter));
  const selectedSummary = allRoutes.find((route) => routeKey(route) === selectedKey && route.tuple.platform === platform) ?? visibleRoutes[0] ?? null;
  const runwayPlatform = platform;
  const runwayRoutes = allRoutes.filter((route) => route.tuple.platform === runwayPlatform);
  const managedPlatform = snapshot.controls.status === "ready" ? snapshot.controls.data.platformPresentation?.platform : undefined;

  const refresh = useCallback(async (selection?: AdminRouteSummary, managedPlatform?: string, policyPlatform?: string) => {
    setRefreshState("refreshing");
    const parameters = new URLSearchParams();
    if (selection) {
      parameters.set("provider", selection.tuple.providerId); parameters.set("platform", selection.tuple.platform); parameters.set("region", selection.tuple.region);
    }
    if (managedPlatform) parameters.set("managedPlatform", managedPlatform);
    if (policyPlatform) parameters.set("policyPlatform", policyPlatform);
    try {
      const response = await fetch(`/api/admin/snapshot${parameters.size ? `?${parameters}` : ""}`, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error("refresh failed");
      const next = AdminConsoleSnapshotSchema.parse(await response.json());
      setSnapshot(next);
      setRefreshState("idle");
    } catch {
      setRefreshState("failed");
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(selectedSummary ?? undefined, managedPlatform, platform);
    }, snapshot.refreshIntervalMs);
    return () => window.clearInterval(timer);
  }, [refresh, managedPlatform, platform, selectedSummary, snapshot.refreshIntervalMs]);

  function selectRoute(route: AdminRouteSummary) {
    setSelectedKey(routeKey(route));
    setPlatform(route.tuple.platform);
    void refresh(route, managedPlatform, route.tuple.platform);
  }

  function selectPlatform(nextPlatform:string){setPlatform(nextPlatform);setSelectedKey("");void refresh(undefined,managedPlatform,nextPlatform);}

  const runtime = snapshot.runtime.status === "ready" ? snapshot.runtime.data : null;
  const deployment = runtime?.deployment ?? (snapshot.overview.status === "ready" ? snapshot.overview.data.deployment : "tikdd");
  const region = runtime?.region ?? (snapshot.overview.status === "ready" ? snapshot.overview.data.region : "nl");
  const overallState = runtime?.state ?? "unavailable";

  return (
    <main className="console-shell">
      <aside className="console-nav" aria-label="后台主导航">
        <a className="console-brand" href="#overview" aria-label="TikDD Admin 总览"><span><DownloadSimple size={20} weight="bold" /></span><b>TikDD</b></a>
        <nav>{navGroups.map((group) => <section key={group.label}><p>{group.label}</p>{group.items.map(({ href, label, icon: Icon }, index) => <a aria-label={label} className={group.label === "主页" && index === 0 ? "active" : ""} href={href} key={`${group.label}-${label}`}><Icon size={19} /><span>{label}</span></a>)}</section>)}</nav>
        <div className="nav-boundary"><ShieldCheck size={17} /><span>Owner only<br /><small>受保护控制面</small></span></div>
      </aside>

      <section className="console-workspace">
        <header className="console-topbar">
          <div className="environment"><span className="flag">NL</span><span><small>部署环境</small><b>{deployment} · {region}</b></span></div>
          <div className="topbar-actions">
            <span className="freshness"><ClockCounterClockwise size={16} /><span>快照 {formatTime(snapshot.generatedAt)}</span></span>
            <button type="button" className="refresh-button" onClick={() => void refresh(selectedSummary ?? undefined, managedPlatform, platform)} disabled={refreshState === "refreshing"}><ArrowClockwise className={refreshState === "refreshing" ? "spinning" : ""} size={17} />{refreshState === "refreshing" ? "刷新中" : refreshState === "failed" ? "重试刷新" : "刷新"}</button>
            <span className={`runtime-badge state-${overallState}`}><StatusDot state={overallState} />{overallState === "ready" ? "运行就绪" : overallState === "degraded" ? "部分降级" : "状态不可用"}</span>
          </div>
        </header>

        <div className="console-content">
          <section className="overview-section" id="overview">
            <SectionHeading eyebrow="OWNER BRIEF / TODAY" title="今天需要处理什么" detail="从真实运行聚合中提取需要站长判断的事项；缺失数据不会被显示为零或健康。" aside={<span className="read-only-label"><ShieldCheck size={15} />已认证 · 受保护</span>} />
            <div className="overview-layout">
              <div className="operating-brief">
                <div className="brief-lead"><span className={`brief-signal severity-${alerts[0]?.severity ?? "notice"}`}><Pulse size={25} weight="fill" /></span><div><small>当前判断</small><strong>{alerts.length === 0 ? "没有需要处理的运行事项" : `${alerts.length} 项需要检查`}</strong><p>{alerts.length === 0 ? "所有已返回的数据源处于可接受状态；继续按刷新周期观察。" : "先处理不可用与熔断，再检查过期数据和发布准备度。"}</p></div></div>
                <SummaryBand snapshot={snapshot} />
              </div>
              <div className="attention-rail" aria-label="优先事项">
                <div className="rail-heading"><span>优先事项</span><b>{alerts.length}</b></div>
                {alerts.length > 0 ? alerts.slice(0, 4).map((alert) => <AttentionItem alert={alert} key={alert.id} />) : <EmptyState icon={<CheckCircle size={27} weight="fill" />} title="当前没有告警" detail="新告警会按严重度出现在这里。" />}
              </div>
            </div>
          </section>

          <section className="routing-section" id="routing">
            <SectionHeading eyebrow="OPERATE / PLATFORM-AWARE ROUTING" title="Provider 路由" detail="先锁定平台与区域，再核对代码能力、生产资格、运行状态和有界回退顺序。" aside={<div className="route-filters"><label>平台<select value={platform} onChange={(event) => selectPlatform(event.target.value)}>{platformOptions.map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select></label><label>区域<select value={region} disabled><option>{region}</option></select></label><label>状态<select value={stateFilter} onChange={(event) => setStateFilter(event.target.value as typeof stateFilter)}><option value="all">全部状态</option>{Object.entries(stateLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>} />
            <div className="routing-scope-band panel"><article><small>当前决策范围</small><strong>{platform.toUpperCase()} / {region}</strong><span>平台和区域共同决定候选集合</span></article><article><small>生产候选</small><strong>{snapshot.controls.status==="ready"?snapshot.controls.data.routePolicy?.baselineProviderIds.length??0:"—"}</strong><span>声明交付模式且当前部署合格</span></article><article><small>技术验证</small><strong>{snapshot.controls.status==="ready"?snapshot.controls.data.routePolicy?.technicalProviderIds.length??0:"—"}</strong><span>仅解析，不进入生产下载顺序</span></article></div>
            <ProviderCapabilityMatrix snapshot={snapshot} selectedPlatform={platform} onSelectPlatform={selectPlatform} />
            {snapshot.routes.status === "unavailable" ? <div className="panel unavailable-panel"><EmptyState icon={<WarningCircle size={30} />} title="路由数据不可用" detail="Admin API 未返回可信的路线投影；当前运行状态保持不变。" /></div> : allRoutes.length === 0 ? <div className="panel"><EmptyState icon={<CirclesThreePlus size={30} />} title="没有可观测路线" detail="Provider 清单尚未生成这个区域的能力投影。" /></div> : (
              <div className="observatory-grid">
                <div className="runway-panel">
                  <div className="runway-caption"><span><GlobeHemisphereWest size={17} />{(runwayPlatform ?? "—").toUpperCase()} · {region}</span><small>{snapshot.routes.data.degradedSources.length > 0 ? `部分数据：${snapshot.routes.data.degradedSources.join("、")}` : "数据源完整"}</small></div>
                  <div className="runway-scroller" tabIndex={0} aria-label="顺序路由运行轨道">
                    <div className="route-runway">
                      <article className="runway-gate"><span><GlobeHemisphereWest size={23} /></span><strong>平台入口</strong><small>识别与准入已在公共 API 边界完成</small></article>
                      <ArrowRight className="runway-arrow" size={24} weight="bold" />
                      <div className="runway-stack">{runwayRoutes.length > 0 ? runwayRoutes.map((route) => <RouteNode route={route} selected={routeKey(route) === routeKey(selectedSummary ?? route)} onSelect={() => selectRoute(route)} key={routeKey(route)} />) : <EmptyState icon={<CirclesThreePlus size={26} />} title="当前筛选无路线" detail="切换平台或状态筛选查看其他路线。" />}</div>
                      <ArrowRight className="runway-arrow" size={24} weight="bold" />
                      <article className="runway-gate delivery"><span><ShieldCheck size={23} /></span><strong>受控交付</strong><small>{snapshot.overview.status === "ready" ? `${formatCount(snapshot.overview.data.delivery.handoffCount)} 次匿名交接` : "交付汇总不可用"}</small></article>
                    </div>
                  </div>
                  <div className="route-table-wrap">
                    <div className="mini-heading"><strong>所有精确路线</strong><span>{visibleRoutes.length} 条匹配</span></div>
                    <div className="table-scroller"><table><thead><tr><th>Provider</th><th>平台 / 区域</th><th>状态</th><th>首选分流</th><th>准入</th><th>成功率</th><th>P95</th><th>样本</th></tr></thead><tbody>{visibleRoutes.map((route) => <tr className={routeKey(route) === routeKey(selectedSummary ?? route) ? "selected-row" : ""} key={routeKey(route)} onClick={() => selectRoute(route)}><td><button type="button" onClick={() => selectRoute(route)}>{route.providerDisplayName}</button></td><td>{route.tuple.platform.toUpperCase()} / {route.tuple.region}</td><td><span className={`table-state state-${route.state}`}><StatusDot state={route.state} />{stateLabels[route.state]}</span></td><td>{formatRate(route.trafficShareBps)}</td><td>{formatRate(route.allocationBps)}</td><td>{formatRate(route.successRateBps)}</td><td>{formatLatency(route.p95LatencyMs)}</td><td>{formatCount(route.sampleCount)}</td></tr>)}</tbody></table></div>
                  </div>
                </div>
                <RouteInspector snapshot={snapshot} summary={selectedSummary} />
              </div>
            )}
            <RoutePolicyControl snapshot={snapshot} summary={selectedSummary} onComplete={()=>refresh(selectedSummary??undefined, managedPlatform, platform)} />
            <QualificationWorkbench view={snapshot.qualification.status==="ready"?snapshot.qualification.data:null} csrfToken={snapshot.controls.status==="ready"?snapshot.controls.data.csrf.csrfToken:null} onComplete={()=>refresh(selectedSummary??undefined,managedPlatform,platform)} />
          </section>

          <section className="alerts-section" id="alerts">
            <SectionHeading eyebrow="OPERATE / ATTENTION QUEUE" title="告警与下一步" detail="告警从路线、队列、交付、发布与依赖状态派生，不读取原始任务或媒体数据。" />
            <div className="alerts-panel panel">{alerts.length > 0 ? alerts.map((alert) => <AttentionItem alert={alert} key={`full-${alert.id}`} />) : <EmptyState icon={<CheckCircle size={30} weight="fill" />} title="没有活动告警" detail="所有已返回的聚合状态均在可接受范围内。" />}</div>
          </section>

          <section className="coverage-section" id="coverage">
            <SectionHeading eyebrow="READ-ONLY CATALOG" title="Provider 与平台覆盖" detail="能力、Host 规则和基础优先级来自代码清单；此处只展示经过净化的投影。" />
            <div className="coverage-grid">
              <div className="panel coverage-panel"><div className="panel-title"><span><PlugsConnected size={19} /></span><div><strong>Providers</strong><small>代码拥有的能力基线</small></div></div>{snapshot.providers.status === "ready" ? <div className="coverage-list">{snapshot.providers.data.providers.map((provider) => <article key={provider.id}><span className={`manifest-mark ${provider.enabled ? "enabled" : ""}`}><PlugsConnected size={17} /></span><span><strong>{provider.displayName}</strong><small>{provider.capabilities.length} 个平台 · {provider.kind}</small></span><b>{provider.enabled ? "已启用" : "未启用"}</b></article>)}</div> : <EmptyState icon={<WarningCircle size={26} />} title="Provider 投影不可用" detail="没有推断任何能力。" />}</div>
              <div className="panel coverage-panel"><div className="panel-title"><span><GlobeHemisphereWest size={19} /></span><div><strong>Platforms</strong><small>识别与发布准备度</small></div></div>{snapshot.platforms.status === "ready" ? <div className="coverage-list">{snapshot.platforms.data.platforms.slice(0, 8).map((item) => <article key={item.id}><span className={`manifest-mark ${item.healthyRouteCount > 0 ? "enabled" : ""}`}><GlobeHemisphereWest size={17} /></span><span><strong>{item.displayName}</strong><small>{item.providerCount} 条路线 · 内容 {formatRate(item.contentCoverageBps)}</small></span><b>{item.seoReady ? "SEO 就绪" : item.publicAvailability === "listed" ? "已展示" : "未就绪"}</b></article>)}</div> : <EmptyState icon={<WarningCircle size={26} />} title="平台投影不可用" detail="Host 规则仍由代码边界保护。" />}</div>
            </div>
          </section>

          <PlatformManagement snapshot={snapshot} onReload={(managedPlatform) => refresh(selectedSummary ?? undefined, managedPlatform)} />

          <ContentManagement view={snapshot.controls.status === "ready" ? snapshot.controls.data.contentManagement : null} publication={snapshot.controls.status === "ready" ? snapshot.controls.data.contentPublication : null} csrfToken={snapshot.controls.status === "ready" ? snapshot.controls.data.csrf.csrfToken : null} onReload={()=>refresh(selectedSummary??undefined)} />

          <SeoWorkbench view={snapshot.controls.status === "ready" ? snapshot.controls.data.contentManagement : null} technical={snapshot.controls.status === "ready" ? snapshot.controls.data.seoTechnical : null} csrfToken={snapshot.controls.status === "ready" ? snapshot.controls.data.csrf.csrfToken : null} onReload={()=>refresh(selectedSummary??undefined)} />

          <section className="publishing-section" id="publishing-readiness">
            <SectionHeading eyebrow="PUBLISH / READINESS" title="页面、语言与 SEO 准备度" detail="当前只读地展示已发布内容和阻塞；草稿编辑与发布将在后续工作项开放。" />
            <div className="publishing-grid panel">
              <article><small>活动快照</small><strong>{runtime?.activeSnapshotRevision ? `r${runtime.activeSnapshotRevision}` : "未激活"}</strong><span>公共 Web 不依赖 Admin API 可用性</span></article>
              <article><small>可索引页面</small><strong>{snapshot.seo.status === "ready" ? formatCount(snapshot.seo.data.indexablePageCount) : "—"}</strong><span>仅来自已发布且合格的页面</span></article>
              <article><small>Sitemap 页面</small><strong>{snapshot.seo.status === "ready" ? formatCount(snapshot.seo.data.sitemapPageCount) : "—"}</strong><span>与可见内容使用同一快照</span></article>
              <article className={(snapshot.seo.status === "ready" ? snapshot.seo.data.blockerCount : 1) > 0 ? "has-warning" : ""}><small>SEO 阻塞</small><strong>{snapshot.seo.status === "ready" ? formatCount(snapshot.seo.data.blockerCount) : "不可用"}</strong><span>私有与动态路由始终不可索引</span></article>
            </div>
          </section>

          <SettingsRecovery view={snapshot.controls.status==="ready"?snapshot.controls.data.settingsRecovery:null} content={snapshot.controls.status==="ready"?snapshot.controls.data.contentManagement:null} csrfToken={snapshot.controls.status==="ready"?snapshot.controls.data.csrf.csrfToken:null} onReload={()=>refresh(selectedSummary??undefined,managedPlatform,platform)} />
          <AccountSecurity />
          <footer className="console-build-footer" aria-label="后台构建信息">
            <span>TikDD Owner Console</span><code>{buildId}</code>
          </footer>
        </div>
      </section>
    </main>
  );
}
