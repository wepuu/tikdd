"use client";

import { CheckCircle, Flask, MagnifyingGlass, MinusCircle, ShieldCheck } from "@phosphor-icons/react";
import { useState } from "react";
import type { AdminConsoleSnapshot } from "../lib/console-contract";

type CapabilityFilter = "all" | "delivery" | "production" | "resolution" | "unverified" | "failed" | "unsupported";

const modeLabels = {
  redirect: "Redirect",
  proxy: "Proxy",
  "temporary-object": "临时文件"
} as const;

const verificationLabels = {
  unverified: "未验证",
  fixture_verified: "Fixture 已验证",
  canary_failed: "Canary 验证失败",
  canary_verified: "Canary 已验证",
  delivery_verified: "交付已验证"
} as const;

export function ProviderCapabilityMatrix({ snapshot, selectedPlatform, onSelectPlatform }: {
  snapshot: AdminConsoleSnapshot;
  selectedPlatform: string;
  onSelectPlatform: (platform: string) => void;
}) {
  const [providerQuery, setProviderQuery] = useState("");
  const [capabilityFilter, setCapabilityFilter] = useState<CapabilityFilter>("all");
  if (snapshot.providers.status !== "ready" || snapshot.platforms.status !== "ready") return null;
  const providers = snapshot.providers.data.providers;
  const platformCatalog = snapshot.platforms.data.platforms;
  const platformIds = [...new Set([
    ...platformCatalog.map(({ id }) => id),
    ...providers.flatMap(({ capabilities }) => capabilities.map(({ platform }) => platform))
  ])].sort();
  const shownPlatforms = platformIds.filter((id) => id === selectedPlatform);
  const filteredProviders = providers.filter((provider) => {
    const queryMatch = `${provider.displayName} ${provider.id}`.toLowerCase().includes(providerQuery.trim().toLowerCase());
    if (!queryMatch) return false;
    const capabilities = shownPlatforms.map((platform) => provider.capabilities.find((item) => item.platform === platform));
    if (capabilityFilter === "delivery") return capabilities.some((item) => item && item.deliveryModes.length > 0);
    if (capabilityFilter === "production") return capabilities.some((item) => item?.productionEligible);
    if (capabilityFilter === "resolution") return capabilities.some((item) => item && item.deliveryModes.length === 0);
    if (capabilityFilter === "unverified") return capabilities.some((item) => item?.verificationStatus === "unverified");
    if (capabilityFilter === "failed") return capabilities.some((item) => item?.verificationStatus === "canary_failed");
    if (capabilityFilter === "unsupported") return capabilities.some((item) => !item);
    return true;
  });

  return <section className="capability-matrix-panel panel" aria-labelledby="capability-matrix-title">
    <header className="matrix-toolbar">
      <div><p className="eyebrow">CODE-OWNED / CAPABILITY RAILS</p><h3 id="capability-matrix-title">Provider × 平台能力矩阵</h3><p>单元格来自运行时 Manifest。后台可以收窄生产路线，但不能新增能力、交付模式或 Host 规则。</p></div>
      <div className="matrix-filters">
        <label>平台<select value={selectedPlatform} onChange={(event) => onSelectPlatform(event.target.value)}>{platformIds.map((id) => <option key={id} value={id}>{id.toUpperCase()}</option>)}</select></label>
        <label>能力<select value={capabilityFilter} onChange={(event) => setCapabilityFilter(event.target.value as CapabilityFilter)}><option value="all">全部能力</option><option value="delivery">声明交付模式</option><option value="production">当前生产合格</option><option value="resolution">仅解析</option><option value="unverified">等待验证</option><option value="failed">Canary 验证失败</option><option value="unsupported">不支持此平台</option></select></label>
        <label className="provider-search"><span className="visually-hidden">筛选 Provider</span><MagnifyingGlass size={15} /><input aria-label="筛选 Provider" value={providerQuery} onChange={(event) => setProviderQuery(event.target.value)} placeholder="筛选 Provider" /></label>
      </div>
    </header>
    <div className="capability-legend"><span><i className="legend-production" />解析 + 安全交付</span><span><i className="legend-resolution" />技术验证 / 仅解析</span><span><i />不支持</span></div>
    <div className="capability-matrix-scroll" tabIndex={0}>
      <table><thead><tr><th>Provider</th>{shownPlatforms.map((platform) => <th key={platform}>{platform.toUpperCase()}</th>)}</tr></thead>
        <tbody>{filteredProviders.map((provider) => <tr key={provider.id}><th><strong>{provider.displayName}</strong><small>{provider.id} · {provider.enabled ? "已启用" : "已停用"}</small></th>{shownPlatforms.map((platform) => {
          const capability = provider.capabilities.find((item) => item.platform === platform);
          if (!capability) return <td key={platform}><span className="capability-cell unsupported"><MinusCircle size={16} /><b>不支持</b></span></td>;
          if (capability.deliveryModes.length === 0) return <td key={platform}><span className="capability-cell resolution"><Flask size={16} /><b>仅解析</b><small>p{capability.basePriority} · {verificationLabels[capability.verificationStatus]}</small></span></td>;
          return <td key={platform}><span className={`capability-cell delivery ${capability.productionEligible ? "production" : "inactive"}`}><CheckCircle size={16} weight={capability.productionEligible ? "fill" : "regular"} /><b>解析 + {capability.deliveryModes.map((mode) => modeLabels[mode]).join("/")}</b><small>p{capability.basePriority} · {verificationLabels[capability.verificationStatus]} · {capability.productionEligible ? "生产合格" : "当前未启用"}</small></span></td>;
        })}</tr>)}{filteredProviders.length===0?<tr><td className="matrix-empty" colSpan={shownPlatforms.length+1}>当前筛选没有匹配的 Provider；能力基线没有被更改。</td></tr>:null}</tbody></table>
    </div>
    <footer><ShieldCheck size={16} /><p>声明支持不等于当前可下载。只有“交付已验证”且声明安全交付模式的能力可进入生产；其余路线只能执行受控 Probe。</p></footer>
  </section>;
}
