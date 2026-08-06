import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabasePool } from "./index";

const migrationDirectoryUrl = new URL("../../../infra/migrations/", import.meta.url);
const migrationDirectory = fileURLToPath(migrationDirectoryUrl);
const migrationFiles = (await readdir(migrationDirectory))
  .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
  .sort();
const pool = createDatabasePool();

try {
  for (const migrationFile of migrationFiles) {
    const sql = await readFile(join(migrationDirectory, migrationFile), "utf8");
    await pool.query(sql);
    process.stdout.write(`Applied migration ${migrationFile}\n`);
  }
} finally {
  await pool.end();
}
