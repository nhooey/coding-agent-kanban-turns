// What the hooks draw, worked out apart from drawing it: the text of the
// commands, the tool's result, an item's title and an option's lead, what
// Submit does with the draft and what the footer says it will send, how
// much of what's open the draft answers, the keys panel's rows, how an
// item's notes are drawn, and whether the tool's row is plain enough to be
// drawn as nothing, the buttons going under the reply instead.

import type { DecideItem, Raised, Settings, Settlement } from "../../types/index.d.ts";
import { answersIn, hasReassess } from "../items/answers.ts";
import { glyphOf, optionMark, refOf } from "../items/items.ts";
import type { Ignored } from "../items/items.ts";
import { DECIDE, DONE, REASSESS, itemLabel } from "../protocol/rules.ts";
import { problemsOf, stillOpen } from "../items/raised.ts";
import { padToCells, widestCells } from "../text/cells.ts";
import { capitalized } from "../text/words.ts";
import { isReassessLine, withoutDraftHeader } from "../transcript/turns.ts";
import { LAYOUT } from "./layout.ts";
import { doneLine } from "./sections.ts";

/** What the pane and /answers say when there are no open items, with why when it's known. */
export const noItemsText = (problem: string): string =>
  `No open ${DECIDE.header} items${problem ? `: ${problem}` : ""}.`;

/** /answers's reply: the pane opened over the open items, or why there are none. */
export const answersText = (raised: Raised): string => {
  const open = stillOpen(raised).length;

  return open === 0
    ? noItemsText(problemsOf(raised))
    : `${DECIDE.header} pane opened: ${open} open ${DECIDE.header} items.`;
};

/** /answers-config's reply: each setting in effect, then each file or value not used and why. */
export const configText = (
  effective: readonly string[],
  problems: readonly string[],
): string =>
  [...effective, ...problems.map((problem) => `Not used: ${problem}`)].join(
    "\n",
  );

/** The form `supersedes` takes, as the tool's result names it. */
const SUPERSEDES_FORM = `["<turn>.${DECIDE.header}.<n>"]`;

/** What the tool's result says the item then supersedes, after it ignored all of its `supersedes`. */
const SUBJECT_FALLBACK = `so it replaces an earlier item on its subject, as with no supersedes`;

/** What the tool's result says of what it ignored in one item's `supersedes`, by why, as Ignored's `left` says. */
const IGNORED_TEXTS: Readonly<Record<Ignored["left"], (ignored: Ignored) => string>> = {
  some: ({ ref, values }) =>
    `Ignored in ${ref}'s supersedes, as no ${DECIDE.header} item's reference, <turn>.${DECIDE.header}.<n>: ${values.join(", ")}.`,
  all: ({ ref, values }) =>
    `Ignored all of ${ref}'s supersedes, as no ${DECIDE.header} item's reference, <turn>.${DECIDE.header}.<n>: ${values.join(", ")}; ${SUBJECT_FALLBACK}.`,
  list: ({ ref, values }) =>
    `Ignored ${ref}'s supersedes, ${values.join(", ")}, as no list, ${SUPERSEDES_FORM}; ${SUBJECT_FALLBACK}.`,
};

/**
 * The `kanban_options` tool's result: how many items it drew buttons for,
 * by reference, then, for each item whose `supersedes` held what itemsOf
 * leaves out, what it ignored there and what the item then supersedes.
 */
export const drewText = (
  items: readonly DecideItem[],
  ignored: readonly Ignored[] = [],
): string =>
  [
    `Drew buttons for ${items.length} ${DECIDE.header} items under the final response and in the ${DECIDE.header} pane: ${items
      .map(refOf)
      .join(", ")}.`,
    ...ignored.map((each) => IGNORED_TEXTS[each.left](each)),
  ].join(" ");

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
 * What the pane says when a step of Submit failed with `why`: once it has
 * read a `draft`, the draft itself, since the failed step may have emptied
 * the box, and may or may not have sent it.
 */
export const failedText = (why: string, draft?: string): string =>
  draft === undefined
    ? `Submit failed: ${why}`
    : `Submit failed, the draft perhaps not sent and the prompt box perhaps emptied: ${why}\nThe draft, to copy:\n${draft}`;

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

/** How many lines tall the notes field is drawn: the setting, a whole number of at least `LAYOUT.fewestNoteRows`. */
export const noteRows = (rows: number): number =>
  Number.isFinite(rows)
    ? Math.max(LAYOUT.fewestNoteRows, Math.floor(rows))
    : LAYOUT.fewestNoteRows;

