// What the spec's option kinds give in more than one place: the glyphs an
// option is drawn with, the letters an option takes, and those in words.
// Pure, and handed the kinds rather than importing the spec, so the build
// step and the core read them alike.

import { inWords } from "../text/words.ts";

/** One option kind, as the spec's schema shapes it. */
export type Kind = Readonly<{
  picks: string;
  glyph: string;
}>;

/** The option kinds, by name, in the spec's order. */
export type Kinds = Readonly<Record<string, Kind>>;

/** How many letters an example's options name: `A`, `B`, `C`. */
const EXAMPLE_LETTERS = 3;

/** Every glyph an option of `kinds` is drawn with, once each. */
export const optionGlyphs = (kinds: Kinds): readonly string[] => [
  ...new Set(Object.values(kinds).map((kind) => kind.glyph)),
];

/** The first `count` letters of the reference grammar's, from `first`: `A`, `B`, `C`. */
export const firstLetters = (
  first: string,
  count: number = EXAMPLE_LETTERS,
): readonly string[] =>
  Array.from({ length: count }, (_, n) =>
    String.fromCharCode(first.charCodeAt(0) + n),
  );

/** The first few letters an option takes, from `first`, in words, each one `mark`ed: `A, B, C`. */
export const lettersInWords = (
  first: string,
  mark: (letter: string) => string = (letter) => letter,
): string => firstLetters(first).map(mark).join(", ");

/** The kinds' glyphs in words, once each: `🔘 or 🔲`. */
export const glyphsInWords = (kinds: Kinds): string =>
  inWords(optionGlyphs(kinds), "or");
