// Writes the derived skill's text files, SKILL.md and its worked examples,
// as tools/skill/render.ts makes them from the fragments, the spec and the
// golden cases, into the folder named by its one argument:
//
//   node tools/skill/build.ts <folder>
//
// The flake runs it to build the skill, then puts the CLI's builds beside
// the files, under scripts/. It refuses, writing nothing, a golden case
// that doesn't read, and a worked example that draws an untaught kind.

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { CASES_DIR, CASE_SCHEMA_FILE, caseOf } from "../spec/cases.ts";
import { skillFiles } from "./render.ts";
import type { NamedCase } from "./render.ts";

const plugin = join(import.meta.dirname, "..", "..");
const read = (file: string): string => readFileSync(join(plugin, file), "utf8");
const [folder] = process.argv.slice(2);

if (folder === undefined) {
  console.error("usage: node tools/skill/build.ts <folder>");
  process.exit(2);
}

const schemaText = read(CASE_SCHEMA_FILE);
const loaded = readdirSync(join(plugin, CASES_DIR))
  .filter((name) => name.endsWith(".yaml") && `${CASES_DIR}/${name}` !== CASE_SCHEMA_FILE)
  .toSorted()
  .map((name) => ({ name, result: caseOf(name, read(`${CASES_DIR}/${name}`), schemaText) }));
const cases: readonly NamedCase[] = loaded.flatMap(({ name, result }) =>
  "case" in result ? [{ name, golden: result.case }] : [],
);
const built = skillFiles(cases);
const problems = [
  ...loaded.flatMap(({ result }) => ("problems" in result ? result.problems : [])),
  ...("problems" in built ? built.problems : []),
];

if (problems.length > 0 || !("files" in built)) {
  problems.forEach((problem) => console.error(`plugin/${problem}`));
  process.exit(1);
}

Object.entries(built.files).forEach(([file, text]) => {
  const path = join(folder, file);

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
});
