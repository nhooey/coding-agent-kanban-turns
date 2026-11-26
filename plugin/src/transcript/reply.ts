// A reply's text read once, into the blocks the protocol draws it with: a
// list's header, an item with the lines under it, the 📌 roll-up's start, an
// older roll-up header that ends a section, a topic header and its rule, an
// underline, a separator, a code block, a blank line and a line of prose.
// No `$`, no I/O. The readers of a reply, its sections, the items of its
// lists, its Decide items, its Decide list cut out and its questions as
// links, read these blocks rather than its lines again; the reply lint reads
// the layout line by line, which the blocks don't keep, so it reads on its
// own.
//
// The grammar, line by line, a line's trailing `\r` aside:
//
// - A code block opens on a fence, its indent aside: 3 or more backticks,
//   with no backtick in the rest of the line, or 3 or more tildes; an
//   item's text may open on one. It closes on a line of the same character
//   alone, at least as long. Every line of it is code, and nothing else. A
//   fence less indented than an item's text ends the item.
// - A list's header is any glyph, then a list's name or alias in bold with
//   a colon, `🧠 **Decide:**`.
// - The 📌 roll-up starts on its header or an older one, with its glyph, in
//   bold with a colon.
// - An older roll-up header bare, alone on its line at its start, a colon
//   after it or not, ends a list's section and nothing more.
// - A topic header is a line of `═` alone, and the line above it, its title,
//   unless that line is blank, a header, the roll-up's start or a rule.
// - An item is a bullet, `-` or `*`, or a number with `.` or `)`, at most 2
//   spaces in; the lines under it are its own until a blank line outside
//   its code, a separator, a header, the roll-up, a topic header, the next
//   item or a fence less indented than its text. A line 3 spaces in or more
//   is under the item, an option or an item's own step among them.
// - An option is one of the spec's option glyphs, a letter with a dot, and
//   its name in bold: `🔘 A. **Disk**`.
//
// Every glyph, name and rule character comes from the spec.

import { optionGlyphs } from "../protocol/kinds.ts";
import { LETTER, SECTION_NAMES, isLineOf, namesOf } from "../protocol/rules.ts";
import { SPEC } from "../protocol/spec.ts";
import { escaped } from "../text/patterns.ts";

/** A list's header line: any glyph, then its name in bold with a colon. */
const HEADER = new RegExp(
  String.raw`^\s*\S+\s+\*\*(${SECTION_NAMES.map(escaped).join("|")}):\*\*`,
);

const ROLL_UP = SPEC["roll-up"];

/** The 📌 roll-up's header, or an older one, with its glyph, in bold with a colon. */
const PIN = new RegExp(
  String.raw`^\s*${escaped(ROLL_UP.glyph)}\s+\*\*(${namesOf(ROLL_UP).map(escaped).join("|")}):\*\*`,
  "u",
);

/** Whether a line is an older roll-up header bare, alone on its line at its start, a colon after it or not. */
const isOlderRollUp = (line: string): boolean => {
  const end = line.trimEnd();

  return ROLL_UP.aliases.some((older) => end === older || end === `${older}:`);
};

/** The count line's opening, `📌 Outstanding:`. */
const COUNT_LINE = `${ROLL_UP.glyph} ${ROLL_UP["count-label"]}:`;

const CHARS = SPEC.characters;

/** The characters a line of which alone underlines a header: a list's and the full roll-up's. */
const UNDERLINES: readonly string[] = [
  CHARS["header-underline"],
  CHARS["roll-up-underline"],
];

/** A topic header's underline: a line of `═` alone. */
export const isTopicRule = (line: string): boolean =>
  isLineOf(CHARS["topic-underline"], line);

/** A code block's fence: its character, a backtick or a tilde, and how many of it open the block. */
type Fence = Readonly<{ char: string; length: number }>;

/** The characters a fence is made of. */
const FENCE_CHARS: readonly string[] = ["`", "~"];

/** How many of `char` the text opens with. */
const runOf = (char: string, text: string): number => {
  const end = [...text].findIndex((each) => each !== char);

  return end < 0 ? text.length : end;
};

/** The fence a line, its indent aside, opens a code block with: 3 or more of its character, no backtick after a backtick fence; undefined where it opens none. */
const fenceOpening = (line: string): Fence | undefined => {
  const body = line.trimStart();
  const char = FENCE_CHARS.find((each) => body.startsWith(each));
  const length = char === undefined ? 0 : runOf(char, body);

  return char !== undefined &&
    length >= 3 &&
    !(char === "`" && body.slice(length).includes("`"))
    ? { char, length }
    : undefined;
};

