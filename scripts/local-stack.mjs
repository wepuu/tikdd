import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import net from "node:net";
import { dirname, join, resolve } from "node:path";
import tls from "node:tls";
import { fileURLToPath } from "node:url";
import {
  LOCAL_STACK_PORTS,
  buildLocalStackProfile,
  parseEnvironmentFile,
  validateDockerServices,
  verifyProviderEgress
} from "./local-stack-core.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const runtimeDirectory = join(repositoryRoot, "tmp", "local-stack");
const statePath = join(runtimeDirectory, "state.json");
const lockPath = join(runtimeDirectory, "owner.lock");
const stopRequestPath = join(runtimeDirectory, "stop.requested");
const nextEnvironmentPath = join(repositoryRoot, "apps", "web", "next-env.d.ts");
const webUrl = "http://localhost:3000/en";
const appDefinitions = Object.freeze([
  { id: "web", packageName: "@tikdd/web" },
  { id: "api", packageName: "@tikdd/api" },
  { id: "worker", packageName: "@tikdd/worker" },
  { id: "delivery", packageName: "@tikdd/delivery" }
]);

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function pnpmInvocation(arguments_) {
  if (process.env.npm_execpath) {
    return { command: process.execPath, arguments: [process.env.npm_execpath, ...arguments_] };
  }
  return {
    command: process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    arguments: arguments_
  };
}

function runNodeScript(relativePath, arguments_, options = {}) {
  const result = spawnSync(process.execPath, [join(repositoryRoot, relativePath), ...arguments_], {
    cwd: repositoryRoot,
    env: options.environment ?? process.env,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(detail || `${relativePath} exited with code ${result.status}.`);
  }
  return result.stdout ?? "";
}

function runPnpm(arguments_, environment, capture = false) {
  const invocation = pnpmInvocation(arguments_);
  const result = spawnSync(invocation.command, invocation.arguments, {
    cwd: repositoryRoot,
    env: environment,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(detail || `pnpm ${arguments_.join(" ")} exited with code ${result.status}.`);
  }
  return result.stdout ?? "";
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeState(state) {
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8" });
}

function removeIfPresent(path) {
  if (existsSync(path)) unlinkSync(path);
}

function restoreGeneratedNextEnvironment(initialContents) {
  if (!initialContents || !existsSync(nextEnvironmentPath)) return;
  const currentContents = readFileSync(nextEnvironmentPath, "utf8");
  const generatedDevelopmentContents = initialContents.replace(
    'import "./.next/types/routes.d.ts";',
    'import "./.next/dev/types/routes.d.ts";'
  );
  if (currentContents === generatedDevelopmentContents) {
    writeFileSync(nextEnvironmentPath, initialContents, "utf8");
  }
}

function acquireOwnerLock(mode) {
  mkdirSync(runtimeDirectory, { recursive: true });
  removeIfPresent(stopRequestPath);
  let descriptor;
  try {
    descriptor = openSync(lockPath, "wx");
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(
        "A TikDD local stack is already active or needs cleanup. Run pnpm dev:stop before starting another stack."
      );
    }
    throw error;
  }
  writeFileSync(
    descriptor,
    `${JSON.stringify({ launcherPid: process.pid, mode, acquiredAt: new Date().toISOString() })}\n`
  );
  closeSync(descriptor);
}

async function assertPortAvailableOnHost(port, host) {
  await new Promise((resolvePort, rejectPort) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error) => {
      if (host === "::1" && error?.code === "EADDRNOTAVAIL") return resolvePort();
      rejectPort(
        new Error(
          `Port ${port} is already in use. TikDD will not select a fallback port or terminate the owning process.`
        )
      );
    });
    server.listen({ host, port, exclusive: true }, () => server.close(resolvePort));
  });
}

async function assertPortAvailable(port) {
  await assertPortAvailableOnHost(port, "127.0.0.1");
  await assertPortAvailableOnHost(port, "::1");
}

function parseComposeRecords(output) {
  const trimmed = output.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) return JSON.parse(trimmed);
  return trimmed.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function ensureInfrastructure(environment) {
  runNodeScript("scripts/docker.mjs", ["compose", "up", "-d", "postgres", "redis"], {
    environment
  });
  let latestError = new Error("Docker services have not reported healthy yet.");
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const output = runNodeScript(
        "scripts/docker.mjs",
        ["compose", "ps", "--format", "json"],
        { environment, capture: true }
      );
      validateDockerServices(parseComposeRecords(output));
      return;
    } catch (error) {
      latestError = error;
      await delay(500);
    }
  }
  throw latestError;
}

function connectSocket({ host, port, timeoutMs }) {
  return new Promise((resolveSocket, rejectSocket) => {
    const socket = net.connect({ host, port });
    const fail = (error) => {
      socket.destroy();
      rejectSocket(error);
    };
    socket.setTimeout(timeoutMs, () => fail(new Error("Connection timed out.")));
    socket.once("error", fail);
    socket.once("connect", () => {
      socket.removeListener("error", fail);
      socket.setTimeout(0);
      resolveSocket(socket);
    });
  });
}

