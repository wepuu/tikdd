import { afterEach, describe, expect, it } from "vitest";
import { createDatabasePool } from "../src/index";

const original = process.env.TIKDD_DATABASE_POOL_MAX;

afterEach(() => {
  if (original === undefined) delete process.env.TIKDD_DATABASE_POOL_MAX;
  else process.env.TIKDD_DATABASE_POOL_MAX = original;
});

describe("production database pool bound", () => {
  it("retains the existing default and accepts a conservative deployment override", async () => {
    delete process.env.TIKDD_DATABASE_POOL_MAX;
    const defaultPool = createDatabasePool("postgresql://example.invalid/tikdd");
    expect(defaultPool.options.max).toBe(10);
    await defaultPool.end();

    process.env.TIKDD_DATABASE_POOL_MAX = "4";
    const boundedPool = createDatabasePool("postgresql://example.invalid/tikdd");
    expect(boundedPool.options.max).toBe(4);
    await boundedPool.end();
  });

  it.each(["0", "21", "2.5", "four", " 4"])("rejects an invalid bound: %s", (value) => {
    process.env.TIKDD_DATABASE_POOL_MAX = value;
    expect(() => createDatabasePool("postgresql://example.invalid/tikdd")).toThrow(
      "TIKDD_DATABASE_POOL_MAX"
    );
  });
});
