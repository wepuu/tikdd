import { createHash, randomBytes } from "node:crypto";
import { AdminUsernameSchema } from "@tikdd/admin-contracts";
import { AdminAccountRepository, createDatabasePool } from "@tikdd/persistence";
import Redis from "ioredis";
import { hashAdminPassword } from "./auth";
import { requestValidPassword } from "./password-prompt";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const command = process.argv[2];
  const parsedUsername = AdminUsernameSchema.safeParse(argument("--username")?.trim().toLowerCase());
  if (!command || !parsedUsername.success) {
    throw new Error("Usage: admin:account <init|reset-password|disable|enable> --username <3-64 lowercase characters>");
  }
  const username = parsedUsername.data;
  const pool = createDatabasePool();
  const accounts = new AdminAccountRepository(pool);
  const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:16379", { maxRetriesPerRequest: 1 });

  async function revoke(accountId: string) {
    const key = `tikdd:admin-auth:v1:account:${accountId}:sessions`;
    const keys = await redis.smembers(key);
    if (keys.length) await redis.del(...keys);
    await redis.del(key);
  }

  try {
    const existing = await accounts.findByUsername(username);
    if (command === "init") {
      if (await accounts.enabledCount()) throw new Error("An enabled administrator account already exists.");
      const password = await requestValidPassword(username);
      const accountId = `adm_${createHash("md5").update(randomBytes(32)).digest("hex")}`;
      await accounts.create({ accountId, username, passwordHash: await hashAdminPassword(username, password) });
      process.stdout.write(`Administrator ${username} initialized.\n`);
      return;
    }

    if (!existing) throw new Error("Administrator account was not found.");
    if (command === "reset-password") {
      const password = await requestValidPassword(username);
      await accounts.updatePassword(existing.accountId, await hashAdminPassword(username, password));
      await revoke(existing.accountId);
      process.stdout.write(`Password reset for ${username}; all sessions revoked.\n`);
    } else if (command === "disable" || command === "enable") {
      await accounts.setEnabled(existing.accountId, command === "enable");
      await revoke(existing.accountId);
      process.stdout.write(`Administrator ${username} ${command}d; all sessions revoked.\n`);
    } else {
      throw new Error("Unsupported administrator account command.");
    }
  } finally {
    redis.disconnect();
    await pool.end();
  }
}

main().catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : "Administrator account command failed.";
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});
