"use client";

import { ArrowRight, CheckCircle, Desktop, DeviceMobile, FileText, FloppyDisk, GitBranch, PaperPlaneTilt, Plus, Translate, Trash, WarningCircle } from "@phosphor-icons/react";
import { AdminPageDiscardCommandSchema, AdminPageDraftCommandSchema, GEO_SOURCE_LABELS, type AdminContentManagementView, type AdminContentPublicationView, type AdminPageContent, type GeoContent, type GeoSourceId } from "@tikdd/admin-contracts";
import { useEffect, useMemo, useState } from "react";
import { StarterContentBootstrap } from "./starter-content-bootstrap";
import { canPublishSnapshot, publicationGuidance, publicationStepLabel } from "../lib/publication-ui-model";
import { emptyPageEditorFields, editorFieldsFromContent, mergePageContent, preserveOrCreateSeo, type EditorFaqItem, type EditorSection, type EditorStep, type PageEditorFields } from "../lib/page-editor-model";

const stateLabel: Record<string, string> = { missing: "缺失", fallback: "回退", draft: "草稿", ready: "就绪", published: "已发布", archived: "已归档" };

function fallbackChain(view: AdminContentManagementView, locale: string) {
  const chain = [locale];
  let current = view.locales.find((item) => item.locale === locale)?.effective;
  const seen = new Set(chain);
  while (current?.fallbackLocale && !seen.has(current.fallbackLocale)) {
    chain.push(current.fallbackLocale);
    seen.add(current.fallbackLocale);
    current = view.locales.find((item) => item.locale === current?.fallbackLocale)?.effective;
  }
  return chain;
}
function contentTitle(content: AdminPageContent | undefined) {
  if (!content) return "尚未创建内容";
  return content.template === "homepage" ? content.heroTitle : content.title;
}

function contentSummary(content: AdminPageContent | undefined) {
  if (!content) return "从代码模板创建草稿后，这里会显示真实结构预览。";
  if (content.template === "homepage") return content.heroSubtitle;
  if (content.template === "platform") return content.introduction;
  if (content.template === "legal") return content.summary;
  return content.introduction;
}

function StepListEditor({ label, items, onChange, min, max }: { label: string; items: EditorStep[]; onChange: (items: EditorStep[]) => void; min: number; max: number }) {
  return <fieldset className="structured-list"><legend>{label}（{items.length}）</legend>{items.map((item, index) => <div className="structured-list-row" key={`${label}-${index}`}><div><input aria-label={`${label}${index + 1}标题`} value={item.title} onChange={(event) => onChange(items.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, title: event.target.value } : candidate))} placeholder="步骤标题"/><textarea aria-label={`${label}${index + 1}说明`} value={item.description} onChange={(event) => onChange(items.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, description: event.target.value } : candidate))} placeholder="步骤说明"/></div><button type="button" className="icon-button" aria-label={`删除${label}${index + 1}`} disabled={items.length <= min} onClick={() => onChange(items.filter((_, candidateIndex) => candidateIndex !== index))}><Trash size={15}/></button></div>)}<button type="button" className="add-structured-row" disabled={items.length >= max} onClick={() => onChange([...items, { title: "新步骤", description: "补充这一步的说明。" }])}><Plus size={14}/>添加步骤</button></fieldset>;
}

function FaqListEditor({ label, items, onChange, min, max }: { label: string; items: EditorFaqItem[]; onChange: (items: EditorFaqItem[]) => void; min: number; max: number }) {
  return <fieldset className="structured-list"><legend>{label}（{items.length}）</legend>{items.map((item, index) => <div className="structured-list-row" key={`${label}-${index}`}><div><input aria-label={`${label}${index + 1}问题`} value={item.question} onChange={(event) => onChange(items.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, question: event.target.value } : candidate))} placeholder="问题"/><textarea aria-label={`${label}${index + 1}答案`} value={item.answerMarkdown} onChange={(event) => onChange(items.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, answerMarkdown: event.target.value } : candidate))} placeholder="Safe Markdown 答案"/></div><button type="button" className="icon-button" aria-label={`删除${label}${index + 1}`} disabled={items.length <= min} onClick={() => onChange(items.filter((_, candidateIndex) => candidateIndex !== index))}><Trash size={15}/></button></div>)}<button type="button" className="add-structured-row" disabled={items.length >= max} onClick={() => onChange([...items, { question: "新问题", answerMarkdown: "补充回答。" }])}><Plus size={14}/>添加问题</button></fieldset>;
}

