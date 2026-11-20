// The protocol's golden cases, spec/cases/*.yaml, run through the core: each
// case's transcript gives the open items, the outstanding items, the count
// line, what each item frees and each turn's command the case expects. A
// new case needs no new test code. Between them the cases cover the spec:
// every list, option kind, command and synonym, settling word, reference
// form and lint rule.

import { describe, test } from "node:test";
import { expect } from "expect";
import { readFileSync, readdirSync } from "node:fs";

import { parseYaml } from "../../../src/config/config.ts";
import { answersOfLine } from "../../../src/items/answer-lines.ts";
import type { LineAnswer } from "../../../src/items/answer-lines.ts";
import { DECIDE, namesOf } from "../../../src/protocol/rules.ts";
import { SPEC } from "../../../src/protocol/spec.ts";
import {
  isOwn,
  sectionsOf,
  withoutDraftHeader,
} from "../../../src/transcript/turns.ts";
import {
  CASES_DIR,
  CASE_SCHEMA_FILE,
  caseFailures,
  caseOf,
  lintFailures,
} from "../../../tools/spec/cases.ts";
import type { CaseTurn, GoldenCase } from "../../../tools/spec/cases.ts";

const read = (path: string): string =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

const schemaText = read(CASE_SCHEMA_FILE);

/** Each case's file name, sorted: every YAML file in the folder but the schema. */
const NAMES: readonly string[] = readdirSync(
  new URL(`../../../${CASES_DIR}`, import.meta.url),
)
  .filter(
    (name) =>
      name.endsWith(".yaml") && `${CASES_DIR}/${name}` !== CASE_SCHEMA_FILE,
  )
  .toSorted();

type Loaded = Readonly<{
  name: string;
  golden: GoldenCase | undefined;
  problems: readonly string[];
}>;

/** Each case, by its file's name; a case that doesn't read fails its own test below. */
const CASES: readonly Loaded[] = NAMES.map((name) => {
  const result = caseOf(name, read(`${CASES_DIR}/${name}`), schemaText);

  return "case" in result
    ? { name, golden: result.case, problems: [] }
    : { name, golden: undefined, problems: result.problems };
});

const TURNS: readonly CaseTurn[] = CASES.flatMap(
  ({ golden }) => golden?.turns ?? [],
);
const REPLIES = TURNS.flatMap((turn) => turn.replies);

/** Every line of the user's own text in the cases: their prompts and their messages. */
const OWN_LINES: readonly string[] = TURNS.flatMap((turn) => [
  ...(isOwn(turn.owner ?? "user") ? [turn.prompt] : []),
  ...(turn.messages ?? [])
    .filter((message) => isOwn(message.owner))
    .map((message) => message.text),
]).flatMap((text) => withoutDraftHeader(text).split("\n"));

