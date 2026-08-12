import type { Readable, Writable } from "node:stream";

type RawInput = Readable & {
  isTTY?: boolean;
  setRawMode?: (enabled: boolean) => void;
};

type TtyOutput = Writable & { isTTY?: boolean };

export function readHiddenSecret(
  prompt: string,
  input: RawInput = process.stdin,
  output: TtyOutput = process.stdout
): Promise<string> {
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== "function") {
    throw new Error("Password input requires an interactive terminal.");
  }

  output.write(prompt);
  input.setRawMode(true);
  input.resume();

  return new Promise<string>((resolve, reject) => {
    let value = "";

    const cleanup = () => {
      input.off("data", onData);
      input.off("error", onError);
      input.setRawMode?.(false);
      input.pause();
    };
    const finish = () => {
      cleanup();
      output.write("\n");
      resolve(value);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onData = (chunk: Buffer | string) => {
      for (const character of chunk.toString()) {
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Cancelled."));
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (value.length < 128 && character >= " ") value += character;
      }
    };

    input.on("data", onData);
    input.on("error", onError);
  });
}
