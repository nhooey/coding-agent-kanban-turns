// The build step that compiles the protocol's spec, spec/kanban.yaml, into
// the module the core reads, src/protocol/spec.ts, and a JSON copy,
// spec/kanban.json. Pure: tools/spec/compile.ts reads the files, hands their
// text here, and writes or checks what comes back.
//
// The spec and its schema are read as strictly as a settings file, by
// tools/spec/strict.ts: YAML 1.2's core schema, so `no`, `Y` and `N`
// are strings, and a key written twice refuses the file. The spec is then
// checked against the schema, which types every value, so a plain scalar
// the core schema reads as a number or a boolean where a string belongs is
// refused; then for the consistency no schema can state.

import { messageOf, repeated, strictlyRead } from "./strict.ts";
import type { Problem } from "./strict.ts";
import type { Json } from "../../types/index.d.ts";

/** The spec, its schema and what they compile to, from the plugin's folder. */
export const SPEC_FILE = "spec/kanban.yaml";
export const SCHEMA_FILE = "spec/kanban.schema.yaml";
export const MODULE_FILE = "src/protocol/spec.ts";
export const JSON_FILE = "spec/kanban.json";

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
        aliases: readonly string[];
        "settling-words": Readonly<Record<string, string>>;
      }>
    >
  >;
  options: Readonly<{
    kinds: Readonly<
      Record<
        string,
        Readonly<{ glyph: string; letters: Readonly<Record<string, string>> }>
      >
    >;
  }>;
  commands: Readonly<{
    names: Readonly<Record<string, Readonly<{ synonyms: readonly string[] }>>>;
  }>;
  reference: Readonly<{
    "turn-id": Readonly<{ length: number; shortest: number }>;
    letters: Readonly<{ first: string; last: string }>;
  }>;
}>;

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

/** A letter range that runs backwards, and each option kind's letter outside it. */
const letterProblems = (spec: SpecShape): readonly string[] => {
  const { first, last } = spec.reference.letters;
  const outside = Object.entries(spec.options.kinds).flatMap(([kind, each]) =>
    Object.keys(each.letters)
      .filter((letter) => letter < first || letter > last)
      .map(
        (letter) =>
          `the letter ${letter} of ${kind} is outside the letters, ${first} to ${last}`,
      ),
  );

  return [
    ...(first <= last ? [] : [`the letters run backwards, ${first} to ${last}`]),
    ...outside,
  ];
};

/** Each glyph that marks more than one option kind, its glyph or a letter's. */
const kindGlyphProblems = (spec: SpecShape): readonly string[] =>
  repeated(
    Object.values(spec.options.kinds).flatMap((kind) => [
      ...new Set([kind.glyph, ...Object.values(kind.letters)]),
    ]),
  ).map((glyph) => `the glyph ${glyph} marks more than one option kind`);

/**
 * What's inconsistent in the spec, which its schema can't say:
 *
 * - a count of lists other than 9;
 * - a glyph or a name two lists share;
 * - a word that settles two lists differently;
 * - a command name that starts another's;
 * - a turn id's shortest prefix longer than the id;
 * - a letter range that runs backwards, or an option kind's letter outside it;
 * - a glyph two option kinds share.
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
    ...repeated(lists.flatMap((list) => [list.header, ...list.aliases])).map(
      (name) => `the name ${JSON.stringify(name)} names more than one list`,
    ),
    ...clashingWords(spec),
    ...clashingCommands(spec),
    ...turnIdProblems(spec),
    ...letterProblems(spec),
    ...kindGlyphProblems(spec),
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
  const fields =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? Object.entries(value).filter(([key]) => key !== "$comment")
      : [];

  return `${JSON.stringify({ $comment: header, ...Object.fromEntries(fields) }, null, 2)}\n`;
};

/** The generated files' text, by path, or why the spec doesn't compile. */
export type Compiled = Readonly<
  | { files: Readonly<{ module: string; json: string }> }
  | { problems: readonly string[] }
>;

/**
 * The spec's text compiled against its schema's: the module and the JSON
 * copy, or every problem with either, each naming its file. The spec is
 * checked for consistency only once its schema holds.
 */
export const compiled = (specText: string, schemaText: string): Compiled => {
  // The schema is read strictly, but for `required` naming keys of a map,
  // such as the lists the core reads by name, which strict mode wants
  // spelled out under `properties` too.
  const spec = strictlyRead(specText, schemaText, { strictRequired: false });
  const problems =
    "problems" in spec
      ? spec.problems.map(named)
      : consistencyProblems(spec.value);

  return problems.length > 0 || !("value" in spec)
    ? { problems }
    : {
        files: { module: moduleText(spec.value), json: jsonText(spec.value) },
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
