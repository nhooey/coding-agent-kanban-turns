// The reply lint: what a draft final response gets wrong of the layout the
// protocol draws its lists with, the kanban skill's `lint_reply.py` in
// TypeScript. No `$`, no I/O: the `kanban_lint` tool and the `turn.complete`
// hook hand a reply's text here and say what it finds.
//
// The rules are about the text's layout as written, line by line, which a
// Markdown parser's tree no longer holds: where a blank line or a separator
// line stands, how far a line is indented, what an underline is as wide as.
// So the lint reads lines, each matched by the small patterns of Markdown's
// own syntax below, a list item's marker, a table row, a fence, and the
// protocol's characters from the spec.
//
// Why each rule:
//
// - A multi-line item is parted from the next item of its list by a line
//   holding the list's indent and the separator character alone, with no
//   blank line on either side; a list ends at a blank line.
// - A header or a line of prose written directly under a list's last line is
//   read by Markdown as more of that item, a lazy continuation, so a blank
//   line goes before it.
// - An empty line between items renders no gap, and a line of spaces renders
//   one or none by its width; a blank line beside a separator renders a
//   double gap, and a separator between one-line items, or under a header's
//   underline, is a gap that shouldn't be there.
// - A numbered item opens on its bold summary alone, ending in a hard line
//   break, 2 trailing spaces, its sentence on the line beneath; without the
//   break the 2 lines run together.
// - An option's lines are plain lines of its item's paragraph, so a list
//   among them captures every line after it, the later options among them.
// - A header's underline holds one character per column of the header as it
//   renders, `**` not counted and an emoji counting 2.
// - Under topic headers each list numbers on from where the same list ended
//   in the topics before, so a reference still names one item.
// - A table indented under a list item is never drawn, and a table needs a
//   blank line above and below it, or a line beside it joins it.
// - An option is drawn with a kind the instructions teach; a kind the spec
//   only reads, which earlier turns may hold, is no longer written. Its
//   glyph gives it away on any option, and its letters only where they are
//   an item's whole set, so a radio item's 14th option, `N.`, is no
//   finding. The skill's `lint_reply.py` [n] flags every `Y` and `N`.
//
// A list is a run of items, `-`, `*`, `+`, `1.` or `1)`, at one indent: every
// list of the reply, the 📌 roll-up's groups and an item's own steps among
// them. An item is multi-line when any line other than its first belongs to
// it. Lines inside ``` or ~~~ fences are not read.
//
// A header's width is `cellWidth`'s, a grapheme at a time, where the
// skill's `_width` counts each code point. They part on an emoji sequence:
// an emoji with U+FE0F after it, `🖥️`, is 2 cells here and 1 there, and a
// ZWJ sequence or a skin-tone modifier is one grapheme of 2 cells here and
// each wide part's 2 there. Here is what the terminal draws.

import { PIN } from "../items/outstanding.ts";
import { cellWidth } from "../text/cells.ts";
import {
  firstLetters,
  glyphsInWords,
  optionGlyphs,
  taughtKinds,
} from "../protocol/kinds.ts";
import type { Kinds } from "../protocol/kinds.ts";
import { codepoint } from "../protocol/prose.ts";
import { DECIDE, DEFAULT_KIND, LETTER } from "../protocol/rules.ts";
import { SPEC } from "../protocol/spec.ts";
import { NO_DRAFT, draftOf } from "../protocol/tools.ts";
import { escaped } from "../text/patterns.ts";
import { HEADER } from "../transcript/turns.ts";

const ROLL_UP = SPEC["roll-up"];
const KINDS: Kinds = SPEC.options.kinds;
const TAUGHT = taughtKinds(KINDS);
const UNTAUGHT: Kinds = Object.fromEntries(
  Object.entries(KINDS).filter(([name]) => !(name in TAUGHT)),
);
/** The glyphs only an untaught kind's options are drawn with. */
const UNTAUGHT_GLYPHS: readonly string[] = optionGlyphs(UNTAUGHT);
/** Each lettered untaught kind's letters, `Y` and `N`, sorted. */
const UNTAUGHT_LETTERS: readonly string[] = Object.values(UNTAUGHT)
  .map((kind) => Object.keys(kind.letters).toSorted().join(""))
  .filter((letters) => letters !== "");