/**
 * The style of the column left of an option's lines: an open item's lights
 * in the hover colour while the pointer is over any line of the option
 * `scope` names; a settled item's stays lit in the settled colour beside an
 * option its answer picked, one of the `answered` letters the settlement or
 * the sent answer gives, and is unlit beside the others, never hovering. An
 * item settled with no letters lights none.
 */
export const gutterStyle = (
  option: Readonly<{
    isSettled: boolean;
    answered: readonly string[];
    letter: string;
    scope: string;
  }>,
  colors: Readonly<{ hover: string; settled: string }>,
):
  | Readonly<{ backgroundColor: string }>
  | Readonly<{ hover: Readonly<{ scope: string; backgroundColor: string }> }>
  | Readonly<Record<never, never>> =>
  !option.isSettled
    ? { hover: { scope: option.scope, backgroundColor: colors.hover } }
    : option.answered.includes(option.letter)
      ? { backgroundColor: colors.settled }
      : {};

/**
 * An item's title line in its box: the label, its list and number, drawn
 * bold on a background with a space either side, then the summary on the
 * same line, marked when the item is Done.
 */
export const itemTitle = (
  item: DecideItem,
  isDone: boolean,
): Readonly<{ label: string; summary: string }> => ({
  label: ` ${itemLabel(item.number)} `,
  summary: `${item.summary}${isDone ? " (done)" : ""}`,
});

/**
 * The cells every option's mark takes in an item: the widest of the chosen
 * and sent marks and each option's glyph, so the item's options line up and
 * a pick moves no option's text.
 */
export const markCells = (
  item: DecideItem,
  marks: Pick<Settings["marks"], "chosen" | "sent">,
): number =>
  widestCells([
    marks.chosen,
    marks.sent,
    ...item.options.map((option) => glyphOf(item, option.letter)),
  ]);

/** An option's lead, `🔘 A. `: its mark, as `optionMark` says, padded to the item's `markCells`, then its letter. */
export const optionLead = (
  item: DecideItem,
  letter: string,
  is: Readonly<{ chosen: boolean; sent: boolean }>,
  marks: Pick<Settings["marks"], "chosen" | "sent">,
): string =>
  `${padToCells(optionMark(item, letter, is, marks), markCells(item, marks))} ${letter}. `;

/** An answer's letters, then its note after ` · ` or in their place. */
const lettersAndNote = (letters: readonly string[], note: string): string =>
  [letters.join(","), note]
    .filter((part) => part !== "")
    .join(LAYOUT.divider);

/** The text for each way an item settles, saying a settlement of that way: one for every `how`, so a new one can't go unsaid. */
export type SettledTexts = {
  readonly [How in Settlement["how"]]: (
    settlement: Extract<Settlement, { how: How }>,
  ) => string;
};

/**
 * What made a Done item Done, by how: the answer, `Answered in <turn>:
 * <letters>`, its note after ` · ` or in place of the letters; the answer
 * Submit sent, `Sent: <letters>`, until the turn's end reads it; a later
 * `reassess`, `Done: reassessed`; or a later item that replaced it,
 * `Superseded by <ref>`. The pane's word for a settled item is the Done
 * list's name, so it follows the spec's header.
 */
const SETTLED_TEXTS: SettledTexts = {
  answered: (s) => `Answered in ${s.turn}: ${lettersAndNote(s.letters, s.note)}`,
  sent: (s) => `Sent: ${lettersAndNote(s.letters, s.note)}`,
  reassessed: () => `${DONE.header}: ${REASSESS}ed`,
  superseded: (s) => `Superseded by ${s.by}`,
};

/** What the settlement's `how` says of it. */
const textOf = <How extends Settlement["how"]>(
  settlement: Extract<Settlement, { how: How }>,
): string => SETTLED_TEXTS[settlement.how](settlement);

/** The line under a Done item's title saying what made it Done, as `SETTLED_TEXTS` says, or `Done` where the transcript doesn't say. */
export const settledText = (settlement: Settlement | undefined): string =>
  settlement === undefined ? DONE.header : textOf(settlement);

/** A line naming another item: its text, and the ref of the item a click on it shows. */
export type ItemLink = Readonly<{ text: string; to: string }>;

/** The link the line saying what made a Done item Done is: a superseded item's, to the item that replaced it; none for any other. */
export const settledLink = (
  settlement: Settlement | undefined,
): ItemLink | undefined =>
  settlement?.how === "superseded"
    ? { text: settledText(settlement), to: settlement.by }
    : undefined;

/** A Done item's one line in its expanded section, as doneLine gives it, and the link that ends it, where what made it Done is one. */
export type DoneRow = Readonly<{
  line: Readonly<{ label: string; text: string }>;
  link: ItemLink | undefined;
}>;

