// What earlier turns left open, read from the turns: the kanban skill's
// `outstanding.py`, in TypeScript. The items of the lists that roll up into
// 📌, what settled them, and the open Decide items the `kanban_options` calls
// raised. No `$`, no I/O, and nothing of where the turns came from: the hooks
// build the turns, ask GitHub which pull requests merged, and hand both here.
//
// What settles an item is a rule this plugin shares with the skill:
//
// - Review: every pull request it names with its repository, as a GitHub
//   URL or `owner/repo#N`, has merged; a bare `#N` is never looked up.
// - Decide: a later prompt or a message sent while a turn ran answers its
//   latest restatement, by an option letter or in words,
//   `9efb08a1.Decide.2.B`, `Decide.2: B of 9efb08a1`, `Decide.2: <words>`,
//   or a line of numbered answers to the turn before, `2. B` or
//   `1. A / 3. B`; a line holding a question mark answers nothing. Only the
//   user's own text answers.
// - Waiting: a report, the prompt of a turn or a message sent while a turn
//   ran, names it in a turn after the last that printed it in its own list.
// - Every list: a later `reassess` turn, whose lists replace every item.
//
// A 📌 roll-up's restatement of a settled item reopens nothing.

import { answersOfLine } from "./answer-lines.ts";
import type { LineAnswer } from "./answer-lines.ts";
import { itemsOf, refOf } from "./items.ts";
import { reportNames, reportNamesItem } from "./reports.ts";
import {
  DECISIONS,
  HEADER,
  isTopicRule,
  reassessStart,
  sectionsOf,
  withoutDraftHeader,
} from "./transcript.ts";
import type { Turn } from "./transcript.ts";
import type { DecideItem, Settlement } from "../types/index.d.ts";

/** The lists that roll up into 📌, in the skill's order. */
export const LIST_KEYS = [
  "pending",
  "waiting",
  "authorizations",
  "review",
  "todo",
  "decide",
] as const;

export type ListKey = (typeof LIST_KEYS)[number];

/** Each list's header names, the later ones aliases older replies carry, and its glyph. */
export const LISTS: Readonly<
  Record<ListKey, Readonly<{ names: readonly string[]; glyph: string }>>
> = {
  pending: { names: ["Pending", "Unfinished", "Open"], glyph: "🚧" },
  waiting: { names: ["Waiting"], glyph: "⏳" },
  authorizations: { names: ["Authorizations"], glyph: "🔑" },
  review: { names: ["Review", "To review"], glyph: "🔍" },
  todo: { names: ["Todo", "To do"], glyph: "👉" },
  decide: { names: DECISIONS, glyph: "🧠" },
};

/** The separator line's character, parting multi-line items. */
export const SEPARATOR = "⠀";

const keyOfName = (name: string): ListKey | undefined =>
  LIST_KEYS.find((key) => LISTS[key].names.includes(name));

// The 📌 roll-up's header, under which the lists' headers repeat.
const PIN =
  /^\s*📌\s+\*\*(Still open from earlier|Outstanding from previous turns):\*\*/;
// A top-level bullet or numbered line, the number kept.
const ITEM = /^ {0,2}(?:[-*]|(\d+)[.)])\s+(.*)$/;
// An older roll-up's tag before the item, and the 🔖 tag after it.
const PREFIX = /^🔖\s*\w+[₀-₉₋]*:\s*/u;
const SUFFIX = /\s*🔖\s+([0-9a-f]{8})[₀-₉₋]*\s*$/u;
const BOLD = /\*\*(.+?)\*\*/;

/**
 * One item of a list that rolls up into 📌: its list, the turn whose reply
 * printed it (its place among the turns), its number in a numbered list,
 * whether it sat in a 📌 roll-up, and its line, the line beneath joined to a
 * summary alone on its own, with any 🔖 tag cut off.
 */
export type ListItem = Readonly<{
  list: ListKey;
  at: number;
  number: number | undefined;
  isPinned: boolean;
  line: string;
}>;

/** The item's summary: its bold text without a trailing colon, else its line. */
export const summaryOf = (line: string): string => {
  const text = line.replace(PREFIX, "");

  return (BOLD.exec(text)?.[1] ?? text).trim().replace(/:$/, "").trim();
};

