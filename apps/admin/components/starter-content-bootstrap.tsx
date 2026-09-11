"use client";

import { ArrowRight, CheckCircle, FilePlus, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { AdminStarterContentPreviewSchema, starterPageRecords, starterSharedRecords, type AdminContentManagementView, type AdminContentPublicationView, type AdminStarterContentPreview } from "@tikdd/admin-contracts";
import { useState } from "react";

function stateLabel(state: AdminStarterContentPreview["state"]): string {
  return ({ empty: "尚未初始化", partial: "部分存在", ready: "已就绪", blocked: "需要处理", published: "已有快照" })[state];
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

  if (!view || publication?.currentRevision !== null) return null;

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
      setMessage(next.eligible ? "可以创建就绪草稿；不会发布公共快照。" : "当前状态不允许初始化，请先处理阻塞项。");
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
            reason: "Initialize the reviewed bilingual starter content set.",
            confirmation: "starter-content",
            idempotencyKey: crypto.randomUUID().replaceAll("-", "")
          }
        })
      });
      if (!response.ok) throw new Error("apply failed");
      const result = await response.json() as { createdPageCount?: number; createdSharedCount?: number };
      setMessage(`已创建 ${result.createdPageCount ?? 0} 个页面与 ${result.createdSharedCount ?? 0} 个共享内容草稿。请逐项检查后再发布。`);
      onReload();
    } catch {
      setMessage("初始化未完成，可能已有其他草稿写入；请刷新后重新预览。");
    } finally {
      setBusy(null);
    }
  }

  const display = preview;
  return (
    <section className="starter-bootstrap panel" data-write-mode={writeMode} aria-labelledby="starter-bootstrap-title">
      <div className="starter-bootstrap-signal" aria-hidden="true"><FilePlus size={22} weight="duotone" /></div>
      <div className="starter-bootstrap-copy">
        <p className="eyebrow">FIRST SNAPSHOT / CONTENT SEED</p>
        <h3 id="starter-bootstrap-title">初始化首发内容</h3>
        <p>把代码审阅过的双语首页、帮助、FAQ、法律页与 X / Instagram Beta 页面写入 <code>ready</code> 草稿。此动作不会发布，也不会修改 Provider 或运行时设置。</p>
        <div className="starter-bootstrap-stats">
          <span><b>{display?.expectedPageCount ?? starterPageRecords().length}</b> 页面</span>
          <span><b>{display?.expectedSharedCount ?? starterSharedRecords().length}</b> 共享块</span>
          <span><b>{display ? stateLabel(display.state) : "等待预览"}</b></span>
        </div>
        {display ? (
          <div className="starter-bootstrap-detail" role="status">
            <span><CheckCircle size={16} /> 已存在 {display.existingPageCount} / {display.expectedPageCount} 页面，{display.existingSharedCount} / {display.expectedSharedCount} 共享块</span>
            <span><ArrowRight size={14} /> 可创建 {display.pendingPageCount + (display.expectedPageCount - display.existingPageCount)} 页面、{display.pendingSharedCount + (display.expectedSharedCount - display.existingSharedCount)} 共享块</span>
            {display.conflicts.length > 0 ? <span className="starter-bootstrap-warning"><WarningCircle size={16} /> 冲突：{display.conflicts.slice(0, 3).join("、")}</span> : null}
          </div>
        ) : null}
        <div className="starter-bootstrap-actions">
          <button type="button" onClick={() => void requestPreview()} disabled={busy !== null || !csrfToken}>
            {busy === "preview" ? "预览中…" : "预览初始内容"}
          </button>
          <button type="button" className="primary" onClick={() => void applyStarter()} disabled={busy !== null || !csrfToken || !display?.eligible}>
            {busy === "apply" ? "创建中…" : "创建就绪草稿"}
          </button>
        </div>
        {message ? <p className="starter-bootstrap-message" role="status">{message}</p> : null}
      </div>
      <div className="starter-bootstrap-guard"><ShieldCheck size={17} /><span>仅首次快照前可用<br />发布仍需完整维护模式</span></div>
    </section>
  );
}
