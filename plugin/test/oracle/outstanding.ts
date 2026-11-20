// The differential test's oracle for what the turns leave open: the core's
// functions that read turns, reading the oracle's turns with `isOwn`, and
// the names a report goes by read out of its text. The pure helpers they
// share with src/items/outstanding.ts, which read no turn, are imported from it.
//
// Temporary: the oracle and its test are deleted once `protocol-spec-data`
// is rebased onto the neutral turns.

import { itemsOf, refOf } from "../../src/items/items.ts";
import {
  answerFor,
  answersOfLine,
  countsOf,
  decideItemsOfText,
  isAnswered,
  itemsOfText,
  openItemsIn,
  pullRequestsOf,
  reviewPullRequests,
  settlementsIn,
  subjectKey,
  summaryOf,
} from "../../src/items/outstanding.ts";
import type {
  Answer,
  DecideState,
  ListItem,
  ListKey,
  Open,
} from "../../src/items/outstanding.ts";
import { elements, reportNamesItem } from "../../src/transcript/reports.ts";
import { withoutDraftHeader } from "../../src/transcript/turns.ts";
import type { DecideItem, Settlement } from "../../types/index.d.ts";
import { reassessStart } from "./transcript.ts";
import type { Turn } from "./transcript.ts";

const DONE_STATUSES: readonly string[] = [
  "completed",
  "failed",
  "killed",
  "stopped",
  "cancelled",
];
const STILL_WAITING = "is waiting on its own background work";
const MONITOR_ENDED = "[Monitor expired";
const QUOTED = /"([^"]+)"/g;

const reportNames = (prompt: string): readonly string[] | undefined => {
  const found = prompt.includes("<") ? elements(prompt) : [];
  const first = (tag: string) => found.find((element) => element.tag === tag);
  const summary = first("summary")?.text ?? "";
  const isFinished =
    (DONE_STATUSES.includes((first("status")?.text ?? "").toLowerCase()) &&
      !summary.includes(STILL_WAITING)) ||
    (first("event")?.text ?? "").startsWith(MONITOR_ENDED);
  const session = first("cross-session-message");
  const agent = first("agent-message");

  return session !== undefined
    ? [session.attrs["from-name"] ?? ""]
    : agent !== undefined
      ? [agent.attrs["from"] ?? ""]
      : first("task-notification") !== undefined && isFinished
        ? [
            first("task-id")?.text ?? "",
            ...[...summary.matchAll(QUOTED)].map((m) => m[1] ?? ""),
          ]
        : undefined;
};

export const allItems = (turns: readonly Turn[]): readonly ListItem[] =>
  turns.flatMap((turn, at) =>
    turn.replies.flatMap((text) =>
      itemsOfText(text).map((item) => ({ ...item, at })),
    ),
  );

export const answered = (turns: readonly Turn[]): readonly Answer[] =>
  turns.flatMap((turn, n) =>
    n === 0
      ? []
      : [...(turn.isOwn ? [turn.prompt] : []), ...turn.asides]
          .flatMap((text) => withoutDraftHeader(text).split("\n"))
          .flatMap(answersOfLine)
          .map((answer) => ({ ...answer, at: n - 1, sent: turn.id })),
  );

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

const answeredSubjects = (turns: readonly Turn[]): ReadonlySet<string> => {
  const answers = answered(turns);

  return new Set(
    latestDecideItems(turns)
      .filter((item) => isAnswered(answers, item.id, item.at, item.number))
      .map((item) => subjectKey(item.summary)),
  );
};

export const windowStart = (turns: readonly Turn[], window: number): number =>
  Math.max(
    window > 0 && window <= turns.length ? turns.length - window : 0,
    reassessStart(turns),
  );

const keyOf = (item: Readonly<{ list: ListKey; line: string }>): string =>
  `${item.list}\t${subjectKey(summaryOf(item.line))}`;

export const rollUp = (
  turns: readonly Turn[],
  window: number,
): readonly ListItem[] => {
  const start = windowStart(turns, window);
  const items = allItems(turns).filter((item) => item.at >= start);
  const last = new Map(items.map((item, n) => [keyOf(item), n]));
  const firsts = [...new Set(items.map(keyOf))];

  return firsts.flatMap((key) => {
    const n = last.get(key);
    const item = n === undefined ? undefined : items[n];

    return item === undefined ? [] : [item];
  });
};

export const pullRequestsToAsk = (
  turns: readonly Turn[],
  window: number,
  merged: ReadonlySet<string> = new Set(),
): readonly string[] =>
  reviewPullRequests(rollUp(turns, window)).filter((ref) => !merged.has(ref));

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
    [...(turn.isOwn ? [] : [turn.prompt]), ...turn.reports].flatMap(
      (report) => {
        const names = reportNames(report);

        return names === undefined ? [] : [{ n, names, report }];
      },
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

export const decideStates = (turns: readonly Turn[]): readonly DecideState[] => {
  const start = reassessStart(turns);
  const answers = answered(turns);
  const raised = turns.flatMap((turn, at) =>
    turn.calls.flatMap((input) => itemsOf(input).map((item) => ({ item, at }))),
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
