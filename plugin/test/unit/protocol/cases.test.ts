// Reading a golden case, tools/spec/cases.ts: as strictly as the spec, its
// schema then what no schema can state; the neutral turns it holds; and
// where what the core gives for it differs from what it expects.

import { describe, test } from "node:test";
import { expect } from "expect";
import { readFileSync } from "node:fs";

import {
  CASE_SCHEMA_FILE,
  caseFailures,
  caseOf,
  caseProblems,
  decideFreesOfTurns,
  freesOfTurns,
  outcomeOf,
  turnsOfCase,
} from "../../../tools/spec/cases.ts";
import type { GoldenCase } from "../../../tools/spec/cases.ts";

const schemaText = readFileSync(
  new URL(`../../../${CASE_SCHEMA_FILE}`, import.meta.url),
  "utf8",
);

/** A case of two turns: a reply raising a radio Decide item and printing a Pending item, then the user's answer to the item. */
const CASE_TEXT = `title: An answer settles its item
turns:
  - id: 9efb08a1
    prompt: Pick the cache.
    replies:
      - text: "\\
          🚧 **Pending:**  \\n\\
          ▔▔▔▔▔▔▔▔▔▔▔\\n\\
          1. **Rework the loader**  \\n\\
          \\   It reads the cache twice.\\n\\
          \\n\\
          🧠 **Decide:**  \\n\\
          ▔▔▔▔▔▔▔▔▔▔\\n\\
          1. **Which cache to keep for the loader**  \\n\\
          \\   🔘 A. **Keep the disk cache**: it survives restarts.\\n\\
          \\   🔘 B. **Keep the memory cache**: simpler.\\n"
        lint: []
    decide:
      - number: 1
        summary: Which cache to keep for the loader
        kind: radio
        options:
          - { letter: A, name: Keep the disk cache }
          - { letter: B, name: Keep the memory cache }
  - id: b2c3d4e5
    prompt: 9efb08a1.Decide.1.A
    replies:
      - text: "Keeping the disk cache.\\n"
        lint: []
expect:
  open: []
  outstanding: ["Pending: Rework the loader"]
  counts: "📌 Outstanding: 🚧 1"
`;

/** CASE_TEXT with `from`, which must be in it, replaced by `to`. */
const edited = (from: string, to: string): string => {
  expect(CASE_TEXT).toContain(from);

  return CASE_TEXT.replace(from, to);
};

/** The problems reading `text` gives; none where it reads. */
const problemsOf = (text: string, schema = schemaText): readonly string[] => {
  const result = caseOf("example.yaml", text, schema);

  return "problems" in result ? result.problems : [];
};

/** The case CASE_TEXT, or `text`, reads as. */
const caseOfText = (text: string = CASE_TEXT): GoldenCase => {
  const result = caseOf("example.yaml", text, schemaText);

  if ("problems" in result) {
    throw new Error(result.problems.join("\n"));
  }

  return result.case;
};