describe("the golden cases", () => {
  test("are there", () => {
    expect(NAMES.length).toBeGreaterThan(0);
  });

  for (const { name, golden, problems } of CASES) {
    test(`${name} gives what it expects`, () => {
      expect(problems).toEqual([]);
      expect(golden === undefined ? [] : caseFailures(golden)).toEqual([]);
    });
  }

  test("a case whose expectation is changed by hand fails", () => {
    const name = "decide-answered-by-reference.yaml";
    const text = read(`${CASES_DIR}/${name}`);
    const failuresOf = (from: string, to: string): readonly string[] => {
      expect(text).toContain(from);
      const result = caseOf(name, text.replace(from, to), schemaText);

      return "case" in result ? caseFailures(result.case) : result.problems;
    };

    expect(failuresOf(`counts: "📌 Outstanding: 🧠 1"`, `counts: "📌 Outstanding: 🧠 2"`)).toEqual([
      `expect.counts: expected "📌 Outstanding: 🧠 2", got "📌 Outstanding: 🧠 1"`,
    ]);
    expect(failuresOf("open: [9efb08a1.Decide.3]", "open: []")).toEqual([
      `expect.open: expected [], got ["9efb08a1.Decide.3"]`,
    ]);
    expect(
      failuresOf(
        `outstanding: ["Decide: Ship the release tonight?"]`,
        "outstanding: []",
      ),
    ).toEqual([
      `expect.outstanding: expected [], got ["Decide: Ship the release tonight?"]`,
    ]);
    expect(
      failuresOf("    prompt: |-\n", "    runs: open\n    prompt: |-\n"),
    ).toEqual([`turns[1].runs: expected "open", got none`]);
  });

  test("a worked example's replies keep every rule, so none expects a lint finding", () => {
    expect(
      CASES.flatMap(({ name, golden }) =>
        golden === undefined || golden.example === false
          ? []
          : golden.turns.flatMap((turn, at) =>
              turn.replies.flatMap((reply, n) =>
                reply.lint.length === 0 ? [] : [`${name}: turns[${at}].replies[${n}]`],
              ),
            ),
      ),
    ).toEqual([]);
  });

  test("give the lint findings each reply expects", () => {
    expect(
      CASES.flatMap(({ name, golden }) =>
        golden === undefined
          ? []
          : lintFailures(golden).map((failure) => `${name}: ${failure}`),
      ),
    ).toEqual([]);
  });

  test("a lint expectation changed by hand fails", () => {
    const name = "lint-layout-findings.yaml";
    const text = read(`${CASES_DIR}/${name}`);
    const from = "- { line: 2, rule: underline-width }";
    const result = caseOf(
      name,
      text.replace(from, "- { line: 3, rule: underline-width }"),
      schemaText,
    );

    expect(text).toContain(from);
    expect("case" in result ? lintFailures(result.case) : result.problems).toEqual([
      `turns[0].replies[0].lint: expected [{"line":3,"rule":"underline-width"}], got [{"line":2,"rule":"underline-width"}]`,
    ]);
  });
});

/** A prompt's first word, lowercased, its trailing punctuation dropped, as a command is read from it. */
const firstWord = (prompt: string): string => {
  const word = (prompt.trim().split(/\s+/)[0] ?? "").toLowerCase();
  const trailing = [...SPEC.commands["trailing-punctuation"]];
  const kept = [...word];

  return kept
    .slice(
      0,
      kept.length -
        kept.toReversed().findIndex((char) => !trailing.includes(char)),
    )
    .join("");
};

/** The names of a command: its own, then its synonyms. */
const commandNames = (command: keyof typeof SPEC.commands.names): readonly string[] => [
  command,
  ...SPEC.commands.names[command].synonyms,
];

const COMMANDS = Object.keys(SPEC.commands.names) as readonly (keyof typeof SPEC.commands.names)[];
const ALL_NAMES = COMMANDS.flatMap(commandNames);

