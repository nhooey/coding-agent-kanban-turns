// The differential test's oracle for what settles a list's items: the
// functions of src/items/outstanding.ts that settled them by a chain of
// `item.list === …` tests, and those that read them, as they stood at
// 3c67f07, before the lists' `settled-by` and the table of settlers keyed
// by it. test/unit/items/settlers-differential.test.ts compares the core
// against them. The helpers they share with the core, which the table
// changed nothing of, are imported from it.
//
// Temporary: the oracle and its test are deleted once
// `settlers-by-list-table` has merged into `master`.

import {
  allItems,
  answeredSubjects,
  countsOf,
  decideStates,
  openItemsIn,
  pullRequestsOf,
  rollUp,
  settlementsIn,
  subjectKey,
  summaryOf,
} from "../../src/items/outstanding.ts";
import type { ListItem, ListKey, Open } from "../../src/items/outstanding.ts";
import { reportNamesItem } from "../../src/transcript/reports.ts";
import { isOwn, reassessStart, textsOf } from "../../src/transcript/turns.ts";
import type { Turn } from "../../types/index.d.ts";

const keyOf = (item: Readonly<{ list: ListKey; line: string }>): string =>
  `${item.list}\t${subjectKey(summaryOf(item.line))}`;

/** The pull requests the roll-up's Review items name with their repository: what to ask GitHub about. */
export const reviewPullRequests = (items: readonly ListItem[]): readonly string[] =>
  [
    ...new Set(
      items
        .filter((item) => item.list === "review")
        .flatMap((item) => pullRequestsOf(item.line)),
    ),
  ].sort();

/** The pull requests the count line over the last `window` turns asks GitHub about: none of those `merged` already holds. */
export const pullRequestsToAsk = (
  turns: readonly Turn[],
  window: number,
  merged: ReadonlySet<string> = new Set(),
): readonly string[] =>
  reviewPullRequests(rollUp(turns, window)).filter((ref) => !merged.has(ref));

/** The items nothing settled, of the roll-up's `items`, given the pull requests that merged. */
export const unsettled = (
  turns: readonly Turn[],
  items: readonly ListItem[],
  merged: ReadonlySet<string>,
): readonly ListItem[] => {
  const floor = reassessStart(turns);
  const lastOwn = new Map(
    allItems(turns)
      .filter((item) => !item.isPinned && item.at >= floor)
      .map((item) => [keyOf(item), item.at]),
  );
  const reports = turns.flatMap((turn, n) =>
    textsOf(turn).flatMap(({ owner, text, reportNames }) =>
      isOwn(owner) || reportNames === undefined
        ? []
        : [{ n, names: reportNames, report: text }],
    ),
  );
  const decided = answeredSubjects(turns);
  const isSettled = (item: ListItem): boolean => {
    const refs = pullRequestsOf(item.line);
    const summary = summaryOf(item.line);

    return item.list === "review"
      ? refs.length > 0 && refs.every((ref) => merged.has(ref))
      : item.list === "decide"
        ? decided.has(subjectKey(summary))
        : item.list === "waiting"
          ? reports.some(
              ({ n, names, report }) =>
                n > (lastOwn.get(keyOf(item)) ?? -1) &&
                reportNamesItem(summary, names, report),
            )
          : false;
  };

  return items.filter((item) => !isSettled(item));
};

/** The count line over the last `window` turns, given the pull requests that merged. */
export const countLine = (
  turns: readonly Turn[],
  window: number,
  merged: ReadonlySet<string> = new Set(),
): string => countsOf(unsettled(turns, rollUp(turns, window), merged));

/** What the turns leave open: the Decide items and the settlements, from one reading of the items' states, and the count line over the last `window` turns given the pull requests that merged. */
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
