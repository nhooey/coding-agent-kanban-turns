import { describe, test } from "node:test";
import { expect } from "expect";
import { readFileSync, readdirSync } from "node:fs";

import { SPEC } from "../../../src/protocol/spec.ts";
import { FRAGMENTS } from "../../../src/protocol/fragments.ts";
import {
  FRAGMENTS_DIR,
  FRAGMENTS_MODULE_FILE,
  JSON_FILE,
  MODULE_FILE,
  SCHEMA_FILE,
  SPEC_FILE,
  compiled,
  specProblems,
  staleOf,
} from "../../../tools/spec/load.ts";
import type { SpecShape } from "../../../tools/spec/load.ts";
import type { DecideKind } from "../../../types/index.d.ts";

const read = (path: string): string =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

const specText = read(SPEC_FILE);
const schemaText = read(SCHEMA_FILE);

/** The committed fragments' text, by name, as the build step reads them. */
const fragments: Readonly<Record<string, string>> = Object.fromEntries(
  readdirSync(new URL(`../../../${FRAGMENTS_DIR}`, import.meta.url))
    .filter((file) => file.endsWith(".md"))
    .toSorted()
    .map((file) => [file.slice(0, -".md".length), read(`${FRAGMENTS_DIR}/${file}`)]),
);

/** The spec's text with `from` replaced by `to`, which must be in it. */
const edited = (from: string, to: string): string => {
  expect(specText).toContain(from);

  return specText.replace(from, to);
};

/** The problems the build step refuses `text` with; none when it compiles. */
const problemsOf = (text: string): readonly string[] => {
  const result = compiled(text, schemaText, fragments);

  return "problems" in result ? result.problems : [];
};

