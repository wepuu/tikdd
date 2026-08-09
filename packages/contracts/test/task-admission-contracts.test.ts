import { describe, expect, it } from "vitest";
import {
  IdempotencyKeySchema,
  ResolveTaskAdmissionErrorCodeSchema
} from "../src/index";

describe("resolve task admission contracts", () => {
  it("accepts bounded opaque idempotency keys and rejects unsafe header text", () => {
    expect(IdempotencyKeySchema.parse("018f47a8-1234-7abc-8def-0123456789ab")).toBe(
      "018f47a8-1234-7abc-8def-0123456789ab"
    );
    expect(() => IdempotencyKeySchema.parse("short")).toThrow();
    expect(() => IdempotencyKeySchema.parse("0123456789abcdef raw")).toThrow();
    expect(() => IdempotencyKeySchema.parse("x".repeat(129))).toThrow();
  });

  it("keeps public admission errors generic", () => {
    expect(ResolveTaskAdmissionErrorCodeSchema.options).toEqual([
      "IDEMPOTENCY_CONFLICT",
      "DUPLICATE_IN_PROGRESS",
      "ADMISSION_UNAVAILABLE"
    ]);
  });
});
