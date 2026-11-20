// What the `kanban_outstanding` tool gives the agent: the count line, a
// draft of the full 📌 roll-up, each item ending in its 🔖 tag, and the open
// Decide items as the `kanban_options` tool takes them; the kanban skill's
// `outstanding.py render` and `decide --json`, in TypeScript. No `$`, no
// I/O: the hook reads the turns, asks GitHub which pull requests merged,
// and hands both here.
//
// The draft leaves out what the core can tell is settled, as the count line
// does; which of the rest is still open is the agent's call, so it prunes
// the draft. Each item carries the turn that raised it: the first turn of
// the latest run of its own list's restatements whose text after the bold
// summary is unchanged, so a restatement with changed substance moves the
// tag and a reworded summary alone does not; else, for an item only a 📌
// roll-up restated, the turn that roll-up's own tag names; else the turn
// that first printed it.

import {
  LIST_KEYS,
  allItems,
  keyOf,
  openOf,
  rollUp,
  summaryOf,
  unsettled,
  windowStart,
} from "./outstanding.ts";
import type { ListItem } from "./outstanding.ts";
import { cellWidth } from "../text/cells.ts";
import { subscriptOf } from "../pane/sections.ts";
import { TOOL_CALLED } from "../protocol/instructions.ts";
import { SPEC } from "../protocol/spec.ts";
import type { Turn } from "../../types/index.d.ts";

const ROLL_UP = SPEC["roll-up"];
const BOLD = /\*\*.+?\*\*/;

/** An item's body: the text after its bold summary, what a restatement with changed substance changes. */
export const bodyOf = (line: string): string => {
  const bold = BOLD.exec(line);

  return bold === null ? line : line.slice(bold.index + bold[0].length);
};

/** Text with everything but letters and digits gone, lowercased, as restatements are compared. */
const normal = (text: string): string =>
  text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * The place among `turns` of the turn that raised an item, from its
 * `occurrences`, oldest first: the first of the latest run of its own
 * list's restatements with the same body; else the turn a 📌 roll-up's tag
 * names; else its earliest occurrence's.
 */
export const raisedAt = (
  turns: readonly Turn[],
  occurrences: readonly Pick<ListItem, "at" | "isPinned" | "line" | "tagged">[],
): number => {
  const own = occurrences.filter((item) => !item.isPinned);
  const latest = normal(bodyOf(own.at(-1)?.line ?? ""));
  const runStart = own.findLastIndex((item) => normal(bodyOf(item.line)) !== latest) + 1;
  const tagged = occurrences
    .map((item) => turns.findIndex((turn) => turn.id === item.tagged))
    .find((at) => at >= 0);

  return own[runStart]?.at ?? tagged ?? occurrences[0]?.at ?? 0;
};

/** The 🔖 tag of an item the turn at `at` raised: the turn's id, then its index back from the latest turn in subscript, `🔖 0f311c94₋₃`. */
export const tagOf = (turns: readonly Turn[], at: number): string =>
  `${SPEC.tag.glyph} ${turns[at]?.id ?? ""}${subscriptOf(at - (turns.length - 1))}`;

/** What a summary cut short ends on, where it was cut. */
const ELLIPSIS = "…";

/** A run of a summary: plain text, `shown` alone, or a Markdown link, its `[`, its label shown, and its `](url)`. */
type Run = Readonly<{ opening: string; shown: string; closing: string }>;

/** A Markdown link in `chars`, as the places of its `[`, `]` and `)`. */
type Link = readonly [number, number, number];

/**
 * Where the bracket closing the `open` one at `start` is in `chars`, nested
 * pairs counted, read one character at a time from `start` and no further
 * than the close; none where `start` holds no `open` or it isn't closed.
 */
const closingAt = (
  chars: readonly string[],
  start: number,
  open: string,
  close: string,
): number | undefined => {
  const walk = (at: number, depth: number): number | undefined => {
    const char = chars[at];
    const deeper =
      depth + (char === open ? 1 : char === close ? -1 : 0);

    return char === undefined
      ? undefined
      : deeper === 0
        ? at
        : walk(at + 1, deeper);
  };

  return chars[start] === open ? walk(start, 0) : undefined;
};

/** The Markdown link `[label](url)` opening at `start` in `chars`, if one does. */
const linkAt = (chars: readonly string[], start: number): Link | undefined => {
  const labelEnd =
    chars[start] === "[" ? closingAt(chars, start, "[", "]") : undefined;
  const urlEnd =
    labelEnd !== undefined && chars[labelEnd + 1] === "("
      ? closingAt(chars, labelEnd + 1, "(", ")")
      : undefined;

  return labelEnd === undefined || urlEnd === undefined
    ? undefined
    : [start, labelEnd, urlEnd];
};

/** A summary as runs of plain text and links, in order, by code point. */
export const runsOf = (text: string): readonly Run[] => {
  const chars = [...text];
  const links = chars.reduce<readonly Link[]>((found, _, n) => {
    const last = found.at(-1);
    const link = last !== undefined && n <= last[2] ? undefined : linkAt(chars, n);

    return link === undefined ? found : [...found, link];
  }, []);
  const plain = (from: number, to: number): readonly Run[] =>
    to > from
      ? [{ opening: "", shown: chars.slice(from, to).join(""), closing: "" }]
      : [];
  const walked = links.reduce<Readonly<{ runs: readonly Run[]; from: number }>>(
    ({ runs, from }, [start, mid, end]) => ({
      runs: [
        ...runs,
        ...plain(from, start),
        {
          opening: "[",
          shown: chars.slice(start + 1, mid).join(""),
          closing: chars.slice(mid, end + 1).join(""),
        },
      ],
      from: end + 1,
    }),
    { runs: [], from: 0 },
  );

  return [...walked.runs, ...plain(walked.from, chars.length)];
};

