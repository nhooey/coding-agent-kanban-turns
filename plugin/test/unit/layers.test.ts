import { describe, test } from "node:test";
import { expect } from "expect";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { parseSync } from "@swc/core";
import { cruise } from "dependency-cruiser";
import type { ICruiseResult } from "dependency-cruiser";
import extractDepcruiseOptions from "dependency-cruiser/config-utl/extract-depcruise-options";

// The plugin's folder, the dependency check's rules in it, and the fixture
// core the rules are tried on.
const PLUGIN = join(import.meta.dirname, "..", "..");
const RULES = join(PLUGIN, ".dependency-cruiser.json");
const FIXTURES = join(PLUGIN, "test", "fixtures", "layers");

// The core's layers and support folders, as the rules name them.
const LAYERS = ["artefacts", "config", "harness", "items", "json", "protocol", "text", "views"];

// What each of the core's folders may import of the others, as the node's
// layer table says; config/ alone imports the bundled library in vendor/.
const SUPPORT = ["config", "text", "json"];
const ALLOWED: Readonly<Record<string, readonly string[]>> = {
  protocol: ["protocol", ...SUPPORT],
  harness: ["harness", "protocol", ...SUPPORT],
  artefacts: ["artefacts", "protocol", ...SUPPORT],
  items: ["items", "harness", "artefacts", "protocol", ...SUPPORT],
  views: LAYERS,
  config: [...SUPPORT, "vendor"],
  text: SUPPORT,
  json: SUPPORT,
};

// The edges, which nothing in the core imports.
const EDGES = ["hooks", "cli", "tools"];

/** The folders directly under `folder`, sorted. */
const foldersIn = (folder: string): readonly string[] =>
  readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

/** A violation as a line: its rule's name, the importing module and the imported one. */
type Violation = readonly string[];

const sorted = (violations: readonly Violation[]): readonly Violation[] =>
  [...violations].sort((a, b) => a.join(" ").localeCompare(b.join(" ")));

/** Each violation the rules find in the fixture core. */
const fixtureViolations = async (): Promise<readonly Violation[]> => {
  const options = await extractDepcruiseOptions(RULES);
  const { output } = await cruise(["src"], { ...options, baseDir: FIXTURES });

  return sorted(
    (output as ICruiseResult).summary.violations.map((violation) => [
      violation.rule.name,
      violation.from,
      violation.to,
    ]),
  );
};

/** Where the fixture core's module that imports nothing lies in `folder`. */
const leafOf = (folder: string): string =>
  folder === "vendor"
    ? "vendor/leaf.js"
    : EDGES.includes(folder)
      ? `${folder}/leaf.ts`
      : `src/${folder}/leaf.ts`;

/** The violations each folder's `wrong.ts` holds: an import of every folder the table forbids it, and of each edge, refused by name. */
const wrongWays = (): readonly Violation[] =>
  LAYERS.flatMap((from) => {
    const module = `src/${from}/wrong.ts`;
    const forbidden = [...LAYERS, "vendor"].filter(
      (to) => !(ALLOWED[from] ?? []).includes(to),
    );

    return [
      ...forbidden.map((to) => ["not-in-allowed", module, leafOf(to)]),
      ...EDGES.flatMap((to) => [
        ["not-in-allowed", module, leafOf(to)],
        ["no-edge-in-core", module, leafOf(to)],
      ]),
    ];
  });

/** A parsed module's nodes, the module's own among them, depth first. */
const nodesIn = (value: unknown): readonly Readonly<Record<string, unknown>>[] =>
  Array.isArray(value)
    ? value.flatMap(nodesIn)
    : typeof value === "object" && value !== null
      ? [
          ...("type" in value ? [value as Readonly<Record<string, unknown>>] : []),
          ...Object.values(value).flatMap(nodesIn),
        ]
      : [];

/** What a node is of the imports the dependency check doesn't see: an import type, `import("x").T`, or a dynamic import; undefined for any other node. */
const inlineImportOf = (node: Readonly<Record<string, unknown>>): string | undefined =>
  node.type === "TsImportType"
    ? "import type"
    : node.type === "CallExpression" &&
        typeof node.callee === "object" &&
        node.callee !== null &&
        "type" in node.callee &&
        node.callee.type === "Import"
      ? "dynamic import"
      : undefined;

/** The inline imports a module's text holds, as swc parses it, in its order. */
const inlineImportsIn = (text: string): readonly string[] =>
  nodesIn(parseSync(text, { syntax: "typescript", target: "es2022" })).flatMap(
    (node) => inlineImportOf(node) ?? [],
  );

/** Each TypeScript module under `folder`, by its path from there. */
const modulesIn = (folder: string): readonly string[] =>
  readdirSync(folder, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".ts"))
    .sort();

describe("the dependency check's rules", () => {
  test("refuse every import the layer table forbids, an effect in the core and a cycle, and nothing else", async () => {
    expect(await fixtureViolations()).toEqual(
      sorted([
        ...wrongWays(),
        ["no-cycle", "src/json/first.ts", "src/json/second.ts"],
        ["no-engine-in-core", "src/text/engine.ts", "claude-code"],
        ["no-node-built-in-in-core", "src/text/clock.ts", "timers"],
        ["not-in-allowed", "src/text/clock.ts", "timers"],
        ["not-in-allowed", "src/text/engine.ts", "claude-code"],
      ]),
    );
  });

  test("refuse an import the wrong way from each layer to the one above it", async () => {
    const found = await fixtureViolations();

    for (const [from, to] of [
      ["items", "views"],
      ["harness", "items"],
      ["artefacts", "harness"],
      ["harness", "artefacts"],
      ["protocol", "harness"],
      ["text", "protocol"],
    ] as const) {
      expect(found).toContainEqual(["not-in-allowed", `src/${from}/wrong.ts`, `src/${to}/leaf.ts`]);
    }
  });
});

describe("the imports the dependency check doesn't see", () => {
  test("are found by a parser: an import type inside another type, and a dynamic import", () => {
    expect(
      inlineImportsIn(readFileSync(join(PLUGIN, "test", "fixtures", "inline-imports.ts"), "utf8")),
    ).toEqual(["import type", "import type", "import type", "dynamic import"]);
  });

  test("are none in the core", () => {
    const src = join(PLUGIN, "src");

    expect(
      modulesIn(src).flatMap((path) =>
        inlineImportsIn(readFileSync(join(src, path), "utf8")).map((kind) => `${path}: ${kind}`),
      ),
    ).toEqual([]);
  });
});

describe("the core's folders", () => {
  test("are its layers and support folders, and no other", () => {
    expect(foldersIn(join(PLUGIN, "src"))).toEqual(LAYERS);
  });

  test("are mirrored by the unit tests', beside the CLI's", () => {
    expect(foldersIn(join(PLUGIN, "test", "unit"))).toEqual([...LAYERS, "cli"].sort());
  });
});
