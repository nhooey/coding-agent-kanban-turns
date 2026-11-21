// The golden cases run through the kanban CLI, whichever way it is run: its
// pure commands, cli/kanban.ts under Node, the bundled kanban.js or the
// standalone binary. Each case's turns go in both ways the CLI reads them,
// as neutral turns on stdin and as a Claude Code transcript through the
// adapter, and what each command writes is compared with what the case
// expects. Each reply also goes in alone, as a draft on stdin.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { LIST_KEYS, summaryOf, itemsOfText } from "../../src/items/outstanding.ts";
import { SPEC } from "../../src/protocol/spec.ts";
import { CASES_DIR, CASE_SCHEMA_FILE, caseOf, turnsOfCase } from "../../tools/spec/cases.ts";
import type { CaseReply, GoldenCase } from "../../tools/spec/cases.ts";
import { SESSION_VARIABLE } from "../../cli/run.ts";
import type { Result } from "../../cli/run.ts";
import type { Turn } from "../../types/index.d.ts";
import { jsonl, recordsOfTurns } from "./records.ts";

/** A file of the plugin's, by its path from the plugin's folder. */
export const pluginFile = (path: string): URL => new URL(`../../${path}`, import.meta.url);

const read = (path: string): string => readFileSync(pluginFile(path), "utf8");

/** Every golden case, by its file's name, sorted; a case that doesn't read throws, as golden-cases.test.ts says why. */
export const goldenCases = (): readonly Readonly<{ name: string; golden: GoldenCase }>[] =>
  readdirSync(pluginFile(CASES_DIR))
    .filter((name) => name.endsWith(".yaml") && `${CASES_DIR}/${name}` !== CASE_SCHEMA_FILE)
    .toSorted()
    .map((name) => {
      const result = caseOf(name, read(`${CASES_DIR}/${name}`), read(CASE_SCHEMA_FILE));

      if ("problems" in result) {
        throw new Error(result.problems.join("\n"));
      }

      return { name, golden: result.case };
    });

/** What the CLI reads the turns from: stdin's text, or a transcript's. */
export type Input = Readonly<{ stdin: string } | { transcript: string }>;

/** A way of running the CLI: its arguments and its input, and what it gives back. A transcript's runner adds `--transcript`. */
export type Runner = (args: readonly string[], input: Input) => Result;

/** A folder of its own for a test's files, under the system's temporary folder. */
export const scratch = (): string => mkdtempSync(join(tmpdir(), "kanban-cli-"));

/**
 * The environment the CLI runs in under test: the tests' own, without the
 * Claude Code session they may run in or its config folder, so the CLI
 * reads the turns the test gives it and not that session's transcript.
 */
export const CLI_ENV: NodeJS.ProcessEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) => name !== SESSION_VARIABLE && name !== "CLAUDE_CONFIG_DIR",
  ),
);

/**
 * The CLI run as a process, `command` its program and the arguments before
 * the CLI's own, such as `node cli/kanban.ts`: a transcript is written to a
 * file of its own and named by `--transcript`, and stdin's text is piped in.
 * The user's settings are read from an empty folder, so only the defaults
 * are in effect.
 */
export const processRunner = (command: readonly [string, ...string[]]): Runner => {
  const folder = scratch();
  const env = { ...CLI_ENV, XDG_CONFIG_HOME: folder };
  const [program, ...before] = command;

  return (args, input) => {
    const transcript = join(folder, "session.jsonl");

    if ("transcript" in input) {
      writeFileSync(transcript, input.transcript);
    }
    const ran = spawnSync(
      program,
      [...before, ...args, ...("transcript" in input ? ["--transcript", transcript] : [])],
      { input: "stdin" in input ? input.stdin : "", encoding: "utf8", env },
    );

    return { out: ran.stdout, err: ran.stderr, code: ran.status ?? -1 };
  };
};

/** A way the turns go in, by its name. */
export type Route = Readonly<{ name: string; input: (turns: readonly Turn[]) => Input }>;

/** Both ways: neutral turns on stdin, and the Claude Code transcript the turns would be. */
export const ROUTES: readonly Route[] = [
  { name: "stdin", input: (turns) => ({ stdin: JSON.stringify(turns) }) },
  { name: "claude-code", input: (turns) => ({ transcript: jsonl(recordsOfTurns(turns)) }) },
];

/** One failure where `expected` and `got` differ, by their JSON. */
const differs = (where: string, expected: unknown, got: unknown): readonly string[] =>
  JSON.stringify(expected) === JSON.stringify(got)
    ? []
    : [`${where}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`];

/** The outstanding items a roll-up shows, as a case writes them: each list's header, a colon and the item's summary. */
export const outstandingOf = (rollUp: string): readonly string[] =>
  itemsOfText(rollUp).map((item) => `${SPEC.lists[item.list].header}: ${summaryOf(item.line)}`);

/** A case's outstanding items in the roll-up's order: its lists' order, each list's items in the case's. */
const inListOrder = (outstanding: readonly string[]): readonly string[] =>
  LIST_KEYS.flatMap((key) =>
    outstanding.filter((item) => item.startsWith(`${SPEC.lists[key].header}: `)),
  );

