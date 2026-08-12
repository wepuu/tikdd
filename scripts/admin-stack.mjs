import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createAdminStopPlan, waitForAdminStop } from "./admin-stack-core.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const runtime = join(root, ".tikdd-admin-runtime");
const statePath = join(runtime, "state.json");
const command = process.argv[2] ?? "status";

function readState() {
  return existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8").replace(/^\uFEFF/, "")) : null;
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function kill(pid) {
  if (!pid || !alive(pid)) return;
  if (process.platform === "win32") spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  else process.kill(-pid, "SIGTERM");
}

function commandLine(pid) {
  if (!pid || !alive(pid)) return "";
  if (process.platform === "win32") {
    const query = `(Get-CimInstance Win32_Process -Filter 'ProcessId=${Number(pid)}').CommandLine`;
    return spawnSync("powershell.exe", ["-NoProfile", "-Command", query], { encoding: "utf8", windowsHide: true }).stdout.trim();
  }
  try { return readFileSync(`/proc/${pid}/cmdline`, "utf8").replaceAll("\0", " "); } catch { return ""; }
}

function portPid(port) {
  if (process.platform !== "win32") return null;
  const result = spawnSync("netstat.exe", ["-ano", "-p", "TCP"], { encoding: "utf8" });
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.trim().match(/^TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)$/i);
    if (match && Number(match[1]) === port) return Number(match[2]);
  }
  return null;
}

async function health(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}

function launch(spec, environment, log) {
  return spawn(process.execPath, spec.args, {
    cwd: spec.cwd,
    env: environment,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", log, log]
  });
}

