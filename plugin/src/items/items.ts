// The items themselves: the list and the feedback one's of, its answers'
// keys, and the glyph or mark an option is drawn with. The reference an
// answer names one by, and the Decide items read out of a `kanban_options`
// call's input, are protocol/options-input.ts's.

import { feedbackOf, paneListOf, settlingWordsOf } from "../protocol/rules.ts";
import type { Feedback, List, ListName } from "../protocol/rules.ts";
import { SPEC } from "../protocol/spec.ts";
import type { DecideItem, ListedItem } from "../../types/index.d.ts";

/** The feedback of a list whose items an option answers. */
const OPTIONS = "options" satisfies Feedback;

/** The list an item is of, the pane's list its `list` names; undefined for one the pane doesn't draw, whose feedback is none, as `feedbackOf` says. */
export const listOf = (item: ListedItem): List | undefined => paneListOf(item.list);

/** The list an item is of as its label names it, its glyph and header: its list's, or its `list` alone, no glyph, for one the pane doesn't draw. */
export const listNameOf = (item: ListedItem): ListName =>
  listOf(item) ?? { glyph: "", header: item.list };

/** What the person answers the item with, as its list's `feedback` says; none for a list the pane doesn't draw. */
export const feedbackOfItem = (item: ListedItem): Feedback => feedbackOf(item.list);

/** Whether the item's list answers it by options, so it carries them: what the spec's `feedback` says, not its list's name. */
export const hasOptions = (item: ListedItem): item is DecideItem =>
  feedbackOfItem(item) === OPTIONS && "options" in item;

/** Whether one of the item's answers takes any number of picks, a checkbox's: as its option kind's `picks` says; never for an item without options. */
export const picksAny = (item: ListedItem): boolean =>
  hasOptions(item) && SPEC.options.kinds[item.kind].picks === "any";

/** The words that settle the item, its list's settling words in the spec's order; none for a list the pane doesn't draw. */
export const settlingWordsOfItem = (item: ListedItem): readonly string[] => {
  const list = listOf(item);

  return list === undefined ? [] : settlingWordsOf(list);
};

/** The keys of the item's answers, in its box's order: its options' letters, then its list's settling words; what each answer's button is keyed by. */
export const answerKeysOf = (item: ListedItem): readonly string[] => [
  ...(hasOptions(item) ? item.options.map((option) => option.letter) : []),
  ...settlingWordsOfItem(item),
];

/** Whether two turn ids name one turn: either may be a prefix of the other, as an answer's may; an empty one names none. */
export const isSameTurn = (a: string, b: string): boolean =>
  a !== "" && b !== "" && (a.startsWith(b) || b.startsWith(a));

/** The glyph an option is drawn with: its own, else its item kind's. */
export const glyphOf = (item: DecideItem, letter: string): string =>
  item.options.find((o) => o.letter === letter)?.glyph ||
  SPEC.options.kinds[item.kind].glyph;

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

/**
 * An open item as `kanban_outstanding` hands it back, for the agent to
 * raise again: its `supersedes` left out, since what it named is settled
 * already.
 */
export const reraisable = ({ supersedes: _, ...item }: DecideItem): DecideItem =>
  item;
