// The Decide items themselves: the reference an answer names one by, the
// glyph an option is drawn with, and the items read out of whatever input a
// `kanban_options` call handed over.

import type { DecideItem, DecideKind } from "../types/index.d.ts";

/** The reference an answer names the item by, without its letters. */
export const refOf = (item: DecideItem): string =>
  item.ref || `${item.turn}.Decide.${item.number}`;

const KIND_GLYPH: Readonly<Record<DecideKind, (letter: string) => string>> = {
  checkbox: () => "🔲",
  binary: (letter) => (letter === "N" ? "👎" : "👍"),
  radio: () => "🔘",
};

/** The mark a chosen option is drawn with, in place of its glyph. */
export const CHOSEN_MARK = "✅";

/** The glyph an option is drawn with: its own, else its item kind's. */
export const glyphOf = (item: DecideItem, letter: string): string =>
  item.options.find((o) => o.letter === letter)?.glyph ||
  KIND_GLYPH[item.kind](letter);

/** What an option is drawn with: ✅ while the draft chooses it, else its glyph. */
export const markOf = (
  item: DecideItem,
  letter: string,
  isChosen: boolean,
): string => (isChosen ? CHOSEN_MARK : glyphOf(item, letter));

/**
 * What an option is drawn with in its item, open or Done: ✅ while the draft
 * chooses it, else `sentMark` where the answer that made the item Done
 * picked it, else its glyph.
 */
export const optionMark = (
  item: DecideItem,
  letter: string,
  is: Readonly<{ chosen: boolean; sent: boolean }>,
  sentMark: string,
): string =>
  is.sent && !is.chosen ? sentMark : markOf(item, letter, is.chosen);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isOption = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.letter === "string" &&
  typeof value.name === "string";

const isItem = (value: unknown): value is DecideItem =>
  isRecord(value) &&
  typeof value.turn === "string" &&
  typeof value.number === "number" &&
  typeof value.summary === "string" &&
  Array.isArray(value.options) &&
  value.options.every(isOption);

const kindOf = (kind: unknown): DecideKind =>
  kind === "checkbox" || kind === "binary" ? kind : "radio";

const withRef = (item: DecideItem): DecideItem => ({
  ...item,
  list: "Decide",
  kind: kindOf(item.kind),
  ref: refOf(item),
});

const itemsField = (value: unknown): unknown =>
  isRecord(value) && "items" in value ? value.items : [];

/** The items a `kanban_options` call handed over, whatever else its input held. */
export const itemsOf = (value: unknown): readonly DecideItem[] => {
  const items = itemsField(value);

  return Array.isArray(items) ? items.filter(isItem).map(withRef) : [];
};