if (command === "stop") {
  const current = readState();
  if (!current) {
    process.stdout.write("TikDD Admin stack is already stopped.\n");
    process.exit(0);
  }
  const api = await health("http://127.0.0.1:4100/health/live");
  const ui = await health("http://localhost:3001/api/admin/health");
  const portPids = { admin: portPid(3001), "admin-api": portPid(4100) };
  const commandLines = Object.fromEntries((current.processes ?? []).flatMap((item) =>
    [item.launcherPid, item.servicePid].filter(Boolean).map((pid) => [pid, commandLine(pid)])));
  const verifiedByHealth = new Set((current.processes ?? []).filter((item) =>
    (item.id === "admin" ? ui : api)?.buildId === current.buildId).map(({id}) => id));
  const plan = createAdminStopPlan({ root, state: current, healthById: { admin: ui, "admin-api": api }, portPids, commandLines });
  const verifiedLaunchers = (current.processes ?? []).filter(({id}) => verifiedByHealth.has(id)).map(({launcherPid}) => launcherPid).filter(Boolean);
  const targets = [...new Set([...plan.targets, ...verifiedLaunchers])];
  for (const pid of targets.filter((pid) => !verifiedLaunchers.includes(pid)).reverse()) kill(pid);
  for (const pid of verifiedLaunchers.reverse()) kill(pid);
  const stopped = await waitForAdminStop({
    targets,
    alive,
    buildStillRunning: async () => {
      const [nextApi, nextUi] = await Promise.all([
        health("http://127.0.0.1:4100/health/live"),
        health("http://localhost:3001/api/admin/health")
      ]);
      return nextApi?.buildId === current.buildId || nextUi?.buildId === current.buildId;
    },
    delay: () => new Promise((resolveWait) => setTimeout(resolveWait, 100))
  });
  if (!stopped) throw new Error("TikDD Admin stack did not stop cleanly; state was preserved for another exact stop attempt.");
  rmSync(statePath, { force: true });
  process.stdout.write("TikDD Admin stack stopped.\n");
} else if (command === "status") {
  const current = readState();
  const api = await health("http://127.0.0.1:4100/health/live");
  const ui = await health("http://localhost:3001/api/admin/health");
  const ports = { admin: portPid(3001), adminApi: portPid(4100) };
  const versionsMatch = Boolean(current && api && ui && api.buildId === ui.buildId && api.buildId === current.buildId);
  if (versionsMatch && current.processes.every((item) => alive(item.launcherPid))) {
    for (const item of current.processes) item.servicePid = item.id === "admin" ? ports.admin : ports.adminApi;
    writeFileSync(statePath, JSON.stringify(current, null, 2));
  }
  const running = Boolean(current && api && ui
    && api.buildId === ui.buildId && api.buildId === current.buildId
    && current.processes.every((item) => alive(item.launcherPid) && alive(item.servicePid))
    && ports.admin === current.processes.find((item) => item.id === "admin")?.servicePid
    && ports.adminApi === current.processes.find((item) => item.id === "admin-api")?.servicePid);
  process.stdout.write(`${JSON.stringify({ running, buildId: current?.buildId ?? null, api, ui, ports, processes: current?.processes ?? [] }, null, 2)}\n`);
  if (!running) process.exitCode = 1;
} else if (command === "start") {
  const current = readState();
  if (current?.processes?.some((item) => alive(item.servicePid) || alive(item.launcherPid))) {
    throw new Error("TikDD Admin stack is already running. Run pnpm admin:stop first.");
  }
  const occupied = [3001, 4100].map((port) => ({ port, pid: portPid(port) })).filter((item) => item.pid);
  if (occupied.length) throw new Error(`Admin ports are occupied: ${occupied.map((item) => `${item.port} (PID ${item.pid})`).join(", ")}`);

  mkdirSync(runtime, { recursive: true });
  const buildId = `dev-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const base = {
    ...process.env,
    NODE_ENV: "development",
    ADMIN_AUTH_MODE: "password",
    ADMIN_ORIGIN: "http://localhost:3001",
    ADMIN_API_INTERNAL_ORIGIN: "http://127.0.0.1:4100",
    ADMIN_API_HOST: "127.0.0.1",
    ADMIN_API_PORT: "4100",
    ADMIN_DEPLOYMENT_ID: process.env.ADMIN_DEPLOYMENT_ID ?? "tikdd",
    ADMIN_REGION: process.env.ADMIN_REGION ?? "nl",
    WEB_ORIGIN: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    PUBLIC_CONTENT_REVALIDATION_SECRET: process.env.PUBLIC_CONTENT_REVALIDATION_SECRET ?? "development-public-content-secret-32-bytes",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://tikdd:tikdd@localhost:5432/tikdd",
    REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:16379",
    TIKDD_ADMIN_BUILD_ID: buildId,
    ADMIN_NEXT_DIST_DIR: ".next-admin-dev"
  };
  const processes = [];
  for (const spec of [
    { id: "admin-api", port: 4100, cwd: join(root, "apps", "admin-api"), args: [join(root, "node_modules", "tsx", "dist", "cli.mjs"), "src/server.ts"] },
    { id: "admin", port: 3001, cwd: join(root, "apps", "admin"), args: [join(root, "apps", "admin", "node_modules", "next", "dist", "bin", "next"), "dev", "-p", "3001"] }
  ]) {
    const logPath = join(runtime, `${spec.id}.log`);
    const log = openSync(logPath, "a");
    const child = launch(spec, base, log);
    closeSync(log);
    child.unref();
    processes.push({ id: spec.id, port: spec.port, launcherPid: child.pid, servicePid: null, logPath });
  }
  const startedAt = new Date().toISOString();
  writeFileSync(statePath, JSON.stringify({ root, buildId, startedAt, processes }, null, 2));

  for (let attempt = 0; attempt < 50; attempt++) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
    const api = await health("http://127.0.0.1:4100/health/live");
    const ui = await health("http://localhost:3001/api/admin/health");
    if (api?.buildId === buildId && ui?.buildId === buildId) {
      for (const item of processes) item.servicePid = portPid(item.port);
      if (processes.every((item) => item.servicePid)) {
        writeFileSync(statePath, JSON.stringify({ root, buildId, startedAt, processes }, null, 2));
        process.stdout.write(`TikDD Admin ready.\nURL: http://localhost:3001/login\nBuild: ${buildId}\n`);
        process.exit(0);
      }
    }
  }
  for (const item of processes.reverse()) {
    kill(portPid(item.port));
    kill(item.launcherPid);
  }
  throw new Error("Admin stack did not become ready. Inspect .tikdd-admin-runtime logs.");
} else {
  throw new Error("Use start, status, or stop.");
}