/** How long a run of text is, by code point, as the skill's script counts it. */
const lengthOf = (text: string): number => [...text].length;

/**
 * A summary cut to `width` Unicode code points, a link counting its label
 * alone, ending on `…` where it was cut, as the skill's `outstanding.py`
 * cuts it; whole for a `width` of 0 or less. A cut inside a link shortens
 * its label and keeps the link whole, so no `[label](url` is left half
 * written; a cut right after a link leaves the link alone, the `…` after
 * it.
 */
export const cutTo = (text: string, width: number): string => {
  const runs = runsOf(text);
  const shown = runs.reduce((sum, run) => sum + lengthOf(run.shown), 0);

  return width <= 0 || shown <= width
    ? text
    : runs.reduce<Readonly<{ out: string; budget: number; isDone: boolean }>>(
        (state, { opening, shown: label, closing }) =>
          state.isDone
            ? state
            : lengthOf(label) <= state.budget
              ? {
                  out: `${state.out}${opening}${label}${closing}`,
                  budget: state.budget - lengthOf(label),
                  isDone: false,
                }
              : state.budget <= 0
                ? { out: `${state.out}${ELLIPSIS}`, budget: 0, isDone: true }
                : {
                    out: `${state.out}${opening}${[...label].slice(0, state.budget).join("")}${ELLIPSIS}${closing}`,
                    budget: 0,
                    isDone: true,
                  },
        { out: "", budget: Math.max(width - 1, 0), isDone: false },
      ).out;
};

/** A header line as a reply writes it, ending in a hard line break: `⏳ **Waiting:**  `. */
const headerLine = (glyph: string, header: string): string =>
  `${glyph} **${header}:**  `;

/** The underline of a header line: one character per column it renders in. */
const underlineOf = (line: string, char: string): string =>
  char.repeat(cellWidth(line.trimEnd().replaceAll("**", "")));

/**
 * A draft of the full 📌 roll-up over the last `window` turns, given the
 * pull requests that merged: its header and rule, then each list's items
 * that nothing settled, in the lists' order, each under its header, its
 * summary cut to `width`, and ending in its 🔖 tag, a blank line before
 * each list but the first. Empty when nothing is outstanding.
 */
export const rollUpDraft = (
  turns: readonly Turn[],
  window: number,
  merged: ReadonlySet<string> = new Set(),
  width: number = Number.POSITIVE_INFINITY,
): string => {
  const start = windowStart(turns, window);
  const occurrences = allItems(turns).filter((item) => item.at >= start);
  const items = unsettled(turns, rollUp(turns, window), merged);
  const groups = LIST_KEYS.map((key) => ({
    key,
    members: items.filter((item) => item.list === key),
  })).filter(({ members }) => members.length > 0);
  const header = headerLine(ROLL_UP.glyph, ROLL_UP.header);
  const body = groups.flatMap(({ key, members }, n) => [
    ...(n > 0 ? [""] : []),
    headerLine(SPEC.lists[key].glyph, SPEC.lists[key].header),
    ...members.map(
      (item) =>
        `- **${cutTo(summaryOf(item.line), width)}** ${tagOf(
          turns,
          raisedAt(
            turns,
            occurrences.filter((found) => keyOf(found) === keyOf(item)),
          ),
        )}`,
    ),
  ]);

  return body.length === 0
    ? ""
    : [header, underlineOf(header, SPEC.characters["roll-up-underline"]), ...body].join("\n");
};

/** The `kanban_outstanding` tool's result where the session can't be read, with why. */
export const unreadText = (problem: string): string =>
  `What earlier turns leave open could not be read${problem === "" ? "" : `: ${problem}`}.`;

/** What `kanban_outstanding` reads the turns over: the window the count line reads, how wide a summary in the draft may be, the pull requests known merged, and whether GitHub answered for the rest. */
export type Over = Readonly<{
  window: number;
  width: number;
  merged: ReadonlySet<string>;
  isMergeKnown: boolean;
}>;

/** What the result says where GitHub didn't say which pull requests merged. */
export const MERGES_UNKNOWN = `Which pull requests merged is unknown: \`gh\` didn't answer, so the count line and the draft keep every ${SPEC.lists.review.header} item whose pull request isn't already known merged; check those before printing them.`;

/**
 * The `kanban_outstanding` tool's result: the count line, the roll-up's
 * draft and the open Decide items' JSON, each under a line saying what it
 * is for, over the turns `over` says, and, where GitHub didn't answer,
 * that the merges are unknown.
 */
export const outstandingText = (
  turns: readonly Turn[],
  { window, width, merged, isMergeKnown }: Over,
): string => {
  const open = openOf(turns, window, merged);
  const draft = rollUpDraft(turns, window, merged, width);

  return [
    ...(isMergeKnown ? [] : [MERGES_UNKNOWN]),
    open.counts === ""
      ? "Count line: none, since nothing is outstanding."
      : `Count line, for a reply between full roll-ups:\n${open.counts}`,
    draft === ""
      ? "Roll-up: none, since nothing is outstanding."
      : `Roll-up draft, for a reply that prints it in full; leave out what is settled:\n${draft}`,
    `Open ${SPEC.lists.decide.header} items, the input for \`${TOOL_CALLED}\` when the reply prints them again:\n${JSON.stringify({ items: open.items })}`,
  ].join("\n\n");
};
