// How an item's text is laid out: the indent its options sit at, and its
// code spans.

/**
 * Columns an option sits in from its item's summary, and its ➕ and ➖ lines
 * from the option.
 */
export const INDENT = 3;

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
