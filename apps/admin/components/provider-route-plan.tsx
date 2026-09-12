"use client";

import { ArrowRight, CheckCircle, CirclesThreePlus, GitBranch, ShieldWarning, WarningCircle } from "@phosphor-icons/react";
import type { AdminEffectiveRoutePlanView, AdminEffectiveRouteRole } from "../lib/console-model";

const roleLabels: Record<AdminEffectiveRouteRole, string> = {
  primary: "主路线",
  fallback: "回退路线",
  eligible: "可用候选",
  excluded: "已排除"
};

const exclusionLabels: Record<string, string> = {
  manifest_disabled: "Manifest 已关闭",
  platform_unsupported: "未声明该平台",
  region_ineligible: "区域不适用",
  no_delivery_mode: "未声明交付模式",
  mock_provider: "开发 Provider 不进入生产",
  rollout_denied: "rollout 未授予",
  rollout_unavailable: "rollout 数据不可用",
  zero_allocation: "分配为 0",
  circuit_open: "熔断已打开",
  concurrency_unavailable: "并发额度不可用",
  max_attempts: "超过本次尝试上限"
};

function roleClass(role: AdminEffectiveRouteRole): string {
  return `route-plan-role role-${role}`;
}

export function ProviderRoutePlan({
  plans,
  selectedPlatform,
  onSelectPlatform
}: {
  plans: readonly AdminEffectiveRoutePlanView[];
  selectedPlatform: string;
  onSelectPlatform: (platform: string) => void;
}) {
  if (plans.length === 0) {
    return (
      <div className="panel route-plan-empty">
        <CirclesThreePlus size={27} />
        <strong>尚未生成有效路由计划</strong>
        <p>等待 Admin API 返回 Provider 能力投影；这里不会主动请求任何 Provider。</p>
      </div>
    );
  }

  return (
    <div className="route-plan-grid" aria-label="有效 Provider 路由计划">
      {plans.map((plan) => {
        const primary = plan.entries.find(({ role }) => role === "primary");
        const fallbackCount = plan.entries.filter(({ role }) => role === "fallback").length;
        const excludedCount = plan.entries.filter(({ role }) => role === "excluded").length;
        return (
          <article className={`panel route-plan-card ${selectedPlatform === plan.platform ? "is-selected" : ""}`} key={`${plan.platform}:${plan.region}`}>
            <header className="route-plan-card-heading">
              <div>
                <p className="eyebrow">{plan.platform.toUpperCase()} / {plan.region}</p>
                <h3>最终尝试顺序</h3>
              </div>
              <button type="button" className="route-plan-platform-button" onClick={() => onSelectPlatform(plan.platform)} aria-pressed={selectedPlatform === plan.platform}>
                查看精确路由 <ArrowRight size={15} />
              </button>
            </header>
            <div className="route-plan-summary">
              <span><GitBranch size={16} />{primary ? `${primary.providerDisplayName} 主路线` : "暂无主路线"}</span>
              <span>{fallbackCount > 0 ? `失败后回退 ${fallbackCount} 条` : "无已配置回退"}</span>
              <span>{excludedCount > 0 ? `${excludedCount} 条被门禁排除` : "没有额外排除"}</span>
            </div>
            <div className="route-plan-order" aria-label={`${plan.platform} 尝试顺序`}>
              {plan.entries.filter(({ role }) => role === "primary" || role === "fallback").map((entry, index, entries) => (
                <span className="route-plan-order-item" key={entry.providerId}>
                  <span className={roleClass(entry.role)}>{index + 1}</span>
                  <strong>{entry.providerDisplayName}</strong>
                  {index < entries.length - 1 ? <ArrowRight size={14} aria-hidden="true" /> : null}
                </span>
              ))}
              {plan.attemptProviderIds.length === 0 ? <span className="route-plan-no-attempt"><WarningCircle size={16} />当前没有可尝试路线</span> : null}
            </div>
            <div className="route-plan-entries">
              {plan.entries.map((entry) => (
                <div className={`route-plan-entry ${entry.exclusionReason ? "is-excluded" : ""}`} key={entry.providerId}>
                  <span className={roleClass(entry.role)}>{roleLabels[entry.role]}</span>
                  <span className="route-plan-entry-name"><strong>{entry.providerDisplayName}</strong><small>{entry.providerId}</small></span>
                  <span className="route-plan-entry-state">{entry.exclusionReason ? <><ShieldWarning size={15} />{exclusionLabels[entry.exclusionReason] ?? entry.exclusionReason}</> : <><CheckCircle size={15} />{entry.state === "healthy" ? "运行健康" : entry.state}</>}</span>
                </div>
              ))}
            </div>
            <footer className="route-plan-footer">
              <span>最多尝试 {plan.maxAttempts} 条</span>
              <span className={plan.manualOrder.valid ? "manual-order-valid" : "manual-order-invalid"}>{plan.manualOrder.valid ? "Admin 顺序有效" : "Admin 顺序需复核"}</span>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
