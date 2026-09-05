import { describe, expect, it } from "vitest";
import {
  DEFAULT_RESOLVE_QUEUE_NAME,
  loadResolveQueueName
} from "../src/index";

describe("resolve queue contract", () => {
  it("keeps the public queue as the default", () => {
    expect(loadResolveQueueName(undefined)).toBe(DEFAULT_RESOLVE_QUEUE_NAME);
    expect(DEFAULT_RESOLVE_QUEUE_NAME).toBe("resolve");
  });

  it("accepts the exact isolated calibration queue", () => {
    expect(loadResolveQueueName("resolve-internal-ssstwitter-x-nl")).toBe(
      "resolve-internal-ssstwitter-x-nl"
    );
  });

  it.each(["", " resolve", "resolve:*", "resolve_internal", "A".repeat(81)])(
    "rejects unsafe queue name %j",
    (value) => expect(() => loadResolveQueueName(value)).toThrow()
  );
});
