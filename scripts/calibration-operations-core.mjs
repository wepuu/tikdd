import { createHash } from "node:crypto";

const DAY_MS = 86_400_000;
const exactScope = Object.freeze({ providerId: "ssstwitter", platform: "x", region: "nl", observationClass: "internal" });
const authorizationKeys = ["schemaVersion","status","authorizationId","scope","operatorCohortId","sourceSha256","releaseSha","qualificationRevision","startsAt","endsAt","taskLimit","cadenceMs","maximumConcurrency","emergencyStopOwner","approvedAt"];

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function exactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("\0") !== [...keys].sort().join("\0")) {
    throw new Error(`${label} fields are invalid.`);
  }
}

function instant(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || Number.isNaN(Date.parse(value))) throw new Error(`${label} is invalid.`);
  return Date.parse(value);
}

export function parseCalibrationAuthorization(raw) {
  exactKeys(raw, authorizationKeys, "Calibration authorization");
  exactKeys(raw.scope, Object.keys(exactScope), "Calibration scope");
  if (raw.schemaVersion !== 1 || raw.status !== "authorized") throw new Error("Calibration authorization is not active.");
  for (const [key, expected] of Object.entries(exactScope)) if (raw.scope[key] !== expected) throw new Error("Calibration authorization scope is not exactly ssstwitter/x/nl/internal.");
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(raw.authorizationId) || !/^[A-Za-z0-9][A-Za-z0-9._:@-]{7,127}$/.test(raw.operatorCohortId) || !/^[A-Za-z0-9][A-Za-z0-9._:@-]{7,127}$/.test(raw.emergencyStopOwner)) throw new Error("Calibration authorization identities are invalid.");
  if (!/^[a-f0-9]{64}$/.test(raw.sourceSha256) || !/^[a-f0-9]{40}$/.test(raw.releaseSha)) throw new Error("Calibration authorization digests are invalid.");
  if (!Number.isInteger(raw.qualificationRevision) || raw.qualificationRevision < 1) throw new Error("Calibration qualification revision is invalid.");
  const startsAt = instant(raw.startsAt, "Calibration start"); const endsAt = instant(raw.endsAt, "Calibration end");
  if (startsAt % DAY_MS !== 0 || endsAt - startsAt !== 3 * DAY_MS) throw new Error("Calibration authorization must cover exactly three sealed UTC days.");
  if (!Number.isInteger(raw.taskLimit) || raw.taskLimit < 3 || raw.taskLimit > 144 || !Number.isInteger(raw.cadenceMs) || raw.cadenceMs < 60_000 || raw.cadenceMs > DAY_MS || raw.maximumConcurrency !== 1) throw new Error("Calibration execution bounds are invalid.");
  const approvedAt = instant(raw.approvedAt, "Calibration approval");
  if (approvedAt >= startsAt) throw new Error("Calibration approval must precede the window.");
  return structuredClone(raw);
}

