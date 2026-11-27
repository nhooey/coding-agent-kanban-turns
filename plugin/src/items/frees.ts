// What an item frees: the line an item that blocks other work ends on,
// naming the items it frees by reference, `Frees: 0f311c94.Decide.2,
// 0f311c94.Review.1`, read by the spec's grammar; and its references
// resolved against the items the turns hold. No `$`, no I/O.
//
// A reference here is an item's without letters or a note, read by
// protocol/options-input.ts's refOfText. The line is split on the spec's
// separator and each part read on its own, so no pattern spans the line.

import { refOfText, refText, uniqueRefs } from "../protocol/options-input.ts";
import { SPEC } from "../protocol/spec.ts";

const FREES = SPEC.frees;

/** What the line opens with: the spec's label and a colon, `Frees:`. */
const OPENING = `${FREES.label}:`;

/** Each value, once, in the order it first comes. */
const once = (values: readonly string[]): readonly string[] => [
  ...new Set(values),
];

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
