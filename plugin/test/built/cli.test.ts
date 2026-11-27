// What the flake builds of the kanban CLI, run on every golden case
// through both ways it reads the turns, and on each case's replies as
// drafts: kanban.js under Node, at $KANBAN_JS. checks.cli-js runs this,
// and checks.plugin holds the derived skill's kanban.js to the same file;
// `npm run test:built` skips the build whose path is unset.

import { describe, test } from "node:test";
import { expect } from "expect";

import { ROUTES, cliFailures, draftFailures, goldenCases, processRunner } from "../fixtures/cli.ts";
import type { Runner } from "../fixtures/cli.ts";

const BUILDS: readonly Readonly<{ name: string; path: string | undefined; runner: (path: string) => Runner }>[] = [
  {
    name: "kanban.js",
    path: process.env.KANBAN_JS,
    runner: (path) => processRunner([process.execPath, path]),
  },
];

describe("the built CLI", () => {
  const cases = goldenCases();

  test("has golden cases to run", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const { name, path, runner } of BUILDS) {
    for (const { name: file, golden } of cases) {
      for (const route of ROUTES) {
        test(`${name} gives ${file} what it expects, through ${route.name}`, { skip: path === undefined }, () => {
          expect(path === undefined ? [] : cliFailures(golden, runner(path), route)).toEqual([]);
        });
      }
      test(`${name} gives each reply of ${file}, as a draft, the findings it expects`, { skip: path === undefined }, () => {
        expect(path === undefined ? [] : draftFailures(golden, runner(path))).toEqual([]);
      });
    }
  }
});
