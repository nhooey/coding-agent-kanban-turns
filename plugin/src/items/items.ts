// The Decide items themselves: the reference an answer names one by, the
// glyph or mark an option is drawn with, and the items read out of whatever
// input a `kanban_options` call handed over, with what each item's
// `supersedes` held that names no Decide item.

import { refOfText, refText, uniqueRefs } from "./frees.ts";
import type { ItemRef } from "./frees.ts";
import { DECIDE, DEFAULT_KIND, paneListOf } from "../protocol/rules.ts";
import type { ListName } from "../protocol/rules.ts";
import { SPEC } from "../protocol/spec.ts";
import { field, isObject } from "../json/fields.ts";
import type { DecideItem, DecideKind, ListedItem } from "../../types/index.d.ts";

/** The reference an answer names the item by, without its letters: `9efb08a1.Decide.2`, `9efb08a1.Todo.3`, a Decide item's where the input names no list. */
export const refOf = (item: ListedItem): string =>
  item.ref || `${item.turn}.${listOf(item).header}.${item.number}`;

/** Whether the item is a Decide item, the case with options. */
export const isDecide = (item: ListedItem): item is DecideItem =>
  "options" in item;

/** The list an item is of, as its label and a list's header name it: the spec's list its `list` names, Decide's for one the pane doesn't draw. */
export const listOf = (item: ListedItem): ListName =>
  paneListOf(item.list) ?? DECIDE;

/** Whether two turn ids name one turn: either may be a prefix of the other, as an answer's may; an empty one names none. */
export const isSameTurn = (a: string, b: string): boolean =>
  a !== "" && b !== "" && (a.startsWith(b) || b.startsWith(a));

/** The glyph a kind draws an option with: its letter's own, else the kind's. */
const kindGlyph = (kind: DecideKind, letter: string): string => {
  const spec = SPEC.options.kinds[kind];
  const lettered: Readonly<Record<string, string>> = spec.letters;

  return Object.hasOwn(lettered, letter) ? (lettered[letter] ?? spec.glyph) : spec.glyph;
};

/** The glyph an option is drawn with: its own, else its item kind's. */
export const glyphOf = (item: DecideItem, letter: string): string =>
  item.options.find((o) => o.letter === letter)?.glyph ||
  kindGlyph(item.kind, letter);

/** What an option is drawn with: `chosenMark`, the `marks.chosen` setting, while the draft chooses it, else its glyph. */
export const markOf = (
  item: DecideItem,
  letter: string,
  isChosen: boolean,
  chosenMark: string,
): string => (isChosen ? chosenMark : glyphOf(item, letter));

/**
 * What an option is drawn with in its item, open or Done, by the `marks`
 * settings: `chosen` while the draft chooses it, else `sent` where the
 * answer that made the item Done picked it, else its glyph.
 */
export const optionMark = (
  item: DecideItem,
  letter: string,
  is: Readonly<{ chosen: boolean; sent: boolean }>,
  marks: Readonly<{ chosen: string; sent: string }>,
): string =>
  is.sent && !is.chosen
    ? marks.sent
    : markOf(item, letter, is.chosen, marks.chosen);

const isOption = (value: unknown): boolean =>
  isObject(value) &&
  typeof value.letter === "string" &&
  typeof value.name === "string";

const isItem = (value: unknown): value is DecideItem =>
  isObject(value) &&
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

/** The Decide item a reference names, `682e71fb.Decide.1`, the whole of `text` but its edges' blanks; undefined for anything else, a reference to another list's item among them. */
export const decideRefOf = (text: unknown): ItemRef | undefined => {
  const ref = typeof text === "string" ? refOfText(text.trim()) : undefined;

  return ref?.list === DECIDE.header ? ref : undefined;
};

/** The Decide items' references among what a call gave as `supersedes`, each once, as refText writes them. */
const supersededRefs = (values: readonly unknown[]): readonly string[] => [
  ...new Set(
    values.flatMap((value) => {
      const ref = decideRefOf(value);

      return ref === undefined ? [] : [refText(ref)];
    }),
  ),
];

/**
 * What an item supersedes: where the call gave an array, its Decide items'
 * references, each once, `[]` for an empty one; none, as though it gave
 * none, for anything else, or for an array none of whose values is a
 * reference, so the item replaces an earlier one on its subject.
 */
const supersedesField = (supersedes: unknown): Pick<DecideItem, "supersedes"> => {
  const refs = Array.isArray(supersedes) ? supersededRefs(supersedes) : [];

  return Array.isArray(supersedes) && (supersedes.length === 0 || refs.length > 0)
    ? { supersedes: refs }
    : {};
};

const withRef = ({ frees, supersedes, ...item }: DecideItem): DecideItem => ({
  ...item,
  list: DECIDE.header,
  kind: kindOf(item.kind),
  ref: refOf({ ...item, list: DECIDE.header }),
  ...freesField(frees),
  ...supersedesField(supersedes),
});

const itemsField = (value: unknown): unknown =>
  isObject(value) && "items" in value ? value.items : [];

/** The items a `kanban_options` call handed over, whatever else its input held. */
export const itemsOf = (value: unknown): readonly DecideItem[] => {
  const items = itemsField(value);

  return Array.isArray(items) ? items.filter(isItem).map(withRef) : [];
};

/**
 * What itemsOf left out of an item's `supersedes`, by the item's ref, each
 * value as JSON, and why: `some`, values that name no Decide item beside
 * others that do; `all`, a list of which none does; `list`, a value that's
 * no list. After `all` or `list` the item supersedes as though it gave no
 * `supersedes`, an earlier item on its subject.
 */
export type Ignored = Readonly<{
  ref: string;
  values: readonly string[];
  left: "some" | "all" | "list";
}>;

/** A value as the tool's result quotes it: as JSON, a string in its quotes. */
const quoted = (value: unknown): string => JSON.stringify(value) ?? String(value);

/** What itemsOf leaves out of what an item gave as `supersedes`; undefined where it gave none or left out nothing. */
const ignoredOf = (
  ref: string,
  given: unknown,
): Ignored | undefined => {
  const values = Array.isArray(given)
    ? given.filter((each) => decideRefOf(each) === undefined).map(quoted)
    : [];

  return given === undefined
    ? undefined
    : !Array.isArray(given)
      ? { ref, values: [quoted(given)], left: "list" }
      : values.length === 0
        ? undefined
        : { ref, values, left: values.length === given.length ? "all" : "some" };
};

/**
 * What the items a `kanban_options` call handed over held in `supersedes`
 * that itemsOf leaves out, by each item's ref, as ignoredOf gives it: what
 * names no Decide item, `<turn>.Decide.<n>`, or a value that's no list. An
 * item that gave no `supersedes`, or whose values all name items, is left
 * out.
 */
export const ignoredSupersedes = (value: unknown): readonly Ignored[] => {
  const items = itemsField(value);

  return (Array.isArray(items) ? items.filter(isItem) : []).flatMap(
    (item) => ignoredOf(refOf(item), field(item, "supersedes")) ?? [],
  );
};

/**
 * An open item as `kanban_outstanding` hands it back, for the agent to
 * raise again: its `supersedes` left out, since what it named is settled
 * already.
 */
export const reraisable = ({ supersedes: _, ...item }: DecideItem): DecideItem =>
  item;
