// The build step that compiles the protocol's spec, spec/kanban.yaml, into
// the module the core reads, src/protocol/spec.ts, and a JSON copy,
// spec/kanban.json; and its prose fragments, spec/fragments/*.md, into
// src/protocol/fragments.ts, once each placeholder in them has a value in
// the spec. Pure: tools/spec/compile.ts reads the files, hands their text
// here, and writes or checks what comes back.
//
// The spec and its schema are read as strictly as a settings file, by
// tools/spec/strict.ts: YAML 1.2's core schema, so `no`, `Y` and `N`
// are strings, and a key written twice refuses the file. The spec is then
// checked against the schema, which types every value, so a plain scalar
// the core schema reads as a number or a boolean where a string belongs is
// refused; then for the consistency no schema can state.

import { messageOf, repeated, strictlyRead } from "./strict.ts";
import type { Problem } from "./strict.ts";
import {
  OWN_PLACEHOLDERS,
  fragmentProblems,
  placeholderValues,
} from "../../src/protocol/prose.ts";
import type { OwnValues, ProseSpec } from "../../src/protocol/prose.ts";
import { isObject } from "../../src/json/fields.ts";
import type { Json } from "../../types/index.d.ts";

/** The spec, its schema, the prose fragments and what they compile to, from the plugin's folder. */
export const SPEC_FILE = "spec/kanban.yaml";
export const SCHEMA_FILE = "spec/kanban.schema.yaml";
export const MODULE_FILE = "src/protocol/spec.ts";
export const JSON_FILE = "spec/kanban.json";
export const FRAGMENTS_DIR = "spec/fragments";
export const FRAGMENTS_MODULE_FILE = "src/protocol/fragments.ts";

/** How many lists the protocol has. */
const LIST_COUNT = 9;

/** The parts of the spec its consistency rests on, as its schema shapes them. */
export type SpecShape = Readonly<{
  lists: Readonly<
    Record<
      string,
      Readonly<{
        header: string;
        glyph: string;
        "rolls-up": boolean;
        "settled-by": string;
        "settling-words": Readonly<Record<string, string>>;
        feedback: string;
      }>
    >
  >;
  options: Readonly<{
    kinds: Readonly<Record<string, Readonly<{ glyph: string }>>>;
  }>;
  commands: Readonly<{
    names: Readonly<Record<string, Readonly<{ synonyms: readonly string[] }>>>;
  }>;
  reference: Readonly<{
    "turn-id": Readonly<{ length: number; shortest: number }>;
    letters: Readonly<{ first: string; last: string }>;
  }>;
  subject: Readonly<{
    alphabet: string;
    "stop-words": readonly string[];
    entry: Readonly<{
      label: string;
      digits: Readonly<{ fewest: number; most: number }>;
    }>;
    branch: Readonly<{ label: string }>;
  }>;
}>;

/** The way that settles nothing, the one way a list that doesn't roll up is settled by. */
const SETTLED_BY_NOTHING = "none";

/** The way an answer settles, and the one list whose items the core reads answers to: Decide's. */
const SETTLED_BY_ANSWER = "answer";
const ANSWERED_LIST = "decide";

/** The way a settling word settles, and the one list whose items the core reads settling words to: Todo's. */
const SETTLED_BY_WORD = "settling-word";
const WORDED_LIST = "todo";

/**
 * Each list settled by a way it can't be: one that doesn't roll up, so none
 * of its items stays open to settle, by a way that settles something; a
 * list other than Decide by an answer; and a list other than Todo, or one
 * with no settling words, by a settling word.
 */
const settledByProblems = (spec: SpecShape): readonly string[] =>
  Object.entries(spec.lists).flatMap(([key, list]) => [
    ...(!list["rolls-up"] && list["settled-by"] !== SETTLED_BY_NOTHING
      ? [
          `${key} doesn't roll up, so none of its items stays open to settle, yet it's settled by ${list["settled-by"]}`,
        ]
      : []),
    ...(key !== ANSWERED_LIST && list["settled-by"] === SETTLED_BY_ANSWER
      ? [
          `${key} is settled by ${SETTLED_BY_ANSWER}, which reads only the ${ANSWERED_LIST} list's items`,
        ]
      : []),
    ...(key !== WORDED_LIST && list["settled-by"] === SETTLED_BY_WORD
      ? [
          `${key} is settled by ${SETTLED_BY_WORD}, which reads only the ${WORDED_LIST} list's items`,
        ]
      : []),
    ...(list["settled-by"] === SETTLED_BY_WORD &&
    Object.keys(list["settling-words"]).length === 0
      ? [`${key} is settled by ${SETTLED_BY_WORD}, yet it has no settling-words`]
      : []),
  ]);