describe("caseOf", () => {
  test("reads a case, a reply's text keeping its hard line breaks", () => {
    const golden = caseOfText();

    expect(golden.title).toBe("An answer settles its item");
    expect(golden.turns[0]?.replies[0]?.text.split("\n").slice(0, 4)).toEqual([
      "🚧 **Pending:**  ",
      "▔▔▔▔▔▔▔▔▔▔▔",
      "1. **Rework the loader**  ",
      "   It reads the cache twice.",
    ]);
  });

  test("refuses a key written twice", () => {
    expect(
      problemsOf(edited("title: An answer", "title: Twice\ntitle: An answer")),
    ).toEqual(["spec/cases/example.yaml: Map keys must be unique at line 2, column 1"]);
  });

  test("refuses a scalar YAML 1.2 types as a number where a string belongs", () => {
    expect(problemsOf(edited("prompt: Pick the cache.", "prompt: 1.10"))).toEqual([
      "spec/cases/example.yaml: /turns/0/prompt must be string",
    ]);
  });

  test("reads yes and no as strings, as YAML 1.2 does", () => {
    expect(
      caseOfText(edited("prompt: Pick the cache.", "prompt: yes")).turns[0]?.prompt,
    ).toBe("yes");
  });

  test("refuses a key its schema doesn't name", () => {
    expect(problemsOf(edited("title:", "colour: red\ntitle:"))).toEqual([
      "spec/cases/example.yaml: / must NOT have additional properties: colour",
    ]);
  });

  test("refuses a reply with no lint expectation", () => {
    expect(
      problemsOf(edited(`      - text: "Keeping the disk cache.\\n"\n        lint: []`, `      - text: "Keeping the disk cache.\\n"`)),
    ).toEqual([
      "spec/cases/example.yaml: /turns/1/replies/0 must have required property 'lint'",
    ]);
  });

  test("refuses an empty schema, which checks nothing", () => {
    expect(problemsOf(CASE_TEXT, "")).toEqual([
      `${CASE_SCHEMA_FILE}: is empty, so it checks nothing`,
    ]);
  });

  test("refuses what its schema can't say, naming the case's file", () => {
    expect(problemsOf(edited("id: b2c3d4e5", "id: 9efb08a1"))).toEqual([
      "spec/cases/example.yaml: the turn id 9efb08a1 opens more than one turn",
    ]);
  });

  test("refuses a reply's line whose break YAML folds into a space, its last backslash left out", () => {
    expect(
      problemsOf(
        edited("1. **Rework the loader**  \\n\\\n", "1. **Rework the loader**  \\n\n"),
      ),
    ).toEqual([
      "spec/cases/example.yaml: turns[0].replies[0].text: line 9 doesn't end on `\\n\\`, so YAML folds its line break into a space",
    ]);
  });

  test("refuses a reply's line YAML joins to the next, its `\\n` left out", () => {
    expect(
      problemsOf(
        edited("1. **Rework the loader**  \\n\\\n", "1. **Rework the loader**  \\\n"),
      ),
    ).toEqual([
      "spec/cases/example.yaml: turns[0].replies[0].text: line 9 doesn't end on `\\n\\`, so YAML joins the next line onto it",
    ]);
  });

  test("refuses a reply's text that isn't a double-quoted scalar", () => {
    expect(
      problemsOf(
        edited(
          `      - text: "Keeping the disk cache.\\n"`,
          "      - text: |\n          Keeping the disk cache.",
        ),
      ),
    ).toEqual([
      "spec/cases/example.yaml: turns[1].replies[0].text is a BLOCK_LITERAL scalar, not a double-quoted one",
    ]);
  });

  test("names the schema where a looser one lets through a case the checks can't read", () => {
    const looser = schemaText.replace(
      "required: [id, prompt, replies]",
      "required: [id, prompt]",
    );

    expect(looser).not.toBe(schemaText);
    expect(
      problemsOf(
        edited(
          `    replies:\n      - text: "Keeping the disk cache.\\n"\n        lint: []\n`,
          "",
        ),
        looser,
      ),
    ).toEqual([
      expect.stringMatching(
        /^spec\/cases\/case\.schema\.yaml: lets through a case the runner can't read: /,
      ),
    ]);
  });
});

/** CASE_TEXT's case with its first turn changed by `change`. */
const withFirstTurn = (
  change: (turn: GoldenCase["turns"][number]) => GoldenCase["turns"][number],
): GoldenCase => {
  const golden = caseOfText();
  const [first, ...rest] = golden.turns;

  return first === undefined ? golden : { ...golden, turns: [change(first), ...rest] };
};