/** Whether a code block's line is one of its fences, the one that opens it or the one that closes it, which is a fence's character alone: not a line of the code inside it. */
export const isFenceLine = (line: string): boolean => fenceOpening(line) !== undefined;

/** Whether a line closes the code block `fence` opened: its character alone, at least as many, whitespace around it. */
const isFenceClosing = (fence: Fence, line: string): boolean => {
  const body = line.trim();

  return body.length >= fence.length && runOf(fence.char, body) === body.length;
};

/** An item's own line, at most 2 spaces in: what comes before its text, its number, if any, with its `.` or `)`, and its text. */
const ITEM = /^( {0,2}(?:[-*]|(\d+)([.)]))\s+)(.*)$/;

/** A number alone on its line, at most 2 spaces in, its `.` or `)` after it. */
const BARE = /^ {0,2}(\d+)[.)]\s*$/;

/** The bold text a text opens on, and what follows it. */
const BOLD = /^\*\*(.+?)\*\*/;

// An option, `🔘 A. **Disk**`: any glyph the spec's kinds draw one with, a
// kind not taught's among them so an older reply's options still read, its
// letter and its bold name.
const OPTION = new RegExp(
  String.raw`^\s*(${optionGlyphs(SPEC.options.kinds).map(escaped).join("|")})\s+(${LETTER})\.\s+\*\*(.+?)\*\*`,
  "u",
);

/**
 * An item's own line: what comes before its text, the indent, marker and
 * spaces; its number and the `.` or `)` after it, none for a bullet; its
 * text, a trailing `\r` dropped; the bold summary its text opens on, if
 * any; and whether that summary is alone on the line, its sentence beneath.
 */
export type ItemHead = Readonly<{
  lead: string;
  number: number | undefined;
  delimiter: string | undefined;
  text: string;
  summary: string | undefined;
  isAlone: boolean;
}>;

/** An option as a line writes it: its glyph, its letter and its name. */
export type Option = Readonly<{ glyph: string; letter: string; name: string }>;

/**
 * What a line of prose is read as besides: the option it writes, the
 * number it holds alone, `1.`, and the bold text it opens on, its indent
 * aside; each undefined where it has none.
 */
export type LineFacts = Readonly<{
  option: Option | undefined;
  bare: number | undefined;
  bold: string | undefined;
}>;

/** A line under an item, as written: whether it's code, whether it's an older roll-up header, and, outside code, what else it's read as. */
export type BodyLine = Readonly<
  { line: string; isCode: boolean; isStop: boolean } & LineFacts
>;

type Of<K extends string, Fields = unknown> = Readonly<
  { kind: K; at: number; lines: readonly string[] } & Fields
>;

/**
 * One block of a reply: its kind, the place of its first line among the
 * reply's lines, and its lines as written. An item adds its own line read
 * and the lines under it; a header, its list's name as written; an
 * underline, its character; a topic, whether a title opens it; a line of
 * prose, what else it's read as.
 */
export type Block =
  | Of<"header", Readonly<{ name: string }>>
  | Of<"roll-up">
  | Of<"stop">
  | Of<"topic", Readonly<{ isTitled: boolean }>>
  | Of<"underline", Readonly<{ char: string }>>
  | Of<"separator">
  | Of<"blank">
  | Of<"code">
  | Of<"text", LineFacts>
  | Of<"item", Readonly<{ head: ItemHead; body: readonly BodyLine[] }>>;

/** The kinds of block, every one a reply may hold. */
export type BlockKind = Block["kind"];

/** One line read on its own: its kind, and what its kind reads of it. A code line says whether it opens its block. */
type Lexeme =
  | Readonly<{ kind: "header"; line: string; name: string }>
  | Readonly<{ kind: "item"; line: string; head: ItemHead }>
  | Readonly<{ kind: "underline"; line: string; char: string }>
  | Readonly<{ kind: "text"; line: string; facts: LineFacts }>
  | Readonly<{ kind: "code"; line: string; opens: boolean }>
  | Readonly<{
      kind: "roll-up" | "stop" | "rule" | "title" | "separator" | "blank";
      line: string;
    }>;

/** The line without the `\r` a CRLF reply ends it on. */
const withoutCr = (line: string): string =>
  line.endsWith("\r") ? line.slice(0, -1) : line;

