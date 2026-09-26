import type { AdminConsoleSnapshot } from "../lib/console-contract";
import type { AdminEffectiveRoutePlanView } from "../lib/console-model";
import { deriveSupportTruth, type SupportTruthDrift } from "../lib/support-truth-model";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";

const catalogLabels = { stable: "Stable", experimental: "Beta", planned: "规划中", paused: "暂停" } as const;
const availabilityLabels = { listed: "已公开", preview: "预览", hidden: "未公开", paused: "已暂停" } as const;
const driftLabels: Record<SupportTruthDrift, string> = {
  catalog_route_mismatch: "目录仍未开放",
  public_page_missing: "公开页未发布",
  route_not_listed: "路由已开但未公开",
  listed_without_route: "已公开但无运行路由",
  public_copy_missing: "首页未声明支持"
};

function rate(value: number | null): string { return value === null ? "—" : `${(value / 100).toFixed(value % 100 === 0 ? 0 : 1)}%`; }
function count(value: number | null): string { return value === null ? "—" : value.toLocaleString("zh-CN"); }
function time(value: string | null): string { return value ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "等待自然流量"; }

export function SupportTruthLedger({ snapshot, plans }: { snapshot: AdminConsoleSnapshot; plans: readonly AdminEffectiveRoutePlanView[] }) {
  if (snapshot.platforms.status !== "ready" || snapshot.routes.status !== "ready") {
    return <div className="support-ledger panel"><div className="support-ledger-empty"><WarningCircle size={20} /><span>平台或路由事实暂不可用，当前运行状态不会被推断。</span></div></div>;
  }
  const controls = snapshot.controls.status === "ready" ? snapshot.controls.data : null;
  const rows = deriveSupportTruth({
    platforms: snapshot.platforms.data.platforms,
    routes: snapshot.routes.data.routes,
    plans,
    beta: snapshot.betaHealth.status === "ready" ? snapshot.betaHealth.data : null,
    content: controls?.contentManagement ?? null,
    seo: controls?.seoTechnical ?? null
  });
  const driftCount = rows.reduce((sum, row) => sum + row.drifts.length, 0);

  return <div className="support-ledger panel">
    <header className="support-ledger-heading">
      <div><p className="eyebrow">SUPPORT TRUTH LEDGER</p><h3>生产支持事实</h3><p>按平台对齐目录、运行路由、自然事件、公开内容与索引边界；不发起 Provider 请求。</p></div>
      <span className={driftCount ? "support-ledger-drift" : "support-ledger-clear"}>{driftCount ? <WarningCircle size={16} /> : <CheckCircle size={16} weight="fill" />}{driftCount ? `${driftCount} 项偏差` : "事实已对齐"}</span>
    </header>
    <div className="support-ledger-scroll"><table>
      <thead><tr><th>平台</th><th>产品状态</th><th>生产路由</th><th>自然任务</th><th>下载交接</th><th>公开内容</th><th>搜索边界</th><th>事实判断</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.platform}>
        <th><strong>{row.displayName}</strong><small>{row.platform} · {time(row.latestEventAt)}</small></th>
        <td><b className={`support-status status-${row.catalogStatus}`}>{catalogLabels[row.catalogStatus]}</b><small>{availabilityLabels[row.publicAvailability]}</small></td>
        <td><strong>{row.activeProviders.join(" → ") || "无活动路由"}</strong><small>{row.circuitOpen ? "熔断已打开" : `${row.activeRouteCount} 条活动路线 · 回退 ${rate(row.fallbackRateBps)}`}</small></td>
        <td><strong>{count(row.tasks)}</strong><small>成功率 {rate(row.taskSuccessRateBps)} · 尝试 {count(row.attempts)}</small></td>
        <td><strong>{count(row.handoffs)}</strong><small>浏览器交接，不代表文件已保存</small></td>
        <td><strong>{row.pageId ?? "无代码页面"}</strong><small>{count(row.publishedLocaleCount)}/{count(row.pageLocaleCount)} 个语言已发布</small></td>
        <td><strong>{count(row.indexableLocaleCount)} 个语言可索引</strong><small>{catalogLabels[row.catalogStatus]} · Sitemap {count(row.sitemapLocaleCount)}</small></td>
        <td>{row.drifts.length ? <div className="support-drift-list">{row.drifts.map((drift) => <span key={drift}>{driftLabels[drift]}</span>)}</div> : <span className="support-row-clear"><CheckCircle size={14} weight="fill" />已对齐</span>}</td>
      </tr>)}</tbody>
    </table></div>
    <footer>缺少自然事件会显示“等待自然流量”，不会被解释为成功或失败。页面发布、Provider rollout 与 Sitemap 仍由各自既有边界控制。</footer>
  </div>;
}
