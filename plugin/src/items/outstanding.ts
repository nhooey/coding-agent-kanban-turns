// What earlier turns left open, read from the turns: the kanban skill's
// `outstanding.py`, in TypeScript. The items of the lists that roll up into
// 📌, what settled them, and the open Decide items the `kanban_options` calls
// raised. No `$`, no I/O, and nothing of where the turns came from: the hooks
// build the turns, ask GitHub which pull requests merged, and hand both here.
//
// What settles an item is a rule this plugin shares with the skill, stated
// once, in spec/kanban.yaml: each list's `settled-by` names its way, the
// comment there says what each way does, and SETTLERS below holds each
// way's code. What the code adds to the rule:
//
// - `answer`: the user's answer comes in a later prompt or a message sent
//   while a turn ran, as `9efb08a1.Decide.2.B`, `Decide.2: B of 9efb08a1`,
//   `Decide.2: <words>`, or a line of numbered answers to the turn before,
//   `2. B` or `1. A / 3. B`; a line holding a question mark answers
//   nothing, and only the user's own text answers.
// - `report`: a report is the prompt of a turn, or a message sent while a
//   turn ran, that goes by names; no text of the user's own is one.
// - A Decide item a `kanban_options` call raised is superseded by a later
//   one that names it in `supersedes`, else by a later one on its subject
//   that gives none; an answer to it, or a later `reassess` turn, settles
//   it first.
//
// A 📌 roll-up's restatement of a settled item reopens nothing.

import { answersOfLine } from "./answer-lines.ts";
import type { LineAnswer } from "./answer-lines.ts";
import { freesOfLine, isFreesLine, refText, resolvedRefs } from "./frees.ts";
import { decideRefOf, isSameTurn, refOf } from "./items.ts";
import { latestWord, wordAnsweredIn } from "./word-answers.ts";
import type { HeldWordAnswer } from "./word-answers.ts";
import { branchSpans, reportNamesItem } from "../transcript/reports.ts";
import { isObject, parsedJson } from "../json/fields.ts";
import { escaped } from "../text/patterns.ts";
import {
  isOwn,
  ownLinesOf,
  reassessStart,
  reassessStarts,
  textsOf,
} from "../transcript/turns.ts";
import type { OwnLine } from "../transcript/turns.ts";
import { isFenceLine, parseReply, sectionsIn } from "../transcript/reply.ts";
import type {
  Block,
  BodyLine,
  ItemHead,
  LineFacts,
} from "../transcript/reply.ts";
import {
  DECIDE,
  DECISIONS,
  SUBSCRIPT_CHAR,
  SUBJECT_WORD,
  TURN_ID,
  namesOf,
} from "../protocol/rules.ts";
import { SPEC } from "../protocol/spec.ts";
import type { DecideItem, Settlement, Turn } from "../../types/index.d.ts";

type Lists = typeof SPEC.lists;

/** The lists that roll up into 📌, by their names in code. */
export type ListKey = {
  [K in keyof Lists]: Lists[K]["rolls-up"] extends true ? K : never;
}[keyof Lists];

/** The lists that roll up into 📌, in the skill's order. */
export const LIST_KEYS: readonly ListKey[] = (
  Object.keys(SPEC.lists) as readonly (keyof Lists)[]
).filter((key): key is ListKey => SPEC.lists[key]["rolls-up"]);

/** The separator line's character, parting multi-line items. */
export const SEPARATOR: string = SPEC.characters.separator;

const keyOfName = (name: string): ListKey | undefined =>
  LIST_KEYS.find((key) => namesOf(SPEC.lists[key]).includes(name));

const ROLL_UP = SPEC["roll-up"];

// An older roll-up's tag before the item, and the 🔖 tag after it.
const TAG = escaped(SPEC.tag.glyph);
const PREFIX = new RegExp(String.raw`^${TAG}\s*\w+${SUBSCRIPT_CHAR}*:\s*`, "u");
const SUFFIX = new RegExp(
  String.raw`\s*${TAG}\s+(${TURN_ID})${SUBSCRIPT_CHAR}*\s*$`,
  "u",
);
const BOLD = /\*\*(.+?)\*\*/;

/**
 * One item of a list that rolls up into 📌: its list, the turn whose reply
 * printed it (its place among the turns), its number in a numbered list,
 * whether it sat in a 📌 roll-up, its line, the line beneath joined to a
 * summary alone on its own, with any 🔖 tag cut off, and the items it frees,
 * by reference: those its last line, a `Frees:` line, names. Read from one
 * reply's text, they are the references as written; read from the turns,
 * each names an item of its turn or an earlier one, by the turn's whole id.
 * `tagged` is the turn id its 🔖 tag named, where it had one. `body`, for a
 * numbered item of a list with settling words in the reply's own list, is
 * what it prints under its summary, which the pane draws, where it prints
 * any.
 */
