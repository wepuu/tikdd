import { describe, expect, it, vi } from "vitest";
import { AdminPasswordAuthService, hashAdminPassword } from "../src/auth";

class MemoryRedis {
  values = new Map<string, string>();
  sets = new Map<string, Set<string>>();
  async incr(key: string) { const next = Number(this.values.get(key) ?? 0) + 1; this.values.set(key, String(next)); return next; }
  async expire() { return 1; }
  async set(key: string, value: string) { this.values.set(key, value); return "OK"; }
  async get(key: string) { return this.values.get(key) ?? null; }
  async sadd(key: string, value: string) { const set = this.sets.get(key) ?? new Set(); set.add(value); this.sets.set(key, set); return 1; }
  async smembers(key: string) { return [...(this.sets.get(key) ?? [])]; }
  async del(...keys: string[]) { keys.forEach((key) => { this.values.delete(key); this.sets.delete(key); }); return keys.length; }
}

async function fixture() {
  const account = {
    accountId: `adm_${"a".repeat(32)}`,
    username: "owner",
    passwordHash: await hashAdminPassword("owner", "correct horse battery staple"),
    enabled: true,
    credentialVersion: 1,
    passwordChangedAt: new Date().toISOString()
  };
  const repository = {
    findByUsername: vi.fn(async () => account),
    findById: vi.fn(async () => account),
    updatePassword: vi.fn(async () => account)
  };
  return { account, repository, redis: new MemoryRedis() };
}

describe("password administrator sessions", () => {
  it("creates, verifies, and revokes an opaque session", async () => {
    const { account, repository, redis } = await fixture();
    const service = new AdminPasswordAuthService(repository as never, redis as never);
    const login = await service.login("owner", "correct horse battery staple");
    expect(login.sessionToken).toHaveLength(43);
    await expect(service.verify(login.sessionToken)).resolves.toMatchObject({ subject: account.accountId, username: "owner" });
    await service.logout(login.sessionToken);
    await expect(service.verify(login.sessionToken)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects an absolutely expired session and a changed credential version", async () => {
    const { account, repository, redis } = await fixture();
    const service = new AdminPasswordAuthService(repository as never, redis as never);
    const first = await service.login("owner", "correct horse battery staple");
    const sessionKey = [...redis.values.keys()].find((key) => key.includes(":session:"))!;
    const stored = JSON.parse(redis.values.get(sessionKey)!);
    stored.expiresAt = new Date(0).toISOString();
    redis.values.set(sessionKey, JSON.stringify(stored));
    await expect(service.verify(first.sessionToken)).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const second = await service.login("owner", "correct horse battery staple");
    account.credentialVersion += 1;
    await expect(service.verify(second.sessionToken)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("counts only failed logins and applies the per-account limit", async () => {
    const { repository, redis } = await fixture();
    const service = new AdminPasswordAuthService(repository as never, redis as never);
    await expect(service.login("owner", "correct horse battery staple")).resolves.toBeDefined();
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(service.login("owner", "not the password value")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    }
    await expect(service.login("owner", "correct horse battery staple")).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("uses the same public error for an unknown account and fails closed when Redis is unavailable", async () => {
    const unknown = { findByUsername: vi.fn(async () => null) };
    const service = new AdminPasswordAuthService(unknown as never, new MemoryRedis() as never);
    await expect(service.login("unknown", "correct horse battery staple")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    const unavailableRedis = new MemoryRedis();
    unavailableRedis.get = vi.fn(async () => { throw new Error("offline"); });
    await expect(new AdminPasswordAuthService(unknown as never, unavailableRedis as never).login("unknown", "correct horse battery staple"))
      .rejects.toMatchObject({ code: "AUTH_UNAVAILABLE" });
  });
});
