import { resolve } from "node:path";

function validPid(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function normalizePath(value) {
  return value.replaceAll("\\", "/").toLowerCase();
}

function normalizeWorkspaceRoot(value) {
  const normalized = normalizePath(value).replace(/\/+$/, "");
  return /^[a-z]:\//.test(normalized)
    ? normalized
    : normalizePath(resolve(value)).replace(/\/+$/, "");
}

export function isTikddAdminProcess(commandLine, root, id) {
  if (!commandLine) return false;
  const normalized = normalizePath(commandLine);
  const workspace = `${normalizeWorkspaceRoot(root)}/`;
  if (!normalized.includes(workspace)) return false;
  return id === "admin-api"
    ? normalized.includes("apps/admin-api") && normalized.includes("server.ts")
    : id === "admin"
      ? normalized.includes("apps/admin") && normalized.includes("next")
      : false;
}

export function createAdminStopPlan({ root, state, healthById, portPids, commandLines }) {
  if (!state) return { targets: [], verifiedServices: [], buildMatches: [] };
  if (normalizeWorkspaceRoot(state.root) !== normalizeWorkspaceRoot(root)) throw new Error("Refusing to stop an unowned Admin stack.");

  const targets = new Set();
  const verifiedServices = new Set();
  const buildMatches = [];
  for (const item of state.processes ?? []) {
    const health = healthById[item.id] ?? null;
    const currentPortPid = validPid(portPids[item.id]);
    const servicePid = validPid(item.servicePid);
    const launcherPid = validPid(item.launcherPid);
    const buildMatchesService = health?.buildId === state.buildId;
    buildMatches.push({ id: item.id, matches: buildMatchesService });

    if (buildMatchesService && currentPortPid) {
      targets.add(currentPortPid);
      verifiedServices.add(item.id);
    } else if (servicePid && currentPortPid === servicePid && isTikddAdminProcess(commandLines[servicePid] ?? "", root, item.id)) {
      targets.add(servicePid);
      verifiedServices.add(item.id);
    }

    if (launcherPid && isTikddAdminProcess(commandLines[launcherPid] ?? "", root, item.id)) {
      targets.add(launcherPid);
    }
  }
  return { targets: [...targets], verifiedServices: [...verifiedServices], buildMatches };
}

export async function waitForAdminStop({ targets, alive, buildStillRunning, delay, attempts = 50 }) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const remaining = targets.filter((pid) => alive(pid));
    if (remaining.length === 0 && !(await buildStillRunning())) return true;
    await delay();
  }
  return false;
}
