// The reader of the `kanban_options` tool's input, by the protocol's rules:
// the Decide items a call handed over, with what each item's `supersedes`
// held that names no Decide item; and the reference grammar they're read
// by, an item's reference without letters or a note, `<turn>.<List>.<n>`:
// its turn always named, by an id or a prefix of one at least the spec's
// shortest, and its list the header of a list that rolls up into 📌. No `$`,
// no I/O.

import { DECIDE, DEFAULT_KIND } from "./rules.ts";
import { SPEC } from "./spec.ts";
import { field, isObject } from "../json/fields.ts";
import type { DecideItem, DecideKind, ListedItem } from "../../types/index.d.ts";

const TURN = SPEC.reference["turn-id"];

/** The lists a reference may name, by header: the ones that roll up into 📌, in the spec's order. */
export const FREED_LISTS: readonly string[] = Object.values(SPEC.lists)
  .filter((list) => list["rolls-up"])
  .map((list) => list.header);

/** One item's reference, as a `Frees:` line writes it: its turn's id or a prefix of one, its list's header and its number. */
export type ItemRef = Readonly<{ turn: string; list: string; number: number }>;

/** A reference as a `Frees:` line writes it: `0f311c94.Decide.2`. */
export const refText = ({ turn, list, number }: ItemRef): string =>
  `${turn}.${list}.${number}`;

/** Whether `text` is a turn id or a prefix long enough to name one: its length in the spec's range, each character of its alphabet. */
const isTurnPrefix = (text: string): boolean =>
  text.length >= TURN.shortest &&
  text.length <= TURN.length &&
  [...text].every((char) => TURN.alphabet.includes(char));

/** Whether `text` is an item's number as a list numbers it: digits, from 1, no leading zero. */
const isNumber = (text: string): boolean =>
  text !== "" &&
  !text.startsWith("0") &&
  [...text].every((char) => char >= "0" && char <= "9");

/** The reference `text` is, the whole of it; undefined where it's none. */
export const refOfText = (text: string): ItemRef | undefined => {
  const parts = text.split(".");
  const [turn = "", list = "", number = ""] = parts;

  return parts.length === 3 &&
    isTurnPrefix(turn) &&
    FREED_LISTS.includes(list) &&
    isNumber(number) &&
    Number.isSafeInteger(Number(number))
    ? { turn, list, number: Number(number) }
    : undefined;
};

/** The values that are references, as strings, each once, in order: what a `kanban_options` call's `frees` keeps. */
export const uniqueRefs = (values: readonly unknown[]): readonly string[] => [
  ...new Set(
    values.flatMap((value) => {
      const ref = typeof value === "string" ? refOfText(value.trim()) : undefined;

      return ref === undefined ? [] : [refText(ref)];
    }),
  ),
];

/** The reference an answer names the item by, without its letters: `9efb08a1.Decide.2`, `9efb08a1.Todo.3`, a Decide item's where a `kanban_options` input names no list. */
export const refOf = (item: ListedItem): string =>
  item.ref || `${item.turn}.${item.list || DECIDE.header}.${item.number}`;

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