/** The feedback of a list whose items an option answers: the one a list settled by an answer takes. */
const FEEDBACK_OPTIONS = "options";

/** The feedback of a list whose items a settling word answers: the one a list with settling words takes. */
const FEEDBACK_WORDS = "settling-words";

/**
 * Each list whose feedback its other keys belie: `options` on a list not
 * settled by an answer, or another feedback on one that is; and
 * `settling-words` on a list with none, or another feedback on one with
 * some.
 */
const feedbackProblems = (spec: SpecShape): readonly string[] =>
  Object.entries(spec.lists).flatMap(([key, list]) => [
    ...((list.feedback === FEEDBACK_OPTIONS) !== (list["settled-by"] === SETTLED_BY_ANSWER)
      ? [
          `${key}'s feedback is ${list.feedback} and it's settled by ${list["settled-by"]}: a list is answered by ${FEEDBACK_OPTIONS} exactly when it's settled by ${SETTLED_BY_ANSWER}`,
        ]
      : []),
    ...((list.feedback === FEEDBACK_WORDS) !== Object.keys(list["settling-words"]).length > 0
      ? [
          `${key}'s feedback is ${list.feedback} and it has ${Object.keys(list["settling-words"]).length} settling-words: a list is answered by ${FEEDBACK_WORDS} exactly when it has some`,
        ]
      : []),
  ]);

/** Each settling word two lists give different effects, with the lists, by name. */
const clashingWords = (spec: SpecShape): readonly string[] => {
  const uses = Object.entries(spec.lists).flatMap(([key, list]) =>
    Object.entries(list["settling-words"]).map(([word, effect]) => ({
      key,
      word,
      effect,
    })),
  );

  return [...new Set(uses.map((use) => use.word))].flatMap((word) => {
    const of = uses.filter((use) => use.word === word);

    return new Set(of.map((use) => use.effect)).size > 1
      ? [
          `the word ${JSON.stringify(word)} settles ${of
            .map((use) => use.key)
            .toSorted()
            .join(" and ")} differently`,
        ]
      : [];
  });
};

/**
 * Each name of one command that starts a name of another, so a word that
 * is that name, or a prefix of it, names both and runs neither.
 */
const clashingCommands = (spec: SpecShape): readonly string[] => {
  const commands = Object.entries(spec.commands.names).map(
    ([command, { synonyms }]) => ({ command, names: [command, ...synonyms] }),
  );

  return commands.flatMap(({ command, names }) =>
    commands
      .filter((other) => other.command !== command)
      .flatMap((other) =>
        names.flatMap((name) => {
          const longer = other.names.find((each) => each.startsWith(name));

          return longer === undefined
            ? []
            : [
                `the name ${JSON.stringify(name)} of ${command} starts the name ${JSON.stringify(longer)} of ${other.command}, so it doesn't name ${command} alone`,
              ];
        }),
      ),
  );
};

/** A turn id's shortest prefix longer than the id, so no prefix names a turn. */
const turnIdProblems = (spec: SpecShape): readonly string[] => {
  const { length, shortest } = spec.reference["turn-id"];

  return shortest <= length
    ? []
    : [
        `the turn id's shortest prefix, ${shortest}, is longer than the turn id, ${length}`,
      ];
};

/** A letter range that runs backwards. */
const letterProblems = (spec: SpecShape): readonly string[] => {
  const { first, last } = spec.reference.letters;

  return first <= last ? [] : [`the letters run backwards, ${first} to ${last}`];
};

/**
 * A backlog entry's digit count that runs backwards; one label for an
 * entry's key and a branch's, so an entry's digits and a branch name
 * alike could match; and each stop word with a character outside the
 * subject's alphabet, which no word read from a summary holds, so it stops
 * nothing.
 */