export function parseCalibrationSnapshot(raw) {
  const keys = ["schemaVersion","capturedAt","releaseSha","deploymentId","publicRuntime","operationalServices","canary","circuit","qualification","rollout","queues","calibrationServices","emergencyDeny"];
  exactKeys(raw, keys, "Calibration snapshot");
  if (raw.schemaVersion !== 1 || !/^[a-f0-9]{40}$/.test(raw.releaseSha) || raw.deploymentId !== "tikdd") throw new Error("Calibration snapshot identity is invalid.");
  instant(raw.capturedAt, "Calibration snapshot time");
  exactKeys(raw.publicRuntime,["providerFlagsEnabled","rolloutEnabled","adminRunning"],"Public runtime snapshot");
  if (![raw.publicRuntime.providerFlagsEnabled,raw.publicRuntime.rolloutEnabled,raw.publicRuntime.adminRunning].every(value=>typeof value==="boolean")) throw new Error("Public runtime snapshot values are invalid.");
  if (!Array.isArray(raw.operationalServices) || raw.operationalServices.length !== 3) throw new Error("Operational service snapshot is invalid.");
  for (const service of raw.operationalServices) { exactKeys(service,["service","ready","freshness","lastFinishedAt"],"Operational service snapshot"); if(!["canary","evidence","cleanup"].includes(service.service)||typeof service.ready!=="boolean"||!["fresh","stale"].includes(service.freshness)) throw new Error("Operational service snapshot values are invalid."); instant(service.lastFinishedAt,"Operational service completion"); }
  if (new Set(raw.operationalServices.map((service) => service.service)).size !== 3) throw new Error("Operational service snapshot identities are invalid.");
  exactKeys(raw.canary,["canaryId","providerId","platform","region","succeeded","fresh"],"Canary snapshot");
  exactKeys(raw.circuit,["providerId","platform","region","state","fresh","insufficientData"],"Circuit snapshot");
  exactKeys(raw.qualification,["providerId","platform","region","stage","paused","revision"],"Qualification snapshot");
  exactKeys(raw.rollout,["effectiveAllocationBps","conflictingGrantCount","guardAction"],"Rollout snapshot");
  exactKeys(raw.queues,["publicWaiting","publicActive","internalWaiting","internalActive"],"Queue snapshot");
  exactKeys(raw.calibrationServices,["apiRunning","workerRunning"],"Calibration service snapshot");
  exactKeys(raw.emergencyDeny,["available","propagationMs"],"Emergency deny snapshot");
  if (raw.canary.canaryId !== "ssstwitter-x-recurring-001" || raw.canary.providerId !== "ssstwitter" || raw.canary.platform !== "x" || raw.canary.region !== "canary-global") throw new Error("Canary snapshot identity is invalid.");
  if (raw.circuit.providerId !== "ssstwitter" || raw.circuit.platform !== "x" || raw.circuit.region !== "nl" || !["closed","open"].includes(raw.circuit.state)) throw new Error("Circuit snapshot identity is invalid.");
  if (raw.qualification.providerId !== "ssstwitter" || raw.qualification.platform !== "x" || raw.qualification.region !== "nl" || !["candidate","internal"].includes(raw.qualification.stage)) throw new Error("Qualification snapshot identity is invalid.");
  if (!["hold","reduce"].includes(raw.rollout.guardAction)) throw new Error("Rollout snapshot action is invalid.");
  if (![raw.canary.succeeded,raw.canary.fresh,raw.circuit.fresh,raw.circuit.insufficientData,raw.qualification.paused,raw.calibrationServices.apiRunning,raw.calibrationServices.workerRunning,raw.emergencyDeny.available].every(value=>typeof value==="boolean")) throw new Error("Calibration snapshot booleans are invalid.");
  for(const value of [raw.qualification.revision,raw.rollout.effectiveAllocationBps,raw.rollout.conflictingGrantCount,raw.queues.publicWaiting,raw.queues.publicActive,raw.queues.internalWaiting,raw.queues.internalActive,raw.emergencyDeny.propagationMs]) if(!Number.isInteger(value)||value<0) throw new Error("Calibration snapshot counters are invalid.");
  return structuredClone(raw);
}

export function evaluateCalibrationPreflight({ authorization: authorizationRaw, snapshot: snapshotRaw, now = new Date() }) {
  const authorization = parseCalibrationAuthorization(authorizationRaw); const snapshot = parseCalibrationSnapshot(snapshotRaw);
  const checks = [];
  const add = (id, pass, reason) => checks.push({ id, status: pass ? "pass" : "block", reason });
  const nowMs = now.getTime(); const capturedAt = Date.parse(snapshot.capturedAt);
  add("authorization_window", nowMs >= Date.parse(authorization.startsAt) && nowMs < Date.parse(authorization.endsAt), "authorized_window_current");
  add("snapshot_freshness", nowMs >= capturedAt && nowMs - capturedAt <= 60_000, "snapshot_within_60_seconds");
  add("release", snapshot.releaseSha === authorization.releaseSha, "exact_authorized_release");
  add("public_runtime", snapshot.publicRuntime?.providerFlagsEnabled === false && snapshot.publicRuntime?.rolloutEnabled === false && snapshot.publicRuntime?.adminRunning === false, "public_provider_rollout_and_admin_disabled");
  const services = snapshot.operationalServices;
  add("wi17", Array.isArray(services) && ["canary","evidence","cleanup"].every((id) => services.some((item) => item?.service === id && item.ready === true && item.freshness === "fresh")), "scheduled_services_fresh");
  add("canary", snapshot.canary?.canaryId === "ssstwitter-x-recurring-001" && snapshot.canary?.providerId === "ssstwitter" && snapshot.canary?.platform === "x" && snapshot.canary?.region === "canary-global" && snapshot.canary?.succeeded === true && snapshot.canary?.fresh === true, "authorized_canary_fresh");
  add("circuit", snapshot.circuit?.providerId === "ssstwitter" && snapshot.circuit?.platform === "x" && snapshot.circuit?.region === "nl" && snapshot.circuit?.state === "closed" && snapshot.circuit?.fresh === true && snapshot.circuit?.insufficientData === false, "nl_circuit_closed_and_fresh");
  add("qualification", snapshot.qualification?.providerId === "ssstwitter" && snapshot.qualification?.platform === "x" && snapshot.qualification?.region === "nl" && snapshot.qualification?.revision === authorization.qualificationRevision && snapshot.qualification?.paused === true && ["candidate","internal"].includes(snapshot.qualification?.stage), "exact_paused_qualification_revision");
  add("rollout", snapshot.rollout?.effectiveAllocationBps === 0 && snapshot.rollout?.conflictingGrantCount === 0 && snapshot.rollout?.guardAction !== "reduce", "no_public_or_conflicting_grant");
  add("queues", snapshot.queues?.publicWaiting === 0 && snapshot.queues?.publicActive === 0 && snapshot.queues?.internalWaiting === 0 && snapshot.queues?.internalActive === 0, "queues_empty");
  add("services", snapshot.calibrationServices?.apiRunning === false && snapshot.calibrationServices?.workerRunning === false, "calibration_services_stopped");
  add("emergency_deny", snapshot.emergencyDeny?.available === true && Number.isInteger(snapshot.emergencyDeny?.propagationMs) && snapshot.emergencyDeny.propagationMs <= 15_000, "emergency_deny_ready");
  const blockers = checks.filter((item) => item.status === "block");
  return { schemaVersion: 1, decision: blockers.length ? "blocked" : "ready", authorizationId: authorization.authorizationId, generatedAt: now.toISOString(), authorizationDigest: sha256(JSON.stringify(authorization)), snapshotDigest: sha256(JSON.stringify(snapshot)), blockers, verified: checks.filter((item) => item.status === "pass") };
}