const ENTRY = /\bentr(?:y|ies)\s+(\d{3,4})\b/i;
const SPAN = /`([^`]+)`/g;
const BRANCH = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;
const STOP_WORDS: readonly string[] =
  "a an and at by for from in is its of on the to with".split(" ");
const KEY_WORDS = 3;

/** The text with everything but letters and digits gone, lowercased. */
const normal = (text: string): string =>
  text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * The key that matches an item across rewordings of its summary: `entry 1411`
 * where the summary names a backlog entry, else `branch atomic-reload` for its
 * first code span shaped like a branch name, else its first 3 words that are
 * not articles or prepositions, lowercased.
 */
export const subjectKey = (summary: string): string => {
  const entry = ENTRY.exec(summary)?.[1];
  const branch = [...summary.matchAll(SPAN)]
    .map((m) => m[1] ?? "")
    .find((span) => BRANCH.test(span));
  const words = (summary.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (word) => !STOP_WORDS.includes(word),
  );

  return entry !== undefined
    ? `entry ${entry}`
    : branch !== undefined
      ? `branch ${branch}`
      : words.length > 0
        ? words.slice(0, KEY_WORDS).join(" ")
        : normal(summary);
};

/** Whether an item line is its bold summary alone, its sentence on the line beneath. */
const awaitsBody = (text: string): boolean => {
  const bold = /^\*\*(.+?)\*\*/.exec(text);

  return bold !== null && text.slice(bold[0].length).trim() === "";
};

type Found = Readonly<{
  list: ListKey;
  number: number | undefined;
  isPinned: boolean;
  line: string;
}>;

type Scan = Readonly<{
  list: ListKey | undefined;
  isPinned: boolean;
  found: readonly Found[];
  isAwaiting: boolean;
}>;

const scan = (state: Scan, line: string): Scan => {
  const header = HEADER.exec(line)?.[1];
  const item = ITEM.exec(line);
  const body = line.trim();
  const last = state.found.at(-1);

  return header !== undefined
    ? { ...state, list: keyOfName(header), isAwaiting: false }
    : PIN.test(line)
      ? { ...state, list: undefined, isPinned: true, isAwaiting: false }
      : // A topic header's rule ends the list above it, and a blank line ends
        // any list, so neither the topic header nor prose after a list is read
        // as an item's body.
        isTopicRule(line)
        ? { ...state, list: undefined, isAwaiting: false }
        : body === ""
          ? { ...state, isAwaiting: false }
          : state.list !== undefined && item !== null
            ? {
                ...state,
                found: [
                  ...state.found,
                  {
                    list: state.list,
                    number: item[1] === undefined ? undefined : Number(item[1]),
                    isPinned: state.isPinned,
                    line: (item[2] ?? "").trim(),
                  },
                ],
                isAwaiting: awaitsBody((item[2] ?? "").trim()),
              }
            : // The summary's own line holds no sentence, so the line beneath
              // it is the item's body.
              state.isAwaiting && last !== undefined && body !== SEPARATOR
              ? {
                  ...state,
                  found: [
                    ...state.found.slice(0, -1),
                    { ...last, line: `${last.line} ${body}` },
                  ],
                  isAwaiting: false,
                }
              : state;
};

/** The items of one reply text's lists that roll up, and of its 📌 roll-up, in order. */
export const itemsOfText = (text: string): readonly Omit<ListItem, "at">[] =>
  text
    .split("\n")
    .reduce(scan, {
      list: undefined,
      isPinned: false,
      found: [],
      isAwaiting: false,
    } as Scan)
    .found.map((found) => ({ ...found, line: found.line.replace(SUFFIX, "") }));

/** Every item of every turn's replies, oldest first. */
export const allItems = (turns: readonly Turn[]): readonly ListItem[] =>
  turns.flatMap((turn, at) =>
    turn.replies.flatMap((text) =>
      itemsOfText(text).map((item) => ({ ...item, at })),
    ),
  );

// --- answers --------------------------------------------------------------

export { answersOfLine } from "./answer-lines.ts";
export type { LineAnswer } from "./answer-lines.ts";

/** An answer as the turns hold it: the line's, with the place `at` of the turn a bare one answers and the id of the turn it was `sent` in. */
export type Answer = LineAnswer & Readonly<{ at: number; sent: string }>;

/**
 * Every answer the user gave: in a turn's prompt where it's the user's own
 * text, and in a message the user sent while a turn ran, the line naming
 * the plugin that opens a draft its clicks started left out; a bare answer
 * means the turn before the one it's in. The first turn answers nothing.
 */
export const answered = (turns: readonly Turn[]): readonly Answer[] =>
  turns.flatMap((turn, n) =>
    n === 0
      ? []
      : [...(turn.isOwn ? [turn.prompt] : []), ...turn.asides]
          .flatMap((text) => withoutDraftHeader(text).split("\n"))
          .flatMap(answersOfLine)
          .map((answer) => ({ ...answer, at: n - 1, sent: turn.id })),
  );

/** The latest answer that settles item `number` of the turn at `at`, whose id is `id`, if one does. */
export const answerFor = (
  answers: readonly Answer[],
  id: string,
  at: number,
  number: number,
): Answer | undefined =>
  answers.findLast(
    (answer) =>
      answer.number === number &&
      (answer.turn === "" ? answer.at === at : id !== "" && id.startsWith(answer.turn)),
  );

/** Whether an answer settles item `number` of the turn at `at`, whose id is `id`. */
export const isAnswered = (
  answers: readonly Answer[],
  id: string,
  at: number,
  number: number,
): boolean => answerFor(answers, id, at, number) !== undefined;

// --- Decide items a reply's own list prints --------------------------------

const DECIDE_ITEM = /^ {0,3}(\d+)[.)]\s+\*\*(.+?)\*\*/gm;
const DECIDE_OPTION = /^\s*(?:🔘|🔲|👍|👎)\s+[A-Z]\.\s+\*\*.+?\*\*/mu;

/** The numbered items of a reply's Decide lists that carry an option; a 📌 roll-up's bullets carry none. */
export const decideItemsOfText = (
  text: string,
): readonly Readonly<{ number: number; summary: string }>[] =>
  sectionsOf(text)
    .filter((section) => DECISIONS.includes(section.name))
    .flatMap(({ text: body }) => {
      const heads = [...body.matchAll(DECIDE_ITEM)];

      return heads
        .map((head, n) => ({
          head,
          chunk: body.slice(head.index, heads[n + 1]?.index ?? body.length),
        }))
        .filter(({ chunk }) => DECIDE_OPTION.test(chunk))
        .map(({ head }) => ({
          number: Number(head[1]),
          summary: (head[2] ?? "").trim().replace(/:$/, "").trim(),
        }));
    });

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

/**
 * The subject keys of the Decide items whose latest restatement the user
 * answered, read from every turn since the latest `reassess` turn, so a 📌
 * roll-up that still carries one, in the window or not, settles nothing.
 */
export const answeredSubjects = (turns: readonly Turn[]): ReadonlySet<string> => {
  const answers = answered(turns);

  return new Set(
    latestDecideItems(turns)
      .filter((item) => isAnswered(answers, item.id, item.at, item.number))
      .map((item) => subjectKey(item.summary)),
  );
};

// --- pull requests ----------------------------------------------------------

// A pull request an item names with its repository: a GitHub URL, or
// `owner/repo#N`. A bare `#N` names no repository, so it is never looked up.
// The host every pull request read here is on, as the URLs below match it;
// `gh` asks it whatever host its own settings default to.
const GITHUB_HOST = "github.com";
const PULL_URL =
  /https?:\/\/github\.com\/([\p{L}\p{N}_.-]+)\/([\p{L}\p{N}_.-]+)\/pull\/(\d+)/gu;
