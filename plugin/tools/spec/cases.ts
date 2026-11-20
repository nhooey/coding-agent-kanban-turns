// The protocol's golden cases, spec/cases/*.yaml: each a transcript, as the
// neutral turns a harness's adapter builds, and what the core gives for it.
// Pure: test/unit/protocol/golden-cases.test.ts reads the files, hands their
// text here, and compares what the core gives with what each case expects.
//
// A case is read as strictly as the spec, by tools/spec/strict.ts: YAML
// 1.2's core schema with duplicate keys refused, then
// spec/cases/case.schema.yaml. It is then checked for what no schema can
// state:
//
// - a turn id the reference grammar can't write, or one opening two turns;
// - a command the spec doesn't name;
// - an option kind the spec doesn't name;
// - an option letter outside the reference grammar's letters, one its kind
//   doesn't take, or one given twice in an item;
// - an item raised twice in a turn;
// - a lint finding past its reply's last line;
// - a reply's text whose lines don't each end on `\n\`, so YAML folds a
//   line break into a space or joins two lines.

import { isScalar, parseDocument } from "yaml";
import { itemsOf, refOf } from "../../src/items/items.ts";
import {
  allItems,
  countLine,
  decideStates,
  listItemRef,
  openOf,
  rollUp,
  summaryOf,
  unsettled,
} from "../../src/items/outstanding.ts";
import { SPEC } from "../../src/protocol/spec.ts";
import { commandOf, isOwn } from "../../src/transcript/turns.ts";
import type { Message, Owner, Turn } from "../../types/index.d.ts";
import { messageOf, repeated, strictlyRead } from "./strict.ts";
import type { Problem } from "./strict.ts";

/** The folder the cases are in, and the schema among them, from the plugin's folder. */
export const CASES_DIR = "spec/cases";
export const CASE_SCHEMA_FILE = `${CASES_DIR}/case.schema.yaml`;

/** One finding of the reply lint: the reply's line, from 1, and the rule it breaks. */
export type Finding = Readonly<{ line: number; rule: string }>;

/** One of the agent's responses, and the lint's findings for it. */
export type CaseReply = Readonly<{ text: string; lint: readonly Finding[] }>;

/** A message sent while a turn ran. */
export type CaseMessage = Readonly<{
  owner: Owner;
  text: string;
  "report-names"?: readonly string[];
}>;

/** A Decide item a `kanban_options` call raised, without its turn. */
export type CaseItem = Readonly<{
  number: number;
  summary: string;
  kind: string;
  options: readonly Readonly<{ letter: string; name: string }>[];
  frees?: readonly string[];
}>;

/** One turn of a case, and the command its prompt runs, `runs`, an expectation. */
export type CaseTurn = Readonly<{
  id: string;
  prompt: string;
  owner?: Owner;
  "report-names"?: readonly string[];
  runs?: string;
  replies: readonly CaseReply[];
  decide?: readonly CaseItem[];
  messages?: readonly CaseMessage[];
}>;

/** What each item frees, by the item's reference. */
export type Frees = Readonly<Record<string, readonly string[]>>;

/** What the core gives for a whole transcript; `frees` and `decide-frees` none where a case leaves them out. */
export type Outcome = Readonly<{
  open: readonly string[];
  outstanding: readonly string[];
  counts: string;
  frees?: Frees;
  "decide-frees"?: Frees;
}>;

/** A golden case, as case.schema.yaml shapes it. */
export type GoldenCase = Readonly<{
  title: string;
  example?: boolean;
  window?: number;
  merged?: readonly string[];
  turns: readonly CaseTurn[];
  expect: Outcome;
}>;

/** A case read from its file, or why it can't be. */
export type Read = Readonly<{ case: GoldenCase } | { problems: readonly string[] }>;

const TURN_ID = SPEC.reference["turn-id"];
const LETTERS = SPEC.reference.letters;

/** Whether the reference grammar writes `id` as a turn's id: its length, in its alphabet. */
const isTurnId = (id: string): boolean =>
  id.length === TURN_ID.length &&
  [...id].every((char) => TURN_ID.alphabet.includes(char));

/** Whether the reference grammar writes `letter` as an option's letter: one character, from its first letter to its last. */
const isLetter = (letter: string): boolean =>
  [...letter].length === 1 && letter >= LETTERS.first && letter <= LETTERS.last;

/** A reply's lines, the empty one after its final line break left out. */
const linesOf = (text: string): readonly string[] => {
  const lines = text.split("\n");

  return lines.at(-1) === "" ? lines.slice(0, -1) : lines;
};

