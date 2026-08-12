import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { readHiddenSecret } from "../src/hidden-secret";

function ttyPair() {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode(enabled: boolean): void };
  const output = new PassThrough() as PassThrough & { isTTY: boolean };
  input.isTTY = true;
  output.isTTY = true;
  input.setRawMode = vi.fn();
  let rendered = "";
  output.on("data", (chunk) => { rendered += chunk.toString(); });
  return { input, output, rendered: () => rendered };
}

describe("hidden administrator password input", () => {
  it("reads two secrets sequentially without destroying stdin or echoing either value", async () => {
    const terminal = ttyPair();
    const first = readHiddenSecret("New: ", terminal.input, terminal.output);
    terminal.input.write("first secret value\r");
    await expect(first).resolves.toBe("first secret value");

    const second = readHiddenSecret("Confirm: ", terminal.input, terminal.output);
    terminal.input.write("second secret value\r");
    await expect(second).resolves.toBe("second secret value");

    expect(terminal.rendered()).toBe("New: \nConfirm: \n");
    expect(terminal.input.destroyed).toBe(false);
    expect(terminal.input.setRawMode).toHaveBeenCalledTimes(4);
  });
});
