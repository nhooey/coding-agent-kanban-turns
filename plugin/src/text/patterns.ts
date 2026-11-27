// Text as a part of a regular expression, as the protocol's patterns and
// the transcript's readers build theirs from a name, a glyph or a header.

/** Text as a regular expression, `u` flag or not, matches it literally. */
export const escaped = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