describe("the golden cases cover", () => {
  const sections = REPLIES.flatMap((reply) =>
    sectionsOf(reply.text).map((section) => section.name),
  );

  test("every list, by its header and by every older name", () => {
    const names = Object.values(SPEC.lists).flatMap(namesOf);

    expect(names.filter((name) => !sections.includes(name))).toEqual([]);
  });

  test("the 📌 roll-up, by its header and by every older one", () => {
    const rollUp = SPEC["roll-up"];

    expect(
      namesOf(rollUp).filter(
        (name) =>
          !REPLIES.some((reply) =>
            reply.text.includes(`${rollUp.glyph} **${name}:**`),
          ),
      ),
    ).toEqual([]);
  });

  test("every option kind", () => {
    const kinds = TURNS.flatMap((turn) =>
      (turn.decide ?? []).map((item) => item.kind),
    );

    expect(
      Object.keys(SPEC.options.kinds).filter((kind) => !kinds.includes(kind)),
    ).toEqual([]);
  });

  for (const command of COMMANDS) {
    const runs = TURNS.filter((turn) => turn.runs === command);

    test(`every name of ${command}, as a prompt's first word`, () => {
      expect(
        commandNames(command).filter(
          (name) => !runs.some((turn) => firstWord(turn.prompt) === name),
        ),
      ).toEqual([]);
    });

    if (SPEC.commands["unique-prefix-runs"]) {
      test(`${command}, by a prefix of a name no other command shares`, () => {
        expect(
          runs.some((turn) => {
            const word = firstWord(turn.prompt);

            return (
              /^\p{L}+$/u.test(word) &&
              !ALL_NAMES.includes(word) &&
              commandNames(command).some((name) => name.startsWith(word))
            );
          }),
        ).toBe(true);
      });
    }

    if (SPEC.commands.names[command]["from-last-line"]) {
      test(`${command}, by a prompt's last line after answers`, () => {
        expect(
          runs.some((turn) => {
            const lines = turn.prompt.split("\n").filter((line) => line.trim() !== "");

            return (
              lines.length > 1 &&
              commandNames(command).includes(firstWord(lines.at(-1) ?? ""))
            );
          }),
        ).toBe(true);
      });
    }
  }

  test("every skill command a command runs after", () => {
    expect(
      SPEC.commands["skill-commands"].filter(
        (skill) =>
          !TURNS.some(
            (turn) => turn.runs !== undefined && turn.prompt.includes(`/${skill}`),
          ),
      ),
    ).toEqual([]);
  });

  test("every settling word, after an item's reference", () => {
    const words = OWN_LINES.map((line) => line.split(/\s+/));
    const missing = Object.values(SPEC.lists).flatMap((list) =>
      Object.keys(list["settling-words"])
        .filter(
          (word) =>
            !words.some((tokens) =>
              tokens.some(
                (token, n) =>
                  token.includes(`${list.header}.`) && tokens[n + 1] === word,
              ),
            ),
        )
        .map((word) => `${list.header}: ${word}`),
    );

    expect(missing).toEqual([]);
  });

  const TURN_ID = SPEC.reference["turn-id"];
  const REFERENCE = `${DECIDE.header}.`;
  const FORMS: readonly Readonly<{
    form: string;
    holds: (line: string, answers: readonly LineAnswer[]) => boolean;
  }>[] = [
    {
      form: "a whole turn id before the item",
      holds: (line, answers) =>
        answers.some(
          (a) =>
            a.turn.length === TURN_ID.length &&
            line.includes(`${a.turn}.${REFERENCE}`),
        ),
    },
    {
      form: "a prefix of a turn id before the item",
      holds: (line, answers) =>
        answers.some(
          (a) =>
            a.turn.length >= TURN_ID.shortest &&
            a.turn.length < TURN_ID.length &&
            line.includes(`${a.turn}.${REFERENCE}`),
        ),
    },
    ...SPEC.reference["turn-after"].map((word) => ({
      form: `the turn after the item, by "${word}"`,
      holds: (line: string, answers: readonly LineAnswer[]) =>
        answers.some((a) => a.turn !== "" && line.includes(`${word} ${a.turn}`)),
    })),
    {
      form: "no turn, answering the turn before",
      holds: (line, answers) =>
        line.includes(REFERENCE) && answers.some((a) => a.turn === ""),
    },
    {
      form: "a line of numbered answers",
      holds: (line, answers) => !line.includes(REFERENCE) && answers.length > 1,
    },
    {
      form: "one letter",
      holds: (_, answers) => answers.some((a) => a.letters.length === 1),
    },
    {
      form: "several letters",
      holds: (_, answers) => answers.some((a) => a.letters.length > 1),
    },
    {
      form: "a note after the letters",
      holds: (_, answers) =>
        answers.some((a) => a.letters.length > 0 && a.note !== ""),
    },
    {
      form: "words in place of letters",
      holds: (_, answers) =>
        answers.some((a) => a.letters.length === 0 && a.note !== ""),
    },
    {
      form: "a question, which answers nothing",
      holds: (line, answers) =>
        line.includes(REFERENCE) && line.includes("?") && answers.length === 0,
    },
  ];

  for (const { form, holds } of FORMS) {
    test(`the reference form: ${form}`, () => {
      expect(OWN_LINES.some((line) => holds(line, answersOfLine(line)))).toBe(true);
    });
  }

  test("every lint rule, in some reply's findings", () => {
    const schema = parseYaml(schemaText);
    const rules: readonly string[] =
      "value" in schema
        ? ((schema.value as { definitions: { finding: { properties: { rule: { enum: string[] } } } } })
            .definitions.finding.properties.rule.enum)
        : [];
    const found: readonly string[] = REPLIES.flatMap((reply) =>
      reply.lint.map((finding) => finding.rule),
    );

    expect(rules.length).toBeGreaterThan(0);
    expect(rules.filter((rule) => !found.includes(rule))).toEqual([]);
  });
});
