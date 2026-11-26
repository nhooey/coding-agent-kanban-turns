// What an answer says after an item's reference and its `: `, for a list
// with settling words, as the spec's `settling-words` gives the form: a
// word alone, `done`; a word, `: ` and a note, `done: rotated it`; or a
// note alone, any other text. The draft's answers and the user's prompts
// both read it here, and the draft writes it back. No `$`, no I/O.

/** What an answer says: the settling word it opens on, empty for none, and its note, empty for none. */
export type Said = Readonly<{ word: string; note: string }>;

/**
 * What `text`, all that follows a reference's `: `, says among `words`, a
 * list's settling words: a word where the text, up to its first colon, is
 * one of them, ignoring case and the spaces around it, with the rest after
 * that colon its note; else no word, and the whole text a note.
 */
export const saidOf = (text: string, words: readonly string[]): Said => {
  const said = text.trim();
  const colon = said.indexOf(":");
  const head = (colon < 0 ? said : said.slice(0, colon)).trim().toLowerCase();
  const word = words.find((each) => each === head);

  return word === undefined
    ? { word: "", note: said }
    : { word, note: colon < 0 ? "" : said.slice(colon + 1).trim() };
};

/** What an answer says, written after its reference's `: `: the word, then `: ` and the note, either alone, or empty for neither. */
export const saidText = (said: Said): string =>
  [said.word, said.note].filter((part) => part !== "").join(": ");
