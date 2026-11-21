// The pane's sections, worked out apart from drawing them: one per turn,
// newest first, each under a faint header naming the turn and its index,
// its open items, then its Done items under one header that a click
// expands; and the stops the pane's j and k keys move the focus ring
// between. No `$`, no I/O.

import { isAnswered } from "../items/answers.ts";
import { refOf } from "../items/items.ts";
import { DONE, itemLabel } from "../protocol/rules.ts";
import { SPEC } from "../protocol/spec.ts";
import { LAYOUT } from "./layout.ts";
import type { DecideItem, Settings } from "../../types/index.d.ts";

/** One turn's part of the pane: its id, its header, its open items, then its Done ones, each oldest first. */
export type TurnSection = Readonly<{
  turn: string;
  header: string;
  open: readonly DecideItem[];
  done: readonly DecideItem[];
}>;

/** Whether two turn ids name one turn: either may be a prefix of the other, as an answer's may. */
const isSameTurn = (a: string, b: string): boolean =>
  a.startsWith(b) || b.startsWith(a);

/** A turn's index counting back from the latest turn the transcript holds, which is 0; undefined for a turn not read. */
export const relativeIndex = (
  turns: readonly string[],
  turn: string,
): number | undefined => {
  const at = turns.findLastIndex((id) => isSameTurn(id, turn));

  return at < 0 ? undefined : at - (turns.length - 1);
};

const SUBSCRIPT: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    [..."0123456789"].map((d, n) => [d, [...SPEC.tag.digits][n] ?? d]),
  ),
  "-": SPEC.tag.minus,
};

/** A relative index in Unicode subscript, as the kanban skill's 🔖 tag writes it: `₀`, `₋₃`. */
export const subscriptOf = (index: number): string =>
  [...String(index)].map((c) => SUBSCRIPT[c] ?? c).join("");

/** A turn's header in the pane: its id and its index between rules, `── 9efb08a1 ₋₃ ──`; the id alone for a turn not read. */
export const turnHeader = (turn: string, index: number | undefined): string =>
  `${LAYOUT.rule} ${turn}${index === undefined ? "" : ` ${subscriptOf(index)}`} ${LAYOUT.rule}`;

/**
 * Where a turn sorts, latest highest: its place among the turns read, or,
 * for a turn the transcript doesn't hold yet, after them all, in the order
 * its items were raised.
 */
const rankOf = (
  turns: readonly string[],
  turn: string,
  raisedAt: number,
): number => {
  const at = turns.findLastIndex((id) => isSameTurn(id, turn));

  return at < 0 ? turns.length + raisedAt : at;
};

/**
 * The pane's sections: one per turn its items came from, newest first,
 * each with its open items and its Done ones as `isDone` says, in the order
 * they were raised.
 */
export const turnSections = (
  items: readonly DecideItem[],
  isDone: (item: DecideItem) => boolean,
  turns: readonly string[],
): readonly TurnSection[] => {
  const ids = [...new Set(items.map((item) => item.turn))];
  const ofTurn = (turn: string) => items.filter((item) => item.turn === turn);

  return ids
    .map((turn, raisedAt) => ({ turn, rank: rankOf(turns, turn, raisedAt) }))
    .toSorted((a, b) => b.rank - a.rank)
    .map(({ turn }) => ({
      turn,
      header: turnHeader(turn, relativeIndex(turns, turn)),
      open: ofTurn(turn).filter((item) => !isDone(item)),
      done: ofTurn(turn).filter(isDone),
    }));
};

/** Where /answers scrolls: the first open item the draft doesn't answer, in the pane's order, newest turn first. */
export const firstUnansweredIn = (
  sections: readonly TurnSection[],
  draft: string,
): DecideItem | undefined =>
  sections
    .flatMap((section) => section.open)
    .find((item) => !isAnswered(draft, item));

/**
 * The header of a turn's Done items: a toggle, `▸ Done (2)` while collapsed,
 * `▾ Done (2)` while expanded, each mark the `marks` setting's, named as
 * the spec names the Done list.
 */
export const doneHeader = (
  count: number,
  isExpanded: boolean,
  marks: Pick<Settings["marks"], "collapsed" | "expanded">,
): string =>
  `${isExpanded ? marks.expanded : marks.collapsed} ${DONE.header} (${count})`;

/**
 * A Done item's one line in its expanded section: its label, then its
 * summary and what made it Done, which wrap under the summary's start.
 */
export const doneLine = (
  item: DecideItem,
  done: string,
): Readonly<{ label: string; text: string }> => ({
  label: itemLabel(item.number),
  text: `${item.summary}${LAYOUT.divider}${done}`,
});

/** The key of a turn's Done header, which the expanded set holds while the section is open. */
export const doneKey = (turn: string): string => `${turn}.done`;

/** The key of a Done item's line, or of its box's title once a click expands it. */
export const lineKey = (item: DecideItem): string => `${refOf(item)}.line`;

/** The expanded set once `key` is clicked: added when it's out, taken out when it's in. */
export const toggledKey = (
  expanded: readonly string[],
  key: string,
): readonly string[] =>
  expanded.includes(key)
    ? expanded.filter((held) => held !== key)
    : [...expanded, key];

/** The expanded set with each of `keys` in it, once: what opens a Done item's section and box to show it. */
export const withKeys = (
  expanded: readonly string[],
  keys: readonly string[],
): readonly string[] => [...new Set([...expanded, ...keys])];

/**
 * A place j and k move the focus ring to: the element's key, and the prefix
 * every element of the same item shares, so a ring on any of them is there.
 */
export type Stop = Readonly<{ key: string; group: string }>;

/** An open item's stop: its first option, else its notes field. */
const openStop = (item: DecideItem): Stop => {
  const first = item.options[0]?.letter;

  return {
    key: `${refOf(item)}.${first ?? "notes"}`,
    group: refOf(item),
  };
};

/**
 * The stops j and k move between, in the pane's order: each open item's
 * first option, each turn's Done header, and, while its section is
 * expanded, each Done item's line.
 */
export const paneStops = (
  sections: readonly TurnSection[],
  expanded: readonly string[],
): readonly Stop[] =>
  sections.flatMap((section) => [
    ...section.open.map(openStop),
    ...(section.done.length === 0
      ? []
      : [
          { key: doneKey(section.turn), group: doneKey(section.turn) },
          ...(expanded.includes(doneKey(section.turn))
            ? section.done.map((item) => ({
                key: lineKey(item),
                group: refOf(item),
              }))
            : []),
        ]),
  ]);

/**
 * Where j (`step` 1) or k (-1) moves the ring from the element `focused`
 * names: the next or the previous stop; the first or the last when the ring
 * is on no item; undefined past either end, or with no stops.
 */
export const steppedStop = (
  stops: readonly Stop[],
  focused: string,
  step: 1 | -1,
): string | undefined => {
  const at = stops.findIndex(
    (stop) => focused === stop.key || focused.startsWith(`${stop.group}.`),
  );

  return at < 0
    ? (step > 0 ? stops[0] : stops.at(-1))?.key
    : stops[at + step]?.key;
};
