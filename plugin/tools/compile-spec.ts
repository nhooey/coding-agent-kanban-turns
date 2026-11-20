// Compiles the protocol's spec, spec/kanban.yaml, into src/spec.ts and
// spec/kanban.json, as tools/spec.ts works them out. With `--check` it writes
// nothing, and fails where either committed file isn't what the spec
// compiles to, as `nix flake check` runs it. `spec-build` in the dev shell
// runs it plain.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  JSON_FILE,
  MODULE_FILE,
  SCHEMA_FILE,
  SPEC_FILE,
  compiled,
  staleOf,
} from "./spec.ts";

const plugin = join(import.meta.dirname, "..");
const pathOf = (file: string): string => join(plugin, file);
const read = (file: string): string => readFileSync(pathOf(file), "utf8");

const result = compiled(read(SPEC_FILE), read(SCHEMA_FILE));

if ("problems" in result) {
  result.problems.forEach((problem) => console.error(`plugin/${problem}`));
  process.exit(1);
}

const files: Readonly<Record<string, string>> = {
  [MODULE_FILE]: result.files.module,
  [JSON_FILE]: result.files.json,
};

if (process.argv.includes("--check")) {
  const stale = staleOf(
    files,
    Object.fromEntries(
      Object.keys(files)
        .filter((file) => existsSync(pathOf(file)))
        .map((file) => [file, read(file)]),
    ),
  );

  stale.forEach((file) =>
    console.error(
      `plugin/${file} is not what plugin/${SPEC_FILE} compiles to; run spec-build in the dev shell, then commit it`,
    ),
  );
  process.exit(stale.length > 0 ? 1 : 0);
}

Object.entries(files).forEach(([file, text]) => writeFileSync(pathOf(file), text));
