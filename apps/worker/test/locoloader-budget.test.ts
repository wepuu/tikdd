import { describe, expect, it } from "vitest";
import { RedisLocoLoaderRequestBudget } from "../src/locoloader-budget";

class FakeRedis {
  readonly calls: Array<{ script: string; keys: string[]; args: string[] }> = [];
  result: unknown = 1;
  async eval(script: string, keyCount: number, ...values: string[]): Promise<unknown> {
    this.calls.push({ script, keys: values.slice(0, keyCount), args: values.slice(keyCount) });
    return this.result;
  }
}

describe("Redis LocoLoader extraction budget", () => {
  it("reserves one global NL extraction and releases only the active lease", async () => {
    const redis = new FakeRedis();
    const budget = new RedisLocoLoaderRequestBudget(redis as never, {
      region: "nl",
      maxExtractions: 2,
      windowMs: 21_600_000,
      maxConcurrency: 1,
      minIntervalMs: 1_000,
      now: () => 1_700_000_000_000
    });
    const permit = await budget.acquire();
    expect(permit).not.toBeNull();
    expect(redis.calls[0]?.keys).toEqual([
      "tikdd:provider-budget:locoloader:nl:extractions",
      "tikdd:provider-budget:locoloader:nl:active",
      "tikdd:provider-budget:locoloader:nl:last"
    ]);
    expect(redis.calls[0]?.args.slice(0, 5)).toEqual(["2", "1700000000000", "1", "1000", "21600000"]);
    await permit?.release();
    expect(redis.calls[1]?.keys).toEqual(["tikdd:provider-budget:locoloader:nl:active"]);
    expect(redis.calls[1]?.script).toContain("ZREM");
  });

  it("fails closed when Redis cannot reserve the budget", async () => {
    const redis = new FakeRedis();
    redis.eval = async () => { throw new Error("redis unavailable"); };
    const budget = new RedisLocoLoaderRequestBudget(redis as never, { region: "nl" });
    await expect(budget.acquire()).resolves.toBeNull();
  });
});
