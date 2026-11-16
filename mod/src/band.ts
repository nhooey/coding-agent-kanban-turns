// How the band above the prompt moves among the open Decide items, and what
// it says about them. Each function takes a band and returns a new one, or a
// position in it; none changes what it's given.

import { isAnswered } from "./answers.ts";
import { refOf } from "./items.ts";
import type { Band, DecideItem } from "../types/index.d.ts";

export const emptyBand: Band = {
  items: [],
  position: 0,
  isDismissed: false,
  isAway: false,
  dismissedRefs: [],
  knownRefs: [],
  settledRefs: [],
  problem: "",
};

const clamp = (position: number, length: number): number =>
  length === 0 ? 0 : Math.min(Math.max(position, 0), length - 1);

/** The band's position, held inside its items. */
export const positionIn = (band: Band): number =>
  clamp(band.position, band.items.length);

/** The item the band shows, if it has any. */
export const shownItem = (band: Band): DecideItem | undefined =>
  band.items[positionIn(band)];

/** The first item the draft does not answer; the first item when it answers all. */
export const firstUnanswered = (
  items: readonly DecideItem[],
  draft: string,
): number =>
  Math.max(
    items.findIndex((item) => !isAnswered(draft, item)),
    0,
  );

/** Every position after `position`, wrapping round, `position` itself left out. */
const after = (position: number, length: number): readonly number[] =>
  Array.from({ length: Math.max(length - 1, 0) }, (_, n) => (position + 1 + n) % length);

/** The next item after `position` the draft does not answer, wrapping; `fallback` when there is none. */
const nextUnanswered = (
  items: readonly DecideItem[],
  draft: string,
  position: number,
  fallback: number,
): number =>
  after(position, items.length).find((n) => {
    const item = items[n];

    return item !== undefined && !isAnswered(draft, item);
  }) ?? fallback;

/** Where the band goes after an option is clicked: on to the next unanswered item, or it stays when all are answered. */
export const afterAnswer = (band: Band, draft: string): number =>
  nextUnanswered(band.items, draft, band.position, band.position);

export const nextPosition = (band: Band): number =>
  band.items.length === 0 ? 0 : (band.position + 1) % band.items.length;

export const prevPosition = (band: Band): number =>
  band.items.length === 0
    ? 0
    : (band.position - 1 + band.items.length) % band.items.length;

/** Skip: on to the next unanswered item, else simply the next one. */
export const skipped = (band: Band, draft: string): number =>
  nextUnanswered(band.items, draft, band.position, nextPosition(band));

const isShown = (band: Band, item: DecideItem): boolean => {
  const shown = shownItem(band);

  return shown !== undefined && refOf(shown) === refOf(item);
};

/** The band once the draft answers `item`: on to the next unanswered item when the band shows it, else where it was. */
export const movedOn = (band: Band, item: DecideItem, draft: string): Band =>
  isShown(band, item) ? { ...band, position: afterAnswer(band, draft) } : band;

/** The band once an option of `item` is clicked: a checkbox item stays for more letters, the others move on. */
export const afterChoice = (
  band: Band,
  item: DecideItem,
  draft: string,
): Band => (item.kind === "checkbox" ? band : movedOn(band, item, draft));

/** A submitted prompt: folded while the turn runs. */
export const away = (band: Band): Band => ({ ...band, isAway: true });

/** The main loop's reply ended: shown again, unless ❌ folded it. */
export const back = (band: Band): Band => ({ ...band, isAway: false });

/** ❌: hidden until a refresh raises an item not open now. */
export const dismissed = (band: Band): Band => ({
  ...band,
  isDismissed: true,
  dismissedRefs: band.items.map(refOf),
});

/** /answers: shown again, at the first item the draft does not answer. */
export const reopened = (band: Band, draft: string): Band => ({
  ...band,
  isDismissed: false,
  isAway: false,
  position: firstUnanswered(band.items, draft),
});

/** A question's link pressed: shown again at the item `n`, or as it was when `n` names none. */
export const shownAt = (band: Band, n: number, draft: string): Band =>
  n < 0 ? band : { ...reopened(band, draft), position: n };

const union = (
  a: readonly string[],
  b: readonly string[],
): readonly string[] => [...new Set([...a, ...b])];

/**
 * The band once a refresh found `items` open: an item no longer open is
 * settled, a new one lifts a dismissal, and the band stays on the item it
 * showed if that is still open, else goes to the first unanswered one.
 */
export const refreshed = (
  band: Band,
  items: readonly DecideItem[],
  draft: string,
): Band => {
  const open = items.map(refOf);
  const known = union(band.knownRefs, open);
  const shown = band.items[band.position];
  const kept = shown === undefined ? -1 : open.indexOf(refOf(shown));
  const isNew = open.some((ref) => !band.dismissedRefs.includes(ref));

  return {
    ...band,
    items,
    position: kept >= 0 ? kept : firstUnanswered(items, draft),
    isDismissed: band.isDismissed && !isNew,
    knownRefs: known,
    settledRefs: known.filter((ref) => !open.includes(ref)),
    problem: "",
  };
};

/** The band once a tool row drew `items`: their refs are known, so a later refresh can settle them. */
export const drawnByTool = (
  band: Band,
  items: readonly DecideItem[],
): Band => ({
  ...band,
  knownRefs: union(band.knownRefs, items.map(refOf)),
});

/** The header line: `🧠 2/5 · <summary>`. */
export const header = (band: Band): string => {
  const item = shownItem(band);

  return item === undefined
    ? ""
    : `🧠 ${positionIn(band) + 1}/${band.items.length} · ${item.summary}`;
};

/** One mark per item, `●` answered in the draft and `○` not, with which one the band shows. */
export const progressMarks = (
  band: Band,
  draft: string,
): readonly { mark: string; isShown: boolean }[] =>
  band.items.map((item, n) => ({
    mark: isAnswered(draft, item) ? "●" : "○",
    isShown: n === positionIn(band),
  }));

/** A mark as drawn: the shown one ringed, `◉` answered or `◎` not. */
export const drawnMark = (mark: string, isShown: boolean): string =>
  isShown ? (mark === "●" ? "◉" : "◎") : mark;

/** The marks as one line, the shown one ringed. */
export const progress = (band: Band, draft: string): string =>
  progressMarks(band, draft)
    .map(({ mark, isShown }) => drawnMark(mark, isShown))
    .join(" ");
