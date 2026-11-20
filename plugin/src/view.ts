// What the hooks draw, worked out apart from drawing it: the text of the
// commands, the tool's result and an item's title, what Submit does with
// the draft, how an item's notes are drawn, and whether the tool's row is
// plain enough to be drawn as nothing, the buttons going under the reply
// instead.

import type { DecideItem, Raised, Settlement } from "../types/index.d.ts";
import { refOf } from "./items.ts";
import { problemsOf, stillOpen } from "./raised.ts";
import { withoutDraftHeader } from "./transcript.ts";

/** What the pane and /answers say when there are no open items, with why when it's known. */
export const noItemsText = (problem: string): string =>
  `No open Decide items${problem ? `: ${problem}` : ""}.`;

/** /answers's reply: the pane opened over the open items, or why there are none. */
export const answersText = (raised: Raised): string => {
  const open = stillOpen(raised).length;

  return open === 0
    ? noItemsText(problemsOf(raised))
    : `Decide pane opened: ${open} open Decide items.`;
};

/** /answers-config's reply: each setting in effect, then each file or value not used and why. */
export const configText = (
  effective: readonly string[],
  problems: readonly string[],
): string =>
  [...effective, ...problems.map((problem) => `Not used: ${problem}`)].join(
    "\n",
  );

/** The `kanban_options` tool's result: how many items it drew buttons for, by reference. */
export const drewText = (items: readonly DecideItem[]): string =>
  `Drew buttons for ${items.length} Decide items under the final response and in the Decide pane: ${items
    .map(refOf)
    .join(", ")}.`;

/** What the pane says when Submit finds a file mention, pasted text or a pasted image, which a plugin's prompt sends unexpanded. */
export const NEEDS_ENTER_TEXT =
  "Not sent: press Enter in the prompt to send file mentions, pasted text or images.";

/** What the pane says when the prompt box couldn't be emptied, so Submit sent nothing. */
export const NOT_EMPTIED_TEXT =
  "Not sent: the prompt box couldn't be emptied, so the draft is still there.";

/** What the pane says when the engine didn't take the prompt Submit sent, the draft put back, after what was typed meanwhile when `isAfterTyped`. */
export const notSentText = (why: string, isAfterTyped = false): string =>
  `Not sent, the draft put back in the prompt box${isAfterTyped ? " after the text typed meanwhile" : ""}: ${why}`;

/** What the pane says when the engine didn't take the prompt and the box couldn't take the draft back either: the draft itself, so it isn't lost. */
export const notPutBackText = (why: string, draft: string): string =>
  `Not sent, and the prompt box couldn't take the draft back: ${why}\nThe draft, to copy:\n${draft}`;

/**
 * What a refused draft goes back into the box with, by `append`: the draft
 * alone into the box Submit emptied, else on a line of its own after what
 * the person typed while the submit was pending.
 */
export const putBackText = (box: string, draft: string): string =>
  box === "" || box.endsWith("\n") ? draft : `\n${draft}`;