function SectionListEditor({ label, items, onChange, max }: { label: string; items: EditorSection[]; onChange: (items: EditorSection[]) => void; max: number }) {
  return <fieldset className="structured-list"><legend>{label}（{items.length}）</legend>{items.map((item, index) => <div className="structured-list-row" key={`${label}-${index}`}><div><input aria-label={`${label}${index + 1}标识`} value={item.id} onChange={(event) => onChange(items.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, id: event.target.value } : candidate))} placeholder="section-id"/><input aria-label={`${label}${index + 1}标题`} value={item.heading} onChange={(event) => onChange(items.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, heading: event.target.value } : candidate))} placeholder="小标题"/><textarea aria-label={`${label}${index + 1}正文`} value={item.bodyMarkdown} onChange={(event) => onChange(items.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, bodyMarkdown: event.target.value } : candidate))} placeholder="Safe Markdown 正文"/></div><button type="button" className="icon-button" aria-label={`删除${label}${index + 1}`} disabled={items.length <= 1} onClick={() => onChange(items.filter((_, candidateIndex) => candidateIndex !== index))}><Trash size={15}/></button></div>)}<button type="button" className="add-structured-row" disabled={items.length >= max} onClick={() => onChange([...items, { id: `section-${items.length + 1}`, heading: "新章节", bodyMarkdown: "补充正文。" }])}><Plus size={14}/>添加章节</button></fieldset>;
}

function updateFields<T extends keyof PageEditorFields>(setFields: React.Dispatch<React.SetStateAction<PageEditorFields>>, key: T, value: PageEditorFields[T]) {
  setFields((current) => ({ ...current, [key]: value }));
}

