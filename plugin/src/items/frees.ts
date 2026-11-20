// What an item frees: the line an item that blocks other work ends on,
// naming the items it frees by reference, `Frees: 0f311c94.Decide.2,
// 0f311c94.Review.1`, read by the spec's grammar; and its references
// resolved against the items the turns hold. No `$`, no I/O.
//
// A reference here is an item's without letters or a note,
// `<turn>.<List>.<n>`: its turn always named, by an id or a prefix of one
// at least the spec's shortest, and its list the header of a list that
// rolls up into 📌. The line is split on the spec's separator and each part
// read on its own, so no pattern spans the line.

import { SPEC } from "../protocol/spec.ts";

const FREES = SPEC.frees;
const TURN = SPEC.reference["turn-id"];

/** What the line opens with: the spec's label and a colon, `Frees:`. */
const OPENING = `${FREES.label}:`;

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

/** Each value, once, in the order it first comes. */
const once = (values: readonly string[]): readonly string[] => [
  ...new Set(values),
];

/** The values that are references, as strings, each once, in order: what a `kanban_options` call's `frees` keeps. */
export const uniqueRefs = (values: readonly unknown[]): readonly string[] =>
  once(
    values.flatMap((value) => {
      const ref = typeof value === "string" ? refOfText(value.trim()) : undefined;

      return ref === undefined ? [] : [refText(ref)];
    }),
  );

/**
 * The references a `Frees:` line names, as written, each once, in order,
 * what isn't one left out; undefined for a line that doesn't open on the
 * spec's label and its colon, its indent aside.
 */
export const freesOfLine = (line: string): readonly string[] | undefined => {
  const text = line.trim();

  return text.startsWith(OPENING)
    ? uniqueRefs(text.slice(OPENING.length).split(FREES.separator))
    : undefined;
};

/** Whether a line is a `Frees:` line, its indent aside. */
export const isFreesLine = (line: string): boolean =>
  freesOfLine(line) !== undefined;

/** The `Frees:` line naming `frees`, as a reply writes it; none where it frees nothing. */
export const freesLineOf = (frees: readonly string[]): readonly string[] =>
  frees.length === 0
    ? []
    : [`${OPENING} ${frees.join(`${FREES.separator} `)}`];

/** The turns a reference may name, by place: from `from`, the latest `reassess` turn at or before the item's, through `at`, the item's own. */
export type Span = Readonly<{ from: number; at: number }>;

/**
 * Each of `refs`, of an item whose references may name the turns `span`
 * among the turns whose ids are `ids`, that names an item `known` holds, by
 * its turn's whole id, each once, in order: the latest turn of the span
 * whose id opens on the reference's and that holds the item. A reference to
 * a later turn, to one before the span, to no turn or to an item no turn
 * holds is left out.
 */
export const resolvedRefs = (
  refs: readonly string[],
  ids: readonly string[],
  span: Span,
  known: ReadonlySet<string>,
): readonly string[] =>
  once(
    refs.flatMap((text) => {
      const ref = refOfText(text);
      const found =
        ref === undefined
          ? undefined
          : ids
              .slice(span.from, span.at + 1)
              .filter((id) => id.startsWith(ref.turn))
              .map((id) => refText({ ...ref, turn: id }))
              .findLast((whole) => known.has(whole));

      return found === undefined ? [] : [found];
    }),
  );