/** The turns up to and including the reply `n` of the turn at `at`, as the CLI would read them right after that reply. */
const untilReply = (turns: readonly Turn[], at: number, n: number): readonly Turn[] =>
  turns.slice(0, at + 1).map((turn, k) =>
    k === at ? { ...turn, replies: turn.replies.slice(0, n + 1) } : turn,
  );

/** The findings `lint --json` writes, by line and rule. */
const findingsOf = (out: string): unknown => {
  const parsed: unknown = JSON.parse(out === "" ? "{}" : out);
  const findings =
    typeof parsed === "object" && parsed !== null && "findings" in parsed && Array.isArray(parsed.findings)
      ? (parsed.findings as readonly Readonly<{ line: unknown; rule: unknown }>[])
      : undefined;

  return findings?.map(({ line, rule }) => ({ line, rule }));
};

/** Where a result's exit code isn't `code`, saying what it wrote to stderr. */
const exitFailures = (where: string, result: Result, code: number): readonly string[] =>
  result.code === code ? [] : [`${where}: exited ${result.code}, not ${code}: ${result.err}`];

/** The findings `lint` gives a reply as the last final response: the case's, unless the case says the turn's end passes it over. */
const replyFindings = (reply: CaseReply): readonly unknown[] =>
  reply["turn-end-lints"] === false ? [] : reply.lint;

/** An unanswered turn after a case's turns, its text written on the way breaking a rule, which `lint` passes over. */
export const UNANSWERED: Turn = {
  id: "ffffffff",
  prompt: { owner: "user", text: "Go on.", reportNames: undefined },
  replies: ["✅ **Done:**  \n▔▔▔▔▔▔▔▔\n1. **Half written**\n   on the way\n"],
  decide: [],
  messages: [],
  unanswered: true,
};

/**
 * Where `lint --draft -` gives any reply of a case other findings than the
 * case expects, or another exit code, one line each: every reply, whether
 * or not the turn's end would lint it as a final response.
 */
export const draftFailures = (golden: GoldenCase, run: Runner): readonly string[] =>
  golden.turns.flatMap((turn, k) =>
    turn.replies.flatMap((reply, n) => {
      const where = `lint --draft - turns[${k}].replies[${n}]`;
      const lint = run(["lint", "--draft", "-", "--json"], { stdin: reply.text });

      return [
        ...exitFailures(where, lint, reply.lint.length === 0 ? 0 : 1),
        ...differs(where, reply.lint, findingsOf(lint.out)),
      ];
    }),
  );

/**
 * Where what the CLI gives for a case, through `route`, differs from what
 * the case expects, one line each: `count`'s count line, `rollup`'s
 * outstanding items, `turn-id`'s id of the latest turn, and, unless
 * `isLinting` is false, `lint`'s findings for each reply as the last final
 * response, and for the last reply with an unanswered turn after it.
 */
export const cliFailures = (
  golden: GoldenCase,
  run: Runner,
  route: Route,
  isLinting = true,
): readonly string[] => {
  const turns = turnsOfCase(golden);
  const input = route.input(turns);
  const over = [
    "--window",
    String(golden.window ?? 0),
    ...(golden.merged ?? []).flatMap((pr) => ["--merged", pr]),
  ];
  const count = run(["count", ...over], input);
  const rollUp = run(["rollup", ...over, "--width", "0"], input);
  const turnId = run(["turn-id"], input);
  const at = (command: string) => `${route.name}: ${command}`;
  const lintFailures = (where: string, lint: Result, reply: CaseReply): readonly string[] => {
    const expected = replyFindings(reply);

    return [
      ...exitFailures(where, lint, expected.length === 0 ? 0 : 1),
      ...differs(where, expected, findingsOf(lint.out)),
    ];
  };
  const last = golden.turns.findLast((turn) => turn.replies.length > 0)?.replies.at(-1);

  return [
    ...exitFailures(at("count"), count, 0),
    ...differs(at("count"), golden.expect.counts, count.out.trimEnd()),
    ...exitFailures(at("rollup"), rollUp, 0),
    ...differs(at("rollup"), inListOrder(golden.expect.outstanding), outstandingOf(rollUp.out)),
    ...exitFailures(at("turn-id"), turnId, 0),
    ...differs(at("turn-id"), turns.at(-1)?.id, turnId.out.trimEnd()),
    ...(isLinting
      ? [
          ...golden.turns.flatMap((turn, k) =>
            turn.replies.flatMap((reply, n) =>
              lintFailures(
                at(`lint turns[${k}].replies[${n}]`),
                run(["lint", "--json"], route.input(untilReply(turns, k, n))),
                reply,
              ),
            ),
          ),
          ...(last === undefined
            ? []
            : lintFailures(
                at("lint with an unanswered turn after"),
                run(["lint", "--json"], route.input([...turns, UNANSWERED])),
                last,
              )),
        ]
      : []),
  ];
};
