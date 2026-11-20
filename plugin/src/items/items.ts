// The Decide items themselves: the reference an answer names one by, the
// glyph an option is drawn with, and the items read out of whatever input a
// `kanban_options` call handed over.

import { uniqueRefs } from "./frees.ts";
import { DECIDE, DEFAULT_KIND } from "../protocol/rules.ts";
import { SPEC } from "../protocol/spec.ts";
import type { DecideItem, DecideKind } from "../../types/index.d.ts";

/** The reference an answer names the item by, without its letters. */
export const refOf = (item: DecideItem): string =>
  item.ref || `${item.turn}.${DECIDE.header}.${item.number}`;

/** The glyph a kind draws an option with: its letter's own, else the kind's. */
const kindGlyph = (kind: DecideKind, letter: string): string => {
  const spec = SPEC.options.kinds[kind];
  const lettered: Readonly<Record<string, string>> = spec.letters;

  return Object.hasOwn(lettered, letter) ? (lettered[letter] ?? spec.glyph) : spec.glyph;
};

/** The mark a chosen option is drawn with, in place of its glyph. */
export const CHOSEN_MARK = "✅";

/** The glyph an option is drawn with: its own, else its item kind's. */
export const glyphOf = (item: DecideItem, letter: string): string =>
  item.options.find((o) => o.letter === letter)?.glyph ||
  kindGlyph(item.kind, letter);

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

/** An item's kind: the one it names, where the spec has it, else the default, radio. */
const kindOf = (kind: unknown): DecideKind =>
  typeof kind === "string" && Object.hasOwn(SPEC.options.kinds, kind)
    ? (kind as DecideKind)
    : DEFAULT_KIND;

/** What an item frees, where the call gave it as an array: its strings that are references, each once; none otherwise. */
const freesField = (frees: unknown): Pick<DecideItem, "frees"> =>
  Array.isArray(frees) ? { frees: uniqueRefs(frees) } : {};

const withRef = ({ frees, ...item }: DecideItem): DecideItem => ({
  ...item,
  list: DECIDE.header,
  kind: kindOf(item.kind),
  ref: refOf(item),
  ...freesField(frees),
});

const itemsField = (value: unknown): unknown =>
  isRecord(value) && "items" in value ? value.items : [];

/** The items a `kanban_options` call handed over, whatever else its input held. */
export const itemsOf = (value: unknown): readonly DecideItem[] => {
  const items = itemsField(value);

  return Array.isArray(items) ? items.filter(isItem).map(withRef) : [];
};