const PAIR = firstLetters(SPEC.reference.letters.first, 2);
const DEFAULT_GLYPH = KINDS[DEFAULT_KIND]?.glyph ?? "";

/** The rules, in the order a finding on one line sorts by, each with what it tells the agent to do. */
export const RULES = {
  "no-separator": "no separator line before this item, though an item beside it is multi-line",
  "stray-separator":
    "a separator line between one-line items, or right under a header's underline, is a gap that shouldn't be there",
  "whitespace-line": `a line of only whitespace inside a list; a gap between items is the list's indent, then ${codepoint(SPEC.characters.separator)} alone`,
  "separator-indent":
    "the separator line's indent isn't its list's, the column its items' text starts at",
  "blank-beside-separator":
    "a blank line beside a separator line, inside the list, renders a double gap",
  "text-after-summary":
    "text after the bold summary on its line; it goes on the line beneath",
  "no-hard-break":
    "the summary line needs a hard line break, 2 trailing spaces, before the lines under it",
  "list-among-options": `a list among a ${DECIDE.header} item's options captures every line after it; write the note as plain lines`,
  "underline-width": "the underline isn't as wide as the header above it",
  "list-not-ended":
    "directly under a list, Markdown reads this as more of its last item; put a blank line before it",
  "table-in-item":
    "a table inside a list item prints as raw pipe rows; end the list and put the table after it",
  "table-not-parted":
    "a table needs a blank line above it and below it, or the line beside it joins it",
  "list-renumbered":
    "under a topic header a list numbers on from where the same list ended in the topics before",
  "untaught-option": `an option is ${glyphsInWords(TAUGHT)} lettered from ${PAIR[0] ?? ""}; write a yes-or-no question as ${DEFAULT_GLYPH} ${PAIR[0] ?? ""}. and ${DEFAULT_GLYPH} ${PAIR[1] ?? ""}.`,
} as const;

/** A rule the lint checks. */
export type Rule = keyof typeof RULES;

/** The rules, in their order. */
export const RULE_NAMES = Object.keys(RULES) as readonly Rule[];

/** One finding: the reply's line, from 1, the rule it breaks, and, for some rules, what it found there. */
export type Finding = Readonly<{ line: number; rule: Rule; detail?: string }>;

const { characters: CHARS } = SPEC;
const SEPARATOR = CHARS.separator;
const HEADER_RULE = CHARS["header-underline"];
const TOPIC_RULE = CHARS["topic-underline"];
const UNDERLINES: readonly string[] = [
  HEADER_RULE,
  CHARS["roll-up-underline"],
  TOPIC_RULE,
];

