"use client";

import type { AdminOperationalTruth, AdminSupportReasonCode, AdminSupportStep } from "@tikdd/admin-contracts";
import { ArrowRight, CheckCircle, ClockCountdown, WarningCircle, XCircle } from "@phosphor-icons/react";
import type { AdminConsoleSnapshot } from "../lib/console-contract";

const stepLabels: Record<AdminSupportStep["id"], { short: string; detail: string }> = {
  catalog: { short: "识别", detail: "目录与 Host 规则" },
  resolution: { short: "解析", detail: "Provider 能力" },
  delivery: { short: "交付", detail: "下载交付已验证" },
  canary: { short: "Canary", detail: "精确路线探测" },
  runtime: { short: "运行时", detail: "当前生产可用" },
  lifecycle: { short: "生命周期", detail: "稳定性状态" },
  seo: { short: "SEO", detail: "索引资格" }
};

const reasonLabels: Record<AdminSupportReasonCode, string> = {
  catalog_not_stable: "平台尚未进入稳定生命周期",
  no_provider_capability: "没有声明该平台能力的 Provider",
  provider_disabled: "Provider 生产开关关闭",
  region_mismatch: "Provider 不支持当前区域",
  no_delivery_mode: "未声明受控交付模式",
  delivery_unverified: "交付链尚未验证",
  canary_not_configured: "当前精确路线没有 Canary 证据",
  canary_failed: "最近一次 Canary 失败",
  canary_stale: "Canary 证据已过期",
  canary_unavailable: "Canary 数据源不可用",
  missing_rollout_grant: "没有当前生产分配授权",
  restrictive_guard: "自动保护正在限制该路线",
  open_circuit: "熔断器已打开",
  circuit_stale: "运行健康数据已过期",
  insufficient_runtime_evidence: "运行样本不足",
  runtime_data_unavailable: "运行时权威数据不可用",
  platform_not_listed: "平台未公开列出",
  content_incomplete: "本地化内容不完整",
  seo_ineligible: "未满足派生的索引条件"
};

const serviceLabels = { canary: "Canary", evidence: "证据评估", cleanup: "数据清理" } as const;

function StepIcon({ state }: { state: AdminSupportStep["state"] }) {
  if (state === "pass") return <CheckCircle weight="fill" />;
  if (state === "warning") return <WarningCircle weight="fill" />;
  if (state === "block") return <XCircle weight="fill" />;
  return <ClockCountdown weight="fill" />;
}

export function OperationalTruthDashboard({
  view,
  selectedPlatform,
  onSelectPlatform
}: {
  view: AdminConsoleSnapshot["operationalTruth"];
  selectedPlatform: string;
  onSelectPlatform(platform: string): void;
}) {
  if (view.status === "unavailable") {
    return <div className="truth-empty panel"><WarningCircle size={28} /><strong>运营真相投影不可用</strong><p>不会用目录声明或零值代替缺失的运行证据。</p></div>;
  }
  const truth = view.data;
  const platform = truth.platforms.find(({ platform: id }) => id === selectedPlatform) ?? truth.platforms[0];
  if (!platform) return <div className="truth-empty panel"><strong>没有平台目录投影</strong></div>;

  return <div className="truth-dashboard panel">
    <div className="truth-toolbar">
      <div><small>当前判断范围</small><strong>{platform.displayName} <span>/ {truth.region}</span></strong></div>
      <label>平台<select value={platform.platform} onChange={(event) => onSelectPlatform(event.target.value)}>{truth.platforms.map((item) => <option value={item.platform} key={item.platform}>{item.displayName}</option>)}</select></label>
      <div className={`truth-verdict state-${platform.currentAvailability}`}><small>当前下载</small><strong>{platform.currentAvailability === "available" ? "可用" : platform.currentAvailability === "degraded" ? "证据降级" : "不可用"}</strong></div>
      <div className={`truth-verdict state-${platform.indexEligibility}`}><small>搜索索引</small><strong>{platform.indexEligibility === "eligible" ? "可索引" : platform.indexEligibility === "unavailable" ? "数据不可用" : "不可索引"}</strong></div>
    </div>

    <div className="truth-signal-chain" aria-label={`${platform.displayName} 支持资格链`}>
      {platform.ladder.map((step, index) => <div className="truth-step-wrap" key={step.id}>
        <article className={`truth-step state-${step.state}`}>
          <span><StepIcon state={step.state} /></span>
          <div><strong>{stepLabels[step.id].short}</strong><small>{stepLabels[step.id].detail}</small></div>
        </article>
        {index < platform.ladder.length - 1 ? <ArrowRight className="truth-arrow" aria-hidden="true" /> : null}
      </div>)}
    </div>

    <div className="truth-detail-grid">
      <section className="truth-reasons">
        <header><strong>为什么没有通过</strong><small>{platform.reasons.length} 个精确阻断</small></header>
        {platform.reasons.length === 0 ? <p className="truth-clear"><CheckCircle weight="fill" />当前链路没有阻断。</p> : <ul>{platform.reasons.map((reason) => <li key={`${reason.code}:${reason.providerId ?? "platform"}`}><span>{reason.providerId ?? "平台"}</span><p>{reasonLabels[reason.code]}</p></li>)}</ul>}
      </section>
      <section className="truth-providers">
        <header><strong>Provider 精确路线</strong><small>授权与健康不会被能力声明替代</small></header>
        <div>{platform.providers.length === 0 ? <p className="truth-muted">当前没有 Provider 能力。</p> : platform.providers.map((provider) => <article key={provider.tuple.providerId}>
          <div><strong>{provider.displayName}</strong><small>{provider.tuple.providerId} / {provider.tuple.region}</small></div>
          <span className={`truth-route-state state-${provider.runtimeState}`}>{provider.allocationBps > 0 ? `${(provider.allocationBps / 100).toFixed(0)}% 授权` : "0% 授权"}</span>
          <small>Canary {provider.canaryState.replace("_", " ")} · Circuit {provider.circuitState.replace("_", " ")}</small>
        </article>)}</div>
      </section>
    </div>

    <div className="truth-services" aria-label="计划任务新鲜度">
      {truth.services.map((service) => <article className={service.ready ? "ready" : "not-ready"} key={service.service}><span></span><div><strong>{serviceLabels[service.service]}</strong><small>{service.freshness} · 连续失败 {service.consecutiveFailures}</small></div><time>{service.observedAt ? new Date(service.observedAt).toLocaleString("zh-CN", { hour12: false }) : "尚无完成记录"}</time></article>)}
    </div>
  </div>;
}
