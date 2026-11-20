// Compiles the protocol's spec, spec/kanban.yaml, into src/protocol/spec.ts and
// spec/kanban.json, and its prose fragments, spec/fragments/*.md, into
// src/protocol/fragments.ts, as tools/spec/load.ts works them out. With
// `--check` it writes nothing, and fails where a committed file isn't what
// the spec and the fragments compile to, as `nix flake check` runs it.
// `spec-build` in the dev shell runs it plain.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  FRAGMENTS_DIR,
  FRAGMENTS_MODULE_FILE,
  JSON_FILE,
  MODULE_FILE,
  SCHEMA_FILE,
  SPEC_FILE,
  compiled,
  staleOf,
} from "./load.ts";

const plugin = join(import.meta.dirname, "..", "..");
const pathOf = (file: string): string => join(plugin, file);
const read = (file: string): string => readFileSync(pathOf(file), "utf8");

/** The fragments' text by name, each file's without `.md`, in the names' order. */
const fragments: Readonly<Record<string, string>> = Object.fromEntries(
  readdirSync(pathOf(FRAGMENTS_DIR))
    .filter((file) => file.endsWith(".md"))
    .toSorted()
    .map((file) => [
      file.slice(0, -".md".length),
      read(join(FRAGMENTS_DIR, file)),
    ]),
);

const result = compiled(read(SPEC_FILE), read(SCHEMA_FILE), fragments);

if ("problems" in result) {
  result.problems.forEach((problem) => console.error(`plugin/${problem}`));
  process.exit(1);
}

const files: Readonly<Record<string, string>> = {
  [MODULE_FILE]: result.files.module,
  [JSON_FILE]: result.files.json,
  [FRAGMENTS_MODULE_FILE]: result.files.fragments,
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
      `plugin/${file} is not what plugin/${SPEC_FILE} and plugin/${FRAGMENTS_DIR}/ compile to; run spec-build in the dev shell, then commit it`,
    ),
  );
  process.exit(stale.length > 0 ? 1 : 0);
}

Object.entries(files).forEach(([file, text]) => writeFileSync(pathOf(file), text));