// The placeholders Claude Code leaves in the box for what it expands only
// on Enter: a pasted image, `[Image #1]`, and collapsed pasted text,
// `[Pasted text #1 +12 lines]`, which `$.prompt.read()` may give in place
// of the text.
const PLACEHOLDERS: readonly RegExp[] = [
  /\[Image #\d+\]/,
  /\[Pasted text #\d+(?: \+\d+ lines?)?\]/,
];

// A mention's path looks like a file when it starts as a path does, `./`,
// `../`, `~/` or `/`, or is quoted, `@"my file.md"`; or when its last
// segment has an extension, `@README.md`, `@src/x.ts#L3`. A bare name,
// `@alice`, or a package, `@types/node`, does not.
const PATH_START = /^(?:\.{1,2}\/|~\/|\/|")/;
const EXTENSION = /[^/.]\.[A-Za-z0-9]+$/;

/** The path of an `@` mention without a `#L` line range or the sentence's punctuation after it. */
const mentionPath = (word: string): string =>
  word
    .slice(1)
    .replace(/#.*$/, "")
    .replace(/[.,;:!?)]+$/, "");

/** Whether a word is an `@` mention whose path looks like a file. */
const isFileMention = (word: string): boolean =>
  word.startsWith("@") &&
  (PATH_START.test(word.slice(1)) || EXTENSION.test(mentionPath(word)));

/** Whether a draft holds a file mention, or pasted text or an image left as a placeholder, which Claude Code expands only for a prompt sent with Enter. */
export const needsEnter = (draft: string): boolean =>
  draft.split(/\s+/).some(isFileMention) ||
  PLACEHOLDERS.some((placeholder) => placeholder.test(draft));

/** What a press of the pane's Submit does with the box's text. */
export type SubmitStep = Readonly<
  { skip: true } | { refuse: string } | { send: string }
>;

/**
 * What a press of the pane's Submit does: nothing while a turn runs or
 * another Submit is under way, or for a box of blanks or of the line
 * naming the plugin alone; refuses a draft with a file mention, pasted text
 * or an image; else sends the draft as it is.
 */
export const submitStep = (draft: string, isBusy: boolean): SubmitStep =>
  isBusy || withoutDraftHeader(draft).trim() === ""
    ? { skip: true }
    : needsEnter(draft)
      ? { refuse: NEEDS_ENTER_TEXT }
      : { send: draft };

/** The key of an item's notes field in the pane. */
export const notesKey = (item: DecideItem): string => `${refOf(item)}.notes`;

/** How an item's notes are drawn: none once settled, a button under a reply, else the field, which takes the focus when `✏️ Add a note` asked for it. */
export type NotesMode = "none" | "button" | "field" | "focused";

/** How an item's notes are drawn, by whether it's settled, whether the pane draws it, and whether its `✏️ Add a note` opened the pane. */
export const notesMode = (
  at: Readonly<{ isSettled: boolean; isPane: boolean; isNoting: boolean }>,
): NotesMode =>
  at.isSettled
    ? "none"
    : !at.isPane
      ? "button"
      : at.isNoting
        ? "focused"
        : "field";

/** How many lines tall the notes field is drawn: the setting, a whole number of at least 1. */
export const noteRows = (rows: number): number =>
  Number.isFinite(rows) ? Math.max(1, Math.floor(rows)) : 1;

/**
 * The style of the column left of an option's lines: a settled item's
 * stays lit in the settled colour, and an open one's lights in the hover
 * colour while the pointer is over any line of the option `scope` names.
 */
export const gutterStyle = (
  isSettled: boolean,
  scope: string,
  colors: Readonly<{ hover: string; settled: string }>,
):
  | Readonly<{ backgroundColor: string }>
  | Readonly<{ hover: Readonly<{ scope: string; backgroundColor: string }> }> =>
  isSettled
    ? { backgroundColor: colors.settled }
    : { hover: { scope, backgroundColor: colors.hover } };

/**
 * An item's title line in its box: the label, its list and number, drawn
 * bold on a background with a space either side, then the summary on the
 * same line, marked when the item is settled.
 */
export const itemTitle = (
  item: DecideItem,
  isSettled: boolean,
): Readonly<{ label: string; summary: string }> => ({
  label: ` 🧠 Decide.${item.number} `,
  summary: `${item.summary}${isSettled ? " (settled)" : ""}`,
});

/**
 * The line under a settled item's title saying what settled it: the answer,
 * `Answered in <turn>: <letters>`, its note after ` · ` or in place of the
 * letters; else `Settled: reassessed`, `Settled: asked again`, or
 * `Settled` where the transcript doesn't say.
 */
export const settledText = (settlement: Settlement | undefined): string =>
  settlement === undefined
    ? "Settled"
    : settlement.how === "answered"
      ? `Answered in ${settlement.turn}: ${[settlement.letters.join(","), settlement.note]
          .filter((part) => part !== "")
          .join(" · ")}`
      : settlement.how === "reassessed"
        ? "Settled: reassessed"
        : "Settled: asked again";

/** The letters the answer that settled an item picked; none when something else settled it. */
export const sentLetters = (
  settlement: Settlement | undefined,
): readonly string[] =>
  settlement?.how === "answered" ? settlement.letters : [];

/** What the engine says of a tool row or its result line. */
export type ToolRow = Readonly<{
  isExpanded: boolean;
  isErrored: boolean;
  /** Left out for a result line, which isn't interrupted apart from its call. */
  isInterrupted?: boolean;
  /** The items the call drew; left out for a result line. */
  itemCount?: number;
}>;

/**
 * Whether the tool's row, or its result line, draws nothing, its items
 * going under the reply: not where it says more than they do, under ctrl+o,
 * after an error or an interruption, or for a call that drew no items.
 */
export const isPlainToolRow = (row: ToolRow): boolean =>
  !row.isExpanded &&
  !row.isErrored &&
  row.isInterrupted !== true &&
  row.itemCount !== 0;
