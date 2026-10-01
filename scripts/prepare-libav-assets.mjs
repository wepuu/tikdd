import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "apps/web/public/vendor/libav");
const variants = ["remux-cli", "encode-cli"];

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const variant of variants) {
  const packageName = `libav.js-${variant}`;
  const source = resolve(root, `apps/web/node_modules/@imput/${packageName}/dist`);
  for (const filename of [
    `libav-${variant}.mjs`,
    `libav-6.8.7.1-${variant}.wasm.mjs`,
    `libav-6.8.7.1-${variant}.wasm.wasm`
  ]) {
    const target = resolve(output, filename);
    copyFileSync(resolve(source, filename), target);
    if (filename.endsWith(".mjs")) {
      // Generated upstream modules contain harmless trailing spaces; normalize
      // copied assets so repeated repository checks remain deterministic.
      writeFileSync(target, readFileSync(target, "utf8").replace(/[ \t]+$/gm, ""));
    }
  }
}