describe("caseProblems", () => {
  test("none for a case that holds together", () => {
    expect(caseProblems(caseOfText())).toEqual([]);
  });

  test("a turn id the reference grammar can't write", () => {
    expect(caseProblems(withFirstTurn((turn) => ({ ...turn, id: "9EFB08A1" })))).toEqual([
      'turns[0].id "9EFB08A1" isn\'t 8 characters of 0123456789abcdef',
    ]);
    expect(caseProblems(withFirstTurn((turn) => ({ ...turn, id: "9efb08" })))).toEqual([
      'turns[0].id "9efb08" isn\'t 8 characters of 0123456789abcdef',
    ]);
  });

  test("a command the spec doesn't name", () => {
    expect(caseProblems(withFirstTurn((turn) => ({ ...turn, runs: "rerun" })))).toEqual([
      "turns[0].runs names no command of the spec: rerun",
    ]);
  });

  test("an option kind the spec doesn't name, and a letter its kind doesn't take", () => {
    const item = {
      number: 2,
      summary: "Ship tonight?",
      kind: "binary",
      options: [
        { letter: "Y", name: "Ship" },
        { letter: "B", name: "Hold" },
      ],
    };

    expect(
      caseProblems(
        withFirstTurn((turn) => ({
          ...turn,
          decide: [...(turn.decide ?? []), item, { ...item, number: 3, kind: "slider" }],
        })),
      ),
    ).toEqual([
      "turns[0].decide[1] gives a binary item the letter B, not one of Y, N",
      "turns[0].decide[2].kind names no option kind of the spec: slider",
    ]);
  });

  test("a letter outside the reference grammar's letters, and a letter given twice in one item", () => {
    expect(
      caseProblems(
        withFirstTurn((turn) => ({
          ...turn,
          decide: [
            {
              number: 1,
              summary: "Which cache to keep for the loader",
              kind: "radio",
              options: [
                { letter: "a", name: "Disk" },
                { letter: "AB", name: "Both" },
                { letter: "B", name: "Memory" },
                { letter: "B", name: "Memory again" },
              ],
            },
          ],
        })),
      ),
    ).toEqual([
      'turns[0].decide[0] gives the letter "a", not one of A to Z',
      'turns[0].decide[0] gives the letter "AB", not one of A to Z',
      "turns[0].decide[0] gives the letter B more than once",
    ]);
  });

  test("an item raised twice in one turn", () => {
    expect(
      caseProblems(
        withFirstTurn((turn) => ({
          ...turn,
          decide: [...(turn.decide ?? []), ...(turn.decide ?? [])],
        })),
      ),
    ).toEqual(["turns[0].decide raises item 1 more than once"]);
  });

  test("a lint finding past its reply's last line, the line break ending it no line of its own", () => {
    const finding = (line: number) =>
      caseProblems(
        withFirstTurn((turn) => ({
          ...turn,
          replies: [{ text: "One line.\n", lint: [{ line, rule: "no-hard-break" }] }],
        })),
      );

    expect(finding(1)).toEqual([]);
    expect(finding(2)).toEqual([
      "turns[0].replies[0].lint finds no-hard-break at line 2, past the reply's 1 lines",
    ]);
  });
});

describe("turnsOfCase", () => {
  test("gives each turn its prompt, the user's by default, its replies, its Decide items with their turn and reference, and its messages", () => {
    const [first, second] = turnsOfCase(
      withFirstTurn((turn) => ({
        ...turn,
        messages: [{ owner: "peer", text: "Done.", "report-names": ["b8a83gfv0"] }],
      })),
    );

    expect(first?.prompt).toEqual({
      owner: "user",
      text: "Pick the cache.",
      reportNames: undefined,
    });
    expect(first?.replies).toHaveLength(1);
    expect(first?.decide.map((item) => [item.ref, item.turn, item.list, item.kind])).toEqual([
      ["9efb08a1.Decide.1", "9efb08a1", "Decide", "radio"],
    ]);
    expect(first?.messages).toEqual([
      { owner: "peer", text: "Done.", reportNames: ["b8a83gfv0"] },
    ]);
    expect(second?.decide).toEqual([]);
    expect(second?.messages).toEqual([]);
  });

  test("gives a prompt its owner and the names it reports by", () => {
    const [first] = turnsOfCase(
      withFirstTurn((turn) => ({ ...turn, owner: "notification", "report-names": ["watch"] })),
    );

    expect(first?.prompt).toEqual({
      owner: "notification",
      text: "Pick the cache.",
      reportNames: ["watch"],
    });
  });
});

