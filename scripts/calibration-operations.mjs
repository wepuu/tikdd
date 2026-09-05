#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { assertExecutionState, evaluateCalibrationPreflight, parseCalibrationAuthorization, parseCalibrationRuntimeState, sha256 } from "./calibration-operations-core.mjs";

function fail(message, code = 78) { process.stderr.write(`calibration-operations: ${message}\n`); process.exit(code); }
function arg(name, required = true) { const index = process.argv.indexOf(`--${name}`); const value = index >= 0 ? process.argv[index + 1] : undefined; if (required && (!value || value.startsWith("--"))) fail(`--${name} is required`, 64); return value; }
function json(path) { return JSON.parse(readFileSync(resolve(path), "utf8")); }
function atomicJson(path, value) { const target = resolve(path); mkdirSync(dirname(target), { recursive: true, mode: 0o700 }); const temporary = `${target}.${process.pid}.tmp`; writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" }); chmodSync(temporary, 0o600); renameSync(temporary, target); }

const command = process.argv[2];
const authorizationPath = arg("authorization"); const authorization = parseCalibrationAuthorization(json(authorizationPath));
const stateDir = resolve(arg("state-dir", false) ?? ".tikdd-calibration-runtime");
if (dirname(stateDir) === stateDir) fail("--state-dir must not be a filesystem root", 64);
const statePath = resolve(stateDir, `${authorization.authorizationId}.json`);
const lockPath = resolve(stateDir, `${authorization.authorizationId}.lock`);
const releaseEnv = resolve(arg("release-env", false) ?? "deploy/production.env");
const composeFile = resolve(arg("compose-file", false) ?? "compose.production.yml");
const docker = process.env.TIKDD_DOCKER_BIN ?? "docker";
const composeArgs = ["compose", "--env-file", releaseEnv, "-f", composeFile, "--profile", "calibration"];
const executionEnv = { ...process.env, TIKDD_CALIBRATION_AUTHORIZATION_ID: authorization.authorizationId, TIKDD_CALIBRATION_WINDOW_STARTS_AT: authorization.startsAt, TIKDD_CALIBRATION_WINDOW_ENDS_AT: authorization.endsAt, TIKDD_CALIBRATION_ENABLE_SSSTWITTER_PROVIDER: "true", TIKDD_CALIBRATION_SSSTWITTER_TERMS_APPROVED: "true", TIKDD_CALIBRATION_SSSTWITTER_DELIVERY_AUDIT_APPROVED: "true", TIKDD_CALIBRATION_ROLLOUT_ENABLED: "true" };
function run(args, options = {}) { return execFileSync(docker, [...composeArgs, ...args], { encoding: "utf8", env: executionEnv, stdio: options.input === undefined ? ["ignore","pipe","pipe"] : ["pipe","pipe","pipe"], ...options }); }
function executeGuard() { if (process.env.TIKDD_CALIBRATION_EXECUTE !== authorization.authorizationId) fail("set TIKDD_CALIBRATION_EXECUTE to the exact authorization ID", 77); }
function readState() { if (!existsSync(statePath)) fail("calibration state is missing"); return parseCalibrationRuntimeState({ authorization, state:json(statePath) }); }
function withLock(callback) { mkdirSync(stateDir,{recursive:true,mode:0o700}); let descriptor; let acquired=false; try { descriptor=openSync(lockPath,"wx",0o600); acquired=true; closeSync(descriptor); descriptor=undefined; return callback(); } catch(error) { if(descriptor!==undefined) closeSync(descriptor); if(error?.code==="EEXIST") fail("another calibration operation holds the authorization lock",75); throw error; } finally { if(acquired&&existsSync(lockPath)) unlinkSync(lockPath); } }

if (command === "preflight") {
  const report = evaluateCalibrationPreflight({ authorization, snapshot: json(arg("snapshot")) });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.decision !== "ready") process.exit(2);
  atomicJson(resolve(stateDir, `${authorization.authorizationId}.preflight.json`), report);
} else if (command === "start") {
  executeGuard(); withLock(()=>{ const snapshot = json(arg("snapshot")); const report = evaluateCalibrationPreflight({ authorization, snapshot });
  if (report.decision !== "ready") fail(`preflight blocked: ${report.blockers.map((item) => item.id).join(",")}`);
  if (existsSync(statePath)) fail("calibration authorization already has runtime state and cannot be restarted", 77);
  const signals = { postgresReady:true, redisReady:true, providerEgressReady:true, cleanupLastSucceededAt:snapshot.operationalServices.find((x)=>x.service==="cleanup").lastFinishedAt, evidenceLastSucceededAt:snapshot.operationalServices.find((x)=>x.service==="evidence").lastFinishedAt, emergencyDenyPropagationMs:snapshot.emergencyDeny.propagationMs, workerRestartFailClosed:true, deliveryExpiryFailClosed:true, manualRecoveryRequired:true };
  executionEnv.TIKDD_INTERNAL_PREFLIGHT_SIGNALS_JSON = JSON.stringify(signals);
  for (const role of ["api","worker"]) { const path=resolve(stateDir,`calibration-${role}.attestation`); if(existsSync(path)) unlinkSync(path); }
  executionEnv.TIKDD_RUNTIME_DIR = stateDir;
  run(["run","--rm","-e",`TIKDD_INTERNAL_PREFLIGHT_SIGNALS_JSON=${executionEnv.TIKDD_INTERNAL_PREFLIGHT_SIGNALS_JSON}`,"calibration-api-preflight"]);
  run(["run","--rm","-e",`TIKDD_INTERNAL_PREFLIGHT_SIGNALS_JSON=${executionEnv.TIKDD_INTERNAL_PREFLIGHT_SIGNALS_JSON}`,"calibration-worker-preflight"]);
  run(["up","-d","--wait","calibration-api","calibration-worker"]);
  atomicJson(statePath, { schemaVersion:1, authorizationId:authorization.authorizationId, authorizationDigest:sha256(JSON.stringify(authorization)), releaseSha:authorization.releaseSha, startedAt:new Date().toISOString(), stoppedAt:null, submittedTaskIds:[], lastSubmittedAt:null });
  process.stdout.write(`${JSON.stringify({ event:"calibration_started", authorizationId:authorization.authorizationId })}\n`);
  });
} else if (command === "submit") {
  executeGuard(); withLock(()=>{ const state = readState(); const source = readFileSync(resolve(arg("url-file")), "utf8").trim(); assertExecutionState({ authorization, state, sourceUrl:source });
  const program = "let d='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>d+=c);process.stdin.on('end',async()=>{const r=await fetch('http://127.0.0.1:4000/v1/resolve-tasks',{method:'POST',headers:{'content-type':'application/json','idempotency-key':process.argv[1]},body:JSON.stringify({url:d.trim(),confirmedRights:true})});const b=await r.text();if(!r.ok){process.stderr.write('submission failed '+r.status);process.exit(1)};const x=JSON.parse(b);process.stdout.write(JSON.stringify({taskId:x.id,status:x.status}))})";
  const key = `cal-${sha256(`${authorization.authorizationId}\0${state.submittedTaskIds.length + 1}`).slice(0,48)}`; const output = run(["exec","-T","calibration-api","node","-e",program,key], { input:source }); const response=JSON.parse(output);
  if(!/^tsk_[a-f0-9]{32}$/.test(response.taskId)) fail("calibration API returned an invalid task ID"); state.submittedTaskIds.push(response.taskId); state.lastSubmittedAt=new Date().toISOString(); atomicJson(statePath,state);
  process.stdout.write(`${JSON.stringify({ event:"calibration_task_submitted", taskId:response.taskId, submitted:state.submittedTaskIds.length, limit:authorization.taskLimit })}\n`);
  });
} else if (command === "status") {
  const state = existsSync(statePath) ? readState() : null; let services=[]; try { services=run(["ps","--format","json","calibration-api","calibration-worker"]).trim().split(/\r?\n/).filter(Boolean).map(line=>{const value=JSON.parse(line);return {service:value.Service,state:value.State,health:value.Health??null};}); } catch {}
  process.stdout.write(`${JSON.stringify({ authorizationId:authorization.authorizationId, active:Boolean(state?.startedAt&&!state?.stoppedAt), submitted:state?.submittedTaskIds?.length??0, taskLimit:authorization.taskLimit, windowEndsAt:authorization.endsAt, services }, null, 2)}\n`);
} else if (command === "stop") {
  executeGuard(); const actor=arg("actor"); if(actor!==authorization.emergencyStopOwner && actor!==authorization.operatorCohortId) fail("stop actor is not authorized",77); withLock(()=>{ const state=existsSync(statePath)?json(statePath):{schemaVersion:1,authorizationId:authorization.authorizationId,authorizationDigest:sha256(JSON.stringify(authorization)),releaseSha:authorization.releaseSha,startedAt:null,stoppedAt:null,submittedTaskIds:[],lastSubmittedAt:null};
  run(["stop","-t","45","calibration-worker","calibration-api"]); for (const role of ["api","worker"]) { const path=resolve(stateDir,`calibration-${role}.attestation`); if(existsSync(path)) unlinkSync(path); }
  const submittedTaskIds=state?.authorizationId===authorization.authorizationId&&Array.isArray(state.submittedTaskIds)&&state.submittedTaskIds.every((taskId)=>/^tsk_[a-f0-9]{32}$/.test(taskId))?state.submittedTaskIds:[];
  const stoppedState={schemaVersion:1,authorizationId:authorization.authorizationId,authorizationDigest:sha256(JSON.stringify(authorization)),releaseSha:authorization.releaseSha,startedAt:typeof state?.startedAt==="string"?state.startedAt:null,stoppedAt:new Date().toISOString(),submittedTaskIds,lastSubmittedAt:typeof state?.lastSubmittedAt==="string"?state.lastSubmittedAt:null,stopActor:actor}; atomicJson(statePath,stoppedState); process.stdout.write(`${JSON.stringify({event:"calibration_stopped",authorizationId:authorization.authorizationId,submitted:submittedTaskIds.length})}\n`);
  });
} else fail("usage: calibration-operations.mjs {preflight|start|submit|status|stop} --authorization <file>",64);
