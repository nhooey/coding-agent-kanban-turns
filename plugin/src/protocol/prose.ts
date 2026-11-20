// The protocol's prose rules, the Markdown fragments in spec/fragments/,
// filled in from the spec and assembled into text. A fragment names a list,
// a glyph or a command by a placeholder, `{{lists.decide.header}}`, which
// the spec's values fill, so no fragment restates a value the spec holds.
// The words are all the fragments': this module gives only the spec's
// values, names, glyphs, letters, counts and examples. A value that a rule
// in words rests on exists only while the spec holds that rule, so a spec
// change that ends the rule leaves its placeholder with no value, and the
// build step names the fragment to rewrite.
//
// Pure, and reads the spec it's handed rather than src/protocol/spec.ts, so
// the build step checks the fragments against the spec it compiles, and the
// instructions and the derived skill fill them from the same values.

import {
  firstLetters,
  glyphsInWords,
  kindGlyphs,
  kindLetters,
  lettersInWords,
  optionGlyphs,
  taughtKinds,
} from "./kinds.ts";
import type { Kinds } from "./kinds.ts";
import { cellWidth } from "../text/cells.ts";
import { capitalized, inWords } from "../text/words.ts";

/** What opens and closes a placeholder. */
const OPEN = "{{";
const CLOSE = "}}";

/** A placeholder's name: lower-case words and digits, and a letter's capital, parted by dots and dashes. */
const NAME = /^[a-z0-9][A-Za-z0-9.-]*$/;

/** The example turn id the fragments' examples use, cut to the spec's length. */
const EXAMPLE_TURN = "0f311c94a7d2b5e8";

/** The placeholders the plugin fills itself, not from the spec: its name and its tool's. */
export const OWN_PLACEHOLDERS = ["plugin", "tool"] as const;

/** The plugin's own values, by placeholder. */
export type OwnValues = Readonly<
  Record<(typeof OWN_PLACEHOLDERS)[number], string>
>;

/** The parts of the spec the prose reads, as its schema shapes them. */
export type ProseSpec = Readonly<{
  lists: Readonly<
    Record<
      string,
      Readonly<{ header: string; glyph: string; "rolls-up": boolean }>
    >
  >;
  options: Readonly<{ kinds: Kinds }>;
  commands: Readonly<{
    names: Readonly<
      Record<
        string,
        Readonly<{ synonyms: readonly string[]; "from-last-line": boolean }>
      >
    >;
    "unique-prefix-runs": boolean;
  }>;
  reference: Readonly<{
    "turn-id": Readonly<{ length: number }>;
    letters: Readonly<{ first: string }>;
  }>;
  "roll-up": Readonly<{
    glyph: string;
    header: string;
    "count-label": string;
    "count-separator": string;
  }>;
  tag: Readonly<{ glyph: string; digits: string; minus: string }>;
  characters: Readonly<Record<string, string>>;
}>;

/** One piece of a fragment: text as it's written, or a placeholder by its name. */
export type Piece = Readonly<{ text: string } | { name: string }>;

/** What piecesOf reads: the pieces, or why the text doesn't read. */
type Read = Readonly<{ pieces: readonly Piece[] } | { problem: string }>;

/** A text piece, none for empty text. */
const textPiece = (text: string): readonly Piece[] =>
  text === "" ? [] : [{ text }];

/**
 * A fragment read as text and placeholders, in order, or why it doesn't
 * read: a `{{` with no `}}` after it, or one around something not a name,
 * such as another `{{`. A `}}` with no `{{` before it is text.
 */
export const piecesOf = (text: string): Read => {
  const start = text.indexOf(OPEN);
  const end = start < 0 ? -1 : text.indexOf(CLOSE, start + OPEN.length);
  const name = text.slice(start + OPEN.length, end);
  const rest = end < 0 ? undefined : piecesOf(text.slice(end + CLOSE.length));

  return start < 0
    ? { pieces: textPiece(text) }
    : rest === undefined
      ? { problem: `a ${OPEN} with no ${CLOSE} after it` }
      : !NAME.test(name)
        ? { problem: `the placeholder ${OPEN}${name}${CLOSE} isn't a name` }
        : "problem" in rest
          ? rest
          : {
              pieces: [
                ...textPiece(text.slice(0, start)),
                { name },
                ...rest.pieces,
              ],
            };
};