describe("outcomeOf", () => {
  test("the open Decide items, the outstanding items, the count line and each turn's command", () => {
    expect(outcomeOf(caseOfText())).toEqual({
      open: [],
      outstanding: ["Pending: Rework the loader"],
      counts: "📌 Outstanding: 🚧 1",
      frees: {},
      "decide-frees": {},
      runs: [undefined, undefined],
    });
  });

  test("what each numbered item frees, by its reference, an item that frees none left out", () => {
    const freeing = caseOfText(
      edited(
        "It reads the cache twice.\\n\\",
        "It reads the cache twice.\\n\\\n          \\   Frees: 9efb08a1.Decide.1, 9efb08a1.Todo.1\\n\\",
      ),
    );

    expect(outcomeOf(freeing).frees).toEqual({
      "9efb08a1.Pending.1": ["9efb08a1.Decide.1"],
    });
    expect(freesOfTurns(turnsOfCase(freeing))).toEqual(outcomeOf(freeing).frees);
  });

  test("what each Decide item a call raised frees, by its reference, as the call gives it where the reply writes no line", () => {
    const freeing = caseOfText(
      edited("        kind: radio\n", "        kind: radio\n        frees: [9efb08a1.Pending.1]\n"),
    );

    expect(outcomeOf(freeing)["decide-frees"]).toEqual({
      "9efb08a1.Decide.1": ["9efb08a1.Pending.1"],
    });
    expect(decideFreesOfTurns(turnsOfCase(freeing))).toEqual(outcomeOf(freeing)["decide-frees"]);
    expect(decideFreesOfTurns(turnsOfCase(caseOfText()))).toEqual({});
  });

  test("an item nobody answered stays open", () => {
    expect(
      outcomeOf(caseOfText(edited("prompt: 9efb08a1.Decide.1.A", "prompt: Go on."))),
    ).toEqual({
      open: ["9efb08a1.Decide.1"],
      outstanding: [
        "Pending: Rework the loader",
        "Decide: Which cache to keep for the loader",
      ],
      counts: "📌 Outstanding: 🚧 1 · 🧠 1",
      frees: {},
      "decide-frees": {},
      runs: [undefined, undefined],
    });
  });

  test("a prompt only the user's own text runs a command from", () => {
    const runs = (owner: "user" | "peer") =>
      outcomeOf(withFirstTurn((turn) => ({ ...turn, prompt: "recheck", owner }))).runs;

    expect(runs("user")).toEqual(["reassess", undefined]);
    expect(runs("peer")).toEqual([undefined, undefined]);
  });

  test("the count line over the window's turns, with the merged pull requests settling their Review items", () => {
    const review = withFirstTurn((turn) => ({
      ...turn,
      replies: [
        {
          text: "🔍 **Review:**  \n▔▔▔▔▔▔▔▔▔▔\n1. **example/kanban#21 Close the pane**\n",
          lint: [],
        },
      ],
      decide: [],
    }));

    expect(outcomeOf(review).counts).toBe("📌 Outstanding: 🔍 1");
    expect(outcomeOf({ ...review, merged: ["example/kanban#21"] }).counts).toBe("");
    expect(outcomeOf({ ...review, window: 1 }).counts).toBe("");
  });
});

describe("caseFailures", () => {
  test("none where the core gives what the case expects", () => {
    expect(caseFailures(caseOfText())).toEqual([]);
  });

  test("one line for each expectation the core doesn't meet", () => {
    const golden = caseOfText();

    expect(
      caseFailures({
        ...golden,
        turns: golden.turns.map((turn, n) => (n === 1 ? { ...turn, runs: "open" } : turn)),
        expect: { open: ["9efb08a1.Decide.1"], outstanding: [], counts: "" },
      }),
    ).toEqual([
      'expect.open: expected ["9efb08a1.Decide.1"], got []',
      'expect.outstanding: expected [], got ["Pending: Rework the loader"]',
      'expect.counts: expected "", got "📌 Outstanding: 🚧 1"',
      'turns[1].runs: expected "open", got none',
    ]);
  });

  test("what the items free, whatever order the case writes them in", () => {
    const golden = caseOfText();
    const frees = { "9efb08a1.Pending.1": ["9efb08a1.Decide.1"] };

    expect(caseFailures({ ...golden, expect: { ...golden.expect, frees } })).toEqual([
      'expect.frees: expected {"9efb08a1.Pending.1":["9efb08a1.Decide.1"]}, got {}',
    ]);
    expect(caseFailures({ ...golden, expect: { ...golden.expect, frees: {} } })).toEqual([]);
  });
});