async function connectThroughProxy(proxy, targetHost, timeoutMs) {
  const socket = await connectSocket({
    host: proxy.hostname,
    port: Number.parseInt(proxy.port, 10),
    timeoutMs
  });
  const authorization =
    proxy.username || proxy.password
      ? `Proxy-Authorization: Basic ${Buffer.from(`${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`).toString("base64")}\r\n`
      : "";
  socket.write(
    `CONNECT ${targetHost}:443 HTTP/1.1\r\nHost: ${targetHost}:443\r\n${authorization}Connection: keep-alive\r\n\r\n`
  );
  return await new Promise((resolveSocket, rejectSocket) => {
    let response = Buffer.alloc(0);
    const fail = (error) => {
      socket.destroy();
      rejectSocket(error);
    };
    socket.setTimeout(timeoutMs, () => fail(new Error("Proxy CONNECT timed out.")));
    socket.once("error", fail);
    socket.on("data", function onData(chunk) {
      response = Buffer.concat([response, chunk]);
      if (response.length > 8_192) return fail(new Error("Proxy CONNECT response was too large."));
      const boundary = response.indexOf("\r\n\r\n");
      if (boundary < 0) return;
      socket.removeListener("data", onData);
      socket.removeListener("error", fail);
      const statusLine = response.subarray(0, boundary).toString("latin1").split("\r\n", 1)[0];
      if (!/^HTTP\/1\.[01] 200\b/.test(statusLine)) {
        return fail(new Error("The configured proxy rejected CONNECT."));
      }
      const remainder = response.subarray(boundary + 4);
      if (remainder.length > 0) socket.unshift(remainder);
      socket.setTimeout(0);
      resolveSocket(socket);
    });
  });
}

async function probeTlsEgress(host, proxy) {
  const socket = proxy
    ? await connectThroughProxy(proxy, host, 7_000)
    : await connectSocket({ host, port: 443, timeoutMs: 7_000 });
  await new Promise((resolveTls, rejectTls) => {
    const secureSocket = tls.connect({ socket, servername: host, rejectUnauthorized: true });
    const fail = (error) => {
      secureSocket.destroy();
      rejectTls(error);
    };
    secureSocket.setTimeout(7_000, () => fail(new Error("TLS negotiation timed out.")));
    secureSocket.once("error", fail);
    secureSocket.once("secureConnect", () => {
      secureSocket.removeListener("error", fail);
      secureSocket.end();
      resolveTls();
    });
  });
}

function spawnApplication(definition, environment) {
  const logPath = join(runtimeDirectory, `${definition.id}.log`);
  const descriptor = openSync(logPath, "w");
  const invocation = pnpmInvocation(["--filter", definition.packageName, "dev"]);
  const child = spawn(invocation.command, invocation.arguments, {
    cwd: repositoryRoot,
    env: environment,
    detached: true,
    stdio: ["ignore", descriptor, descriptor],
    windowsHide: true
  });
  closeSync(descriptor);
  if (!child.pid) throw new Error(`Failed to start ${definition.id}.`);
  child.unref();
  return { id: definition.id, pid: child.pid, logPath };
}

async function waitForHttp(url, service, processes, validate) {
  let lastStatus = null;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (existsSync(stopRequestPath)) {
      throw new Error("TikDD local stack startup was interrupted.");
    }
    const exited = processes.find(({ pid }) => !isProcessAlive(pid));
    if (exited) {
      throw new Error(`${exited.id} exited before readiness. Inspect ${exited.logPath}.`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000), cache: "no-store" });
      lastStatus = response.status;
      if (response.ok && (!validate || (await validate(response)))) return;
    } catch {
      // The process may still be compiling or binding its port.
    }
    await delay(500);
  }
  throw new Error(`${service} did not become ready${lastStatus ? ` (HTTP ${lastStatus})` : ""}.`);
}

async function terminateOwnedProcesses(processes) {
  const live = processes.filter(({ pid }) => isProcessAlive(pid));
  if (process.platform === "win32") {
    for (const { pid } of [...live].reverse()) {
      spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true
      });
    }
    return;
  }
  for (const { pid } of [...live].reverse()) {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      // The recorded process already exited.
    }
  }
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (live.every(({ pid }) => !isProcessAlive(pid))) return;
    await delay(100);
  }
  for (const { pid } of live) {
    if (!isProcessAlive(pid)) continue;
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // The recorded process exited between checks.
    }
  }
}

async function assertProcessesStable(processes) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const exited = processes.find(({ pid }) => !isProcessAlive(pid));
    if (exited) {
      throw new Error(`${exited.id} exited during the readiness stability window. Inspect ${exited.logPath}.`);
    }
    await delay(100);
  }
}