/** Whether two types are the same type. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// The kinds the spec names are the kinds an item's type allows.
const kindsMatch: Same<keyof typeof SPEC.options.kinds, DecideKind> = true;

describe("the spec", () => {
  test("is consistent", () => {
    expect(specProblems(SPEC)).toEqual([]);
  });

  test("holds 9 lists, each with its own glyph and names", () => {
    const lists = Object.values(SPEC.lists);
    const names = lists.flatMap((list) => [list.header, ...list.aliases]);

    expect(lists).toHaveLength(9);
    expect(new Set(lists.map((list) => list.glyph)).size).toBe(9);
    expect(new Set(names).size).toBe(names.length);
  });

  test("lists in the order a final response prints them", () => {
    expect(Object.values(SPEC.lists).map((list) => list.header)).toEqual([
      "Done",
      "Pending",
      "Logged",
      "Waiting",
      "Answers",
      "Authorizations",
      "Review",
      "Todo",
      "Decide",
    ]);
  });

  test("names the kinds an item's type allows", () => {
    expect(kindsMatch).toBe(true);
  });

  test("reads Y and N as letters, as YAML 1.2 does", () => {
    expect(Object.keys(SPEC.options.kinds.binary.letters)).toEqual(["Y", "N"]);
  });
});

describe("specProblems", () => {
  const spec: SpecShape = SPEC;
  const withList = (key: string, list: SpecShape["lists"][string]): SpecShape => ({
    ...spec,
    lists: { ...spec.lists, [key]: list },
  });
  const decide = SPEC.lists.decide;

  test("finds a list too many", () => {
    expect(
      specProblems(
        withList("extra", { ...decide, header: "Extra", glyph: "🧩", aliases: [], "settled-by": "none" }),
      ),
    ).toEqual([
      "holds 10 lists, not 9",
    ]);
  });

  test("finds a glyph two lists share", () => {
    expect(specProblems(withList("decide", { ...decide, glyph: "✅" }))).toEqual([
      "the glyph ✅ heads more than one list",
    ]);
  });

  test("finds a name two lists share, as a header or an alias", () => {
    expect(specProblems(withList("decide", { ...decide, aliases: ["To do"] }))).toEqual([
      'the name "To do" names more than one list',
    ]);
  });

  test("finds a list that doesn't roll up yet something settles", () => {
    expect(specProblems(withList("done", { ...SPEC.lists.done, "settled-by": "report" }))).toEqual([
      "done doesn't roll up, so none of its items stays open to settle, yet it's settled by report",
    ]);
    expect(specProblems(withList("done", { ...SPEC.lists.done, "rolls-up": true }))).toEqual([]);
  });

  test("finds a list other than Decide settled by an answer, which reads only Decide's items", () => {
    expect(specProblems(withList("todo", { ...SPEC.lists.todo, "settled-by": "answer" }))).toEqual([
      "todo is settled by answer, which reads only the decide list's items",
    ]);
    expect(specProblems(withList("decide", { ...SPEC.lists.decide, "settled-by": "answer" }))).toEqual([]);
  });

  test("finds a word that settles two lists differently", () => {
    const settling = withList("todo", {
      ...SPEC.lists.todo,
      "settling-words": { skip: "settles it" },
    });

    expect(
      specProblems({
        ...settling,
        lists: {
          ...settling.lists,
          review: { ...SPEC.lists.review, "settling-words": { skip: "asks to merge it" } },
        },
      }),
    ).toEqual(['the word "skip" settles review and todo differently']);
    expect(
      specProblems({
        ...settling,
        lists: {
          ...settling.lists,
          review: { ...SPEC.lists.review, "settling-words": { skip: "settles it" } },
        },
      }),
    ).toEqual([]);
  });

  test("finds a command name that is a prefix of another command's", () => {
    expect(
      specProblems({
        ...spec,
        commands: {
          names: {
            ...spec.commands.names,
            open: { synonyms: ["pending", "re"] },
          },
        },
      }),
    ).toEqual([
      'the name "re" of open starts the name "reassess" of reassess, so it doesn\'t name open alone',
    ]);
  });

  test("finds a turn id's shortest prefix longer than the turn id", () => {
    const turnId = { ...spec.reference["turn-id"], shortest: 9 };

    expect(specProblems({ ...spec, reference: { ...spec.reference, "turn-id": turnId } })).toEqual([
      "the turn id's shortest prefix, 9, is longer than the turn id, 8",
    ]);
    expect(
      specProblems({
        ...spec,
        reference: { ...spec.reference, "turn-id": { ...turnId, length: 9 } },
      }),
    ).toEqual([]);
  });

  test("finds letters that run backwards", () => {
    expect(
      specProblems({ ...spec, reference: { ...spec.reference, letters: { first: "Z", last: "A" } } }),
    ).toEqual([
      "the letters run backwards, Z to A",
      "the letter Y of binary is outside the letters, Z to A",
      "the letter N of binary is outside the letters, Z to A",
    ]);
  });

  test("finds an option kind's letter outside the letters", () => {
    expect(
      specProblems({ ...spec, reference: { ...spec.reference, letters: { first: "A", last: "X" } } }),
    ).toEqual(["the letter Y of binary is outside the letters, A to X"]);
  });

  test("finds a glyph two option kinds share, as a kind's glyph or a letter's", () => {
    const kinds = spec.options.kinds;
    const withKinds = (changed: SpecShape["options"]["kinds"]): SpecShape => ({
      ...spec,
      options: { kinds: { ...kinds, ...changed } },
    });

    expect(specProblems(withKinds({ checkbox: { ...kinds["checkbox"]!, glyph: "🔘" } }))).toEqual([
      "the glyph 🔘 marks more than one option kind",
    ]);
    expect(specProblems(withKinds({ radio: { ...kinds["radio"]!, glyph: "👎" } }))).toEqual([
      "the glyph 👎 marks more than one option kind",
    ]);
  });

  test("finds a backlog entry's digits that run backwards", () => {
    const withDigits = (fewest: number, most: number): SpecShape => ({
      ...spec,
      subject: { ...spec.subject, entry: { ...spec.subject.entry, digits: { fewest, most } } },
    });

    expect(specProblems(withDigits(5, 4))).toEqual([
      "a backlog entry's digits run backwards, 5 to 4",
    ]);
    expect(specProblems(withDigits(4, 4))).toEqual([]);
  });

  test("finds one label for a backlog entry's key and a branch's, which keeps the kinds of key apart no more", () => {
    const withBranchLabel = (label: string): SpecShape => ({
      ...spec,
      subject: { ...spec.subject, branch: { label } },
    });

    expect(specProblems(withBranchLabel("entry"))).toEqual([
      `a backlog entry's key and a branch's both open with "entry", so the kinds of key aren't kept apart`,
    ]);
    expect(specProblems(withBranchLabel("span"))).toEqual([]);
  });

  test("finds a stop word with a character outside the subject's alphabet, which stops nothing", () => {
    expect(
      specProblems({ ...spec, subject: { ...spec.subject, alphabet: "0123456789abcdefghijklmnopqrsuvwxyz" } }),
    ).toEqual([
      'the stop word "at" holds a character outside the subject\'s alphabet, so it stops nothing',
      'the stop word "its" holds a character outside the subject\'s alphabet, so it stops nothing',
      'the stop word "the" holds a character outside the subject\'s alphabet, so it stops nothing',
      'the stop word "to" holds a character outside the subject\'s alphabet, so it stops nothing',
      'the stop word "with" holds a character outside the subject\'s alphabet, so it stops nothing',
    ]);
  });
});

describe("the build step", () => {
  test("compiles the spec and the fragments to the committed modules and JSON copy", () => {
    const result = compiled(specText, schemaText, fragments);

    expect(result).toEqual({
      files: {
        module: read(MODULE_FILE),
        json: read(JSON_FILE),
        fragments: read(FRAGMENTS_MODULE_FILE),
      },
    });
  });

  test("writes each fragment into its module by its file's name, without its trailing blank lines", () => {
    expect(Object.keys(FRAGMENTS)).toEqual(Object.keys(fragments));
    Object.entries(fragments).forEach(([name, text]) =>
      expect(FRAGMENTS[name as keyof typeof FRAGMENTS]).toBe(text.trimEnd()),
    );
  });

  test("refuses a fragment with a placeholder the spec has no value for", () => {
    expect(
      compiled(specText, schemaText, { ...fragments, extra: "a {{header.nothing}}\n" }),
    ).toEqual({
      problems: [`${FRAGMENTS_DIR}/extra.md: no value in the spec for {{header.nothing}}`],
    });
  });

  test("refuses a fragment whose placeholder a spec change takes the value of", () => {
    expect(
      compiled(edited("    glyph: 🧠\n", "    glyph: 🧩\n"), schemaText, {
        extra: "{{lists.decide.glyph}} {{header.decide}} {{lists.decide.colour}}",
      }),
    ).toEqual({
      problems: [`${FRAGMENTS_DIR}/extra.md: no value in the spec for {{lists.decide.colour}}`],
    });
    expect(
      compiled(edited("  todo:\n", "  chores:\n"), schemaText, { extra: "{{header.todo}}" }),
    ).toEqual({
      problems: [`${FRAGMENTS_DIR}/extra.md: no value in the spec for {{header.todo}}`],
    });
  });

  test("refuses a fragment named other than an id", () => {
    expect(compiled(specText, schemaText, { "Extra Rules": "plain" })).toEqual({
      problems: [`${FRAGMENTS_DIR}/Extra Rules.md: isn't named in lower-case words and dashes`],
    });
  });

  test("writes the JSON copy with the spec's values and a header naming its source", () => {
    const result = compiled(specText, schemaText, fragments);
    const json: unknown = "files" in result ? JSON.parse(result.files.json) : {};

    expect(json).toEqual({
      $comment: expect.stringContaining(SPEC_FILE),
      ...SPEC,
    });
  });

  test("refuses an implicitly typed scalar where the schema wants a string", () => {
    expect(
      problemsOf(edited("synonyms: [pending, restate]", "synonyms: [pending, 1.10]")),
    ).toEqual([`${SPEC_FILE}: /commands/names/open/synonyms/1 must be string`]);
    expect(problemsOf(edited("header: Todo", "header: true"))).toEqual([
      `${SPEC_FILE}: /lists/todo/header must be string`,
    ]);
  });

  test("refuses a key written twice", () => {
    const problems = problemsOf(edited("    glyph: 🧠\n", "    glyph: 🧠\n    glyph: 🧩\n"));

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(new RegExp(`^${SPEC_FILE}: .*[Mm]ap keys must be unique`));
  });

  test("refuses a spec the schema doesn't allow", () => {
    expect(problemsOf(edited("    glyph: 🧠\n", ""))).toEqual([
      `${SPEC_FILE}: /lists/decide must have required property 'glyph'`,
    ]);
    expect(problemsOf(edited("  minus: ₋\n", "  minus: ₋\n  plus: ₊\n"))).toEqual([
      `${SPEC_FILE}: /tag must NOT have additional properties: plus`,
    ]);
  });

  test("refuses a branch name of one word, and a separator a sentence or a path holds", () => {
    expect(problemsOf(edited("    fewest-words: 2\n", "    fewest-words: 1\n"))).toEqual([
      `${SPEC_FILE}: /subject/branch/fewest-words must be >= 2`,
    ]);
    expect(problemsOf(edited('    separator: "-"\n', '    separator: "."\n'))).toEqual([
      `${SPEC_FILE}: /subject/branch/separator must match pattern "^[-_]$"`,
    ]);
    expect(problemsOf(edited('    separator: "-"\n', '    separator: "/"\n'))).toEqual([
      `${SPEC_FILE}: /subject/branch/separator must match pattern "^[-_]$"`,
    ]);
    expect(problemsOf(edited('    separator: "-"\n', '    separator: "_"\n'))).toEqual([]);
  });

  test("refuses a spec that isn't consistent", () => {
    expect(problemsOf(edited("    glyph: 🧠\n", "    glyph: ✅\n"))).toEqual([
      `${SPEC_FILE}: the glyph ✅ heads more than one list`,
    ]);
  });

  test("keeps its own header in the JSON copy, whatever `$comment` the spec holds", () => {
    const result = compiled(`$comment: mine\n${specText}`, schemaText, fragments);
    const json: unknown = "files" in result ? JSON.parse(result.files.json) : {};

    expect(json).toMatchObject({ $comment: expect.stringContaining(SPEC_FILE) });
  });

  test("refuses an empty schema, which checks nothing", () => {
    expect(compiled(specText, "", fragments)).toEqual({
      problems: [`${SCHEMA_FILE}: is empty, so it checks nothing`],
    });
  });

  test("reports, rather than throws, a schema too loose to shape the spec", () => {
    const result = compiled("lists: {}\n", "type: object\n", fragments);

    expect("problems" in result && result.problems).toEqual([
      expect.stringMatching(new RegExp(`^${SCHEMA_FILE}: lets through a spec the build step can't read: `)),
    ]);
  });

  test("reports, rather than throws, a spec the prose can't be filled from", () => {
    const result = compiled(`plugin: its own\n${specText}`, "type: object\n", fragments);

    expect("problems" in result && result.problems).toEqual([
      `${FRAGMENTS_DIR}/: can't be filled from ${SPEC_FILE}: more than one value for {{plugin}}`,
    ]);
  });

  test("refuses a schema it can't read", () => {
    const result = compiled(specText, "type: [", fragments);

    expect("problems" in result && result.problems[0]).toMatch(
      new RegExp(`^${SCHEMA_FILE}: `),
    );
  });
});

describe("staleOf", () => {
  test("names each file whose committed text isn't what the spec compiles to", () => {
    expect(
      staleOf(
        { "src/protocol/spec.ts": "new", "spec/kanban.json": "same" },
        { "src/protocol/spec.ts": "old", "spec/kanban.json": "same" },
      ),
    ).toEqual(["src/protocol/spec.ts"]);
  });

  test("names a file that isn't committed", () => {
    expect(staleOf({ "src/protocol/spec.ts": "new" }, {})).toEqual([
      "src/protocol/spec.ts",
    ]);
  });
});