/** A word in backticks, as the prose writes a command or a letter. */
const coded = (word: string): string => `\`${word}\``;

/** A relative index in the 🔖 tag's subscript, `₋₁₇` for 17 turns back. */
export const subscript = (
  index: number,
  tag: Readonly<{ digits: string; minus: string }>,
): string => {
  const digits = [...tag.digits];

  return `${index < 0 ? tag.minus : ""}${[...String(Math.abs(index))]
    .map((digit) => digits[Number(digit)] ?? digit)
    .join("")}`;
};

/** A character by its code point, `U+2800`; empty for no character. */
export const codepoint = (char: string): string => {
  const point = char.codePointAt(0);

  return point === undefined
    ? ""
    : `U+${point.toString(16).toUpperCase().padStart(4, "0")}`;
};

/** The cells a header takes as drawn: its glyph, a space, its name and the colon, the bold markers not drawn. */
export const headerWidth = (glyph: string, name: string): number =>
  cellWidth(`${glyph} ${name}:`);

/** A header as a final response writes it: `🧠 **Decide:**`. */
const written = (glyph: string, name: string): string =>
  `${glyph} **${name}:**`;

type Entries = readonly (readonly [string, string])[];

/** Every string and number in `value`, by its dotted path; an array's by index. */
const leaves = (value: unknown, path: readonly string[]): Entries =>
  typeof value === "string" || typeof value === "number"
    ? [[path.join("."), String(value)]]
    : typeof value === "object" && value !== null
      ? Object.entries(value).flatMap(([key, each]) =>
          leaves(each, [...path, key]),
        )
      : [];

/** Each list's header, underline and width as drawn. */
const listValues = (spec: ProseSpec): Entries =>
  Object.entries(spec.lists).flatMap(([key, list]): Entries => {
    const width = headerWidth(list.glyph, list.header);

    return [
      [`header.${key}`, written(list.glyph, list.header)],
      [`list.${key}`, `${list.glyph} ${list.header}`],
      [`underline.${key}`, String(width)],
      [
        `rule.${key}`,
        (spec.characters["header-underline"] ?? "").repeat(width),
      ],
    ];
  });

/** The lists' names, those that roll up and those that don't, in the spec's order. */
const listsValues = (spec: ProseSpec): Entries => {
  const lists = Object.values(spec.lists);
  const rolled = lists.filter((list) => list["rolls-up"]);
  const kept = lists.filter((list) => !list["rolls-up"]);

  return [
    ["count.lists", String(lists.length)],
    ["names.lists", inWords(lists.map((list) => list.header))],
    ["names.rolled-up", inWords(rolled.map((list) => list.header))],
    ["names.not-rolled-up", inWords(kept.map((list) => list.header))],
    [
      "glyphs.rolled-up",
      inWords(rolled.map((list) => `${list.glyph} ${list.header}`)),
    ],
  ];
};

/** The example turn id, as long as the spec's turn ids. */
const exampleTurn = (spec: ProseSpec): string =>
  EXAMPLE_TURN.slice(0, spec.reference["turn-id"].length);

/** The roll-up's header as drawn, its underline, the count line's mark, and the examples of its count line and its 🔖 tag. */
const rollUpValues = (spec: ProseSpec): Entries => {
  const rollUp = spec["roll-up"];
  const rolled = Object.values(spec.lists).filter((list) => list["rolls-up"]);
  const width = headerWidth(rollUp.glyph, rollUp.header);

  return [
    ["header.roll-up", written(rollUp.glyph, rollUp.header)],
    ["underline.roll-up", String(width)],
    [
      "rule.roll-up",
      (spec.characters["roll-up-underline"] ?? "").repeat(width),
    ],
    ["roll-up.count-mark", rollUp["count-separator"].trim()],
    ["example.turn", exampleTurn(spec)],
    [
      "example.tag",
      `${spec.tag.glyph} ${exampleTurn(spec)}${subscript(-3, spec.tag)}`,
    ],
    ["example.index", subscript(-17, spec.tag)],
    [
      "example.count-line",
      `${rollUp.glyph} ${rollUp["count-label"]}: ${rolled
        .map((list, n) => `${list.glyph} ${n + 1}`)
        .join(rollUp["count-separator"])}`,
    ],
  ];
};