// Markdown's own syntax: a list item's marker and the spaces after it, a
// table row, a code fence and a bold summary; and the protocol's lines, a
// separator alone at its indent, an option, of any kind the spec reads, and
// a list's bold name.
const SEP_LINE = new RegExp(`^( *)${escaped(SEPARATOR)} *$`, "u");
const SPACES = /^[ \t ]+$/;
const ITEM = /^( *)([-*+]|\d{1,9}[.)])( +)(?=\S)/;
const SUMMARY = /^\*\*.+?\*\*/;
const LIST_NAME = /\*\*([^*]+?):\*\*/;
const FENCE = /^ *(```|~~~)/;
const ROW = /^ *\|/;
const OPTION = new RegExp(
  `^( *)(${optionGlyphs(KINDS).map(escaped).join("|")}) (${LETTER})\\. `,
  "u",
);

/** Whether a line is an underline: one of the protocol's underline characters, repeated alone. */
const isUnderline = (line: string): boolean => {
  const chars = [...line.trim()];

  return chars.length > 0 && chars.every((char) => UNDERLINES.includes(char));
};

/** One item of a list, as far as the lint has read it. */
type Item = Readonly<{
  line: number;
  indent: number;
  /** Where its text starts, the column a separator under it sits at. */
  column: number;
  /** How many lines belong to it, its first among them. */
  lines: number;
  /** The item before it in its list, by its place among the items. */
  prev: number | undefined;
  /** The separator line between it and the item before, if there is one. */
  sepBefore: number | undefined;
  /** The separator line under it, while nothing else has followed it. */
  sepAfter: number | undefined;
  /** Whether it's a numbered item's summary alone on its line, with no hard line break. */
  isUnbroken: boolean;
}>;

/** One option line of a Decide item: where it is, and the glyph and letter it opens on. */
export type Mark = Readonly<{ line: number; glyph: string; letter: string }>;

type Previous = "text" | "blank" | "sep";
type Above = "blank" | "row" | "text";

/** What the lint knows after a line. */
type State = Readonly<{
  findings: readonly Finding[];
  items: readonly Item[];
  /** The items open around the line, outermost first, by their place among the items. */
  stack: readonly number[];
  /** The fence the line is inside, if it's in one. */
  fence: string | undefined;
  isAfterUnderline: boolean;
  previous: Previous;
  /** The line before, where it held text. */
  lastText: string;
  /** The indent of the open Decide item's option lines. */
  options: number | undefined;
  /** The open item's options so far: each one's line, glyph and letter. */
  marks: readonly Mark[];
  /** A blank line under a separator, fine only where the list ends. */
  blankUnderSep: number | undefined;
  /** The line before, for tables. */
  above: Above;
  topics: number;
  /** The list under way, once a topic header has been seen. */
  listName: string | undefined;
  /** Whether the list under way has yet to reach its first numbered item. */
  isFirstItem: boolean;
  /** Each list's last number, across the topics before. */
  lastNumber: Readonly<Record<string, number>>;
}>;

const START: State = {
  findings: [],
  items: [],
  stack: [],
  fence: undefined,
  isAfterUnderline: false,
  previous: "text",
  lastText: "",
  options: undefined,
  marks: [],
  blankUnderSep: undefined,
  above: "blank",
  topics: 0,
  listName: undefined,
  isFirstItem: false,
  lastNumber: {},
};

/** How far a line is indented: its leading spaces, as Markdown counts them, a tab or U+00A0 not among them. */
export const indentOf = (text: string): number =>
  text.length - text.replace(/^ +/, "").length;

const found = (
  state: State,
  line: number,
  rule: Rule,
  detail?: string,
): State => ({
  ...state,
  findings: [
    ...state.findings,
    detail === undefined ? { line, rule } : { line, rule, detail },
  ],
});

const top = (state: State): Item | undefined =>
  state.items[state.stack.at(-1) ?? -1];

/** The stack with every item `isClosed` says the line closes popped off its end. */
const popped = (state: State, isClosed: (item: Item) => boolean): State => {
  const kept = state.stack.findLastIndex((n) => {
    const item = state.items[n];

    return item !== undefined && !isClosed(item);
  });

  return { ...state, stack: state.stack.slice(0, kept + 1) };
};

/** Every open item grown by the line, which follows any separator under it. */
const grown = (state: State): State => ({
  ...state,
  items: state.items.map((item, n) =>
    state.stack.includes(n)
      ? { ...item, lines: item.lines + 1, sepAfter: undefined }
      : item,
  ),
});

/** The width a header takes as it renders: `**` not counted, trailing spaces dropped. */
const headerWidth = (header: string): number =>
  cellWidth(header.trimEnd().replaceAll("**", ""));

/** A table's findings, for the line, and what the line is for the next one. */
const tableStep = (state: State, number: number, line: string): State => {
  const isRow = ROW.test(line);
  const checked =
    (isRow && state.above === "text") ||
    (!isRow && state.above === "row" && line.trim() !== "")
      ? found(state, number, "table-not-parted")
      : state;

  return {
    ...checked,
    above: isRow ? "row" : line.trim() !== "" ? "text" : "blank",
  };
};

/** A blank line, or one of whitespace alone. */
const blankStep = (state: State, number: number, line: string): State => {
  const checked =
    line !== "" && state.stack.length > 0
      ? found(state, number, "whitespace-line")
      : state;

  return {
    ...checked,
    lastText: "",
    blankUnderSep: state.previous === "sep" ? number : state.blankUnderSep,
    previous: "blank",
  };
};

/** A separator line, its indent `indent`. */
const separatorStep = (state: State, number: number, indent: number): State => {
  const marked: State = {
    ...(state.previous === "blank"
      ? found(state, number, "blank-beside-separator")
      : state),
    previous: "sep",
    lastText: "",
    options:
      state.options !== undefined && indent <= state.options
        ? undefined
        : state.options,
  };

  if (marked.isAfterUnderline) {
    return found(marked, number, "stray-separator");
  }
  const closed = popped(marked, (item) => item.indent >= indent);
  const owner = top(closed);
  const at = closed.stack.at(-1) ?? -1;

  return owner === undefined
    ? found(
        closed,
        number,
        "separator-indent",
        `it is at column ${indent}, outside any list item`,
      )
    : {
        ...(owner.column === indent
          ? closed
          : found(
              closed,
              number,
              "separator-indent",
              `it is at column ${indent}; its list's items, from line ${owner.line}, start at column ${owner.column}`,
            )),
        items: closed.items.map((item, n) =>
          n === at ? { ...item, sepAfter: number } : item,
        ),
      };
};

