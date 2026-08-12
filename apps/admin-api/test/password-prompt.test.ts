import { describe, expect, it, vi } from "vitest";
import { requestValidPassword } from "../src/password-prompt";

describe("administrator password prompt", () => {
  it("explains the rule and retries after a short password", async () => {
    const read = vi.fn()
      .mockResolvedValueOnce("short")
      .mockResolvedValueOnce("short")
      .mockResolvedValueOnce("a sufficiently long private password")
      .mockResolvedValueOnce("a sufficiently long private password");
    const messages: string[] = [];

    await expect(requestValidPassword("solo", read, (message) => messages.push(message)))
      .resolves.toBe("a sufficiently long private password");
    expect(read).toHaveBeenCalledTimes(4);
    expect(messages.join("")).toContain("at least 8 characters");
  });

  it("retries when confirmation does not match", async () => {
    const read = vi.fn()
      .mockResolvedValueOnce("first sufficiently long password")
      .mockResolvedValueOnce("different sufficiently long password")
      .mockResolvedValueOnce("matching sufficiently long password")
      .mockResolvedValueOnce("matching sufficiently long password");
    const messages: string[] = [];

    await expect(requestValidPassword("solo", read, (message) => messages.push(message)))
      .resolves.toBe("matching sufficiently long password");
    expect(messages.join("")).toContain("do not match");
  });
});