/** What's wrong with one Decide item's options, at `n` among its turn's, that the schema can't say. */
const optionProblems = (item: CaseItem, n: number, where: string): readonly string[] => {
  const kinds: Readonly<Record<string, Readonly<{ letters: object }>>> =
    SPEC.options.kinds;
  const kind = kinds[item.kind];
  const taken = Object.keys(kind?.letters ?? {});
  const letters = item.options.map((option) => option.letter);
  const at = `${where}.decide[${n}]`;

  return kind === undefined
    ? [`${at}.kind names no option kind of the spec: ${item.kind}`]
    : [
        ...letters
          .filter((letter) => !isLetter(letter))
          .map(
            (letter) =>
              `${at} gives the letter ${JSON.stringify(letter)}, not one of ${LETTERS.first} to ${LETTERS.last}`,
          ),
        ...letters
          .filter(
            (letter) =>
              isLetter(letter) && taken.length > 0 && !taken.includes(letter),
          )
          .map(
            (letter) =>
              `${at} gives a ${item.kind} item the letter ${letter}, not one of ${taken.join(", ")}`,
          ),
        ...repeated(letters).map(
          (letter) => `${at} gives the letter ${letter} more than once`,
        ),
      ];
};

/** What's wrong with one turn of a case, at `at` among its turns, that its schema can't say. */
const turnProblems = (turn: CaseTurn, at: number): readonly string[] => {
  const where = `turns[${at}]`;
  const items = turn.decide ?? [];

  return [
    ...(isTurnId(turn.id)
      ? []
      : [
          `${where}.id ${JSON.stringify(turn.id)} isn't ${TURN_ID.length} characters of ${TURN_ID.alphabet}`,
        ]),
    ...(turn.runs === undefined || Object.hasOwn(SPEC.commands.names, turn.runs)
      ? []
      : [`${where}.runs names no command of the spec: ${turn.runs}`]),
    ...repeated(items.map((item) => item.number)).map(
      (number) => `${where}.decide raises item ${number} more than once`,
    ),
    ...items.flatMap((item, n) => optionProblems(item, n, where)),
    ...turn.replies.flatMap((reply, n) => {
      const lines = linesOf(reply.text).length;

      return reply.lint
        .filter((finding) => finding.line > lines)
        .map(
          (finding) =>
            `${where}.replies[${n}].lint finds ${finding.rule} at line ${finding.line}, past the reply's ${lines} lines`,
        );
    }),
  ];
};

/** What's wrong with a case that its schema can't say: a turn id given twice, and each turn's problems. */
export const caseProblems = (golden: GoldenCase): readonly string[] => [
  ...repeated(golden.turns.map((turn) => turn.id)).map(
    (id) => `the turn id ${id} opens more than one turn`,
  ),
  ...golden.turns.flatMap(turnProblems),
];

// The line that opens a reply's scalar, the quote and an escaped line break
// alone, and what each of its lines but the last ends on: a line break,
// then an escaped one.
const OPENING = '"\\';
const LINE_END = "\\n\\";

/**
 * What's wrong with how one reply's text is written in the case's `source`,
 * at `where`: a scalar that isn't double-quoted, or a line of it, but a first
 * that opens it alone and the last, not ending on `\n\`. Such a line's
 * break folds into a space, or, where it ends on a bare `\`, joins the next
 * line onto it, so the reply isn't the lines the file shows.
 */
const scalarProblems = (
  source: string,
  node: unknown,
  where: string,
): readonly string[] => {
  const [start = 0, end = 0] = isScalar(node) ? (node.range ?? []) : [];
  const lines = source.slice(start, end).split("\n");
  const first = source.slice(0, start).split("\n").length;

  return !isScalar(node)
    ? []
    : node.type !== "QUOTE_DOUBLE"
      ? [`${where} is a ${node.type ?? "plain"} scalar, not a double-quoted one`]
      : lines.slice(0, -1).flatMap((line, n) => {
          const bare = line.trimEnd();

          return (n === 0 && bare === OPENING) || bare.endsWith(LINE_END)
            ? []
            : [
                `${where}: line ${first + n} doesn't end on \`${LINE_END}\`, so YAML ${bare.endsWith("\\") ? "joins the next line onto it" : "folds its line break into a space"}`,
              ];
        });
};

/** What's wrong with how each reply's text is written in the case's `source`. */
const replyScalarProblems = (
  source: string,
  golden: GoldenCase,
): readonly string[] => {
  const document = parseDocument(source, { version: "1.2" });

  return golden.turns.flatMap((turn, at) =>
    turn.replies.flatMap((_, n) =>
      scalarProblems(
        source,
        document.getIn(["turns", at, "replies", n, "text"], true),
        `turns[${at}].replies[${n}].text`,
      ),
    ),
  );
};

/**
 * caseProblems's and replyScalarProblems's problems, or, when a schema too
 * loose to shape the case lets through a case they can't read, why.
 */
const consistencyProblems = (
  source: string,
  golden: GoldenCase,
): readonly Problem[] => {
  try {
    return [
      ...caseProblems(golden),
      ...replyScalarProblems(source, golden),
    ].map((problem) => ({ in: "data", problem }));
  } catch (error) {
    return [
      {
        in: "schema",
        problem: `lets through a case the runner can't read: ${messageOf(error)}`,
      },
    ];
  }
};

/**
 * The case in the file `name`, from its text and its schema's, or every
 * problem with either, each naming its file. The case is checked for what
 * its schema can't say only once its schema holds.
 */