export type ListItem = Readonly<{
  list: ListKey;
  at: number;
  number: number | undefined;
  isPinned: boolean;
  line: string;
  frees: readonly string[];
  tagged?: string;
  body?: readonly string[];
}>;

/** A summary's text as an item's summary keeps it: trimmed, without a trailing colon. */
export const summaryText = (text: string): string =>
  text.trim().replace(/:$/, "").trim();

/** The item's summary: its bold text without a trailing colon, else its line. */
export const summaryOf = (line: string): string => {
  const text = line.replace(PREFIX, "");

  return summaryText(BOLD.exec(text)?.[1] ?? text);
};

const SUBJECT = SPEC.subject;
const ENTRY_DIGITS = SUBJECT.entry.digits;
// A backlog entry, as the spec words it: `\b(?:entry|entries)\s+(\d{3,4})\b`,
// ignoring case. No `u` flag: with `i`, it would fold the long s, `ſ`, into
// `s` and the Kelvin sign, U+212A, into `k`, and count both as word
// characters at `\b`, so `entrieſ 0550` would name an entry and
// `ſentry 0550` would not.
const ENTRY = new RegExp(
  String.raw`\b(?:${SUBJECT.entry.words.map(escaped).join("|")})\s+(\d{${ENTRY_DIGITS.fewest},${ENTRY_DIGITS.most}})\b`,
  "i",
);
const KEY_WORD = new RegExp(SUBJECT_WORD, "g");
const STOP_WORDS: readonly string[] = SUBJECT["stop-words"];

/** The text with everything but letters and digits gone, lowercased. */
const normal = (text: string): string =>
  text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * The key that matches an item across rewordings of its summary, by the
 * spec's `subject` rule: `entry 1411` where the summary names a backlog
 * entry, else `branch atomic-reload` for its first code span shaped like a
 * branch name, else its first `words-kept` words that aren't stop words,
 * lowercased, `ship release users`.
 */
export const subjectKey = (summary: string): string => {
  const entry = ENTRY.exec(summary)?.[1];
  const branch = branchSpans(summary)[0];
  const words = (summary.toLowerCase().match(KEY_WORD) ?? []).filter(
    (word) => !STOP_WORDS.includes(word),
  );

  return entry !== undefined
    ? `${SUBJECT.entry.label} ${entry}`
    : branch !== undefined
      ? `${SUBJECT.branch.label} ${branch}`
      : words.length > 0
        ? words.slice(0, SUBJECT["words-kept"]).join(" ")
        : normal(summary);
};

/** The bold markers either side of a summary. */
const BOLD_MARKS = "****".length;

/** The text of an item's own line after the bold summary it opens on, a colon or a dash that opens it aside: the start of its body, where the summary isn't alone. */
const restOfHead = (head: ItemHead): string =>
  head.summary === undefined || head.isAlone
    ? ""
    : head.text
        .slice(head.summary.length + BOLD_MARKS)
        .replace(/^[\s:–—-]+/, "")
        .trim();

/** A line of code under an item, the item's indent aside, as a code span the pane draws in the code colour; one that holds a backtick of its own as written. */
const codeLineOf = (head: ItemHead, line: string): string => {
  const code = line.slice(Math.min(head.lead.length, line.length - line.trimStart().length)).trimEnd();

  return code.includes("`") ? code : `\`${code}\``;
};

/** What an item prints under its summary: the rest of its own line, then each line under it but blank ones, its fences and its `Frees:` line, a line of code as a code span. */
const bodyOf = (head: ItemHead, body: readonly BodyLine[]): readonly string[] =>
  [
    restOfHead(head),
    ...body.flatMap((under) =>
      under.isCode
        ? isFenceLine(under.line) || under.line.trim() === ""
          ? []
          : [codeLineOf(head, under.line)]
        : isFreesLine(under.line)
          ? []
          : [under.line.trim()],
    ),
  ].filter((line) => line !== "");

/**
 * An item of a list that rolls up, read from its block: its own line, and,
 * where that line is its bold summary alone, the line beneath joined to it,
 * unless that's the `Frees:` line, which is no body; with any 🔖 tag cut off,
 * and what its last line, a `Frees:` line, frees, as written; and, for a
 * numbered item of a list with settling words in the reply's own list, its
 * body, where it prints one.
 */
