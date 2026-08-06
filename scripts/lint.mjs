import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const roots = ["apps", "packages", "config", "docs", "infra", "openapi", "scripts"];
const checkedExtensions = new Set([".css", ".json", ".md", ".mjs", ".sql", ".ts", ".tsx", ".yaml", ".yml"]);
const ignoredDirectories = new Set([".next", "coverage", "dist", "node_modules"]);
const failures = [];

async function visit(path) {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        await visit(child);
      }
      continue;
    }

    if (!checkedExtensions.has(extname(entry.name))) {
      continue;
    }

    const content = await readFile(child, "utf8");
    const lines = content.split("\n");
    lines.forEach((line, index) => {
      if (line.endsWith(" ") || line.endsWith("\t")) {
        failures.push(`${child}:${index + 1} has trailing whitespace`);
      }
      if (line.includes("\t")) {
        failures.push(`${child}:${index + 1} contains a tab character`);
      }
    });

    if (content.length > 0 && !content.endsWith("\n")) {
      failures.push(`${child} must end with a newline`);
    }

    if (extname(entry.name) === ".json") {
      try {
        JSON.parse(content);
      } catch (error) {
        failures.push(`${child} is invalid JSON: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
}

for (const root of roots) {
  await visit(root);
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Repository text checks passed.\n");
}