export function parseCalibrationRuntimeState({ authorization, state }) {
  const parsed = parseCalibrationAuthorization(authorization);
  const allowedKeys = ["schemaVersion","authorizationId","authorizationDigest","releaseSha","startedAt","stoppedAt","submittedTaskIds","lastSubmittedAt"];
  if (state?.stopActor !== undefined) allowedKeys.push("stopActor");
  exactKeys(state, allowedKeys, "Calibration runtime state");
  if (state.schemaVersion !== 1 || state.authorizationDigest !== sha256(JSON.stringify(parsed)) || state.authorizationId !== parsed.authorizationId || state.releaseSha !== parsed.releaseSha) throw new Error("Calibration runtime state does not match this authorization.");
  if (state.startedAt !== null) instant(state.startedAt, "Calibration runtime start");
  if (state.stoppedAt !== null) instant(state.stoppedAt, "Calibration runtime stop");
  if (state.lastSubmittedAt !== null) instant(state.lastSubmittedAt, "Calibration last submission");
  if (!Array.isArray(state.submittedTaskIds) || !state.submittedTaskIds.every((taskId) => /^tsk_[a-f0-9]{32}$/.test(taskId))) throw new Error("Calibration task ledger is invalid.");
  if (state.submittedTaskIds.length > parsed.taskLimit || (state.lastSubmittedAt !== null && state.startedAt === null)) throw new Error("Calibration runtime state bounds are invalid.");
  if (state.stopActor !== undefined && state.stopActor !== parsed.emergencyStopOwner && state.stopActor !== parsed.operatorCohortId) throw new Error("Calibration stop actor is invalid.");
  return structuredClone(state);
}

export function assertExecutionState({ authorization, state, now = new Date(), sourceUrl = null }) {
  const parsed = parseCalibrationAuthorization(authorization); const verifiedState = parseCalibrationRuntimeState({ authorization: parsed, state }); const nowMs = now.getTime();
  if (!verifiedState.startedAt || verifiedState.stoppedAt) throw new Error("Calibration runtime state is not active for this authorization.");
  if (nowMs < Date.parse(parsed.startsAt) || nowMs >= Date.parse(parsed.endsAt)) throw new Error("Calibration authorization window is closed.");
  if (sourceUrl !== null && sha256(sourceUrl.trim()) !== parsed.sourceSha256) throw new Error("Calibration source does not match the authorized SHA-256 digest.");
  if (verifiedState.submittedTaskIds.length >= parsed.taskLimit) throw new Error("Calibration task limit is exhausted.");
  if (verifiedState.lastSubmittedAt && nowMs - Date.parse(verifiedState.lastSubmittedAt) < parsed.cadenceMs) throw new Error("Calibration submission cadence has not elapsed.");
  return parsed;
}

export const calibrationScope = exactScope;