/** An underline, under `header`. */
const underlineStep = (
  state: State,
  number: number,
  line: string,
  header: string,
): State => {
  const width = [...line.trim()].length;
  const rule = [...line.trim()][0] ?? "";
  const topics = state.topics + (rule === TOPIC_RULE ? 1 : 0);
  const named =
    rule === HEADER_RULE && topics > 0 ? LIST_NAME.exec(header)?.[1] : undefined;
  const want = headerWidth(header);
  const checked =
    header !== "" && width !== want
      ? found(
          state,
          number,
          "underline-width",
          `it is ${width} columns wide; the header is ${want}`,
        )
      : state;

  return {
    ...checked,
    stack: [],
    options: undefined,
    isAfterUnderline: true,
    topics,
    listName: named,
    isFirstItem: named !== undefined,
  };
};

/** A numbered item's number under a topic header: it numbers on from where its list ended in the topics before. */
const numberingStep = (
  state: State,
  number: number,
  marker: string,
  indent: number,
): State => {
  const name = state.listName;
  const isOuter = state.stack.every((n) => (state.items[n]?.indent ?? 0) >= indent);

  if (name === undefined || !/^\d/.test(marker) || !isOuter) {
    return state;
  }
  const count = Number(marker.slice(0, -1));
  const last = state.lastNumber[name];
  const checked =
    state.isFirstItem && last !== undefined && count !== last + 1
      ? found(
          state,
          number,
          "list-renumbered",
          `this ${name} list starts at ${last + 1}, not ${count}`,
        )
      : state;

  return {
    ...checked,
    isFirstItem: false,
    lastNumber: { ...checked.lastNumber, [name]: count },
  };
};

/** A list item's line, its marker matched as `item`. */
const itemStep = (
  state: State,
  number: number,
  line: string,
  item: RegExpExecArray,
): State => {
  const [whole, lead = "", marker = "", gap = ""] = item;
  const indent = lead.length;
  const inOptions =
    state.options === undefined
      ? state
      : indent >= state.options
        ? found(state, number, "list-among-options")
        : { ...state, options: undefined };
  const closed = numberingStep(
    popped(inOptions, (open) => open.indent > indent),
    number,
    marker,
    indent,
  );
  const rest = line.slice(whole.length);
  const summary = /^\d/.test(marker) ? SUMMARY.exec(rest) : null;
  const after = summary === null ? "" : rest.slice(summary[0].length);
  const summed =
    summary !== null && after.trim() !== ""
      ? found(closed, number, "text-after-summary")
      : closed;
  const prevAt = summed.stack.at(-1);
  const prev = top(summed);
  const isSibling = prev !== undefined && prev.indent === indent;
  const siblingless: State = isSibling
    ? { ...summed, stack: summed.stack.slice(0, -1) }
    : summed;
  const grew = grown(siblingless);
  const added: Item = {
    line: number,
    indent,
    column: indent + marker.length + gap.length,
    lines: 1,
    prev: isSibling ? prevAt : undefined,
    sepBefore: isSibling ? prev.sepAfter : undefined,
    sepAfter: undefined,
    isUnbroken: summary !== null && after.trim() === "" && !line.endsWith("  "),
  };

  return {
    ...grew,
    items: [...grew.items, added],
    stack: [...grew.stack, grew.items.length],
  };
};

