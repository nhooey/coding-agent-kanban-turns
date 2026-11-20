// Words in a sentence, as the protocol's prose and the tool's schema write
// a list of names, glyphs or letters.

/** Words in a sentence: `a, b and c`, by `conjunction`. */
export const inWords = (
  words: readonly string[],
  conjunction = "and",
): string =>
  words.length > 1
    ? `${words.slice(0, -1).join(", ")} ${conjunction} ${words.at(-1) ?? ""}`
    : words.join("");

/** A word with its first letter a capital, as a label opens: `Reassess`. */
export const capitalized = (word: string): string =>
  `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