const listItemOf = (
  list: ListKey,
  isPinned: boolean,
  head: ItemHead,
  body: readonly BodyLine[],
): Omit<ListItem, "at"> => {
  const own = head.text.trim();
  const beneath = body[0]?.line.trim();
  const line =
    head.isAlone && beneath !== undefined && !isFreesLine(beneath)
      ? `${own} ${beneath}`
      : own;
  const tagged = SUFFIX.exec(line)?.[1];
  const printed =
    !isPinned &&
    head.number !== undefined &&
    Object.keys(SPEC.lists[list]["settling-words"]).length > 0
      ? bodyOf(head, body)
      : [];

  return {
    list,
    number: head.number,
    isPinned,
    line: line.replace(SUFFIX, ""),
    frees: freesOfLine(body.at(-1)?.line ?? "") ?? [],
    ...(tagged === undefined ? {} : { tagged }),
    ...(printed.length > 0 ? { body: printed } : {}),
  };
};

/** Where the reading of a reply's blocks is: the list it's in, whether in a 📌 roll-up, and the items found. */
type Reading = Readonly<{
  list: ListKey | undefined;
  isPinned: boolean;
  found: readonly Omit<ListItem, "at">[];
}>;

/**
 * The reading once one more block is read: a header opens its list, the 📌
 * roll-up's start leaves every list and pins what follows, a topic header
 * leaves the list above it, and an item of a list that rolls up is found.
 */
const readBlock = (state: Reading, block: Block): Reading =>
  block.kind === "header"
    ? { ...state, list: keyOfName(block.name) }
    : block.kind === "roll-up"
      ? { ...state, list: undefined, isPinned: true }
      : block.kind === "topic"
        ? { ...state, list: undefined }
        : block.kind === "item" && state.list !== undefined
          ? {
              ...state,
              found: [
                ...state.found,
                listItemOf(state.list, state.isPinned, block.head, block.body),
              ],
            }
          : state;

/** The items of one reply text's lists that roll up, and of its 📌 roll-up, in order, each freeing the references its last line names as written. */
export const itemsOfText = (text: string): readonly Omit<ListItem, "at">[] =>
  parseReply(text).reduce(readBlock, {
    list: undefined,
    isPinned: false,
    found: [],
  }).found;

/** The reference an item of a reply's own list goes by, `9efb08a1.Todo.2`, by its turn's id; none for a 📌 roll-up's bullet or an item with no number. */
export const listItemRef = (
  turns: readonly Pick<Turn, "id">[],
  item: ListItem,
): string | undefined =>
  item.isPinned || item.number === undefined
    ? undefined
    : refText({
        turn: turns[item.at]?.id ?? "",
        list: SPEC.lists[item.list].header,
        number: item.number,
      });

/**
 * The items with what each frees resolved against the items the turns
 * hold, each numbered item of a reply's own list and each Decide item a
 * `kanban_options` call raised, by its turn's whole id: only those of its
 * own turn and the turns before it back to `starts[at]`, the latest
 * `reassess` turn at or before its own, whose lists replaced every earlier
 * item; and never the item itself.
 */
export const withResolvedFrees = (
  turns: readonly Pick<Turn, "id" | "decide">[],
  starts: readonly number[],
  items: readonly ListItem[],
): readonly ListItem[] => {
  const ids = turns.map((turn) => turn.id);
  const known = new Set([
    ...items.flatMap((item) => listItemRef(turns, item) ?? []),
    ...turns.flatMap((turn) =>
      turn.decide.map((raised) =>
        refText({ turn: turn.id, list: DECIDE.header, number: raised.number }),
      ),
    ),
  ]);

  return items.map((item) => {
    const own = listItemRef(turns, item);
    const span = { from: starts[item.at] ?? 0, at: item.at };

    return {
      ...item,
      frees: resolvedRefs(item.frees, ids, span, known).filter(
        (ref) => ref !== own,
      ),
    };
  });
};

/** Every item of every turn's replies, oldest first, each freeing the items its `Frees:` line names, as withResolvedFrees resolves them. */
export const allItems = (turns: readonly Turn[]): readonly ListItem[] =>
  itemsIn(turns, reassessStarts(turns));

/** allItems, given each turn's latest `reassess` turn, `starts`, as reassessStarts gives them. */
const itemsIn = (
  turns: readonly Turn[],
  starts: readonly number[],
): readonly ListItem[] =>
  withResolvedFrees(
    turns,
    starts,
    turns.flatMap((turn, at) =>
      turn.replies.flatMap((text) =>
        itemsOfText(text).map((item) => ({ ...item, at })),
      ),
    ),
  );

/** A Decide item a `kanban_options` call raised, and the place of the turn it raised it in. */
export type Raising = Readonly<{ item: DecideItem; at: number }>;