/** Every prefix of `word`, shortest first. */
const prefixes = (word: string): readonly string[] =>
  [...word].map((_, n) => [...word].slice(0, n + 1).join(""));

/**
 * A command's prefixes, while the spec lets a unique prefix run it: the
 * shortest no other command's name starts with, which runs it, and the
 * longest another command's name starts with, which runs nothing, when
 * there is one.
 */
const prefixValues = (spec: ProseSpec, name: string): Entries => {
  const others = Object.entries(spec.commands.names)
    .filter(([other]) => other !== name)
    .flatMap(([other, command]) => [other, ...command.synonyms]);
  const isShared = (prefix: string): boolean =>
    others.some((other) => other.startsWith(prefix));
  const unique = prefixes(name).find((prefix) => !isShared(prefix)) ?? name;
  const shared = prefixes(name).filter(isShared).at(-1);

  return spec.commands["unique-prefix-runs"]
    ? [
        [`command.${name}.prefix`, coded(unique)],
        ...(shared === undefined
          ? []
          : [[`command.${name}.shared-prefix`, coded(shared)] as const]),
      ]
    : [];
};

/** Each command with its synonyms, its name bare and as a label opens, its prefixes, and which commands trail. */
const commandValues = (spec: ProseSpec): Entries => {
  const names = Object.entries(spec.commands.names);
  const trailing = (is: boolean): string =>
    inWords(
      names
        .filter(([, command]) => command["from-last-line"] === is)
        .map(([name]) => coded(name)),
      "or",
    );

  return [
    ...names.flatMap(([name, command]): Entries => [
      [
        `command.${name}`,
        command.synonyms.length > 0
          ? `${coded(name)} (or ${command.synonyms.map(coded).join(", ")})`
          : coded(name),
      ],
      [`command.${name}.name`, coded(name)],
      [`command.${name}.word`, name],
      [`command.${name}.label`, capitalized(name)],
      ...prefixValues(spec, name),
    ]),
    ["names.trailing", trailing(true)],
    ["names.not-trailing", trailing(false)],
  ];
};

/**
 * The glyphs and letters of the kinds not taught, `👍 or 👎` and `` `Y` or
 * `N` ``, and their options, for the rules that a reply no longer writes
 * them and that `open` reprints them; none while every kind is taught.
 */
const untaughtValues = (spec: ProseSpec, untaught: Kinds): Entries => {
  const kinds = Object.values(untaught);
  const first = spec.reference.letters.first;

  return kinds.length === 0
    ? []
    : [
        ["untaught.glyphs", inWords(kinds.flatMap(kindGlyphs), "or")],
        [
          "untaught.letters",
          inWords(
            kinds.flatMap((kind) => kindLetters(kind, first).map(coded)),
            "or",
          ),
        ],
        [
          "untaught.options",
          inWords(
            kinds.flatMap((kind) =>
              Object.entries(kind.letters).map(
                ([letter, glyph]) => `${glyph} ${coded(letter)}`,
              ),
            ),
          ),
        ],
      ];
};

/** The kinds the instructions teach, in words, with their glyphs and letters; and the kinds they don't. */
const optionValues = (spec: ProseSpec): Entries => {
  const taught = taughtKinds(spec.options.kinds);
  const untaught = Object.fromEntries(
    Object.entries(spec.options.kinds).filter(([name]) => !(name in taught)),
  );
  const first = spec.reference.letters.first;

  return [
    ["kinds.names", inWords(Object.keys(taught).map(coded), "or")],
    ["glyphs.options", glyphsInWords(taught)],
    ["count.option-glyphs", String(optionGlyphs(taught).length)],
    ["letters.example", lettersInWords(taught, first, coded)],
    ["letters.pair", inWords(firstLetters(first, 2).map(coded))],
    ...Object.entries(taught).flatMap(([name, kind]): Entries => [
      [`kind.${name}`, `${inWords(kindGlyphs(kind))} ${name}`],
      [`kind.${name}.name`, name],
      [`letters.${name}`, lettersInWords({ [name]: kind }, first, coded)],
    ]),
    ...untaughtValues(spec, untaught),
  ];
};

