import { BETA_PLATFORMS, BetaOperabilityRepository, type BetaPlatform } from "./beta-operability";
import { createDatabasePool } from "./index";

const MAX_REPORT_HOURS = 24 * 7;

function readOption(args: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseHours(args: readonly string[]): number {
  const raw = readOption(args, "hours") ?? "24";
  const hours = Number(raw);
  if (!Number.isInteger(hours) || hours < 1 || hours > MAX_REPORT_HOURS) {
    throw new Error(`--hours must be an integer between 1 and ${MAX_REPORT_HOURS}.`);
  }
  return hours;
}

function parsePlatforms(args: readonly string[]): readonly BetaPlatform[] {
  const raw = readOption(args, "platforms") ?? BETA_PLATFORMS.join(",");
  const values = [...new Set(raw.split(",").map((value) => value.trim()).filter(Boolean))];
  if (values.length === 0 || values.some((value) => !BETA_PLATFORMS.includes(value as BetaPlatform))) {
    throw new Error(`--platforms must contain only: ${BETA_PLATFORMS.join(", ")}.`);
  }
  return values as BetaPlatform[];
}

const args = process.argv.slice(2);
const hours = parseHours(args);
const platforms = parsePlatforms(args);
const pool = createDatabasePool();

try {
  const report = await new BetaOperabilityRepository(pool).report({ hours, platforms });
  process.stdout.write(`${JSON.stringify(report)}\n`);
} finally {
  await pool.end();
}