export function ContentManagement({ view, publication, csrfToken, onReload, writeMode }: { view: AdminContentManagementView | null; publication: AdminContentPublicationView | null; csrfToken: string | null; onReload: () => void; writeMode: "content-draft" | "full" }) {
  const [selectedLocale, setSelectedLocale] = useState(view?.locales[0]?.locale ?? "en");
  const [selectedPage, setSelectedPage] = useState("page_home");
  const [preview, setPreview] = useState<"desktop" | "mobile">("desktop");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [editorFields, setEditorFields] = useState<PageEditorFields>(emptyPageEditorFields());
  const [directAnswer, setDirectAnswer] = useState("");
  const [reviewStatus, setReviewStatus] = useState<"draft" | "reviewed">("draft");
  const [reviewedAt, setReviewedAt] = useState("");
  const [sourceRefs, setSourceRefs] = useState<GeoSourceId[]>([]);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [savedFingerprint, setSavedFingerprint] = useState("");

  const selected = view?.locales.find((item) => item.locale === selectedLocale) ?? view?.locales[0];
  const definition = view?.definitions.find((item) => item.pageId === selectedPage) ?? view?.definitions[0];
  const revision = view?.pages.find((page) => page.pageId === definition?.pageId && page.locale === selected?.locale);
  const chain = useMemo(() => view && selected ? fallbackChain(view, selected.locale) : [], [view, selected]);
  const canPublish = writeMode === "full";
  const publicationBlockers = publication?.blockers ?? [];
  // The single owner does not need to retype deployment/audit fields. Keep
  // the command contract populated internally so the API retains its safety
  // checks without making routine publishing a form-filling exercise.
  const publishConfirmation = publication?.deployment ?? "";
  const publishReady = canPublishSnapshot({ writeMode, publication, confirmation: publishConfirmation });
  const publishGuidance = publicationGuidance({ writeMode, publication, confirmation: publishConfirmation });
  const geoFingerprint = { directAnswer, reviewStatus, reviewedAt, sourceRefs };
  const currentFingerprint = JSON.stringify({ title, summary, editorFields, geoFingerprint });
  const dirty = Boolean(savedFingerprint && currentFingerprint !== savedFingerprint);

  useEffect(() => {
    const nextFields = editorFieldsFromContent(revision?.content);
    const nextTitle = contentTitle(revision?.content);
    const nextSummary = contentSummary(revision?.content);
    const geo = revision?.content.template === "platform" ? revision.content.geo : null;
    const nextGeo = { directAnswer: geo?.directAnswer ?? "", reviewStatus: geo?.reviewStatus ?? "draft" as const, reviewedAt: geo?.reviewedAt ?? "", sourceRefs: geo?.sourceRefs ? [...geo.sourceRefs] : [] };
    setTitle(nextTitle); setSummary(nextSummary); setEditorFields(nextFields); setDirectAnswer(nextGeo.directAnswer); setReviewStatus(nextGeo.reviewStatus); setReviewedAt(nextGeo.reviewedAt); setSourceRefs(nextGeo.sourceRefs); setFieldErrors([]); setMessage("");
    setSavedFingerprint(JSON.stringify({ title: nextTitle, summary: nextSummary, editorFields: nextFields, geoFingerprint: nextGeo }));
  // The revision key intentionally resets the editor only when the authoritative record changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision?.revision, definition?.pageId, selected?.locale]);

  if (!view) return <section className="content-management panel" id="publishing"><WarningCircle size={26}/><h2>内容模型暂不可用</h2><p>恢复 Admin API 后再编辑或发布；不会使用缓存草稿推断成功。</p></section>;

  const enabled = view.locales.filter(({ effective }) => effective.enabled);
  const geoDraft = (): GeoContent | null => {
    const answer = directAnswer.trim();
    if (!answer) return null;
    const date = reviewedAt ? new Date(reviewedAt) : null;
    return { directAnswer: answer, reviewStatus, reviewedAt: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null, sourceRefs };
  };

  const send = async (payload: unknown) => {
    try {
      const response = await fetch("/api/admin/snapshot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000) });
      setMessage(response.ok ? "操作已由权威状态确认。" : "操作未完成，请刷新版本后重试。");
      if (response.ok) onReload();
    } catch {
      setMessage("操作未完成，请检查 Admin API 后刷新重试。");
    }
  };

  const savePage = async (state: "draft" | "ready") => {
    if (!csrfToken || !definition || !selected) return;
    const localPath = revision?.seo.localPath ?? (definition.pageType === "homepage" ? "/" : `/${definition.pageId.replace("page_", "").replaceAll("_", "-")}`);
    const searchDescription = summary.length >= 40 ? summary : `${summary} TikDD 仅解析公开媒体页面，并以统一结果展示经过验证的可用格式与受控交付选项。`;
    const fallbackSeo = { localPath, searchTitle: (title.length >= 10 ? title : `${title} | TikDD`).slice(0, 70), searchDescription: searchDescription.slice(0, 180), socialTitle: null, socialDescription: null, socialImageAssetId: null, indexable: false, includeInSitemap: false, redirectFrom: [] };
    const content = mergePageContent(revision?.content, { template: definition.pageType, title, summary, geo: definition.pageType === "platform" ? geoDraft() : null, fields: editorFields });
    const parsed = AdminPageDraftCommandSchema.safeParse({ pageId: definition.pageId, locale: selected.locale, pageType: definition.pageType, platform: definition.platform, state, content, seo: preserveOrCreateSeo(revision?.seo, fallbackSeo), expectedRevision: revision?.revision ?? null, reason: "Update structured page content from the proofing desk.", confirmation: `${definition.pageId}/${selected.locale}`, idempotencyKey: crypto.randomUUID().replaceAll("-", "") });
    if (!parsed.success) { setFieldErrors(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)); setMessage("请先修正字段错误。"); return; }
    setFieldErrors([]); setMessage("保存中…"); await send({ action: "page_draft", csrfToken, command: parsed.data });
  };

  const discardPage = async () => {
    if (!csrfToken || !definition || !selected || !revision || !["draft", "ready"].includes(revision.state)) return;
    if (!window.confirm(`放弃 ${definition.pageId}/${selected.locale} 的当前草稿？已发布快照不会改变。`)) return;
    const parsed = AdminPageDiscardCommandSchema.safeParse({ pageId: definition.pageId, locale: selected.locale, expectedRevision: revision.revision, draftRevision: revision.revision, reason: "Discard the current structured content draft.", confirmation: `${definition.pageId}/${selected.locale}`, idempotencyKey: crypto.randomUUID().replaceAll("-", "") });
    if (!parsed.success) { setMessage("当前版本不可放弃，请刷新后重试。"); return; }
    setMessage("放弃草稿中…"); await send({ action: "page_discard", csrfToken, command: parsed.data });
  };

  const publish = async (action: "content_publish" | "content_rollback" | "content_retry", extra: Record<string, unknown> = {}) => {
    if (!publication || !csrfToken) return;
    setMessage("处理中…");
    const command = { deployment: publication.deployment, expectedRevision: publication.currentRevision, reason: "Owner content publish", confirmation: publication.deployment, idempotencyKey: crypto.randomUUID().replaceAll("-", ""), ...extra };
    await send({ action, csrfToken, command });
  };

  const updateSteps = (key: "howItWorksSteps" | "howToSteps", items: EditorStep[]) => updateFields(setEditorFields, key, items);
  const updateFaq = (key: "faqItems" | "platformFaqItems", items: EditorFaqItem[]) => updateFields(setEditorFields, key, items);
  const updateSections = (items: EditorSection[]) => updateFields(setEditorFields, "sections", items);

  return <section className="content-management" id="publishing">
    <header className="content-heading"><div><p className="eyebrow">CONTENT / PROOFING DESK</p><h2>结构化内容校样台</h2><p>编辑会保留当前模板的全部字段；发布时只提升一个完整不可变快照。</p></div><div className="content-score"><strong>{publication?.readyPageCount ?? 0}</strong><span>个页面草稿已就绪</span></div></header>
    <StarterContentBootstrap view={view} publication={publication} csrfToken={csrfToken} writeMode={writeMode} onReload={onReload} />
    <div className="publication-film panel"><div className="film-step ready"><span>01</span><strong>结构校验</strong><small>固定模板 · Safe Markdown</small></div><ArrowRight/><div className={`film-step ${publication && publicationBlockers.length === 0 ? "ready" : "blocked"}`}><span>02</span><strong>完整快照</strong><small>{publication ? publicationBlockers.length : "不可用"} 个阻塞</small></div><ArrowRight/><div className={`film-step state-${publication?.propagationState ?? "idle"}`} aria-live="polite"><span>03</span><strong>路径确认</strong><small>{publicationStepLabel(publication?.propagationState)}</small></div><ArrowRight/><div className="film-step"><span>04</span><strong>公共读取</strong><small>接入快照加载器</small></div></div>
    <div className="proofing-shell panel">
      <aside className="proofing-index"><div className="mini-heading"><Translate size={16}/><strong>Locale / 页面</strong></div><select value={selected?.locale} onChange={(event) => setSelectedLocale(event.target.value)}>{view.locales.map((item) => <option key={item.locale} value={item.locale}>{item.effective.displayName} · {item.locale}</option>)}</select>{view.definitions.map((item) => <button type="button" className={item.pageId === definition?.pageId ? "selected" : ""} key={item.pageId} onClick={() => setSelectedPage(item.pageId)}><FileText size={15}/><span><strong>{item.label}</strong><small>{item.pageType} · v{item.templateVersion}</small></span><b>{stateLabel[view.coverage.find((cell) => cell.pageId === item.pageId && cell.locale === selected?.locale)?.status ?? "missing"]}</b></button>)}</aside>
      <div className="proofing-workbench">
        <div className="fallback-ribbon"><span><GitBranch size={18}/></span><div><small>当前回退链</small><div>{chain.map((tag, index) => <span key={tag}><b>{tag}</b>{index < chain.length - 1 ? <ArrowRight size={13}/> : null}</span>)}</div></div><em>{selected?.effective.direction.toUpperCase()}</em></div>
        <div className="editor-preview-grid"><section className="structured-editor"><header><div><small>STRUCTURED FIELDS</small><strong>{definition?.label}</strong></div><span>{revision ? "已保存" : "新页面"}</span></header>
          <div className="editor-state-line" role="status"><span className={dirty ? "dirty-dot" : "saved-dot"} />{dirty ? "有未保存修改" : "与当前权威版本一致"}</div>
          <label>主标题<input aria-invalid={fieldErrors.some((error) => /content\.(heroTitle|title)/.test(error))} value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>摘要<textarea aria-invalid={fieldErrors.some((error) => /content\.(heroSubtitle|introduction|summary)/.test(error))} value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
          <div className="field-grid"><label>页面类型<input value={definition?.pageType ?? ""} readOnly /></label><label>本地路径<input value={revision?.seo.localPath ?? (definition?.pageType === "homepage" ? "/" : "将按定义生成")} readOnly /></label></div>
          {definition?.pageType === "homepage" ? <><div className="field-grid"><label>输入标签<input value={editorFields.inputLabel} onChange={(event) => updateFields(setEditorFields, "inputLabel", event.target.value)} /></label><label>输入占位<input value={editorFields.inputPlaceholder} onChange={(event) => updateFields(setEditorFields, "inputPlaceholder", event.target.value)} /></label></div><label>主操作按钮<input value={editorFields.primaryActionLabel} onChange={(event) => updateFields(setEditorFields, "primaryActionLabel", event.target.value)} /></label><label>平台标题<input value={editorFields.supportedPlatformsTitle} onChange={(event) => updateFields(setEditorFields, "supportedPlatformsTitle", event.target.value)} /></label><label>使用步骤标题<input value={editorFields.howItWorksTitle} onChange={(event) => updateFields(setEditorFields, "howItWorksTitle", event.target.value)} /></label><StepListEditor label="使用步骤" items={editorFields.howItWorksSteps} onChange={(items) => updateSteps("howItWorksSteps", items)} min={2} max={6} /><label>FAQ 标题<input value={editorFields.faqTitle} onChange={(event) => updateFields(setEditorFields, "faqTitle", event.target.value)} /></label><FaqListEditor label="FAQ 条目" items={editorFields.faqItems} onChange={(items) => updateFaq("faqItems", items)} min={1} max={20} /></> : null}
          {definition?.pageType === "platform" ? <><label>平台眉题<input value={editorFields.eyebrow} onChange={(event) => updateFields(setEditorFields, "eyebrow", event.target.value)} /></label><label>限制说明<textarea value={editorFields.limitationsMarkdown} onChange={(event) => updateFields(setEditorFields, "limitationsMarkdown", event.target.value)} /></label><StepListEditor label="平台使用步骤" items={editorFields.howToSteps} onChange={(items) => updateSteps("howToSteps", items)} min={2} max={8} /><FaqListEditor label="平台 FAQ" items={editorFields.platformFaqItems} onChange={(items) => updateFaq("platformFaqItems", items)} min={0} max={20} /><div className="geo-editor"><label>GEO 直接回答<textarea aria-invalid={fieldErrors.some((error) => error.includes("content.geo.directAnswer"))} value={directAnswer} onChange={(event) => setDirectAnswer(event.target.value)} placeholder="用一两句话回答用户最关心的问题。" /></label><div className="field-grid"><label>审核状态<select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value as "draft" | "reviewed")}><option value="draft">草稿</option><option value="reviewed">已审核</option></select></label><label>审核时间<input type="datetime-local" value={reviewedAt ? reviewedAt.slice(0, 16) : ""} onChange={(event) => setReviewedAt(event.target.value)} /></label></div><fieldset><legend>审核来源（只能选择代码目录）</legend>{(Object.entries(GEO_SOURCE_LABELS) as [GeoSourceId, string][]).map(([sourceId, label]) => <label key={sourceId}><input type="checkbox" checked={sourceRefs.includes(sourceId)} onChange={(event) => setSourceRefs((current) => event.target.checked ? [...current, sourceId] : current.filter((item) => item !== sourceId))} />{label}</label>)}</fieldset></div></> : null}
          {definition?.pageType === "faq" ? <FaqListEditor label="FAQ 条目" items={editorFields.faqItems} onChange={(items) => updateFaq("faqItems", items)} min={1} max={50} /> : null}
          {definition?.pageType === "guide" ? <SectionListEditor label="指南章节" items={editorFields.sections} onChange={updateSections} max={30} /> : null}
          {definition?.pageType === "legal" ? <SectionListEditor label="法律章节" items={editorFields.sections} onChange={updateSections} max={40} /> : null}
          {fieldErrors.length ? <div className="validation-summary" role="alert"><strong>请修正 {fieldErrors.length} 个字段问题</strong><ul>{fieldErrors.slice(0, 5).map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
          <div className="editor-note"><FloppyDisk size={17}/><p>字段由代码模板约束，不接受任意 HTML、远程 URL 或任意 JSON-LD。当前 SEO 路径、noindex 与社交字段会在已有页面编辑时原样保留。</p></div>
          <div className="editor-actions"><button type="button" onClick={() => void savePage("draft")}>保存草稿</button><button type="button" className="primary" onClick={() => void savePage("ready")}>保存并标记就绪</button>{revision && ["draft", "ready"].includes(revision.state) ? <button type="button" className="quiet" onClick={() => void discardPage()}><Trash size={14}/>放弃草稿</button> : null}</div>
        </section>
          <section className={`template-preview preview-${preview}`} dir={selected?.effective.direction}><header><div><small>REAL TEMPLATE PREVIEW</small><strong>{selected?.locale} · {definition?.pageType}</strong></div><div><button type="button" className={preview === "desktop" ? "active" : ""} onClick={() => setPreview("desktop")} aria-label="桌面预览"><Desktop size={16}/></button><button type="button" className={preview === "mobile" ? "active" : ""} onClick={() => setPreview("mobile")} aria-label="移动预览"><DeviceMobile size={16}/></button></div></header><div className="preview-canvas"><nav><b>Tik<span>DD</span></b><i>{selected?.effective.displayName}</i></nav><main><small>{definition?.pageType?.toUpperCase()}</small><h3>{title}</h3><p>{summary}</p>{definition?.pageType === "platform" && directAnswer.trim() ? <blockquote>{directAnswer}</blockquote> : null}<div className="preview-input"><span>{definition?.pageType === "homepage" ? editorFields.inputPlaceholder : "Structured page content"}</span><b>{definition?.pageType === "homepage" ? editorFields.primaryActionLabel : "TikDD"}</b></div></main></div></section></div>
        <div className="revision-strip"><div><small>DRAFT → PUBLISHED DIFF</small><strong>{publication?.diff.length ?? 0} 个变更 · {publication?.affectedPaths.length ?? 0} 条受影响路径</strong></div><div className="diff-list">{publication?.diff.slice(0, 4).map((item) => <span key={item.targetId}><b>{item.change}</b>{item.targetId}</span>)}{!publication?.diff.length ? <span>没有待发布差异</span> : null}</div></div>
        <div className="publication-command"><div className="publication-owner-note"><strong>单人运营模式</strong><p>发布会自动使用当前部署的安全校验；无需填写理由或部署 ID。后端仍保留版本与幂等保护。</p></div><div className="publish-summary"><p id="publication-publish-help" role="status">{publishGuidance}</p><div className="command-actions"><button type="button" className="primary" aria-describedby="publication-publish-help" disabled={!publishReady} onClick={() => void publish("content_publish")}><PaperPlaneTilt size={15}/>发布快照</button>{canPublish && publication?.propagationState === "propagation_failed" && publication.pendingSnapshotId ? <button type="button" onClick={() => void publish("content_retry", { snapshotId: publication.pendingSnapshotId })}>重试确认</button> : null}{canPublish && publication?.rollbackCandidates[1] ? <button type="button" className="quiet" onClick={() => void publish("content_rollback", { targetRevision: publication.rollbackCandidates[1]!.revision })}>回滚到 r{publication.rollbackCandidates[1]!.revision}</button> : null}</div>{message ? <span className="command-message">{message}</span> : null}</div></div>
      </div>
    </div>
    <div className="coverage-matrix compact-matrix"><table><thead><tr><th>代码模板</th>{enabled.map((item) => <th key={item.locale}>{item.locale}</th>)}</tr></thead><tbody>{view.definitions.slice(0, 8).map((item) => <tr key={item.pageId}><th><strong>{item.label}</strong></th>{enabled.map((locale) => { const cell = view.coverage.find((candidate) => candidate.pageId === item.pageId && candidate.locale === locale.locale); return <td key={locale.locale}><span className={`matrix-cell state-${cell?.status ?? "missing"}`}>{["ready", "published"].includes(cell?.status ?? "") ? <CheckCircle size={16}/> : cell?.status === "fallback" ? <GitBranch size={15}/> : <WarningCircle size={15}/>}<b>{stateLabel[cell?.status ?? "missing"]}</b></span></td>; })}</tr>)}</tbody></table></div>
  </section>;
}
