"use client";

import type { AdminRouteSummary } from "@tikdd/admin-contracts";
import { useEffect, useMemo, useState } from "react";
import type { AdminConsoleSnapshot } from "../lib/console-contract";

type CommandState="idle"|"submitting"|"succeeded"|"failed";

function idempotencyKey(){return crypto.randomUUID().replaceAll("-","");}

export function RoutePolicyControl({snapshot,summary,onComplete}:{snapshot:AdminConsoleSnapshot;summary:AdminRouteSummary|null;onComplete:()=>Promise<void>}){
  const control=snapshot.controls.status==="ready"?snapshot.controls.data:null;
  const policy=control?.routePolicy??null;
  const active=policy?.draft??policy?.published;
  const [order,setOrder]=useState<string[]>([]);const [allocations,setAllocations]=useState<Record<string,number>>({});
  const [trafficShares,setTrafficShares]=useState<Record<string,number>>({});
  const [caps,setCaps]=useState<Record<string,string>>({});const [reason,setReason]=useState("");const [confirmation,setConfirmation]=useState("");
  const [safetyConfirmation,setSafetyConfirmation]=useState("");
  const [state,setState]=useState<CommandState>("idle");const [message,setMessage]=useState("");
  const revisionKey=`${policy?.platform}:${policy?.region}:${policy?.headRevision}:${policy?.draft?.revision}`;
  useEffect(()=>{if(!policy)return;setOrder(active?.orderedProviderIds.length?active.orderedProviderIds:policy.baselineProviderIds);
    setAllocations(Object.fromEntries(policy.baselineProviderIds.map((id)=>{
      const staged=active?.stagedAllocations.find(({providerId})=>providerId===id)?.allocationBps;
      const observed=snapshot.routes.status==="ready"?snapshot.routes.data.routes.find(({tuple})=>tuple.providerId===id&&tuple.platform===policy.platform&&tuple.region===policy.region)?.allocationBps:undefined;
      return [id,staged??observed??0];
    })));
    setTrafficShares(Object.fromEntries(policy.baselineProviderIds.map((id)=>[id,active?.trafficShares.find(({providerId})=>providerId===id)?.shareBps??0])));
    setCaps(Object.fromEntries(active?.concurrencyCaps.map(({providerId,limit})=>[providerId,String(limit)])??[]));setReason("");setConfirmation("");setSafetyConfirmation("");setState("idle");setMessage("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[revisionKey]);
  const exactScope=policy?`${policy.platform}/${policy.region}`:"";
  const propagationLabel=policy?.draft?"草稿未发布":!policy?.published?"Manifest 基线":policy.propagation.state==="propagated"?"已传播":policy.propagation.state==="propagating"?"传播中":policy.propagation.state==="propagation_failed"?"传播失败":"待处理";
  const trafficShareTotal=order.reduce((total,id)=>total+(trafficShares[id]??0),0);
  const trafficSharesValid=trafficShareTotal===0||trafficShareTotal===10_000;
  const canSubmit=Boolean(policy&&reason.trim()&&confirmation===exactScope&&trafficSharesValid&&state!=="submitting");
  const effective=useMemo(()=>policy?[...order,...policy.baselineProviderIds.filter((id)=>!order.includes(id))]:[],[order,policy]);

  function move(id:string,direction:-1|1){setOrder((current)=>{const next=[...current];const index=next.indexOf(id);const target=index+direction;if(index<0||target<0||target>=next.length)return current;[next[index],next[target]]=[next[target]!,next[index]!];return next;});}
  async function command(action:"draft"|"publish"|"discard"|"rollback"){
    if(!policy||!control||!canSubmit)return;setState("submitting");setMessage("");
    const base={platform:policy.platform,region:policy.region,expectedRevision:policy.headRevision,reason:reason.trim(),confirmation,idempotencyKey:idempotencyKey()};
    const payload=action==="draft"?{...base,orderedProviderIds:order,
      stagedAllocations:policy.baselineProviderIds.map((providerId)=>({providerId,allocationBps:allocations[providerId]??0})),
      trafficShares:order.map((providerId)=>({providerId,shareBps:trafficShares[providerId]??0})).filter(({shareBps})=>shareBps>0),
      concurrencyCaps:Object.entries(caps).filter(([,value])=>value!=="").map(([providerId,value])=>({providerId,limit:Number(value)}))}
      :action==="publish"||action==="discard"?{...base,expectedRevision:policy.headRevision!,draftRevision:policy.draft!.revision}
      :{...base,expectedRevision:policy.headRevision!,targetRevision:policy.published!.previousRevision!};
    try{const response=await fetch("/api/admin/snapshot",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,csrfToken:control.csrf.csrfToken,command:payload}),signal:AbortSignal.timeout(10_000)});
      const result=await response.json() as {state?:string};if(!response.ok)throw new Error();setState("succeeded");setMessage(result.state==="propagated"?"命令已落库并完成运行时传播。":"命令已受理，请刷新查看传播状态。");await onComplete();
    }catch{setState("failed");setMessage("命令被拒绝或发生版本冲突。当前运行策略没有被静默覆盖，请刷新后重试。");}
  }
  async function routeAction(action:"pause"|"emergency_deny"|"resume"|"probe"){
    const exact=summary?`${summary.tuple.providerId}/${summary.tuple.platform}/${summary.tuple.region}`:"";
    if(!summary||!control||!reason.trim()||safetyConfirmation!==exact||state==="submitting")return;
    if((action==="resume"||action==="probe")&&summary.rolloutRevision===null)return;
    setState("submitting");setMessage("");const common={providerId:summary.tuple.providerId,platform:summary.tuple.platform,region:summary.tuple.region,
      expectedRolloutRevision:summary.rolloutRevision,reason:reason.trim(),confirmation:safetyConfirmation,idempotencyKey:idempotencyKey()};
    const outerAction=action==="probe"?"probe":"safety";const payload=action==="probe"?{...common,expectedRolloutRevision:summary.rolloutRevision!}:{...common,action};
    try{const response=await fetch("/api/admin/snapshot",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:outerAction,csrfToken:control.csrf.csrfToken,command:payload}),signal:AbortSignal.timeout(30_000)});if(!response.ok)throw new Error();const result=await response.json() as {state?:string};setState("succeeded");setMessage(result.state==="propagated"?"精确路线命令已验证完成。":"命令未能完成；限制状态保持不放宽。");await onComplete();}
    catch{setState("failed");setMessage("精确路线命令被拒绝或版本已变化。恢复操作没有创建新的授权。");}
  }
  if(!control||!policy)return <section className="route-policy-control unavailable"><strong>路由控制暂不可用</strong><p>观测数据仍可查看；没有 CSRF 令牌或权威策略状态时，所有写操作保持关闭。</p></section>;
  return <section className="route-policy-control" aria-labelledby="route-policy-title">
    <header><div><p className="eyebrow">CONFIGURE / GUARDED POLICY</p><h3 id="route-policy-title">Provider 路由策略</h3><span>{exactScope} · head {policy.headRevision?`r${policy.headRevision}`:"尚无策略"}</span></div>
      <span className={`propagation-badge ${policy.draft?"state-draft":`state-${policy.propagation.state}`}`}>{propagationLabel}</span></header>
    <div className="policy-comparison"><article><small>Manifest 基线</small><p>{policy.baselineProviderIds.join(" → ")||"无生产可用 Provider"}</p></article><article><small>当前已发布</small><p>{policy.published?.orderedProviderIds.join(" → ")||"沿用 Manifest"}</p></article><article><small>最终尝试顺序</small><p>{effective.join(" → ")||"无可用路线"}</p><em>{effective.map((id,index)=>`${id} 失败${effective[index+1]?` → ${effective[index+1]}`:" → 结束"}`).join(" · ")}</em></article></div>
    {policy.technicalProviderIds.length||policy.excludedProviders.length?<div className="technical-routes"><div><strong>技术验证路线</strong><span>仅解析 Provider 不参与生产顺序、分配或并发</span></div><ul>{policy.technicalProviderIds.map((id)=><li key={id}><b>{id}</b><span>可执行受控 Probe</span></li>)}</ul>{policy.excludedProviders.length?<details><summary>查看被排除路线与原因（{policy.excludedProviders.length}）</summary>{policy.excludedProviders.map((item)=><p key={item.providerId}><code>{item.providerId}</code><span>{item.reasons.map((reason)=>({disabled:"Manifest 未启用",mock:"开发 Mock",region_mismatch:"区域不匹配",resolution_only:"仅解析 / 未通过交付审计"})[reason]).join("；")}</span></p>)}</details>:null}</div>:null}
    <div className="policy-editor"><div className="policy-order"><div className="mini-heading"><strong>顺序与受控参数</strong><span>未列出的 Provider 仍按 Manifest 顺序回退</span></div>
      {order.map((id,index)=><article key={id}><span className="order-index">{index+1}</span><strong>{id}</strong><div className="order-buttons"><button type="button" onClick={()=>move(id,-1)} disabled={index===0}>上移</button><button type="button" onClick={()=>move(id,1)} disabled={index===order.length-1}>下移</button></div>
        <label>准入 %<input type="number" min="0" max="100" step="1" value={(allocations[id]??0)/100} onChange={(event)=>setAllocations({...allocations,[id]:Math.round(Number(event.target.value)*100)})}/></label>
        <label>首选流量 %<input type="number" min="0" max="100" step="1" value={(trafficShares[id]??0)/100} onChange={(event)=>setTrafficShares({...trafficShares,[id]:Math.round(Number(event.target.value)*100)})}/></label>
        <label>并发上限<input type="number" min="1" max="1000" placeholder="基线" value={caps[id]??""} onChange={(event)=>setCaps({...caps,[id]:event.target.value})}/></label></article>)}</div>
      <div className="policy-command">{!trafficSharesValid?<div className="command-message failed">首选流量份额当前合计 {(trafficShareTotal/100).toFixed(0)}%，必须为 100% 或全部留空。</div>:null}<label>变更原因<textarea maxLength={500} value={reason} onChange={(event)=>setReason(event.target.value)} placeholder="说明为什么需要调整这条精确路线"/></label>
        <label>输入 <code>{exactScope}</code> 确认<input value={confirmation} onChange={(event)=>setConfirmation(event.target.value)} autoComplete="off"/></label>
        <p>草稿不会影响流量。发布时会重新校验 Manifest、精确范围、版本与并发上限；Redis 传播未验证前不会显示成功。</p>
        <div className="command-actions"><button type="button" className="secondary" disabled={!canSubmit} onClick={()=>void command("draft")}>保存草稿</button>{policy.draft?<><button type="button" className="primary" disabled={!canSubmit} onClick={()=>void command("publish")}>发布草稿</button><button type="button" className="quiet" disabled={!canSubmit} onClick={()=>void command("discard")}>丢弃草稿</button></>:null}{policy.published?.previousRevision?<button type="button" className="quiet" disabled={!canSubmit} onClick={()=>void command("rollback")}>回滚到 r{policy.published.previousRevision}</button>:null}</div>
        {summary?<div className="safety-actions"><label>精确路线确认 <code>{summary.tuple.providerId}/{summary.tuple.platform}/{summary.tuple.region}</code><input value={safetyConfirmation} onChange={(event)=>setSafetyConfirmation(event.target.value)} autoComplete="off"/></label><div className="command-actions"><button type="button" className="danger" disabled={!reason.trim()||safetyConfirmation!==`${summary.tuple.providerId}/${summary.tuple.platform}/${summary.tuple.region}`||state==="submitting"} onClick={()=>void routeAction("pause")}>暂停路线</button><button type="button" className="danger" disabled={!reason.trim()||safetyConfirmation!==`${summary.tuple.providerId}/${summary.tuple.platform}/${summary.tuple.region}`||state==="submitting"} onClick={()=>void routeAction("emergency_deny")}>紧急拒绝</button><button type="button" className="quiet" disabled={!summary.rolloutRevision||!reason.trim()||safetyConfirmation!==`${summary.tuple.providerId}/${summary.tuple.platform}/${summary.tuple.region}`||state==="submitting"} onClick={()=>void routeAction("resume")}>恢复（不授予）</button><button type="button" className="quiet" disabled={!summary.rolloutRevision||!reason.trim()||safetyConfirmation!==`${summary.tuple.providerId}/${summary.tuple.platform}/${summary.tuple.region}`||state==="submitting"} onClick={()=>void routeAction("probe")}>运行预设探测</button></div></div>:<div className="route-safety-empty">此平台当前没有运行路线；可查看 Manifest 基线和保存收窄型策略，但精确暂停、恢复与 Probe 保持关闭。</div>}
        {message?<div className={`command-message ${state}`}>{message}</div>:null}</div></div>
  </section>;
}