export const caseOf = (name: string, text: string, schemaText: string): Read => {
  const read = strictlyRead(text, schemaText, { strictRequired: true });
  const golden = "value" in read ? (read.value as GoldenCase) : undefined;
  const problems =
    "problems" in read
      ? read.problems
      : golden === undefined
        ? []
        : consistencyProblems(text, golden);
  const named = problems.map(
    (problem) =>
      `${problem.in === "schema" ? CASE_SCHEMA_FILE : `${CASES_DIR}/${name}`}: ${problem.problem}`,
  );

  return golden !== undefined && named.length === 0
    ? { case: golden }
    : { problems: named };
};

/** A case's message as the core reads one. */
const messageFor = (
  owner: Owner,
  text: string,
  reportNames: readonly string[] | undefined,
): Message => ({ owner, text, reportNames });

/** The neutral turns a case's transcript is: each Decide item given its turn, as the `kanban_options` call that raised it names it. */
export const turnsOfCase = (golden: GoldenCase): readonly Turn[] =>
  golden.turns.map((turn) => ({
    id: turn.id,
    prompt: messageFor(turn.owner ?? "user", turn.prompt, turn["report-names"]),
    replies: turn.replies.map((reply) => reply.text),
    decide: itemsOf({
      items: (turn.decide ?? []).map((item) => ({ ...item, turn: turn.id })),
    }),
    messages: (turn.messages ?? []).map((message) =>
      messageFor(message.owner, message.text, message["report-names"]),
    ),
  }));

/** The command a turn's prompt runs: its user's own text's only; undefined where it runs none. */
const runsOf = (turn: Turn): string | undefined =>
  isOwn(turn.prompt.owner) ? commandOf(turn.prompt.text) : undefined;

/** What each numbered item of the replies' own lists frees, by its reference; an item that frees none left out. */
export const freesOfTurns = (turns: readonly Turn[]): Frees =>
  Object.fromEntries(
    allItems(turns).flatMap((item) => {
      const ref = listItemRef(turns, item);

      return ref === undefined || item.frees.length === 0
        ? []
        : [[ref, item.frees] as const];
    }),
  );

/** What each Decide item a `kanban_options` call raised frees, the reply's line winning over the call's, by its reference; an item that frees none left out. */
export const decideFreesOfTurns = (turns: readonly Turn[]): Frees =>
  Object.fromEntries(
    decideStates(turns).flatMap(({ item }) =>
      (item.frees ?? []).length === 0 ? [] : [[refOf(item), item.frees ?? []] as const],
    ),
  );

/** What the core gives for a case's transcript: the open Decide items by reference, the outstanding items, the count line, what each item frees, and each turn's command. */
export const outcomeOf = (
  golden: GoldenCase,
): Required<Outcome> & Readonly<{ runs: readonly (string | undefined)[] }> => {
  const turns = turnsOfCase(golden);
  const window = golden.window ?? 0;
  const merged = new Set(golden.merged ?? []);

  return {
    open: openOf(turns, window, merged).items.map((item) => item.ref),
    outstanding: unsettled(turns, rollUp(turns, window), merged).map(
      (item) => `${SPEC.lists[item.list].header}: ${summaryOf(item.line)}`,
    ),
    counts: countLine(turns, window, merged),
    frees: freesOfTurns(turns),
    "decide-frees": decideFreesOfTurns(turns),
    runs: turns.map(runsOf),
  };
};

/** What each item frees, sorted by the item's reference, so the order a case writes them in doesn't count. */
const sortedFrees = (frees: Frees): Frees =>
  Object.fromEntries(
    Object.entries(frees).toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );

/** A value as a failure prints it: JSON, or `none` for nothing. */
const shown = (value: unknown): string =>
  value === undefined ? "none" : JSON.stringify(value);

/** One failure where `expected` and `got` differ, by their JSON. */
const differs = (where: string, expected: unknown, got: unknown): readonly string[] =>
  shown(expected) === shown(got)
    ? []
    : [`${where}: expected ${shown(expected)}, got ${shown(got)}`];

/**
 * Where what the core gives for a case differs from what the case expects,
 * one line each: its open items, outstanding items, count line, what each
 * item and each raised Decide item frees, and each turn's command. Empty
 * when the core gives what the case expects. The lint findings wait for
 * the lint.
 */
export const caseFailures = (golden: GoldenCase): readonly string[] => {
  const got = outcomeOf(golden);

  return [
    ...differs("expect.open", golden.expect.open, got.open),
    ...differs("expect.outstanding", golden.expect.outstanding, got.outstanding),
    ...differs("expect.counts", golden.expect.counts, got.counts),
    ...differs(
      "expect.frees",
      sortedFrees(golden.expect.frees ?? {}),
      sortedFrees(got.frees),
    ),
    ...differs(
      "expect.decide-frees",
      sortedFrees(golden.expect["decide-frees"] ?? {}),
      sortedFrees(got["decide-frees"]),
    ),
    ...golden.turns.flatMap((turn, n) =>
      differs(`turns[${n}].runs`, turn.runs, got.runs[n]),
    ),
  ];
};