/** A line of text that's no list item: prose, an option, or a fence's opening. */
const textStep = (state: State, line: string): State => {
  const indent = indentOf(line);
  const options =
    state.options !== undefined && indent < state.options
      ? undefined
      : state.options;
  const grew = grown(popped({ ...state, options }, (item) => indent <= item.indent));

  return { ...grew, fence: FENCE.exec(line)?.[1] ?? grew.fence };
};

/** An option's line, matched as `option`: where its options sit, and its glyph and letter among the item's. */
const optionStep = (
  state: State,
  number: number,
  option: RegExpExecArray,
): State => {
  const [, lead = "", glyph = "", letter = ""] = option;

  return {
    ...state,
    options: lead.length,
    marks: [...state.marks, { line: number, glyph, letter }],
  };
};

/**
 * The options of a kind the instructions no longer teach among `marks`, one
 * item's: each drawn with an untaught kind's glyph, `👍` or `👎`, and each
 * of an item whose letters are exactly an untaught kind's, `Y` and `N`. A
 * `Y` or an `N` among other letters, as the 14th option of a radio item, is
 * a taught kind's letter.
 */
export const untaughtMarks = (marks: readonly Mark[]): readonly number[] => {
  const letters = [...new Set(marks.map((mark) => mark.letter))].toSorted().join("");
  const isUntaughtSet = UNTAUGHT_LETTERS.includes(letters);

  return marks
    .filter((mark) => isUntaughtSet || UNTAUGHT_GLYPHS.includes(mark.glyph))
    .map((mark) => mark.line);
};

/** The state with the open item's options checked and let go. */
const flushed = (state: State): State => ({
  ...untaughtMarks(state.marks).reduce(
    (sofar, line) => found(sofar, line, "untaught-option"),
    state,
  ),
  marks: [],
});

/** One line of the reply, `number` from 1, its item's options not yet checked. */
const lineStep = (before: State, raw: string, at: number): State => {
  const number = at + 1;
  const line = raw.replace(/\r$/, "");

  if (before.fence !== undefined) {
    return {
      ...before,
      fence: line.replace(/^ +/, "").startsWith(before.fence)
        ? undefined
        : before.fence,
      above: "text",
    };
  }
  const state = tableStep(before, number, line);

  if (line === "" || SPACES.test(line)) {
    return blankStep(state, number, line);
  }
  const sep = SEP_LINE.exec(line);
  const first = state.items[state.stack[0] ?? -1];
  const endsList =
    first !== undefined && !ITEM.test(line) && indentOf(line) < first.column;
  const afterBlank =
    state.blankUnderSep !== undefined && !(endsList && sep === null)
      ? found(state, state.blankUnderSep, "blank-beside-separator")
      : state;
  const cleared: State = { ...afterBlank, blankUnderSep: undefined };
  const isRow = ROW.test(line);
  const inItem =
    isRow &&
    cleared.stack.length > 0 &&
    !endsList &&
    !(cleared.previous === "text" && ROW.test(cleared.lastText))
      ? found(cleared, number, "table-in-item")
      : cleared;
  const ended =
    endsList && sep === null && inItem.previous !== "blank"
      ? found(inItem, number, "list-not-ended")
      : inItem;

  if (sep !== null) {
    return separatorStep(ended, number, (sep[1] ?? "").length);
  }
  const header = ended.lastText;
  const texted: State = {
    ...ended,
    previous: "text",
    isAfterUnderline: false,
    lastText: line,
  };

  if (isUnderline(line)) {
    return underlineStep(texted, number, line, header);
  }
  const option = OPTION.exec(line);
  const optioned = option === null ? texted : optionStep(texted, number, option);
  const item = ITEM.exec(line);

  return item === null
    ? textStep(optioned, line)
    : itemStep(optioned, number, line, item);
};

/** One line of the reply, `number` from 1; an item's options end where its option lines do, and are checked there. */
const step = (before: State, raw: string, at: number): State => {
  const after = lineStep(before, raw, at);

  return before.options !== undefined && after.options === undefined
    ? flushed(after)
    : after;
};