const subjectProblems = (spec: SpecShape): readonly string[] => {
  const { alphabet, entry, branch } = spec.subject;
  const { fewest, most } = entry.digits;

  return [
    ...(fewest <= most
      ? []
      : [`a backlog entry's digits run backwards, ${fewest} to ${most}`]),
    ...(entry.label !== branch.label
      ? []
      : [
          `a backlog entry's key and a branch's both open with ${JSON.stringify(entry.label)}, so the kinds of key aren't kept apart`,
        ]),
    ...spec.subject["stop-words"]
      .filter((word) => [...word].some((char) => !alphabet.includes(char)))
      .map(
        (word) =>
          `the stop word ${JSON.stringify(word)} holds a character outside the subject's alphabet, so it stops nothing`,
      ),
  ];
};

/** Each glyph that marks more than one option kind. */
const kindGlyphProblems = (spec: SpecShape): readonly string[] =>
  repeated(Object.values(spec.options.kinds).map((kind) => kind.glyph)).map(
    (glyph) => `the glyph ${glyph} marks more than one option kind`,
  );

/**
 * What's inconsistent in the spec, which its schema can't say:
 *
 * - a count of lists other than 9;
 * - a glyph or a name two lists share;
 * - a list that doesn't roll up yet is settled by a way other than `none`,
 *   or a list other than Decide settled by `answer`;
 * - a list answered by `options` that isn't settled by `answer`, or the
 *   other way round, and one answered by `settling-words` that has none,
 *   or the other way round;
 * - a word that settles two lists differently;
 * - a command name that starts another's;
 * - a turn id's shortest prefix longer than the id;
 * - a letter range that runs backwards;
 * - a glyph two option kinds share;
 * - a backlog entry's digit count that runs backwards, one label for an
 *   entry's key and a branch's, or a stop word with a character outside
 *   the subject's alphabet.
 */
export const specProblems = (spec: SpecShape): readonly string[] => {
  const lists = Object.values(spec.lists);

  return [
    ...(lists.length === LIST_COUNT
      ? []
      : [`holds ${lists.length} lists, not ${LIST_COUNT}`]),
    ...repeated(lists.map((list) => list.glyph)).map(
      (glyph) => `the glyph ${glyph} heads more than one list`,
    ),
    ...repeated(lists.map((list) => list.header)).map(
      (name) => `the name ${JSON.stringify(name)} names more than one list`,
    ),
    ...settledByProblems(spec),
    ...feedbackProblems(spec),
    ...clashingWords(spec),
    ...clashingCommands(spec),
    ...turnIdProblems(spec),
    ...letterProblems(spec),
    ...kindGlyphProblems(spec),
    ...subjectProblems(spec),
  ];
};

/**
 * specProblems's problems, each naming the spec, or, when a schema too loose
 * to shape the spec lets through a spec it can't read, why.
 */
const consistencyProblems = (spec: Json): readonly string[] => {
  try {
    return specProblems(spec as SpecShape).map(
      (problem) => `${SPEC_FILE}: ${problem}`,
    );
  } catch (error) {
    return [
      `${SCHEMA_FILE}: lets through a spec the build step can't read: ${messageOf(error)}`,
    ];
  }
};

/** A problem strict reading found, naming its file. */
const named = (problem: Problem): string =>
  `${problem.in === "schema" ? SCHEMA_FILE : SPEC_FILE}: ${problem.problem}`;

/** The header each generated file opens with, naming what it's generated from. */
const GENERATED = `Generated from plugin/${SPEC_FILE} by plugin/tools/spec/compile.ts: edit the spec and run spec-build, never this file.`;

/** The header the fragments' module opens with. */
const FRAGMENTS_GENERATED = `Generated from plugin/${FRAGMENTS_DIR}/ by plugin/tools/spec/compile.ts: edit the fragments and run spec-build, never this file.`;

/** The module the core reads: the spec as one deeply readonly value, and its type. */
export const moduleText = (value: Json): string =>
  [
    `// The kanban turn-response protocol's checkable rules. ${GENERATED}`,
    "",
    `export const SPEC = ${JSON.stringify(value, null, 2)} as const;`,
    "",
    "/** The spec's type: deeply readonly, each value its literal. */",
    "export type Spec = typeof SPEC;",
    "",
  ].join("\n");