const PULL_REF =
  /(?<![\p{L}\p{N}_./-])([\p{L}\p{N}_.-]+)\/([\p{L}\p{N}_.-]+)#(\d+)(?![\p{L}\p{N}_])/gu;

/** Each pull request the text names with its repository, as `owner/repo#N`, lowercased, once each, sorted. */
export const pullRequestsOf = (text: string): readonly string[] =>
  [
    ...new Set(
      [...text.matchAll(PULL_URL), ...text.matchAll(PULL_REF)].map((m) =>
        `${m[1]}/${m[2]}#${m[3]}`.toLowerCase(),
      ),
    ),
  ].sort();

/** The one `gh api graphql` call that asks which of `refs` merged: its argument vector, and the refs in the order its `pr<n>` aliases name them. */
export const mergedQuery = (
  refs: readonly string[],
): Readonly<{ ordered: readonly string[]; argv: readonly string[] }> => {
  const ordered = [...new Set(refs)].sort();
  const query = ordered
    .map((ref, n) => {
      const [repo = "", number = ""] = ref.split("#");
      const [owner = "", name = ""] = repo.split("/");

      return `pr${n}: repository(owner: "${owner}", name: "${name}") { pullRequest(number: ${number}) { state } }`;
    })
    .join(" ");

  return {
    ordered,
    argv: [
      "gh",
      "api",
      "graphql",
      "-f",
      `query=query { ${query} }`,
      "--hostname",
      GITHUB_HOST,
    ],
  };
};

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parsed = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