async function stopStack() {
  mkdirSync(runtimeDirectory, { recursive: true });
  if (!existsSync(statePath)) {
    if (existsSync(lockPath)) {
      const lock = readJson(lockPath);
      if (isProcessAlive(lock.launcherPid)) {
        throw new Error("The TikDD launcher is still starting. Wait for it to finish before stopping.");
      }
      removeIfPresent(lockPath);
    }
    removeIfPresent(stopRequestPath);
    process.stdout.write("No recorded TikDD local stack is running.\n");
    return;
  }
  const state = readJson(statePath);
  const processes = Array.isArray(state.processes) ? state.processes : [];
  writeFileSync(stopRequestPath, `${new Date().toISOString()}\n`, "utf8");
  await terminateOwnedProcesses(processes);
  if (isProcessAlive(state.launcherPid)) {
    for (let attempt = 0; attempt < 300 && existsSync(statePath); attempt += 1) {
      await delay(100);
    }
  } else {
    removeIfPresent(statePath);
    removeIfPresent(lockPath);
    removeIfPresent(stopRequestPath);
  }
  if (existsSync(statePath) || existsSync(lockPath)) {
    throw new Error(
      "TikDD stop was requested, but the recorded launcher did not finish its bounded cleanup within 30 seconds."
    );
  }
  process.stdout.write(
    `Stopped ${processes.length} recorded TikDD process trees. PostgreSQL and Redis were left running.\n`
  );
}

function readLocalEnvironment() {
  const path = join(repositoryRoot, ".env");
  return existsSync(path) ? parseEnvironmentFile(readFileSync(path, "utf8")) : {};
}

function assertStartupContinues(interrupted) {
  if (interrupted || existsSync(stopRequestPath)) {
    throw new Error("TikDD local stack startup was interrupted.");
  }
}

async function startStack(mode) {
  const initialNextEnvironment = existsSync(nextEnvironmentPath)
    ? readFileSync(nextEnvironmentPath, "utf8")
    : null;
  acquireOwnerLock(mode);
  const state = {
    version: 1,
    mode,
    status: "starting",
    launcherPid: process.pid,
    startedAt: new Date().toISOString(),
    webUrl,
    processes: []
  };
  writeState(state);

  let interrupted = false;
  const interrupt = () => {
    interrupted = true;
  };
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);

  try {
    const profile = buildLocalStackProfile({
      mode,
      commandEnvironment: process.env,
      fileEnvironment: readLocalEnvironment()
    });
    state.providers = profile.providers;
    writeState(state);

    for (const port of LOCAL_STACK_PORTS) await assertPortAvailable(port);
    assertStartupContinues(interrupted);

    process.stdout.write("Starting and checking PostgreSQL and Redis...\n");
    await ensureInfrastructure(profile.environment);
    assertStartupContinues(interrupted);
    process.stdout.write("Applying database migrations...\n");
    runPnpm(["db:migrate"], profile.environment);
    assertStartupContinues(interrupted);

    if (mode === "pilot") {
      process.stdout.write("Checking explicitly selected provider page-host egress...\n");
      await verifyProviderEgress(profile.providerHosts, (host) =>
        probeTlsEgress(host, profile.proxy)
      );
    }
    assertStartupContinues(interrupted);

    for (const definition of appDefinitions) {
      assertStartupContinues(interrupted);
      const processRecord = spawnApplication(definition, profile.environment);
      state.processes.push(processRecord);
      writeState(state);
    }

    await Promise.all([
      waitForHttp(webUrl, "Web", state.processes),
      waitForHttp(
        "http://localhost:4000/health/ready",
        "API",
        state.processes,
        async (response) => (await response.json()).status === "ready"
      ),
      waitForHttp(
        "http://localhost:4002/health/ready",
        "Delivery",
        state.processes,
        async (response) => (await response.json()).status === "ready"
      )
    ]);
    runPnpm(["--filter", "@tikdd/worker", "probe:readiness"], profile.environment, true);
    await assertProcessesStable(state.processes);

    state.status = "ready";
    state.readyAt = new Date().toISOString();
    writeState(state);
    process.stdout.write(
      `TikDD ${mode} stack is ready.\nWeb: ${webUrl}\nLogs: ${runtimeDirectory}\nStop: pnpm dev:stop\n`
    );
    while (!interrupted && !existsSync(stopRequestPath)) await delay(250);
    await terminateOwnedProcesses(state.processes);
    removeIfPresent(statePath);
    removeIfPresent(lockPath);
    removeIfPresent(stopRequestPath);
    process.stdout.write("TikDD local stack supervisor stopped. PostgreSQL and Redis were left running.\n");
  } catch (error) {
    await terminateOwnedProcesses(state.processes);
    removeIfPresent(statePath);
    removeIfPresent(lockPath);
    removeIfPresent(stopRequestPath);
    throw error;
  } finally {
    restoreGeneratedNextEnvironment(initialNextEnvironment);
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
  }
}

const [command = "start", mode = "offline"] = process.argv.slice(2);
if (command === "stop") {
  await stopStack();
} else if (command === "start") {
  await startStack(mode);
} else {
  throw new Error(`Unknown local stack command: ${command}.`);
}
