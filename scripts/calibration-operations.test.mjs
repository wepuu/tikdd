import { describe, expect, it } from "vitest";
import { assertExecutionState, evaluateCalibrationPreflight, parseCalibrationAuthorization, sha256 } from "./calibration-operations-core.mjs";

const source = "https://x.com/example/status/1234567890123456789";
const authorization = {
  schemaVersion:1,status:"authorized",authorizationId:"auth.x.nl.internal.0001",
  scope:{providerId:"ssstwitter",platform:"x",region:"nl",observationClass:"internal"},
  operatorCohortId:"owner.team.001",sourceSha256:sha256(source),releaseSha:"a".repeat(40),qualificationRevision:7,
  startsAt:"2026-09-10T00:00:00.000Z",endsAt:"2026-09-13T00:00:00.000Z",taskLimit:9,cadenceMs:300000,
  maximumConcurrency:1,emergencyStopOwner:"owner.stop.001",approvedAt:"2026-09-09T12:00:00.000Z"
};
const snapshot = {
  schemaVersion:1,capturedAt:"2026-09-10T00:01:00.000Z",releaseSha:"a".repeat(40),deploymentId:"tikdd",
  publicRuntime:{providerFlagsEnabled:false,rolloutEnabled:false,adminRunning:false},
  operationalServices:["canary","evidence","cleanup"].map(service=>({service,ready:true,freshness:"fresh",lastFinishedAt:"2026-09-10T00:00:30.000Z"})),
  canary:{canaryId:"ssstwitter-x-recurring-001",providerId:"ssstwitter",platform:"x",region:"canary-global",succeeded:true,fresh:true},
  circuit:{providerId:"ssstwitter",platform:"x",region:"nl",state:"closed",fresh:true,insufficientData:false},
  qualification:{providerId:"ssstwitter",platform:"x",region:"nl",stage:"internal",paused:true,revision:7},
  rollout:{effectiveAllocationBps:0,conflictingGrantCount:0,guardAction:"hold"},
  queues:{publicWaiting:0,publicActive:0,internalWaiting:0,internalActive:0},
  calibrationServices:{apiRunning:false,workerRunning:false},emergencyDeny:{available:true,propagationMs:4000}
};
const now = new Date("2026-09-10T00:01:30.000Z");

describe("X-GATE-03 calibration operations",()=>{
  it("accepts only the exact bounded authorization and current safe snapshot",()=>{
    expect(parseCalibrationAuthorization(authorization).scope).toEqual(authorization.scope);
    const report=evaluateCalibrationPreflight({authorization,snapshot,now});
    expect(report.decision).toBe("ready"); expect(report.blockers).toEqual([]);
  });
  it.each([
    ["wrong scope",{...authorization,scope:{...authorization.scope,region:"global"}},snapshot,"scope"],
    ["non-UTC window",{...authorization,startsAt:"2026-09-10T01:00:00.000Z",endsAt:"2026-09-13T01:00:00.000Z"},snapshot,"three sealed UTC"],
    ["stale WI17",authorization,{...snapshot,operationalServices:snapshot.operationalServices.map(x=>x.service==="evidence"?{...x,freshness:"stale",ready:false}:x)},"wi17"],
    ["public rollout",authorization,{...snapshot,publicRuntime:{...snapshot.publicRuntime,rolloutEnabled:true}},"public_runtime"],
    ["open circuit",authorization,{...snapshot,circuit:{...snapshot.circuit,state:"open"}},"circuit"],
    ["queue backlog",authorization,{...snapshot,queues:{...snapshot.queues,internalWaiting:1}},"queues"],
    ["running profile",authorization,{...snapshot,calibrationServices:{apiRunning:true,workerRunning:false}},"services"]
    ,["stale snapshot",authorization,{...snapshot,capturedAt:"2026-09-10T00:00:00.000Z"},"snapshot_freshness"]
    ,["wrong release",authorization,{...snapshot,releaseSha:"b".repeat(40)},"release"]
    ,["failed canary",authorization,{...snapshot,canary:{...snapshot.canary,succeeded:false}},"canary"]
    ,["wrong qualification revision",authorization,{...snapshot,qualification:{...snapshot.qualification,revision:8}},"qualification"]
    ,["conflicting rollout grant",authorization,{...snapshot,rollout:{...snapshot.rollout,conflictingGrantCount:1}},"rollout"]
    ,["slow emergency deny",authorization,{...snapshot,emergencyDeny:{available:true,propagationMs:16000}},"emergency_deny"]
  ])("fails closed for %s",(_label,auth,current,expected)=>{
    if(expected==="scope"||expected==="three sealed UTC") expect(()=>evaluateCalibrationPreflight({authorization:auth,snapshot:current,now})).toThrow(new RegExp(expected));
    else expect(evaluateCalibrationPreflight({authorization:auth,snapshot:current,now}).blockers.map(x=>x.id)).toContain(expected);
  });
  it("rejects malformed nested snapshot values before evaluating policy",()=>{
    expect(()=>evaluateCalibrationPreflight({authorization,snapshot:{...snapshot,rollout:{...snapshot.rollout,guardAction:null}},now})).toThrow(/action/);
    expect(()=>evaluateCalibrationPreflight({authorization,snapshot:{...snapshot,operationalServices:[...snapshot.operationalServices.slice(0,2),snapshot.operationalServices[0]]},now})).toThrow(/snapshot/);
  });
  it("binds submissions to source hash, cadence, cap, and active state",()=>{
    const state={schemaVersion:1,authorizationId:authorization.authorizationId,authorizationDigest:sha256(JSON.stringify(authorization)),releaseSha:authorization.releaseSha,startedAt:"2026-09-10T00:00:00.000Z",stoppedAt:null,submittedTaskIds:[],lastSubmittedAt:null};
    expect(assertExecutionState({authorization,state,now,sourceUrl:source}).authorizationId).toBe(authorization.authorizationId);
    expect(()=>assertExecutionState({authorization,state,now,sourceUrl:"https://x.com/other/status/1"})).toThrow(/SHA-256/);
    expect(()=>assertExecutionState({authorization,state:{...state,lastSubmittedAt:"2026-09-10T00:00:00.000Z"},now:new Date("2026-09-10T00:01:00.000Z"),sourceUrl:source})).toThrow(/cadence/);
    expect(()=>assertExecutionState({authorization,state:{...state,submittedTaskIds:Array(9).fill("tsk_"+"1".repeat(32))},now,sourceUrl:source})).toThrow(/limit/);
    expect(()=>assertExecutionState({authorization,state:{...state,stoppedAt:now.toISOString()},now,sourceUrl:source})).toThrow(/not active/);
    expect(()=>assertExecutionState({authorization,state:{...state,authorizationDigest:"0".repeat(64)},now,sourceUrl:source})).toThrow(/does not match/);
    expect(()=>assertExecutionState({authorization,state:{...state,submittedTaskIds:["not-a-task"]},now,sourceUrl:source})).toThrow(/ledger/);
  });
});
