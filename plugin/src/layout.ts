// How an item's text is laid out: the indent its options sit at, the cells
// a line's lead takes, and its code spans.

/**
 * Columns an option sits in from its item's summary, and its ➕ and ➖ lines
 * from the option.
 */
export const INDENT = 3;

/** A character that takes no cell: a combining mark, a joiner or a variation selector. */
const ZERO_WIDTH = /^[\p{Mn}\p{Me}\p{Cf}]$/u;

/** A grapheme drawn as an emoji: one presented so by default, or by U+FE0F. */
const EMOJI = /\p{Emoji_Presentation}|️/u;

/** A grapheme East Asian Width calls wide or fullwidth. */
const EAST_ASIAN_WIDE =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦\u{20000}-\u{3FFFD}]/u;

const graphemes = (text: string): readonly string[] =>
  [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map(
    (part) => part.segment,
  );

/** The cells one grapheme takes: 2 for an emoji or a wide character, 0 for one of zero-width characters alone, else 1. */
const graphemeWidth = (grapheme: string): number =>
  EMOJI.test(grapheme) || EAST_ASIAN_WIDE.test(grapheme)
    ? 2
    : [...grapheme].every((c) => ZERO_WIDTH.test(c))
      ? 0
      : 1;

/**
 * The cells `text` takes in a terminal, as the engine counts them: an
 * emoji 2, whatever it's joined or varied with, a wide character 2, a
 * combining mark 0, anything else 1. What a line's lead, such as `🔘 A. `,
 * takes, for the lines it wraps to to start under its text.
 */
export const cellWidth = (text: string): number =>
  graphemes(text).reduce((cells, grapheme) => cells + graphemeWidth(grapheme), 0);

/** A line split at its backticks: even parts are prose, odd parts code. */
export const codeSpans = (
  line: string,
): readonly { text: string; isCode: boolean }[] =>
  line
    .split("`")
    .map((text, n) => ({
      text: text.replaceAll("**", ""),
      isCode: n % 2 === 1,
    }))
    .filter((part) => part.text !== "");