/** An item's own line read, where the line is one. */
const headOf = (line: string): ItemHead | undefined => {
  const found = ITEM.exec(line);
  const text = found?.[4] ?? "";
  const bold = BOLD.exec(text);

  return found === null
    ? undefined
    : {
        lead: found[1] ?? "",
        number: found[2] === undefined ? undefined : Number(found[2]),
        delimiter: found[3],
        text,
        summary: bold?.[1],
        isAlone: bold !== null && text.slice(bold[0].length).trim() === "",
      };
};

/** What a line of prose is read as besides. */
const factsOf = (line: string): LineFacts => {
  const option = OPTION.exec(line);
  const bare = BARE.exec(line)?.[1];

  return {
    option:
      option === null
        ? undefined
        : { glyph: option[1] ?? "", letter: option[2] ?? "", name: option[3] ?? "" },
    bare: bare === undefined ? undefined : Number(bare),
    bold: BOLD.exec(line.trimStart())?.[1],
  };
};

/** No facts, as a line of code or other than prose has. */
const NO_FACTS: LineFacts = { option: undefined, bare: undefined, bold: undefined };

/** One line outside a code block read on its own. */
const lexeme = (raw: string): Lexeme => {
  const line = withoutCr(raw);
  const name = HEADER.exec(line)?.[1];
  const head = headOf(line);
  const char = UNDERLINES.find((under) => isLineOf(under, line));

  return name !== undefined
    ? { kind: "header", line: raw, name }
    : PIN.test(line)
      ? { kind: "roll-up", line: raw }
      : isOlderRollUp(line)
        ? { kind: "stop", line: raw }
        : isTopicRule(line)
          ? { kind: "rule", line: raw }
          : char !== undefined
            ? { kind: "underline", line: raw, char }
            : line.trim() === ""
              ? { kind: "blank", line: raw }
              : line.trim() === CHARS.separator
                ? { kind: "separator", line: raw }
                : head !== undefined
                  ? { kind: "item", line: raw, head }
                  : fenceOpening(line) !== undefined
                    ? { kind: "code", line: raw, opens: true }
                    : { kind: "text", line: raw, facts: factsOf(line) };
};

type Lexing = Readonly<{ fence: Fence | undefined; done: readonly Lexeme[] }>;

/** The fence a line read on its own opens: a fence's, or that its item's text opens on. */
const fenceOfLexeme = (lex: Lexeme): Fence | undefined =>
  lex.kind === "code"
    ? fenceOpening(withoutCr(lex.line))
    : lex.kind === "item"
      ? fenceOpening(lex.head.text)
      : undefined;

/** The lexing once one more line is read: code while a fence is open, its closing line among it. */
const lexed = ({ fence, done }: Lexing, raw: string): Lexing => {
  const read = fence === undefined ? lexeme(raw) : undefined;

  return read === undefined
    ? {
        fence:
          fence !== undefined && isFenceClosing(fence, withoutCr(raw))
            ? undefined
            : fence,
        done: [...done, { kind: "code", line: raw, opens: false }],
      }
    : { fence: fenceOfLexeme(read), done: [...done, read] };
};

/** The kinds a topic's title may be read as before the rule under it shows it's one. */
const TITLES: readonly Lexeme["kind"][] = [
  "text",
  "item",
  "separator",
  "underline",
  "stop",
];

/** Each line's lexeme, a line above a topic rule made its title. */
const lexemesOf = (lines: readonly string[]): readonly Lexeme[] => {
  const read = lines.reduce<Lexing>(lexed, { fence: undefined, done: [] }).done;

  return read.map((lex, n) =>
    read[n + 1]?.kind === "rule" && TITLES.includes(lex.kind)
      ? { kind: "title", line: lex.line }
      : lex,
  );
};

/** How many characters of whitespace a line opens with. */
const indentOf = (line: string): number => line.length - line.trimStart().length;

/** Whether a line is the item's own: prose, an underline, an older roll-up header, or code, unless it's a fence less indented than the item's text. */
const isUnder = (head: ItemHead, lex: Lexeme): boolean =>
  lex.kind === "text" ||
  lex.kind === "underline" ||
  lex.kind === "stop" ||
  (lex.kind === "code" && !(lex.opens && indentOf(lex.line) < head.lead.length));

/** A line under an item, read. */
const bodyLineOf = (lex: Lexeme): BodyLine => ({
  line: lex.line,
  isCode: lex.kind === "code",
  isStop: lex.kind === "stop",
  ...(lex.kind === "text" ? lex.facts : NO_FACTS),
});