/**
 * The Decide items `kanban_options` calls raised, each at its turn's place
 * `at`, with what it frees as the reply's own Decide list writes it: where
 * that turn's reply prints the item, by its number, with a `Frees:` line
 * naming an item `items` resolves, the reply's line wins over the call's
 * `frees`, since the reply is what the user reads and the call came before
 * it; else the call's stands.
 */
export const withRepliedFrees = (
  turns: readonly Pick<Turn, "id">[],
  items: readonly ListItem[],
  raised: readonly Raising[],
): readonly Raising[] => {
  const replied = new Map(
    items
      .filter((item) => item.list === "decide" && item.frees.length > 0)
      .flatMap((item) => {
        const ref = listItemRef(turns, item);

        return ref === undefined ? [] : [[ref, item.frees] as const];
      }),
  );

  return raised.map((entry) => {
    const frees = replied.get(
      refText({
        turn: turns[entry.at]?.id ?? "",
        list: DECIDE.header,
        number: entry.item.number,
      }),
    );

    return frees === undefined
      ? entry
      : { ...entry, item: { ...entry.item, frees } };
  });
};

// --- answers --------------------------------------------------------------

export { answersOfLine } from "./answer-lines.ts";
export type { LineAnswer } from "./answer-lines.ts";

/** An answer as the turns hold it: the line's, with the place `at` of the turn a bare one answers and the id of the turn it was `sent` in. */
export type Answer = LineAnswer & Readonly<{ at: number; sent: string }>;

/** Every answer the user's own lines give, oldest first, a bare one answering the turn before its own. */
const answeredIn = (lines: readonly OwnLine[]): readonly Answer[] =>
  lines.flatMap(({ line, at, sent }) =>
    answersOfLine(line).map((answer) => ({ ...answer, at, sent })),
  );

/**
 * Every answer the user gave: in a turn's prompt where it's the user's own
 * text, and in a message the user sent while a turn ran, the line naming
 * the plugin that opens a draft its clicks started left out; a bare answer
 * means the turn before the one it's in. The first turn answers nothing.
 */
export const answered = (turns: readonly Turn[]): readonly Answer[] =>
  answeredIn(ownLinesOf(turns));

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

/** A Decide item a reply's list prints: its number and its summary. */
type PrintedItem = Readonly<{ number: number; summary: string }>;

/**
 * One line of a Decide list as its items are read from it: a numbered
 * item's own line, its number and the bold summary it opens on; the number
 * a line holds alone, `1.`, or a numbered item's own line holds with no
 * text; the bold text a line opens on, its indent aside; whether it's
 * blank; and whether it writes an option outside code.
 */
type DecideLine = Readonly<{
  number: number | undefined;
  summary: string | undefined;
  bare: number | undefined;
  bold: string | undefined;
  isBlank: boolean;
  isOption: boolean;
}>;

/** A line that opens no item and writes no option: code, a separator, an underline, a bullet. */
const OTHER: DecideLine = {
  number: undefined,
  summary: undefined,
  bare: undefined,
  bold: undefined,
  isBlank: false,
  isOption: false,
};

/** A line of prose, by what it's read as besides. */
const proseLine = (facts: LineFacts): DecideLine => ({
  ...OTHER,
  bare: facts.bare,
  bold: facts.bold,
  isOption: facts.option !== undefined,
});

/** An item's own line. */
const headLine = (head: ItemHead): DecideLine =>
  head.number === undefined
    ? OTHER
    : head.summary !== undefined
      ? { ...OTHER, number: head.number, summary: head.summary }
      : head.text.trim() === ""
        ? { ...OTHER, bare: head.number }
        : OTHER;

/** A block's lines, as a Decide list's items are read from them; a header's none. */
const decideLinesOf = (block: Block): readonly DecideLine[] =>
  block.kind === "item"
    ? [
        headLine(block.head),
        ...block.body.map((under) => (under.isCode ? OTHER : proseLine(under))),
      ]
    : block.kind === "text"
      ? [proseLine(block)]
      : block.kind === "blank"
        ? [{ ...OTHER, isBlank: true }]
        : block.kind === "header"
          ? []
          : block.lines.map(() => OTHER);

/**
 * The item the line at `n` opens: a numbered item's own line opening on its
 * bold summary, or a number alone, `1.`, where the next line not blank opens
 * on the bold summary.
 */
const headAt = (
  lines: readonly DecideLine[],
  n: number,
): PrintedItem | undefined => {
  const line = lines[n];
  const next = lines.slice(n + 1).find((later) => !later.isBlank);

  return line?.number !== undefined && line.summary !== undefined
    ? { number: line.number, summary: line.summary }
    : line?.bare !== undefined && next?.bold !== undefined
      ? { number: line.bare, summary: next.bold }
      : undefined;
};