/** What the items say once every line is read: a summary line with no hard break, and the separators between items. */
const itemFindings = (items: readonly Item[]): readonly Finding[] =>
  items.flatMap((item): readonly Finding[] => {
    const prev = item.prev === undefined ? undefined : items[item.prev];
    const isMulti =
      prev !== undefined && (prev.lines > 1 || item.lines > 1);

    return [
      ...(item.isUnbroken && item.lines > 1
        ? [{ line: item.line, rule: "no-hard-break" as const }]
        : []),
      ...(prev === undefined
        ? []
        : isMulti && item.sepBefore === undefined
          ? [
              {
                line: item.line,
                rule: "no-separator" as const,
                detail:
                  prev.lines > 1
                    ? `the item at line ${prev.line} is multi-line`
                    : "this item is multi-line",
              },
            ]
          : !isMulti && item.sepBefore !== undefined
            ? [{ line: item.sepBefore, rule: "stray-separator" as const }]
            : []),
    ];
  });

const byLine = (a: Finding, b: Finding): number =>
  a.line - b.line || RULE_NAMES.indexOf(a.rule) - RULE_NAMES.indexOf(b.rule);

/** A reply's lines, the empty one after its final line break left out. */
const linesOf = (text: string): readonly string[] => {
  const lines = text.split("\n");

  return lines.at(-1) === "" ? lines.slice(0, -1) : lines;
};

/** What the lint finds in a reply, in line order: empty for a reply that keeps every rule. */
export const lintReply = (text: string): readonly Finding[] => {
  const end = flushed(linesOf(text).reduce(step, START));

  return [...end.findings, ...itemFindings(end.items)].toSorted(byLine);
};

/** A finding as the agent reads it: `5: [no-separator] what to do`, then what it found there, where the rule says. */
export const findingLine = (finding: Finding): string =>
  `${finding.line}: [${finding.rule}] ${RULES[finding.rule]}${finding.detail === undefined ? "" : `; ${finding.detail}`}`;

/** How many findings there are, in words: `1 finding`, `3 findings`. */
const countOf = (findings: readonly Finding[]): string =>
  `${findings.length} finding${findings.length === 1 ? "" : "s"}`;

/** The `kanban_lint` tool's result for a draft: each finding, one line each, or that there are none. */
export const draftLintText = (findings: readonly Finding[]): string =>
  findings.length === 0
    ? "The lint finds nothing: the draft keeps every rule it checks."
    : [
        `The lint finds ${countOf(findings)}; fix each before sending the response:`,
        ...findings.map(findingLine),
      ].join("\n");

/** The `kanban_lint` tool's result for its input: the draft's findings, or that no draft was given. */
export const lintToolText = (input: unknown): string => {
  const draft = draftOf(input);

  return draft === undefined ? NO_DRAFT : draftLintText(lintReply(draft));
};

/** What the turn's end says of a final response's findings, to the user beneath it and to the agent with the next prompt; empty for none. */
export const replyLintText = (findings: readonly Finding[]): string =>
  findings.length === 0
    ? ""
    : [
        `The reply lint finds ${countOf(findings)} in the last final response; keep these rules in the next one:`,
        ...findings.map(findingLine),
      ].join("\n");

/** What the CLI's lint says of the last final response where it finds nothing, as the turn's end says nothing. */
export const CLEAN_REPLY_TEXT =
  "The reply lint finds nothing in the last final response: it keeps every rule the lint checks.";

/** What the CLI's lint says of the last final response where it's in no list's shape, which the turn's end doesn't lint. */
export const UNSHAPED_REPLY_TEXT =
  "The last final response holds no list's header, roll-up or count line, so the reply lint passes over it, as the turn's end does.";

/** Whether a reply is drawn in the protocol's shape, so the turn's end lints it: a line opens a list's header or the 📌 roll-up, or is the count line. */
export const isKanbanReply = (text: string): boolean =>
  text
    .split("\n")
    .some(
      (line) =>
        HEADER.test(line) ||
        PIN.test(line) ||
        line.trimStart().startsWith(`${ROLL_UP.glyph} ${ROLL_UP["count-label"]}:`),
    );