/** The block a line opens, at place `at`. */
const blockOf = (lex: Lexeme, at: number): Block => {
  const lines = [lex.line];

  switch (lex.kind) {
    case "header":
      return { kind: "header", at, lines, name: lex.name };
    case "item":
      return { kind: "item", at, lines, head: lex.head, body: [] };
    case "underline":
      return { kind: "underline", at, lines, char: lex.char };
    case "text":
      return { kind: "text", at, lines, ...lex.facts };
    case "code":
      return { kind: "code", at, lines };
    case "title":
      return { kind: "topic", at, lines, isTitled: true };
    case "rule":
      return { kind: "topic", at, lines, isTitled: false };
    default:
      return { kind: lex.kind, at, lines };
  }
};

/** The last block with one more line of its own: under an item, or the rule under a title, or the next line of a code block. */
const extended = (last: Block, lex: Lexeme): Block | undefined =>
  last.kind === "item" && isUnder(last.head, lex)
    ? {
        ...last,
        lines: [...last.lines, lex.line],
        body: [...last.body, bodyLineOf(lex)],
      }
    : (last.kind === "topic" &&
          last.isTitled &&
          last.lines.length === 1 &&
          lex.kind === "rule") ||
        (last.kind === "code" && lex.kind === "code")
      ? { ...last, lines: [...last.lines, lex.line] }
      : undefined;

/** The blocks once one more line is read: the last one's own line, or a block it opens. */
const grouped = (
  blocks: readonly Block[],
  lex: Lexeme,
  at: number,
): readonly Block[] => {
  const last = blocks.at(-1);
  const grown = last === undefined ? undefined : extended(last, lex);

  return grown === undefined
    ? [...blocks, blockOf(lex, at)]
    : [...blocks.slice(0, -1), grown];
};

/** A reply's text as its blocks, in order; their lines, joined, are the text's. */
export const parseReply = (text: string): readonly Block[] =>
  lexemesOf(text.split("\n")).reduce(grouped, []);

/** Each line of the blocks that is no code, in order. */
export const proseLines = (blocks: readonly Block[]): readonly string[] =>
  blocks.flatMap((block) =>
    block.kind === "code"
      ? []
      : block.kind === "item"
        ? [
            ...block.lines.slice(0, 1),
            ...block.body.filter((under) => !under.isCode).map((under) => under.line),
          ]
        : block.lines,
  );

/** Whether a line opens the count line, `📌 Outstanding: …`. */
export const isCountLine = (line: string): boolean =>
  line.trimStart().startsWith(COUNT_LINE);

/** A list's section of the blocks: its name as its header writes it, and its blocks, the header first. */
export type SectionBlocks = Readonly<{ name: string; blocks: readonly Block[] }>;

type Sectioning = Readonly<{ isOpen: boolean; done: readonly SectionBlocks[] }>;

/** Where an older roll-up header stands among an item's lines under it; -1 where none does. */
const stopAt = (block: Block): number =>
  block.kind === "item" ? block.body.findIndex((under) => under.isStop) : -1;

/** An item cut before the line under it at `at`. */
const cutAt = (block: Block, at: number): Block =>
  block.kind === "item"
    ? { ...block, lines: block.lines.slice(0, 1 + at), body: block.body.slice(0, at) }
    : block;

/** The sections with `block` the last one's last. */
const appended = (
  done: readonly SectionBlocks[],
  block: Block,
): readonly SectionBlocks[] =>
  done.map((section, n) =>
    n === done.length - 1
      ? { ...section, blocks: [...section.blocks, block] }
      : section,
  );

const sectioned = ({ isOpen, done }: Sectioning, block: Block): Sectioning => {
  const stop = stopAt(block);

  return block.kind === "header"
    ? { isOpen: true, done: [...done, { name: block.name, blocks: [block] }] }
    : block.kind === "roll-up" || block.kind === "stop" || block.kind === "topic"
      ? { isOpen: false, done }
      : !isOpen
        ? { isOpen, done }
        : stop >= 0
          ? { isOpen: false, done: appended(done, cutAt(block, stop)) }
          : { isOpen, done: appended(done, block) };
};

/**
 * Each list's section of the blocks, in order: a header and the blocks
 * after it, up to the next header, the 📌 roll-up's start, an older roll-up
 * header bare, even among an item's lines, or a topic header.
 */
export const sectionsIn = (blocks: readonly Block[]): readonly SectionBlocks[] =>
  blocks.reduce(sectioned, { isOpen: false, done: [] }).done;
