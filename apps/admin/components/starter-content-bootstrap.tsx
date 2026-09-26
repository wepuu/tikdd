"use client";

import { ArrowRight, CheckCircle, FilePlus, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { AdminStarterContentPreviewSchema, starterPageRecords, starterSharedRecords, type AdminContentManagementView, type AdminContentPublicationView, type AdminStarterContentPreview } from "@tikdd/admin-contracts";
import { useState } from "react";

function stateLabel(state: AdminStarterContentPreview["state"]): string {
  return ({ empty: "尚未应用", partial: "有待更新", ready: "内容包已同步", blocked: "需要处理", published: "已有快照" })[state];
}

export function StarterContentBootstrap({
  view,
  publication,
  csrfToken,
  writeMode,
  onReload
}: {
  view: AdminContentManagementView | null;
  publication: AdminContentPublicationView | null;
  csrfToken: string | null;
  writeMode: "content-draft" | "full";
  onReload: () => void;
}) {
  const [preview, setPreview] = useState<AdminStarterContentPreview | null>(null);
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);
  const [message, setMessage] = useState("");

  if (!view) return null;

  async function requestPreview() {
    if (!csrfToken) return;
    setBusy("preview");
    setMessage("");
    try {
      const response = await fetch("/api/admin/snapshot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "starter_preview", csrfToken, command: {} })
      });
      if (!response.ok) throw new Error("preview failed");
      const next = AdminStarterContentPreviewSchema.parse(await response.json());
      setPreview(next);
      setMessage(next.eligible ? "可以将内容包写入就绪草稿；不会自动发布公共快照。" : "当前内容定义不兼容，请先处理阻塞项。");
    } catch {
      setMessage("预览暂时不可用，请刷新当前版本后重试。");
    } finally {
      setBusy(null);
    }
  }

  async function applyStarter() {
    if (!csrfToken || !preview?.eligible) return;
    setBusy("apply");
    setMessage("");
    try {
      const response = await fetch("/api/admin/snapshot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "starter_apply",
          csrfToken,
          command: {
            reason: "Apply the reviewed multilingual SEO content pack.",
            confirmation: "starter-content",
            idempotencyKey: crypto.randomUUID().replaceAll("-", "")
          }
        })
      });
      if (!response.ok) throw new Error("apply failed");
      const result = await response.json() as { createdPageCount?: number; createdSharedCount?: number };
      setMessage(`已写入 ${result.createdPageCount ?? 0} 个页面与 ${result.createdSharedCount ?? 0} 个共享内容草稿。请检查 SEO 技术视图后发布。`);
      onReload();
    } catch {
      setMessage("内容包应用未完成，可能已有其他草稿写入；请刷新后重新预览。");
    } finally {
      setBusy(null);
    }
  }

  const display = preview;
  return (
    <section className="starter-bootstrap panel" data-write-mode={writeMode} aria-labelledby="starter-bootstrap-title">
      <div className="starter-bootstrap-signal" aria-hidden="true"><FilePlus size={22} weight="duotone" /></div>
      <div className="starter-bootstrap-copy">
        <p className="eyebrow">VERSIONED CONTENT PACK</p>
        <h3 id="starter-bootstrap-title">同步多语言 SEO 内容</h3>
        <p>把代码审阅过的 9 种语言首页、平台页、帮助、FAQ 与法律内容写入 <code>ready</code> 草稿。会保留 Google 统计和广告设置，不修改 Provider 或运行时配置，也不会自动发布。</p>
        <div className="starter-bootstrap-stats">
          <span><b>{display?.expectedPageCount ?? starterPageRecords().length}</b> 页面</span>
          <span><b>{display?.expectedSharedCount ?? starterSharedRecords().length}</b> 共享块</span>
          <span><b>{display ? stateLabel(display.state) : "等待预览"}</b></span>
        </div>
        {display ? (
          <div className="starter-bootstrap-detail" role="status">
            <span><CheckCircle size={16} /> 已存在 {display.existingPageCount} / {display.expectedPageCount} 页面，{display.existingSharedCount} / {display.expectedSharedCount} 共享块</span>
            <span><ArrowRight size={14} /> 可创建 {display.pendingPageCount + (display.expectedPageCount - display.existingPageCount)} 页面、{display.pendingSharedCount + (display.expectedSharedCount - display.existingSharedCount)} 共享块</span>
            {display.conflicts.length > 0 ? <span className="starter-bootstrap-warning"><WarningCircle size={16} /> 将更新：{display.conflicts.slice(0, 3).join("、")}</span> : null}
          </div>
        ) : null}
        <div className="starter-bootstrap-actions">
          <button type="button" onClick={() => void requestPreview()} disabled={busy !== null || !csrfToken}>
            {busy === "preview" ? "预览中…" : "预览内容包"}
          </button>
          <button type="button" className="primary" onClick={() => void applyStarter()} disabled={busy !== null || !csrfToken || !display?.eligible}>
            {busy === "apply" ? "同步中…" : "同步为就绪草稿"}
          </button>
        </div>
        {message ? <p className="starter-bootstrap-message" role="status">{message}</p> : null}
      </div>
      <div className="starter-bootstrap-guard"><ShieldCheck size={17} /><span>显式应用且不自动发布<br />发布仍需完整维护模式</span></div>
    </section>
  );
}
