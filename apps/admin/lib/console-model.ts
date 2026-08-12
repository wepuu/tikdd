import type { AdminRouteSummary } from "@tikdd/admin-contracts";
import type { AdminConsoleSnapshot } from "./console-contract";

export type AlertSeverity = "critical" | "warning" | "notice";

export interface ConsoleAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  target: "routing" | "coverage" | "publishing" | "runtime";
  actionLabel: string;
}

const stateOrder: Record<AdminRouteSummary["state"], number> = {
  unavailable: 0,
  open: 1,
  warning: 2,
  stale: 3,
  paused: 4,
  insufficient_data: 5,
  healthy: 6,
  draft: 7
};

export const stateLabels: Record<AdminRouteSummary["state"], string> = {
  healthy: "健康",
  warning: "需关注",
  open: "熔断开启",
  paused: "已暂停",
  insufficient_data: "样本不足",
  stale: "数据过期",
  unavailable: "不可用",
  draft: "草稿"
};

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("zh-CN", { notation: value >= 100_000 ? "compact" : "standard" }).format(value);
}

export function formatRate(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${(value / 100).toFixed(2)}%`;
}

export function formatLatency(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : value >= 1_000 ? `${(value / 1_000).toFixed(2)} s` : `${value} ms`;
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "尚未观测";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Europe/Amsterdam"
  }).format(new Date(value));
}

export function sortRoutes(routes: readonly AdminRouteSummary[]): AdminRouteSummary[] {
  return [...routes].sort((left, right) =>
    Number(right.productionEligible) - Number(left.productionEligible) ||
    stateOrder[left.state] - stateOrder[right.state] ||
    left.tuple.platform.localeCompare(right.tuple.platform) ||
    (left.preferencePosition ?? 1_000) - (right.preferencePosition ?? 1_000) ||
    right.basePriority - left.basePriority ||
    left.tuple.providerId.localeCompare(right.tuple.providerId));
}

export function routeNextStep(route: AdminRouteSummary): string {
  if (!route.manifestEnabled) return "Provider 清单已禁用；启用能力仍需代码和部署评审。";
  switch (route.state) {
    case "unavailable": return "检查运行依赖与 rollout / guard 新鲜度；不要根据缺失数据恢复流量。";
    case "open": return "查看失败分类并等待熔断冷却；后台不能手动关闭熔断。";
    case "warning": return "对比顺序中的下一条回退路线，并检查失败类别是否集中。";
    case "stale": return "检查调度器和证据聚合时间；过期指标不应用于放量判断。";
    case "paused": return "核对 Manifest、rollout 和 Pilot Guard；仅可恢复精确的 Admin 创建限制，恢复不会创建授权。";
    case "insufficient_data": return "等待更多聚合样本，或在下方运行一次有租约和超时边界的预设探测。";
    case "draft": return "草稿不会影响运行流量；在下方比较有效顺序并显式发布。";
    case "healthy": return "当前无需操作；继续观察分配、成功率和回退变化。";
  }
}

function pushRouteAlerts(alerts: ConsoleAlert[], routes: readonly AdminRouteSummary[]) {
  for (const route of sortRoutes(routes).filter(({ state, manifestEnabled, productionEligible }) => productionEligible && state !== "healthy" && (state !== "paused" || manifestEnabled)).slice(0, 5)) {
    const exact = `${route.providerDisplayName} · ${route.tuple.platform.toUpperCase()} / ${route.tuple.region}`;
    alerts.push({
      id: `route:${route.tuple.providerId}:${route.tuple.platform}:${route.tuple.region}`,
      severity: ["open", "unavailable"].includes(route.state) ? "critical" : "warning",
      title: `${exact}：${stateLabels[route.state]}`,
      detail: routeNextStep(route),
      target: "routing",
      actionLabel: "检查精确路线"
    });
  }
}

export function deriveAlerts(snapshot: AdminConsoleSnapshot): ConsoleAlert[] {
  const alerts: ConsoleAlert[] = [];
  if (snapshot.routes.status === "unavailable") {
    alerts.push({ id: "routes-unavailable", severity: "critical", title: "路线状态不可读取", detail: "保持现有运行状态，并检查 Admin API 与路由健康数据源。", target: "runtime", actionLabel: "检查运行依赖" });
  } else {
    pushRouteAlerts(alerts, snapshot.routes.data.routes);
    const disabledCapabilities = snapshot.routes.data.routes.filter(({ manifestEnabled }) => !manifestEnabled).length;
    if (disabledCapabilities > 0) {
      alerts.push({ id: "manifest-disabled", severity: "notice", title: `${disabledCapabilities} 条 Provider 能力未在此部署启用`, detail: "这是代码与部署配置的只读基线，不是运行故障；启用仍需代码和部署评审。", target: "coverage", actionLabel: "查看能力覆盖" });
    }
    if (snapshot.routes.data.degradedSources.length > 0) {
      alerts.push({ id: "route-partial", severity: "warning", title: "路线视图为部分数据", detail: `暂不可用的数据源：${snapshot.routes.data.degradedSources.join("、")}。`, target: "runtime", actionLabel: "查看数据新鲜度" });
    }
  }
  if (snapshot.overview.status === "unavailable") {
    alerts.push({ id: "overview-unavailable", severity: "critical", title: "今日运行摘要不可读取", detail: "队列、交付和发布数字均不应视为零。", target: "runtime", actionLabel: "检查 Admin API" });
  } else {
    const { queue, delivery, publishing, routes } = snapshot.overview.data;
    if (queue.failed > 0 || queue.queued > 100) {
      alerts.push({ id: "queue-pressure", severity: queue.failed > 20 || queue.queued > 500 ? "critical" : "warning", title: "解析队列需要关注", detail: `${formatCount(queue.queued)} 个等待，${formatCount(queue.failed)} 个失败。`, target: "runtime", actionLabel: "检查队列与 Worker" });
    }
    if (delivery.successRateBps !== null && delivery.successRateBps < 9_500) {
      alerts.push({ id: "delivery", severity: "warning", title: "交付成功率下降", detail: `当前聚合成功率 ${formatRate(delivery.successRateBps)}，仅显示匿名交付汇总。`, target: "runtime", actionLabel: "检查交付依赖" });
    }
    if (routes.activeDenies > 0) {
      alerts.push({ id: "active-denies", severity: "warning", title: `${routes.activeDenies} 条运行路线处于拒绝或暂停`, detail: "确认限制来源；受保护的恢复只会到期精确 Admin deny，不会创建或提高授权。", target: "routing", actionLabel: "查看暂停路线" });
    }
    if (publishing.localeGaps > 0 || publishing.seoBlockers > 0 || publishing.pendingDrafts > 0) {
      alerts.push({ id: "publishing", severity: publishing.seoBlockers > 0 ? "warning" : "notice", title: "发布准备尚未完成", detail: `${publishing.pendingDrafts} 个草稿，${publishing.localeGaps} 个语言缺口，${publishing.seoBlockers} 个 SEO 阻塞。`, target: "publishing", actionLabel: "查看发布准备度" });
    }
  }
  if (snapshot.runtime.status === "unavailable") {
    alerts.push({ id: "runtime-unavailable", severity: "critical", title: "运行依赖状态不可读取", detail: "不要将未返回的依赖状态解释为健康。", target: "runtime", actionLabel: "检查运行边界" });
  } else {
    for (const dependency of snapshot.runtime.data.dependencies.filter(({ state }) => state !== "healthy")) {
      alerts.push({ id: `dependency:${dependency.id}`, severity: dependency.state === "unavailable" ? "critical" : "warning", title: `${dependency.id}：${dependency.state === "stale" ? "数据过期" : "不可用"}`, detail: dependency.observedAt ? `最近观测：${formatTime(dependency.observedAt)}（荷兰时间）` : "当前没有可信的新鲜度时间。", target: "runtime", actionLabel: "查看依赖状态" });
    }
  }
  return alerts.sort((left, right) => ({ critical: 0, warning: 1, notice: 2 })[left.severity] - ({ critical: 0, warning: 1, notice: 2 })[right.severity]);
}
