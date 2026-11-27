// What the spec's option kinds give in more than one place: the kinds the
// instructions teach, the glyphs an option is drawn with, the letters it
// takes, and those in words. Pure, and handed the kinds rather than
// importing the spec, so the build step and the core read them alike.

import { inWords } from "../text/words.ts";

/** One option kind, as the spec's schema shapes it. */
export type Kind = Readonly<{
  picks: string;
  glyph: string;
  letters: Readonly<Record<string, string>>;
  taught: boolean;
}>;

/** The option kinds, by name, in the spec's order. */
export type Kinds = Readonly<Record<string, Kind>>;

/** How many letters an unlettered kind's options name in an example: `A`, `B`, `C`. */
const EXAMPLE_LETTERS = 3;

/** The kinds the instructions teach, in the spec's order; the others are only read. */
export const taughtKinds = (kinds: Kinds): Kinds =>
  Object.fromEntries(Object.entries(kinds).filter(([, kind]) => kind.taught));

/** A kind's glyphs: its letters' own, else its one glyph. */
export const kindGlyphs = (kind: Kind): readonly string[] => {
  const lettered = Object.values(kind.letters);

  return lettered.length > 0 ? lettered : [kind.glyph];
};

/** Every glyph an option of `kinds` is drawn with, its kind's and its letters', once each. */
export const optionGlyphs = (kinds: Kinds): readonly string[] => [
  ...new Set(
    Object.values(kinds).flatMap((kind) => [
      kind.glyph,
      ...Object.values(kind.letters),
    ]),
  ),
];

/** The first `count` letters of the reference grammar's, from `first`: `A`, `B`, `C`. */
export const firstLetters = (
  first: string,
  count: number = EXAMPLE_LETTERS,
): readonly string[] =>
  Array.from({ length: count }, (_, n) =>
    String.fromCharCode(first.charCodeAt(0) + n),
  );

/** A kind's letters: its own, `Y` and `N`, else the first of the reference grammar's, from `first`. */
export const kindLetters = (kind: Kind, first: string): readonly string[] => {
  const own = Object.keys(kind.letters);

  return own.length > 0 ? own : firstLetters(first);
};

/**
 * The letters options of `kinds` take, in words, each one `mark`ed: an
 * unlettered kind's first few, `A, B, C`, a lettered kind's own, `Y and N`,
 * each set once, the sets parted by `, or `.
 */
export const lettersInWords = (
  kinds: Kinds,
  first: string,
  mark: (letter: string) => string = (letter) => letter,
): string =>
  [
    ...new Set(
      Object.values(kinds).map((kind) => {
        const letters = kindLetters(kind, first).map(mark);

        return Object.keys(kind.letters).length > 0
          ? inWords(letters)
          : letters.join(", ");
      }),
    ),
  ].join(", or ");

/**
 * Each kind's glyphs in words, a lettered kind's by each: `🔘 or 🔲`, and
 * with a comma before the `or` where a kind's own glyphs take an `and`:
 * `🔘, 🔲, or 👍 and 👎`.
 */
export const glyphsInWords = (kinds: Kinds): string => {
  const each = Object.values(kinds).map(kindGlyphs);
  const glyphs = each.map((own) => inWords(own));

  return each.some((own) => own.length > 1) && glyphs.length > 1
    ? `${glyphs.slice(0, -1).join(", ")}, or ${glyphs.at(-1) ?? ""}`
    : inWords(glyphs, "or");
};
