"use client";

import type { AdminQualificationStage, AdminQualificationView } from "@tikdd/admin-contracts";
import { CheckCircle, LockKey, ShieldWarning, XCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

const stages:readonly AdminQualificationStage[]=["candidate","fixture-ready","canary-ready","internal","limited","stable"];
const key=()=>crypto.randomUUID().replaceAll("-","");

export function QualificationWorkbench({view,csrfToken,onComplete}:{view:AdminQualificationView|null;csrfToken:string|null;onComplete:()=>Promise<void>}){
  const [reason,setReason]=useState("");const [confirmation,setConfirmation]=useState("");const [approvalReference,setApprovalReference]=useState("");
  const [state,setState]=useState<"idle"|"submitting"|"succeeded"|"failed">("idle");const [message,setMessage]=useState("");
  const scope=view?`${view.tuple.providerId}/${view.tuple.platform}/${view.tuple.region}`:"";
  useEffect(()=>{setReason("");setConfirmation("");setApprovalReference("");setState("idle");setMessage("");},[scope,view?.state.revision]);
  if(!view||!csrfToken)return <section className="qualification-workbench panel"><strong>Qualification controls unavailable</strong><p>No authoritative exact-route projection or CSRF capability was returned. All qualification writes remain closed.</p></section>;
  const data=view;const currentIndex=stages.indexOf(data.state.stage);const next=stages[currentIndex+1]??null;const confirmed=confirmation===scope&&reason.trim().length>0&&state!=="submitting";
  async function submit(action:"qualification_review"|"qualification_lock",command:unknown){setState("submitting");setMessage("");try{const response=await fetch("/api/admin/snapshot",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,csrfToken,command}),signal:AbortSignal.timeout(10_000)});if(!response.ok)throw new Error();setState("succeeded");setMessage("Authoritative receipt accepted. Reloaded the current qualification revision.");await onComplete();}catch{setState("failed");setMessage("Command rejected. No traffic grant was created; reload the current revision and prerequisites.");}}
  function review(decision:"approve"|"hold"|"deny"){
    if(!confirmed)return;const targetStage=decision==="approve"?next:data.state.stage;if(!targetStage)return;
    void submit("qualification_review",{providerId:data.tuple.providerId,platform:data.tuple.platform,region:data.tuple.region,
      expectedRevision:data.state.revision,decision,targetStage,approvalReference:decision==="approve"?approvalReference.trim():null,
      reason:reason.trim(),confirmation,idempotencyKey:key()});
  }
  function lock(){if(!confirmed||!data.proposal)return;void submit("qualification_lock",{providerId:data.tuple.providerId,platform:data.tuple.platform,
    region:data.tuple.region,expectedRevision:data.state.revision,proposalId:data.proposal.proposalId,expectedProposalRevision:data.proposal.revision,
    reason:reason.trim(),confirmation,idempotencyKey:key()});}
  return <section className="qualification-workbench panel" id="qualification" aria-labelledby="qualification-title">
    <header><div><p className="eyebrow">QUALIFY / EXACT ROUTE</p><h3 id="qualification-title">Provider qualification</h3><span>{scope} · revision {view.state.revision??"not reviewed"}</span></div><b className={view.state.paused?"qualification-paused":"qualification-active"}>{view.state.stage} · {view.state.paused?"paused":"approved"}</b></header>
    <div className="qualification-grid">
      <section><h4>Prerequisites</h4>{view.prerequisites.map(item=><article key={item.code}>{item.satisfied?<CheckCircle weight="fill"/>:<XCircle weight="fill"/>}<span><strong>{item.code.replaceAll("_"," ")}</strong><small>{item.detail}</small></span></article>)}</section>
      <section><h4>Three-day calibration</h4>{view.calibration.days.length?view.calibration.days.map(day=><article key={day.utcDay}><span><strong>{day.utcDay} · r{day.revision}</strong><small>{day.completeness} · {day.distinctSamples} samples · resolution {(day.resolutionSuccessBps/100).toFixed(0)}% · delivery {(day.deliverySuccessBps/100).toFixed(0)}%</small></span></article>):<p>No internal calibration days are available.</p>}<footer>{view.calibration.complete?"Exact sealed provenance is complete.":"Calibration cannot be inferred from elapsed time."}</footer></section>
      <section><h4>Policy, guard, and allocation</h4><dl><dt>Proposal</dt><dd>{view.proposal?`${view.proposal.status} · r${view.proposal.revision}`:"none"}</dd><dt>Locked policy</dt><dd>{view.lockedPolicy?`${view.lockedPolicy.id} v${view.lockedPolicy.version}`:"none"}</dd><dt>Restrictive guard</dt><dd>{view.guard?`${view.guard.action} · ${view.guard.reason} · cap ${(view.guard.capBps/100).toFixed(0)}%`:"not available"}</dd><dt>Current rollout</dt><dd>{(view.rollout.allocationBps/100).toFixed(0)}% · effective cap {(view.eligibility.effectiveAllocationCapBps/100).toFixed(0)}%</dd></dl>{view.eligibility.blockers.length?<ul>{view.eligibility.blockers.map(blocker=><li key={blocker}>{blocker}</li>)}</ul>:<p>All current promotion prerequisites are satisfied.</p>}</section>
    </div>
    <div className="qualification-command"><label>Bounded owner reason<textarea maxLength={500} value={reason} onChange={event=>setReason(event.target.value)}/></label><label>Approval reference<input maxLength={160} value={approvalReference} onChange={event=>setApprovalReference(event.target.value)} placeholder="Required only for approval"/></label><label>Type <code>{scope}</code> to confirm<input value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off"/></label>
      <div className="qualification-actions"><button disabled={!confirmed||!view.proposal||view.proposal.status!=="proposed"||!view.calibration.complete} onClick={lock}><LockKey/>Lock reviewed policy</button><button disabled={!confirmed||!next||!approvalReference.trim()} onClick={()=>review("approve")}><CheckCircle/>Approve next stage{next?` (${next})`:""}</button><button disabled={!confirmed} onClick={()=>review("hold")}><ShieldWarning/>Hold</button><button className="danger" disabled={!confirmed} onClick={()=>review("deny")}><XCircle/>Deny</button></div>
      <p>Qualification approval never creates or increases a rollout grant. Hold and deny preserve the current stage and remain restrictive.</p>{message?<div className={`command-message ${state}`}>{message}</div>:null}</div>
  </section>;
}