/**
 * The items of one Decide list's lines that carry an option: each item's
 * chunk runs from its line to the next item's, across blank lines, bullets
 * and prose, as the kanban skill's `decide_items_of_text` reads it, and
 * holds an option outside code.
 */
const printedIn = (lines: readonly DecideLine[]): readonly PrintedItem[] => {
  const heads = lines.flatMap((_, n) => {
    const head = headAt(lines, n);

    return head === undefined ? [] : [{ head, at: n }];
  });

  return heads
    .filter(({ at }, k) =>
      lines
        .slice(at + 1, heads[k + 1]?.at ?? lines.length)
        .some((line) => line.isOption),
    )
    .map(({ head }) => ({
      number: head.number,
      summary: head.summary.trim().replace(/:$/, "").trim(),
    }));
};

/** The numbered items of a reply's Decide lists that carry an option; a 📌 roll-up's bullets carry none. */
export const decideItemsOfText = (text: string): readonly PrintedItem[] =>
  sectionsIn(parseReply(text))
    .filter((section) => DECISIONS.includes(section.name))
    .flatMap((section) => printedIn(section.blocks.flatMap(decideLinesOf)));

/** A Decide item a reply's own list printed: its number and summary, and the id and place of its turn. */
type PrintedDecide = Readonly<{
  number: number;
  summary: string;
  id: string;
  at: number;
}>;