/**
 * The pull requests a GraphQL response, aliased `pr<n>` after their place in
 * `ordered`, reports merged; none where the response is no JSON object. A
 * GraphQL error, such as one pull request that doesn't exist, exits non-zero
 * but still answers for the others.
 */
export const mergedOfResponse = (
  ordered: readonly string[],
  response: string,
): ReadonlySet<string> => {
  const body = parsed(response);
  const data = isObject(body) && isObject(body.data) ? body.data : {};
  const stateOf = (key: string): unknown => {
    const value = data[key];
    const pull = isObject(value) ? value.pullRequest : undefined;

    return isObject(pull) ? pull.state : undefined;
  };

  return new Set(ordered.filter((_, n) => stateOf(`pr${n}`) === "MERGED"));
};

// --- the roll-up ------------------------------------------------------------

/** Where the count line starts reading: the last `window` turns, never before the latest `reassess` turn; every turn since it for a `window` of 0 or less. */
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
  const items = allItems(turns).filter((item) => item.at >= start);
  const last = new Map(items.map((item, n) => [keyOf(item), n]));
  const firsts = [...new Set(items.map(keyOf))];

  return firsts.flatMap((key) => {
    const n = last.get(key);
    const item = n === undefined ? undefined : items[n];

    return item === undefined ? [] : [item];
  });
};

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

/**
 * The count line the skill closes a reply on, such as
 * `📌 Outstanding: 🚧 2 · 🔑 1 · 🧠 3`: each list's glyph and count in the
 * skill's order, an empty list left out; empty when there are no items.
 */
export const countsOf = (items: readonly ListItem[]): string => {
  const shown = LIST_KEYS.map(
    (key) =>
      [LISTS[key].glyph, items.filter((item) => item.list === key).length] as const,
  )
    .filter(([, count]) => count > 0)
    .map(([glyph, count]) => `${glyph} ${count}`);

  return shown.length > 0 ? `📌 Outstanding: ${shown.join(" · ")}` : "";
};

/** The count line over the last `window` turns, given the pull requests that merged. */
export const countLine = (
  turns: readonly Turn[],
  window: number,
  merged: ReadonlySet<string> = new Set(),
): string => countsOf(unsettled(turns, rollUp(turns, window), merged));

/** How a Decide item stopped being open: by an answer, a later `reassess` turn, or a later item on its subject; undefined while it's open. */
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

/**
 * Every Decide item the `kanban_options` calls raised, oldest first, and how
 * it settled, if it did: by the latest of the user's answers to it, else by
 * a later `reassess` turn, else by a later item on its subject. A turn that
 * reassesses applies its own answers first, so an item it answers settles
 * as answered.
 */
export const decideStates = (
  turns: readonly Turn[],
): readonly Readonly<{
  item: DecideItem;
  settlement: Settlement | undefined;
}>[] => {
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

/**
 * The open Decide items, oldest first: those the `kanban_options` calls
 * raised since the latest `reassess` turn, each subject's latest only, none
 * the user answered.
 */
export const openDecideItems = (
  turns: readonly Turn[],
): readonly DecideItem[] =>
  decideStates(turns)
    .filter((state) => state.settlement === undefined)
    .map((state) => state.item);

/** How each settled Decide item settled, oldest first. */
export const settlementsOf = (turns: readonly Turn[]): readonly Settlement[] =>
  decideStates(turns).flatMap((state) => state.settlement ?? []);

/** What the turns leave open: the Decide items, how each settled one settled, and the count line. */
export type Open = Readonly<{
  items: readonly DecideItem[];
  settlements: readonly Settlement[];
  counts: string;
}>;

/** What the turns leave open: the Decide items, and the count line over the last `window` turns given the pull requests that merged. */
export const openOf = (
  turns: readonly Turn[],
  window: number,
  merged: ReadonlySet<string> = new Set(),
): Open => ({
  items: openDecideItems(turns),
  settlements: settlementsOf(turns),
  counts: countLine(turns, window, merged),
});