/** A Done item's row: its line saying what made it Done, or, where that's a link, its line up to the link, then the link. */
export const doneRowOf = (
  item: DecideItem,
  settlement: Settlement | undefined,
): DoneRow => {
  const link = settledLink(settlement);

  return {
    line: doneLine(item, link === undefined ? settledText(settlement) : ""),
    link,
  };
};

/** The lines of an item's box naming each item it supersedes, `Supersedes 682e71fb.Decide.1`, each a link to it. */
export const supersedesLinks = (refs: readonly string[]): readonly ItemLink[] =>
  refs.map((ref) => ({ text: `Supersedes ${ref}`, to: ref }));

/**
 * What an item's box says under its title of where it stands: `settled`,
 * the line saying what made a Done item Done, where that's no link, empty
 * otherwise; and `links`, the one saying what made it Done where it's a
 * link, `Superseded by <ref>`, then one per item in `supersedes`, the refs
 * of those it supersedes.
 */
export const boxLines = (
  isDone: boolean,
  settlement: Settlement | undefined,
  supersedes: readonly string[],
): Readonly<{ settled: string; links: readonly ItemLink[] }> => {
  const link = isDone ? settledLink(settlement) : undefined;

  return {
    settled: isDone && link === undefined ? settledText(settlement) : "",
    links: [...(link === undefined ? [] : [link]), ...supersedesLinks(supersedes)],
  };
};

/** The letters the answer that made an item Done picked, sent or read; none when something else did. */
export const sentLetters = (
  settlement: Settlement | undefined,
): readonly string[] =>
  settlement?.how === "answered" || settlement?.how === "sent"
    ? settlement.letters
    : [];

const counted = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

/** The draft's lines, past the line naming the plugin, that hold no answer and aren't its trailing `reassess`: words of the person's own. */
const ownLines = (body: string): readonly string[] => {
  const lines = body.split("\n").filter((line) => line.trim() !== "");

  return lines.filter(
    (line, n) =>
      answersIn(line).length === 0 &&
      !(n === lines.length - 1 && isReassessLine(line)),
  );
};

/**
 * What the pane's footer says Submit will send: how many answers, how many
 * of them carry a note, a trailing `reassess`, and words of the person's
 * own, `Draft: 2 answers · 1 note · reassess`; `Draft: empty` for none.
 */
export const draftSummary = (draft: string): string => {
  const body = withoutDraftHeader(draft);
  const answers = answersIn(body);
  const notes = answers.filter((answer) => answer.note !== "").length;
  const parts = [
    ...(answers.length > 0 ? [counted(answers.length, "answer")] : []),
    ...(notes > 0 ? [counted(notes, "note")] : []),
    ...(hasReassess(body) ? [REASSESS] : []),
    ...(ownLines(body).length > 0 ? ["your words"] : []),
  ];

  return `Draft: ${parts.length > 0 ? parts.join(LAYOUT.divider) : "empty"}`;
};

/** The pane header's count: the open items the draft answers, out of every open item. */
export const answeredText = (answered: number, open: number): string =>
  `${answered} of ${open} answered`;

/** What the line above the prompt adds while the draft answers open items: `✏️ 2 picked`, opened by `noteMark`, the `marks.note` setting; empty while it answers none. */
export const pickedText = (picked: number, noteMark: string): string =>
  picked > 0 ? `${noteMark} ${picked} picked` : "";

/** One row of the pane's keys panel: a key, and what it does. */
export type KeyRow = Readonly<{ key: string; does: string }>;

/**
 * The pane's keys panel, opened by `? Keys`: each key the pane takes while
 * it holds the keyboard and what it does, the pane's own read from the
 * `keys` settings, so a rebound key shows as rebound, each beside its
 * button's glyph from the `marks.buttons` settings, then the keys Claude
 * Code moves the focus ring and the keyboard with.
 */
export const keyRows = (
  keys: Settings["keys"],
  glyphs: Settings["marks"]["buttons"],
): readonly KeyRow[] => [
  {
    key: keys.next,
    does: `${glyphs.next} Next: the next item, or header`,
  },
  { key: keys.previous, does: `${glyphs.previous} Previous: the item before` },
  { key: keys.submit, does: `${glyphs.submit} Submit: send the draft` },
  {
    key: keys.reassess,
    does: `${glyphs.reassess} ${capitalized(REASSESS)}: add or take out the ${REASSESS} line`,
  },
  { key: keys.help, does: `${glyphs.help} Keys: open or close this panel` },
  { key: keys.dismiss, does: `${glyphs.dismiss} Close: close the pane` },
  { key: "↑ ↓ tab", does: "move between options and fields" },
  { key: "enter", does: "pick the option the ring is on" },
  { key: "esc", does: "give the keyboard back to the prompt" },
];

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