/** Each subject's latest Decide item a reply's own list printed since `start`, the latest `reassess` turn, oldest first. */
const latestDecideItems = (
  turns: readonly Turn[],
  start: number,
): readonly PrintedDecide[] => {
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
export const answeredSubjects = (turns: readonly Turn[]): ReadonlySet<string> =>
  decidedOf(answered(turns), latestDecideItems(turns, reassessStart(turns)));

/** The subject keys of the `latest` Decide items that `answers` answer. */
const decidedOf = (
  answers: readonly Answer[],
  latest: readonly PrintedDecide[],
): ReadonlySet<string> =>
  new Set(
    latest
      .filter((item) => isAnswered(answers, item.id, item.at, item.number))
      .map((item) => subjectKey(item.summary)),
  );

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

/** A GraphQL response's `data`, its answers by alias; none where the response is no JSON object or holds no `data`. */
const dataOf = (response: string): Readonly<Record<string, unknown>> => {
  const body = parsedJson(response);

  return isObject(body) && isObject(body.data) ? body.data : {};
};

/**
 * Whether a GraphQL response, aliased `pr<n>` after each pull request's
 * place in `ordered`, says which of them merged: its `data` holds an entry
 * for every one. A `gh` that failed, timed out or answered with errors
 * alone leaves the merges unknown; nothing asked leaves nothing unknown.
 */
export const isMergeKnown = (
  ordered: readonly string[],
  response: string,
): boolean => {
  const data = dataOf(response);

  return ordered.every((_, n) => isObject(data[`pr${n}`]));
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
  const data = dataOf(response);
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
  windowFrom(turns.length, window, reassessStart(turns));

/** windowStart, over `length` turns whose latest `reassess` turn is at `floor`. */
const windowFrom = (length: number, window: number, floor: number): number =>
  Math.max(window > 0 && window <= length ? length - window : 0, floor);

/** What matches an item across turns: its list and its summary's subject key. */
export const keyOf = (item: Readonly<{ list: ListKey; line: string }>): string =>
  `${item.list}\t${subjectKey(summaryOf(item.line))}`;

/**
 * One item per list and subject printed in the window, at its latest
 * occurrence, in order of first appearance. A 📌 bullet that names nothing
 * it frees keeps what its own list's latest printing since the latest
 * `reassess` turn freed, so a roll-up's restatement doesn't drop it.
 */
export const rollUp = (
  turns: readonly Turn[],
  window: number,
): readonly ListItem[] => rollUpIn(factsOf(turns), window);

/** rollUp, over the facts the turns hold. */
const rollUpIn = (facts: Facts, window: number): readonly ListItem[] => {
  const start = windowFrom(facts.turns.length, window, facts.start);
  const items = facts.items.filter((item) => item.at >= start);
  const keys = items.map(keyOf);
  const last = new Map(keys.map((key, n) => [key, n]));
  const firsts = [...new Set(keys)];

  return firsts.flatMap((key) => {
    const n = last.get(key);
    const found = n === undefined ? undefined : items[n];
    const item =
      found !== undefined && found.isPinned && found.frees.length === 0
        ? { ...found, frees: facts.latestOwn.get(key)?.frees ?? found.frees }
        : found;

    return item === undefined ? [] : [item];
  });
};

// --- what settles an item ---------------------------------------------------

/** The ways an item is settled, as a list's `settled-by` in the spec names them. */
export type SettledBy = Lists[keyof Lists]["settled-by"];

/** A report the turns hold: the place `n` of the turn it came in, the names it goes by, and its text. */
export type Report = Readonly<{
  n: number;
  names: readonly string[];
  report: string;
}>;

/**
 * What the turns hold that settles an item: the pull requests that merged,
 * the subject keys of the Decide items the user answered and of the Todo
 * items a settling word settled, the reports, and the place of the last
 * turn whose own list printed each item since the latest `reassess` turn,
 * by the item's key.
 */
export type Settling = Readonly<{
  merged: ReadonlySet<string>;
  decided: ReadonlySet<string>;
  worded: ReadonlySet<string>;
  reports: readonly Report[];
  lastOwn: ReadonlyMap<string, number>;
}>;

/** How a way of settling settles an item: whether what the turns hold settles it, and the pull requests to ask GitHub about for it. */
export type Settler = Readonly<{
  settles: (item: ListItem, settling: Settling) => boolean;
  pullRequests: (item: ListItem) => readonly string[];
}>;

/** No pull requests to ask about, for a way that merges settle nothing of. */
const askNothing = (): readonly string[] => [];

/**
 * Each way an item is settled, by the name a list's `settled-by` gives it,
 * as spec/kanban.yaml's comment states it; every way the spec's lists use
 * is covered, so a way with no settler here doesn't compile. A later
 * `reassess` turn settles every list's items besides, which the roll-up
 * reads before this.
 */
export const SETTLERS: Readonly<Record<SettledBy, Settler>> = {
  answer: {
    settles: (item, { decided }) =>
      decided.has(subjectKey(summaryOf(item.line))),
    pullRequests: askNothing,
  },
  "merged-pull-request": {
    settles: (item, { merged }) => {
      const refs = pullRequestsOf(item.line);

      return refs.length > 0 && refs.every((ref) => merged.has(ref));
    },
    pullRequests: (item) => pullRequestsOf(item.line),
  },
  report: {
    settles: (item, { reports, lastOwn }) => {
      const summary = summaryOf(item.line);
      const printed = lastOwn.get(keyOf(item)) ?? -1;

      return reports.some(
        ({ n, names, report }) =>
          n > printed && reportNamesItem(summary, names, report),
      );
    },
    pullRequests: askNothing,
  },
  "settling-word": {
    settles: (item, { worded }) => worded.has(subjectKey(summaryOf(item.line))),
    pullRequests: askNothing,
  },
  none: { settles: () => false, pullRequests: askNothing },
};

/** The settler of the way the item's list is settled, as the spec's `settled-by` names it. */
export const settlerOf = (item: Pick<ListItem, "list">): Settler =>
  SETTLERS[SPEC.lists[item.list]["settled-by"]];

/** What the turns hold that settles an item, given the pull requests that merged. */
export const settlingOf = (
  turns: readonly Turn[],
  merged: ReadonlySet<string>,
): Settling => settlingIn(factsOf(turns), merged);

/** settlingOf, over the facts the turns hold. */
const settlingIn = (facts: Facts, merged: ReadonlySet<string>): Settling => ({
  merged,
  decided: decidedOf(facts.answers, latestDecideItems(facts.turns, facts.start)),
  worded: wordedIn(facts),
  reports: reportsOf(facts.turns),
  lastOwn: new Map([...facts.latestOwn].map(([key, item]) => [key, item.at])),
});

/**
 * The subject keys of the items of a list settled by a settling word whose
 * latest printing in their own list since the latest `reassess` turn the
 * user's own text gives one, read from the facts' printings and word
 * answers.
 */
const wordedIn = (facts: Facts): ReadonlySet<string> =>
  new Set(
    [...facts.latestOwn.values()].flatMap((item) =>
      SPEC.lists[item.list]["settled-by"] === "settling-word" &&
      item.number !== undefined &&
      latestWord(
        facts.words,
        SPEC.lists[item.list].header,
        facts.turns[item.at]?.id ?? "",
        item.at,
        item.number,
      ) !== undefined
        ? [subjectKey(summaryOf(item.line))]
        : [],
    ),
  );

/** The reports the turns hold: each text of a turn, not the user's own, that goes by names. */
const reportsOf = (turns: readonly Turn[]): readonly Report[] =>
  turns.flatMap((turn, n) =>
    textsOf(turn).flatMap(({ owner, text, reportNames }) =>
      isOwn(owner) || reportNames === undefined
        ? []
        : [{ n, names: reportNames, report: text }],
    ),
  );

/** The pull requests whose merging would settle any of `items`, as each one's settler names them: what to ask GitHub about. */
export const settlingPullRequests = (items: readonly ListItem[]): readonly string[] =>
  [...new Set(items.flatMap((item) => settlerOf(item).pullRequests(item)))].sort();

/** The pull requests the count line over the last `window` turns asks GitHub about: none of those `merged` already holds. */
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
): readonly ListItem[] => unsettledIn(factsOf(turns), items, merged);

/** unsettled, over the facts the turns hold. */
const unsettledIn = (
  facts: Facts,
  items: readonly ListItem[],
  merged: ReadonlySet<string>,
): readonly ListItem[] => {
  const settling = settlingIn(facts, merged);

  return items.filter((item) => !settlerOf(item).settles(item, settling));
};

/**
 * The count line the skill closes a reply on, such as
 * `📌 Outstanding: 🚧 2 · 🔑 1 · 🧠 3`: each list's glyph and count in the
 * skill's order, an empty list left out; empty when there are no items.
 */
export const countsOf = (items: readonly ListItem[]): string => {
  const shown = LIST_KEYS.map(
    (key) =>
      [
        SPEC.lists[key].glyph,
        items.filter((item) => item.list === key).length,
      ] as const,
  )
    .filter(([, count]) => count > 0)
    .map(([glyph, count]) => `${glyph} ${count}`);

  return shown.length > 0
    ? `${ROLL_UP.glyph} ${ROLL_UP["count-label"]}: ${shown.join(ROLL_UP["count-separator"])}`
    : "";
};

/** The count line over the last `window` turns, given the pull requests that merged. */
export const countLine = (
  turns: readonly Turn[],
  window: number,
  merged: ReadonlySet<string> = new Set(),
): string => countLineIn(factsOf(turns), window, merged);

/** countLine, over the facts the turns hold. */
const countLineIn = (
  facts: Facts,
  window: number,
  merged: ReadonlySet<string>,
): string => countsOf(unsettledIn(facts, rollUpIn(facts, window), merged));

/** How a Decide item stopped being open: by an answer, a later `reassess` turn, or a later item that replaced it, `by`, by its ref; undefined while it's open. */
const settlementOf = (
  item: DecideItem,
  answer: Answer | undefined,
  isBeforeReassess: boolean,
  by: string | undefined,
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
      : by !== undefined
        ? { ref: refOf(item), how: "superseded", by }
        : undefined;

/** Whether `newer`'s `supersedes` names `older`, by its turn and number; an item never names itself. */
const supersedes = (newer: DecideItem, older: DecideItem): boolean =>
  refOf(newer) !== refOf(older) &&
  (newer.supersedes ?? []).some((text) => {
    const ref = decideRefOf(text);

    return (
      ref !== undefined &&
      ref.number === older.number &&
      isSameTurn(ref.turn, older.turn)
    );
  });

/**
 * The ref of the item that replaced each of `raised`, the Decide items
 * oldest first, in their order. A later raising of an item's own ref, as
 * when the agent raises an open item again, replaces it whatever that
 * one's `supersedes`: the item then goes as its latest raising goes, by
 * the item that replaced that one, else by its own ref. Else it's the
 * latest later item whose `supersedes` names it; else the latest later
 * item on its subject that gave no `supersedes`; undefined where none did.
 * Only a later item replaces one, so a reference to a later item, to an
 * unknown one or back round a cycle replaces nothing. Each item's ref and
 * subject key is worked out once, latest first, so a raising's own
 * replacer is known before an earlier raising of it asks.
 */
export const supersedersOf = (
  raised: readonly Raising[],
): readonly (string | undefined)[] => {
  const items = raised.map(({ item }) => item);
  const refs = items.map(refOf);
  const keys = items.map((item) => subjectKey(item.summary));
  const latestAfter = (n: number, is: (later: DecideItem, m: number) => boolean) =>
    items.findLastIndex((later, m) => m > n && is(later, m));
  const byOf = (older: DecideItem, n: number): number => {
    const named = latestAfter(n, (later) => supersedes(later, older));

    return named >= 0
      ? named
      : latestAfter(n, (later, m) => later.supersedes === undefined && keys[m] === keys[n]);
  };

  const replacerOf = (
    after: readonly (string | undefined)[],
    older: DecideItem,
    n: number,
  ): string | undefined => {
    const again = latestAfter(n, (_, m) => refs[m] === refs[n]);
    const by = again >= 0 ? -1 : byOf(older, n);

    return again >= 0
      ? (after[again - n - 1] ?? refs[again])
      : by < 0
        ? undefined
        : refs[by];
  };

  return items.reduceRight<readonly (string | undefined)[]>(
    (after, older, n) => [replacerOf(after, older, n), ...after],
    [],
  );
};

/** A Decide item a `kanban_options` call raised, and how it settled, if it did. */
export type DecideState = Readonly<{
  item: DecideItem;
  settlement: Settlement | undefined;
}>;

/**
 * Every Decide item the `kanban_options` calls raised, oldest first, and how
 * it settled, if it did: by the latest of the user's answers to it, else by
 * a later `reassess` turn, else by a later item that replaced it, as
 * supersedersOf finds it. A turn that reassesses applies its own answers
 * first, so an item it answers settles as answered. Each frees what
 * withRepliedFrees gives it.
 */
export const decideStates = (turns: readonly Turn[]): readonly DecideState[] =>
  decideStatesIn(factsOf(turns));

/** decideStates, over the facts the turns hold. */
const decideStatesIn = ({
  turns,
  start,
  answers,
  items,
}: Facts): readonly DecideState[] => {
  const raised = withRepliedFrees(
    turns,
    items,
    turns.flatMap((turn, at) => turn.decide.map((item) => ({ item, at }))),
  );
  const superseders = supersedersOf(raised);

  return raised.map(({ item, at }, n) => ({
    item,
    settlement: settlementOf(
      item,
      answerFor(answers, item.turn, at, item.number),
      at < start,
      superseders[n],
    ),
  }));
};

/**
 * The open Decide items, oldest first: those the `kanban_options` calls
 * raised since the latest `reassess` turn that no later item replaced,
 * none the user answered.
 */
export const openDecideItems = (
  turns: readonly Turn[],
): readonly DecideItem[] => openItemsIn(decideStates(turns));

/** The items among `states` that haven't settled, in their order. */
export const openItemsIn = (
  states: readonly DecideState[],
): readonly DecideItem[] =>
  states
    .filter((state) => state.settlement === undefined)
    .map((state) => state.item);

/** How each settled Decide item settled, oldest first. */
export const settlementsOf = (turns: readonly Turn[]): readonly Settlement[] =>
  settlementsIn(decideStates(turns));

/** How each of `states` that settled did, in their order. */
export const settlementsIn = (
  states: readonly DecideState[],
): readonly Settlement[] => states.flatMap((state) => state.settlement ?? []);

/** What the turns leave open: the Decide items, how each settled one settled, and the count line. */
export type Open = Readonly<{
  items: readonly DecideItem[];
  settlements: readonly Settlement[];
  counts: string;
}>;

/** What the turns leave open: the Decide items and the settlements, from one reading of the items' states, and the count line over the last `window` turns given the pull requests that merged, all from one gathering of the facts the turns hold. */
export const openOf = (
  turns: readonly Turn[],
  window: number,
  merged: ReadonlySet<string> = new Set(),
): Open => openIn(factsOf(turns), window, merged);

/** openOf, over the facts the turns hold, which a caller that reads more of them gathers once. */
export const openIn = (
  facts: Facts,
  window: number,
  merged: ReadonlySet<string> = new Set(),
): Open => {
  const states = decideStatesIn(facts);

  return {
    items: openItemsIn(states),
    settlements: settlementsIn(states),
    counts: countLineIn(facts, window, merged),
  };
};

// --- the facts every reading shares -----------------------------------------

/**
 * What two or more of the Decide items' states, the roll-up and the
 * settling read, gathered once: the turns, the place of the latest
 * `reassess` turn, the user's answers, those with a settling word among
 * them, every item, and each item's latest printing in its own list since
 * that turn, by the item's key.
 */
export type Facts = Readonly<{
  turns: readonly Turn[];
  start: number;
  answers: readonly Answer[];
  words: readonly HeldWordAnswer[];
  items: readonly ListItem[];
  latestOwn: ReadonlyMap<string, ListItem>;
}>;

/** The facts the turns hold, each worked out once, the user's own lines read once for both kinds of answer. */
export const factsOf = (turns: readonly Turn[]): Facts => {
  const starts = reassessStarts(turns);
  // The latest `reassess` turn at or before the last turn: reassessStart.
  const start = starts.at(-1) ?? 0;
  const items = itemsIn(turns, starts);
  const lines = ownLinesOf(turns);

  return {
    turns,
    start,
    answers: answeredIn(lines),
    words: wordAnsweredIn(lines),
    items,
    latestOwn: new Map(
      items
        .filter((item) => !item.isPinned && item.at >= start)
        .map((item) => [keyOf(item), item] as const),
    ),
  };
};
