import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const candidates = [process.env.DOCKER_BIN, "docker"];

if (process.platform === "win32") {
  if (process.env.LOCALAPPDATA) {
    candidates.push(
      join(
        process.env.LOCALAPPDATA,
        "Programs",
        "DockerDesktop",
        "resources",
        "bin",
        "docker.exe"
      )
    );
  }
  if (process.env.ProgramFiles) {
    candidates.push(join(process.env.ProgramFiles, "Docker", "Docker", "resources", "bin", "docker.exe"));
  }
}

for (const candidate of candidates.filter(Boolean)) {
  if (candidate !== "docker" && !existsSync(candidate)) {
    continue;
  }

  const result = spawnSync(candidate, process.argv.slice(2), { stdio: "inherit" });
  if (result.error?.code === "ENOENT") {
    continue;
  }
  if (result.error) {
    throw result.error;
  }
  process.exit(result.status ?? 1);
}

throw new Error("Docker CLI was not found. Start Docker Desktop or set DOCKER_BIN.");