/** Each rule character's code point, `U+2800`. */
const characterValues = (spec: ProseSpec): Entries =>
  Object.entries(spec.characters).map(([key, char]) => [
    `codepoint.${key}`,
    codepoint(char),
  ]);

/** Each name more than one entry gives a value for, once. */
const twice = (entries: Entries): readonly string[] => {
  const names = entries.map(([name]) => name);

  return [...new Set(names.filter((name, n) => names.indexOf(name) !== n))];
};

/** Every placeholder's name and value, from each source, before they are checked for a name given twice. */
export const placeholderEntries = (spec: ProseSpec, own: OwnValues): Entries => [
  ...leaves(spec, []),
  ...listValues(spec),
  ...listsValues(spec),
  ...rollUpValues(spec),
  ...commandValues(spec),
  ...optionValues(spec),
  ...characterValues(spec),
  ...Object.entries(own),
];

/** The entries as values by name, refusing, by throwing, a name two of them give: no fragment could tell those apart. */
export const valuesOf = (entries: Entries): Readonly<Record<string, string>> => {
  const named = twice(entries);

  if (named.length > 0) {
    throw new Error(
      `more than one value for ${named.map((name) => `${OPEN}${name}${CLOSE}`).join(", ")}`,
    );
  }

  return Object.fromEntries(entries);
};

/**
 * The value of every placeholder a fragment may name: each string and
 * number in the spec by its path, `lists.decide.header`; the values worked
 * out from them, a header as drawn, `header.decide`, the lists' names in
 * words, `names.lists`, the examples, `example.count-line`; and the
 * plugin's own, `plugin` and `tool`. Throws where two of them name one
 * placeholder.
 */
export const placeholderValues = (
  spec: ProseSpec,
  own: OwnValues,
): Readonly<Record<string, string>> => valuesOf(placeholderEntries(spec, own));

/** A fragment with each placeholder's value in its place; one with no value, or a fragment that doesn't read, left as written. */
export const filled = (
  text: string,
  values: Readonly<Record<string, string>>,
): string => {
  const read = piecesOf(text);

  return "problem" in read
    ? text
    : read.pieces
        .map((piece) =>
          "text" in piece
            ? piece.text
            : (values[piece.name] ?? `${OPEN}${piece.name}${CLOSE}`),
        )
        .join("");
};

/** What's wrong with each fragment, by its name: why it doesn't read, or each placeholder with no value. */
export const fragmentProblems = (
  fragments: Readonly<Record<string, string>>,
  values: Readonly<Record<string, string>>,
): readonly string[] =>
  Object.entries(fragments).flatMap(([name, text]) => {
    const read = piecesOf(text);

    return "problem" in read
      ? [`${name}: ${read.problem}`]
      : read.pieces.flatMap((piece) =>
          "name" in piece && values[piece.name] === undefined
            ? [`${name}: no value in the spec for ${OPEN}${piece.name}${CLOSE}`]
            : [],
        );
  });

/** Each fragment, by name, that none of the outputs uses. */
export const unusedFragments = (
  names: readonly string[],
  outputs: readonly (readonly string[])[],
): readonly string[] =>
  names.filter((name) => !outputs.some((output) => output.includes(name)));

/** The fragments `order` names, filled in from `values`, each parted from the next by a blank line. */
export const assembled = <N extends string>(
  fragments: Readonly<Record<N, string>>,
  order: readonly N[],
  values: Readonly<Record<string, string>>,
): string =>
  order.map((name) => filled(fragments[name], values).trimEnd()).join("\n\n");
