"use client";

import { CheckCircle, Code, GlobeHemisphereWest, LockKey, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import type { AdminConsoleSnapshot } from "../lib/console-contract";

const blockerLabels: Record<string, string> = {
  catalog_not_stable: "代码目录尚未标记为稳定",
  no_monitored_eligible_route: "没有受监控且可承载流量的生产路线",
  no_healthy_route: "没有健康路线",
  page_not_associated: "尚未关联平台页面",
  page_not_published: "关联页面尚未发布",
  locale_coverage_incomplete: "已发布语言覆盖不完整",
  seo_not_ready: "页面 SEO 尚未满足索引条件",
  operational_data_unavailable: "运行或内容数据暂时不可用"
};

const availabilityLabels = { hidden: "隐藏", preview: "预览", listed: "公开支持", paused: "暂停展示" } as const;
type CommandState = "idle" | "submitting" | "succeeded" | "failed";
const idempotencyKey = () => crypto.randomUUID().replaceAll("-", "");

export function PlatformManagement({ snapshot, onReload }: {
  snapshot: AdminConsoleSnapshot;
  onReload: (platform: string) => Promise<void>;
}) {
  const platforms = snapshot.platforms.status === "ready" ? snapshot.platforms.data.platforms : [];
  const controls = snapshot.controls.status === "ready" ? snapshot.controls.data : null;
  const view = controls?.platformPresentation ?? null;
  const source = view?.draft ?? view?.published;
  const [displayName, setDisplayName] = useState("");
  const [supportLabel, setSupportLabel] = useState("");
  const [availability, setAvailability] = useState<"hidden" | "preview" | "listed" | "paused">("hidden");
  const [pageId, setPageId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [state, setState] = useState<CommandState>("idle");
  const [message, setMessage] = useState("");
  const revisionKey = `${view?.platform}:${view?.headRevision}:${view?.draft?.revision}`;

  useEffect(() => {
    if (!view) return;
    setDisplayName(source?.publicDisplayName ?? view.baseline.publicDisplayName);
    setSupportLabel(source?.supportLabel ?? view.baseline.supportLabel);
    setAvailability(source?.publicAvailability ?? view.baseline.publicAvailability);
    setPageId(source?.pageId ?? "");
    setReason(""); setConfirmation(""); setState("idle"); setMessage("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revisionKey]);

  const exactScope = view ? `${view.platform}/${view.region}` : "";
  const canSubmit = Boolean(view && controls && displayName.trim() && supportLabel.trim() && reason.trim() && confirmation === exactScope && state !== "submitting");
  const selectedSummary = useMemo(() => platforms.find(({ id }) => id === view?.platform), [platforms, view?.platform]);

  async function command(action: "platform_draft" | "platform_publish" | "platform_discard" | "platform_rollback") {
    if (!view || !controls || !canSubmit) return;
    setState("submitting"); setMessage("");
    const base = { platform: view.platform, region: view.region, expectedRevision: view.headRevision,
      reason: reason.trim(), confirmation, idempotencyKey: idempotencyKey() };
    const payload = action === "platform_draft"
      ? { ...base, publicDisplayName: displayName.trim(), supportLabel: supportLabel.trim(), publicAvailability: availability, pageId: pageId.trim() || null }
      : action === "platform_publish" || action === "platform_discard"
        ? { ...base, expectedRevision: view.headRevision!, draftRevision: view.draft!.revision }
        : { ...base, expectedRevision: view.headRevision!, targetRevision: view.published!.previousRevision! };
    try {
      const response = await fetch("/api/admin/snapshot", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, csrfToken: controls.csrf.csrfToken, command: payload }), signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error();
      setState("succeeded");
      setMessage(action === "platform_draft" ? "平台展示草稿已保存，公开站点没有变化。" : "平台展示版本已完成持久化验证。");
      await onReload(view.platform);
    } catch {
      setState("failed");
      setMessage(availability === "listed" ? "发布被就绪门禁或版本冲突阻止。请检查右侧发布跑道并刷新后重试。" : "命令被拒绝或版本已经变化；当前已发布展示没有被覆盖。");
    }
  }

  return <section className="platform-management" id="platforms" aria-labelledby="platform-management-title">
    <header className="platform-management-heading">
      <div><p className="eyebrow">CONFIGURE / PLATFORM CATALOG</p><h2 id="platform-management-title">平台展示与发布就绪</h2><p>目录识别能力保持代码只读；这里只管理公众看到的名称、支持标签、可见状态和页面关联。</p></div>
      <span className="read-only-label"><LockKey size={15} />Host 规则不可编辑</span>
    </header>
    <div className="platform-command-deck">
      <nav className="platform-index" aria-label="平台目录">
        <div className="mini-heading"><strong>代码目录</strong><span>{platforms.length} 个平台</span></div>
        {platforms.map((platform) => <button type="button" className={platform.id === view?.platform ? "selected" : ""} key={platform.id} onClick={() => void onReload(platform.id)}>
          <span className={`catalog-signal status-${platform.catalogStatus}`} />
          <span><strong>{platform.displayName}</strong><small>{platform.id} · {platform.catalogStatus}</small></span>
          <b>{availabilityLabels[platform.publicAvailability]}</b>
        </button>)}
      </nav>

      {!view || !controls ? <div className="platform-workbench unavailable"><WarningCircle size={30} /><strong>平台控制暂不可用</strong><p>代码目录仍可查看；没有权威版本或 CSRF 令牌时写操作保持关闭。</p></div> : <div className="platform-workbench">
        <div className="platform-facts">
          <div><small>目录基线</small><strong>{view.catalog.displayName}</strong><span>{view.catalog.source} · {view.catalog.status}</span></div>
          <div><small>公开展示</small><strong>{view.effective.publicDisplayName}</strong><span>{availabilityLabels[view.effective.publicAvailability]}</span></div>
          <div><small>Provider 覆盖</small><strong>{view.adapterCapabilities.length}</strong><span>{view.readiness.monitoredEligibleRouteCount} 条受监控可用路线</span></div>
          <div><small>语言页面</small><strong>{view.readiness.publishedPageLocaleCount}/{view.readiness.publishedLocaleCount}</strong><span>{view.readiness.seoReady ? "SEO 已就绪" : "SEO 未就绪"}</span></div>
        </div>

        <div className="readiness-runway" aria-label="平台发布就绪检查">
          {[{label:"目录稳定",ok:view.catalog.status==="stable"},{label:"生产路线",ok:view.readiness.monitoredEligibleRouteCount>0},{label:"页面关联",ok:Boolean(view.effective.pageId)},{label:"语言覆盖",ok:view.readiness.publishedLocaleCount>0&&view.readiness.publishedPageLocaleCount>=view.readiness.publishedLocaleCount},{label:"SEO 就绪",ok:view.readiness.seoReady}].map((step, index) => <div className={step.ok ? "ready" : "blocked"} key={step.label}>
            <span>{step.ok ? <CheckCircle weight="fill" size={18} /> : <span>{index + 1}</span>}</span><b>{step.label}</b>
          </div>)}
        </div>

        <div className="platform-detail-grid">
          <div className="catalog-boundary">
            <div className="mini-heading"><strong><Code size={16} />代码拥有的识别边界</strong><span>只读</span></div>
            <dl><dt>Recognized hosts</dt><dd>{view.catalog.recognizedHosts.map(({ hostname, allowSubdomains }) => <code key={hostname}>{allowSubdomains ? "*." : ""}{hostname}</code>)}</dd>
              <dt>Extractor keys</dt><dd>{view.catalog.extractorKeys.length ? view.catalog.extractorKeys.map((key) => <code key={key}>{key}</code>) : <span>无 extractor key</span>}</dd>
              <dt>Adapter capability</dt><dd>{view.adapterCapabilities.length ? view.adapterCapabilities.map((item) => <code key={item.providerId}>{item.providerId} · p{item.basePriority} · {item.productionEligible ? item.deliveryModes.join(" + ") : "仅解析"}</code>) : <span>尚无 Provider 能力</span>}</dd></dl>
            <p><GlobeHemisphereWest size={15} />展示状态不会改变 URL 识别、Host allowlist 或交付边界。</p>
          </div>

          <div className="platform-editor">
            <div className="mini-heading"><strong>展示草稿</strong><span>{view.draft ? `草稿 r${view.draft.revision}` : view.published ? `已发布 r${view.published.revision}` : "沿用目录基线"}</span></div>
            <label>公开名称<input maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
            <label>支持标签<input maxLength={80} value={supportLabel} onChange={(event) => setSupportLabel(event.target.value)} /></label>
            <div className="platform-editor-row"><label>可见状态<select value={availability} onChange={(event) => setAvailability(event.target.value as typeof availability)}>{Object.entries(availabilityLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>页面 ID<input placeholder="page_x" value={pageId} onChange={(event) => setPageId(event.target.value)} /></label></div>
            <label>变更原因<textarea maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="说明这次公众展示调整" /></label>
            <label>输入 <code>{exactScope}</code> 确认<input autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
            <div className="command-actions"><button className="secondary" type="button" disabled={!canSubmit} onClick={() => void command("platform_draft")}>保存草稿</button>
              {view.draft ? <><button className="primary" type="button" disabled={!canSubmit} onClick={() => void command("platform_publish")}>发布展示</button><button className="quiet" type="button" disabled={!canSubmit} onClick={() => void command("platform_discard")}>丢弃草稿</button></> : null}
              {view.published?.previousRevision ? <button className="quiet" type="button" disabled={!canSubmit} onClick={() => void command("platform_rollback")}>回滚到 r{view.published.previousRevision}</button> : null}</div>
            {message ? <div className={`command-message ${state}`}>{message}</div> : null}
          </div>
        </div>

        <aside className={`platform-readiness-summary ${view.readiness.indexableEligible ? "ready" : "blocked"}`}>
          <span>{view.readiness.indexableEligible ? <CheckCircle weight="fill" size={22} /> : <WarningCircle size={22} />}</span><div><strong>{view.readiness.indexableEligible ? "可以发布为公开支持" : "公开索引仍被阻止"}</strong>
            {view.readiness.blockers.length ? <ul>{view.readiness.blockers.map((blocker) => <li key={blocker}>{blockerLabels[blocker] ?? blocker}</li>)}</ul> : <p>目录、路线、页面、语言和 SEO 检查均已通过。</p>}</div>
          {selectedSummary ? <small>{selectedSummary.providerCount} 条目录能力 · {selectedSummary.healthyRouteCount} 条健康路线</small> : null}
        </aside>
      </div>}
    </div>
  </section>;
}