/** The JSON copy, its header in `$comment`: first, and never the spec's own. */
export const jsonText = (value: Json): string => {
  const header = `The kanban turn-response protocol's checkable rules. ${GENERATED}`;
  const fields = isObject(value)
    ? Object.entries(value).filter(([key]) => key !== "$comment")
    : [];

  return `${JSON.stringify({ $comment: header, ...Object.fromEntries(fields) }, null, 2)}\n`;
};

/** The fragments' module: each fragment's text by its name, in the order given, without its trailing blank lines. */
export const fragmentsModuleText = (
  fragments: Readonly<Record<string, string>>,
): string =>
  [
    `// The kanban turn-response protocol's prose rules, a fragment per topic, their placeholders unfilled. ${FRAGMENTS_GENERATED}`,
    "",
    `export const FRAGMENTS = ${JSON.stringify(
      Object.fromEntries(
        Object.entries(fragments).map(([name, text]) => [name, text.trimEnd()]),
      ),
      null,
      2,
    )} as const;`,
    "",
    "/** A fragment's name: its file's, without `.md`. */",
    "export type FragmentName = keyof typeof FRAGMENTS;",
    "",
  ].join("\n");

/** A fragment's name, as a plan node's id is: lower-case words and dashes. */
const FRAGMENT_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The values the plugin fills its own placeholders with, for the check alone. */
const OWN_FOR_CHECK = Object.fromEntries(
  OWN_PLACEHOLDERS.map((name) => [name, name]),
) as OwnValues;

/**
 * What's wrong with each fragment, naming its file: a name that isn't an
 * id, a fragment that doesn't read, or a placeholder the spec has no value
 * for. Or, when the prose can't be filled from the spec, why: a schema too
 * loose to shape the spec let through one the prose can't read, or two of
 * the spec's values name one placeholder.
 */
const fragmentFileProblems = (
  spec: Json,
  fragments: Readonly<Record<string, string>>,
): readonly string[] => {
  try {
    return [
      ...Object.keys(fragments)
        .filter((name) => !FRAGMENT_NAME.test(name))
        .map(
          (name) =>
            `${FRAGMENTS_DIR}/${name}.md: isn't named in lower-case words and dashes`,
        ),
      ...fragmentProblems(
        Object.fromEntries(
          Object.entries(fragments).map(([name, text]) => [
            `${FRAGMENTS_DIR}/${name}.md`,
            text,
          ]),
        ),
        placeholderValues(spec as unknown as ProseSpec, OWN_FOR_CHECK),
      ),
    ];
  } catch (error) {
    return [
      `${FRAGMENTS_DIR}/: can't be filled from ${SPEC_FILE}: ${messageOf(error)}`,
    ];
  }
};

/** The generated files' text, by path, or why the spec doesn't compile. */
export type Compiled = Readonly<
  | { files: Readonly<{ module: string; json: string; fragments: string }> }
  | { problems: readonly string[] }
>;

/**
 * The spec's text compiled against its schema's, with the prose
 * fragments' text by name: the spec's module, its JSON copy and the
 * fragments' module, or every problem with any, each naming its file. The
 * spec is checked for consistency only once its schema holds, and the
 * fragments against the spec only once it's consistent.
 */
export const compiled = (
  specText: string,
  schemaText: string,
  fragments: Readonly<Record<string, string>>,
): Compiled => {
  // The schema is read strictly, but for `required` naming keys of a map,
  // such as the lists the core reads by name, which strict mode wants
  // spelled out under `properties` too.
  const spec = strictlyRead(specText, schemaText, { strictRequired: false });
  const problems =
    "problems" in spec
      ? spec.problems.map(named)
      : consistencyProblems(spec.value);
  const all =
    problems.length === 0 && "value" in spec
      ? fragmentFileProblems(spec.value, fragments)
      : problems;

  return all.length > 0 || !("value" in spec)
    ? { problems: all }
    : {
        files: {
          module: moduleText(spec.value),
          json: jsonText(spec.value),
          fragments: fragmentsModuleText(fragments),
        },
      };
};

/** The paths whose `committed` text isn't what they compile to, in `compiled`'s order. */
export const staleOf = (
  compiledFiles: Readonly<Record<string, string>>,
  committed: Readonly<Record<string, string>>,
): readonly string[] =>
  Object.entries(compiledFiles)
    .filter(([path, text]) => committed[path] !== text)
    .map(([path]) => path);
