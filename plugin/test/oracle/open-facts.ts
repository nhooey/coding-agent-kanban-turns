// The differential test's oracle for what the turns leave open: the
// functions of src/items/outstanding.ts that each worked their facts out of
// the turns again, as they stood at 3839484, before `openOf` gathered the
// facts once. test/unit/items/open-facts-differential.test.ts compares the
// core against them. The helpers they share with the core, which gathering
// the facts once changed nothing of, are imported from it.
//
// Temporary: the oracle and its test are deleted once
// `open-facts-computed-once` has merged into `master`.

import {
  answerFor,
  answered,
  countsOf,
  decideItemsOfText,
  isAnswered,
  itemsOfText,
  openItemsIn,
  settlementsIn,
  settlerOf,
  settlingPullRequests,
  subjectKey,
  summaryOf,
  textsOf,
  withRepliedFrees,
  withResolvedFrees,
} from "../../src/items/outstanding.ts";
import type {
  Answer,
  DecideState,
  ListItem,
  ListKey,
  Open,
  Settling,
} from "../../src/items/outstanding.ts";
import { refOf } from "../../src/items/items.ts";
import {
  isOwn,
  reassessStart,
  reassessStarts,
} from "../../src/transcript/turns.ts";
import type { DecideItem, Settlement, Turn } from "../../types/index.d.ts";

/** Every item of every turn's replies, oldest first, each freeing the items its `Frees:` line names, as withResolvedFrees resolves them. */
export const allItems = (turns: readonly Turn[]): readonly ListItem[] =>
  withResolvedFrees(
    turns,
    reassessStarts(turns),
    turns.flatMap((turn, at) =>
      turn.replies.flatMap((text) =>
        itemsOfText(text).map((item) => ({ ...item, at })),
      ),
    ),
  );

/** Each subject's latest Decide item a reply's own list printed since the latest `reassess` turn, oldest first. */
const latestDecideItems = (turns: readonly Turn[]) => {
  const start = reassessStart(turns);
  const raised = turns.flatMap((turn, at) =>
    at < start
      ? []
      : turn.replies.flatMap((text) =>
          decideItemsOfText(text).map((item) => ({ ...item, id: turn.id, at })),
        ),
  );
  const last = new Map(raised.map((item, n) => [subjectKey(item.summary), n]));

  return raised.filter((item, n) => last.get(subjectKey(item.summary)) === n);
};

/** The subject keys of the Decide items whose latest restatement the user answered. */
export const answeredSubjects = (turns: readonly Turn[]): ReadonlySet<string> => {
  const answers = answered(turns);

  return new Set(
    latestDecideItems(turns)
      .filter((item) => isAnswered(answers, item.id, item.at, item.number))
      .map((item) => subjectKey(item.summary)),
  );
};

/** Where the count line starts reading. */
export const windowStart = (turns: readonly Turn[], window: number): number =>
  Math.max(
    window > 0 && window <= turns.length ? turns.length - window : 0,
    reassessStart(turns),
  );

const keyOf = (item: Readonly<{ list: ListKey; line: string }>): string =>
  `${item.list}\t${subjectKey(summaryOf(item.line))}`;

/** One item per list and subject printed in the window, at its latest occurrence, in order of first appearance. */
export const rollUp = (
  turns: readonly Turn[],
  window: number,
): readonly ListItem[] => {
  const start = windowStart(turns, window);
  const all = allItems(turns);
  const floor = reassessStart(turns);
  const items = all.filter((item) => item.at >= start);
  const last = new Map(items.map((item, n) => [keyOf(item), n]));
  const firsts = [...new Set(items.map(keyOf))];
  const ownFrees = new Map(
    all
      .filter((item) => !item.isPinned && item.at >= floor)
      .map((item) => [keyOf(item), item.frees] as const),
  );

  return firsts.flatMap((key) => {
    const n = last.get(key);
    const found = n === undefined ? undefined : items[n];
    const item =
      found !== undefined && found.isPinned && found.frees.length === 0
        ? { ...found, frees: ownFrees.get(key) ?? found.frees }
        : found;

    return item === undefined ? [] : [item];
  });
};

/** What the turns hold that settles an item, given the pull requests that merged. */
export const settlingOf = (
  turns: readonly Turn[],
  merged: ReadonlySet<string>,
): Settling => {
  const floor = reassessStart(turns);

  return {
    merged,
    decided: answeredSubjects(turns),
    reports: turns.flatMap((turn, n) =>
      textsOf(turn).flatMap(({ owner, text, reportNames }) =>
        isOwn(owner) || reportNames === undefined
          ? []
          : [{ n, names: reportNames, report: text }],
      ),
    ),
    lastOwn: new Map(
      allItems(turns)
        .filter((item) => !item.isPinned && item.at >= floor)
        .map((item) => [keyOf(item), item.at]),
    ),
  };
};

/** The pull requests the count line over the last `window` turns asks GitHub about. */
export const pullRequestsToAsk = (
  turns: readonly Turn[],
  window: number,
  merged: ReadonlySet<string> = new Set(),
): readonly string[] =>
  settlingPullRequests(rollUp(turns, window)).filter((ref) => !merged.has(ref));

/** The items nothing settled, of the roll-up's `items`, given the pull requests that merged. */
export const unsettled = (
  turns: readonly Turn[],
  items: readonly ListItem[],
  merged: ReadonlySet<string>,
): readonly ListItem[] => {
  const settling = settlingOf(turns, merged);

  return items.filter((item) => !settlerOf(item).settles(item, settling));
};

/** The count line over the last `window` turns, given the pull requests that merged. */
export const countLine = (
  turns: readonly Turn[],
  window: number,
  merged: ReadonlySet<string> = new Set(),
): string => countsOf(unsettled(turns, rollUp(turns, window), merged));

const settlementOf = (
  item: DecideItem,
  answer: Answer | undefined,
  isBeforeReassess: boolean,
  isRestated: boolean,
): Settlement | undefined =>
  answer !== undefined
    ? {
        ref: refOf(item),
        how: "answered",
        turn: answer.sent,
        letters: answer.letters,
        note: answer.note,
      }
    : isBeforeReassess
      ? { ref: refOf(item), how: "reassessed" }
      : isRestated
        ? { ref: refOf(item), how: "restated" }
        : undefined;

/** Every Decide item the `kanban_options` calls raised, oldest first, and how it settled, if it did. */
export const decideStates = (turns: readonly Turn[]): readonly DecideState[] => {
  const start = reassessStart(turns);
  const answers = answered(turns);
  const raised = withRepliedFrees(
    turns,
    allItems(turns),
    turns.flatMap((turn, at) => turn.decide.map((item) => ({ item, at }))),
  );
  const last = new Map(
    raised
      .map(({ item, at }, n) => ({ key: subjectKey(item.summary), at, n }))
      .filter(({ at }) => at >= start)
      .map(({ key, n }) => [key, n] as const),
  );

  return raised.map(({ item, at }, n) => ({
    item,
    settlement: settlementOf(
      item,
      answerFor(answers, item.turn, at, item.number),
      at < start,
      last.get(subjectKey(item.summary)) !== n,
    ),
  }));
};

/** What the turns leave open: the Decide items and the settlements, and the count line over the last `window` turns given the pull requests that merged. */
export const openOf = (
  turns: readonly Turn[],
  window: number,
  merged: ReadonlySet<string> = new Set(),
): Open => {
  const states = decideStates(turns);

  return {
    items: openItemsIn(states),
    settlements: settlementsIn(states),
    counts: countLine(turns, window, merged),
  };
};
