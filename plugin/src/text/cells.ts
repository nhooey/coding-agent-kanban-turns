// The cells text takes in a terminal, which the pane lays its lines out by
// and the protocol's prose measures a header's underline by.

/** A character that takes no cell: a combining mark, a joiner or a variation selector. */
const ZERO_WIDTH = /^[\p{Mn}\p{Me}\p{Cf}]$/u;

/** A character presented as an emoji by default. */
const EMOJI_PRESENTATION = /^\p{Emoji_Presentation}$/u;

/** A character an emoji presentation selector, U+FE0F, makes an emoji. */
const EMOJI = /^\p{Emoji}$/u;

/** A regional indicator, two of which make a flag. */
const REGIONAL_INDICATOR = /^[\u{1F1E6}-\u{1F1FF}]$/u;

/** U+FE0F and U+FE0E, which ask for a character's emoji or text presentation. */
const EMOJI_SELECTOR = "\u{FE0F}";
const TEXT_SELECTOR = "\u{FE0E}";

/**
 * The code points East Asian Width calls wide or fullwidth and that aren't
 * emoji by default, first and last of each range.
 */
const EAST_ASIAN_WIDE: readonly (readonly [number, number])[] = [
  [0x1100, 0x115f],
  [0x2329, 0x232a],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xa960, 0xa97f],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe4f],
  [0xfe50, 0xfe6b],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1b000, 0x1b2ff],
  [0x1f202, 0x1f202],
  [0x1f210, 0x1f219],
  [0x20000, 0x3fffd],
];

const isEastAsianWide = (char: string): boolean => {
  const point = char.codePointAt(0) ?? 0;

  return EAST_ASIAN_WIDE.some(([first, last]) => point >= first && point <= last);
};

/** Splits text into the graphemes a terminal draws as one: a letter and its marks, an emoji and its joins. */
const SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });

const graphemes = (text: string): readonly string[] =>
  [...SEGMENTER.segment(text)].map((part) => part.segment);

/**
 * The cells one grapheme takes, by its first character and what follows:
 * a wide or fullwidth character 2; a character asked for as text, by
 * U+FE0E, 1; an emoji by default, or one U+FE0F asks for, 2, but for a
 * regional indicator alone, which isn't a flag, 1; zero-width characters
 * alone 0; anything else 1.
 */
const graphemeWidth = (grapheme: string): number => {
  const chars = [...grapheme];
  const base = chars[0] ?? "";

  return isEastAsianWide(base)
    ? 2
    : chars.includes(TEXT_SELECTOR)
      ? 1
      : REGIONAL_INDICATOR.test(base)
        ? chars.filter((c) => REGIONAL_INDICATOR.test(c)).length === 2
          ? 2
          : 1
        : EMOJI_PRESENTATION.test(base) ||
            (EMOJI.test(base) && chars.includes(EMOJI_SELECTOR))
          ? 2
          : chars.every((c) => ZERO_WIDTH.test(c))
            ? 0
            : 1;
};

/**
 * The cells `text` takes in a terminal: an emoji 2, whatever it's joined
 * or varied with, a wide character 2, a combining mark 0, anything else 1.
 * What a line's lead, such as `🔘 A. `, takes, for the lines it wraps to to
 * start under its text, and what a header's underline runs under.
 */
export const cellWidth = (text: string): number =>
  graphemes(text).reduce(
    (cells, grapheme) => cells + graphemeWidth(grapheme),
    0,
  );

/** `text` with spaces after it until it takes `cells` cells; as it is where it already takes that many or more. */
export const padToCells = (text: string, cells: number): string =>
  `${text}${" ".repeat(Math.max(0, cells - cellWidth(text)))}`;

/** The cells the widest of `texts` takes; 0 for none. */
export const widestCells = (texts: readonly string[]): number =>
  Math.max(0, ...texts.map(cellWidth));
