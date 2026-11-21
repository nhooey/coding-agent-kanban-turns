// What the flake builds of the kanban CLI, run on a golden case through
// both ways it reads the turns, and on another's replies as drafts:
// kanban.js under Node, at $KANBAN_JS, and the standalone binary, at
// $KANBAN_BIN. checks.cli builds both and runs this with each path set;
// `npm run test:built` with either unset skips it.

import { describe, test } from "node:test";
import { expect } from "expect";

import { ROUTES, cliFailures, draftFailures, goldenCases, processRunner } from "../fixtures/cli.ts";
import type { Runner } from "../fixtures/cli.ts";

/** The case each build runs on, and the case whose replies it lints as drafts. */
const CASE = "every-list.yaml";
const DRAFTS = "lint-layout-findings.yaml";

const BUILDS: readonly Readonly<{ name: string; path: string | undefined; runner: (path: string) => Runner }>[] = [
  {
    name: "kanban.js",
    path: process.env.KANBAN_JS,
    runner: (path) => processRunner([process.execPath, path]),
  },
  { name: "the binary", path: process.env.KANBAN_BIN, runner: (path) => processRunner([path]) },
];

describe("the built CLI", () => {
  const found = goldenCases().find(({ name }) => name === CASE);
  const drafts = goldenCases().find(({ name }) => name === DRAFTS);

  for (const { name, path, runner } of BUILDS) {
    for (const route of ROUTES) {
      test(`${name} gives ${CASE} what it expects, through ${route.name}`, { skip: path === undefined }, () => {
        expect(found).toBeDefined();
        expect(found === undefined || path === undefined ? [] : cliFailures(found.golden, runner(path), route)).toEqual([]);
      });
    }
    test(`${name} gives each reply of ${DRAFTS}, as a draft, the findings it expects`, { skip: path === undefined }, () => {
      expect(drafts).toBeDefined();
      expect(drafts === undefined || path === undefined ? [] : draftFailures(drafts.golden, runner(path))).toEqual([]);
    });
  }
});
