// Every golden case through the CLI's commands, its turns given both ways,
// as neutral turns on stdin and as a Claude Code transcript, and each reply
// as a draft: each command gives what the case expects. kanban.test.ts runs a case through
// cli/kanban.ts itself, and test/built/ through what the flake builds.

import { describe, test } from "node:test";
import { expect } from "expect";
import { readFileSync } from "node:fs";

import { answer, requestOf } from "../../../cli/run.ts";
import { DEFAULTS_FILE, loaded } from "../../../src/config/config.ts";
import { ROUTES, cliFailures, draftFailures, goldenCases, pluginFile } from "../../fixtures/cli.ts";
import type { Runner } from "../../fixtures/cli.ts";

const settings = loaded(
  { path: DEFAULTS_FILE, text: readFileSync(pluginFile(DEFAULTS_FILE), "utf8") },
  undefined,
);

/** The CLI's commands with no process: the arguments read, and the input handed over as the edge would, stdin's text as a `--draft -`'s. */
const run: Runner = (args, input) => {
  const request = requestOf("transcript" in input ? [...args, "--transcript", "session.jsonl"] : args);
  const text = "stdin" in input ? input.stdin : input.transcript;

  return "problems" in request
    ? { out: "", err: request.problems.join("\n"), code: 2 }
    : answer(request.value, {
        turns: text,
        draft: !request.value.help && request.value.draft === "-" ? text : undefined,
        settings,
        now: Date.now(),
      });
};

describe("the golden cases through the CLI", () => {
  for (const { name, golden } of goldenCases()) {
    for (const route of ROUTES) {
      test(`${name}, through ${route.name}, gives what it expects`, () => {
        expect(cliFailures(golden, run, route)).toEqual([]);
      });
    }
    test(`${name}: each reply, as a draft, gives the findings it expects`, () => {
      expect(draftFailures(golden, run)).toEqual([]);
    });
  }

  test("a reply whose findings are changed by hand fails as a draft", () => {
    const found = goldenCases().find(({ name }) => name === "lint-layout-findings.yaml");
    const golden = found?.golden;
    const [first, ...rest] = golden?.turns ?? [];

    expect(first).toBeDefined();
    if (golden !== undefined && first !== undefined) {
      const changed = {
        ...golden,
        turns: [{ ...first, replies: first.replies.map((reply) => ({ ...reply, lint: [] })) }, ...rest],
      };

      expect(draftFailures(changed, run)).toEqual([
        "lint --draft - turns[0].replies[0]: exited 1, not 0: ",
        'lint --draft - turns[0].replies[0]: expected [], got [{"line":2,"rule":"underline-width"}]',
      ]);
    }
  });

  test("a case whose expectation is changed by hand fails", () => {
    const found = goldenCases().find(({ name }) => name === "decide-answered-by-reference.yaml");
    const golden = found?.golden;

    expect(golden).toBeDefined();
    if (golden !== undefined) {
      const changed = { ...golden, expect: { ...golden.expect, counts: "📌 Outstanding: 🧠 2" } };

      expect(cliFailures(changed, run, ROUTES[0]!, false)).toEqual([
        `stdin: count: expected "📌 Outstanding: 🧠 2", got "📌 Outstanding: 🧠 1"`,
      ]);
    }
  });
});
