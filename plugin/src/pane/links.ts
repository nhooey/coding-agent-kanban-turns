// A reply's Decide questions as links: each raised item's summary line made
// a link that names the item, the item a pressed link names, and the items a
// reply links, drawn under it; the Todo items a reply prints; or the reply's
// Decide and Todo lists cut out, for the items' boxes to stand in their
// place, and the reply's text in parts round them. Each reads the reply's
// blocks, as parseReply gives them. And the ref a link to an item names, a
// question's or one between a superseded item and the item that replaced it.

import { isDecide, refOf } from "../items/items.ts";
import { todoItemsOfText } from "../items/listed.ts";
import { DECIDE, TODO, isLineOf, namesOf } from "../protocol/rules.ts";
import type { ListName } from "../protocol/rules.ts";
import { SPEC } from "../protocol/spec.ts";
import { parseReply } from "../transcript/reply.ts";
import type { Block, ItemHead, Option } from "../transcript/reply.ts";
import type { DecideItem, ListedItem, TodoItem } from "../../types/index.d.ts";

/** Where a question's link points: a name that never resolves, so a click the plugin misses opens nothing real. */
export const QUESTION_LINK = "https://kanban-turns.invalid/";

const plainSummary = (summary: string): string =>
  summary.replaceAll("**", "").replaceAll("`", "").trim();

/** A numbered item's bold summary, where it's alone on its line; undefined for a bullet or a line holding more. */
const summaryAlone = (head: ItemHead): string | undefined =>
  head.number !== undefined && head.isAlone ? head.summary : undefined;

/** A numbered item's summary alone on its line, where the block is such an item. */
const summaryOfBlock = (block: Block): string | undefined =>
  block.kind === "item" ? summaryAlone(block.head) : undefined;

/** An item's own line, `line`, with its summary made a link, `**[<summary>](<href>)**`, all else as written. */
const linkedLine = (line: string, head: ItemHead, href: string): string => {
  const summary = summaryAlone(head);

  return summary === undefined
    ? line
    : `${head.lead}**[${summary}](${href})**${line.slice(head.lead.length + summary.length + 4)}`;
};

/**
 * A reply's text with each given item's summary line, `1. **<summary>**`,
 * made a link to the item, `1. **[<summary>](…/<ref>)**`; the hrefs it made.
 * A summary line is a numbered item's own line, its bold summary alone on it.
 */
export const linkedQuestions = (
  text: string,
  items: readonly DecideItem[],
): Readonly<{ text: string; hrefs: readonly string[] }> => {
  const bySummary = new Map(
    items.map((item) => [plainSummary(item.summary), item]),
  );
  const hrefOf = (block: Block): string | undefined => {
    const summary = summaryOfBlock(block);
    const item =
      summary === undefined ? undefined : bySummary.get(plainSummary(summary));

    return item === undefined ? undefined : `${QUESTION_LINK}${refOf(item)}`;
  };
  const linked = parseReply(text).map((block) => ({
    block,
    href: hrefOf(block),
  }));

  return {
    text: linked
      .flatMap(({ block, href }) =>
        block.kind === "item" && href !== undefined
          ? [
              linkedLine(block.lines[0] ?? "", block.head, href),
              ...block.lines.slice(1),
            ]
          : block.lines,
      )
      .join("\n"),
    hrefs: linked.flatMap(({ href }) => href ?? []),
  };
};

/** The item with the ref, of any list the pane draws, by its place among `items`; -1 when none has it. */
export const itemOfRef = (items: readonly (DecideItem | TodoItem)[], ref: string): number =>
  items.findIndex((item) => refOf(item) === ref);

/** The ref a question's link names, by its href; empty when it names none. */
export const refOfLink = (href: string): string =>
  href.startsWith(QUESTION_LINK) ? href.slice(QUESTION_LINK.length) : "";

/** The item a question's link names, by its href; -1 when it names none. */
export const itemOfLink = (
  items: readonly DecideItem[],
  href: string,
): number => itemOfRef(items, refOfLink(href));

/** Whether the options written include each of the item's, by letter and plain name. */
const hasOptionsOf = (item: DecideItem, options: readonly Option[]): boolean => {
  const written = options.map(
    (option) => `${option.letter}. ${plainSummary(option.name)}`,
  );

  return item.options.every((option) =>
    written.includes(`${option.letter}. ${plainSummary(option.name)}`),
  );
};

/** The character a list's header is underlined with. */
const HEADER_RULE = SPEC.characters["header-underline"];

/** Whether a line opens at its very start, as prose after a list does, where the list's own lines are indented. */
const isAtStart = (line: string): boolean => /^\S/.test(line);

/**
 * One block's part of the list above it: the lines it keeps in the
 * list, the options those of them outside code write, its summary where it
 * is one of the list's items, and whether the list ends with it.
 */
type Part = Readonly<{
  kept: readonly string[];
  options: readonly Option[];
  summary: string | undefined;
  ends: boolean;
}>;

/** No part of the list: the block ends it. */
const ENDED: Part = { kept: [], options: [], summary: undefined, ends: true };

/**
 * An item's part of the list: where its summary is alone on its line, it is
 * one of the list's items, keeping its lines up to one outside code at the
 * line's start, other than a header's underline, which is prose its lines
 * run into and ends the list; any other item ends the list.
 */
const itemPart = (block: Extract<Block, { kind: "item" }>): Part => {
  const summary = summaryOfBlock(block);
  const prose = block.body.findIndex(
    (under) =>
      !under.isCode &&
      isAtStart(under.line) &&
      !isLineOf(HEADER_RULE, under.line),
  );
  const own = prose < 0 ? block.body : block.body.slice(0, prose);

  return summary === undefined
    ? ENDED
    : {
        kept: block.lines.slice(0, 1 + own.length),
        options: own.flatMap((under) =>
          under.isCode || under.option === undefined ? [] : [under.option],
        ),
        summary,
        ends: prose >= 0,
      };
};

/** Whether a block other than an item goes on with the list: a header's underline, or an indented underline, separator, line of prose or code block. */
const goesOn = (block: Block): boolean =>
  (block.kind === "underline" && block.char === HEADER_RULE) ||
  ((block.kind === "underline" ||
    block.kind === "separator" ||
    block.kind === "text" ||
    block.kind === "code") &&
    !isAtStart(block.lines[0] ?? ""));

/** A block's part of the list above it. */
const partOf = (block: Block): Part =>
  block.kind === "item"
    ? itemPart(block)
    : goesOn(block)
      ? {
          kept: block.lines,
          options:
            block.kind === "text" && block.option !== undefined ? [block.option] : [],
          summary: undefined,
          ends: false,
        }
      : ENDED;

/** The parts of the list the blocks after its header hold, up to the one that ends it. */
const listParts = (blocks: readonly Block[]): readonly Part[] => {
  const parts = blocks.map(partOf);
  const end = parts.findIndex((part) => part.ends);

  return end < 0 ? parts : parts.slice(0, end + 1);
};

/** One of the list's items: its summary, and the options written in its lines and those of the parts after it up to the next item. */
type WrittenItem = Readonly<{ summary: string; options: readonly Option[] }>;

const writtenItems = (parts: readonly Part[]): readonly WrittenItem[] =>
  parts.reduce<readonly WrittenItem[]>((listed, part) => {
    const last = listed.at(-1);

    return part.summary !== undefined
      ? [...listed, { summary: part.summary, options: part.options }]
      : last === undefined
        ? listed
        : [
            ...listed.slice(0, -1),
            { ...last, options: [...last.options, ...part.options] },
          ];
  }, []);

/**
 * Where a list stands in a reply's text, to be cut out for its items' boxes
 * to stand in its place: the list, by its header, as an item's `list` names
 * it, and its lines, from its header's, `start`, up to `end`, not included.
 */
export type ListSpan = Readonly<{ list: string; start: number; end: number }>;

/**
 * Where the list `list` names stands in the reply, its header, its rule and
 * every line of its items. Undefined unless the list is found intact:
 * exactly one list of `list`'s names before any 📌 roll-up, whose summary
 * lines name `items`, every one and no other, in their order, each as
 * `isWritten` says the list writes it.
 */
const listSpan = <T extends ListedItem>(
  text: string,
  list: ListName & Readonly<{ aliases: readonly string[] }>,
  items: readonly T[],
  isWritten: (item: T, found: WrittenItem) => boolean,
): ListSpan | undefined => {
  const blocks = parseReply(text);
  const pinned = blocks.findIndex((block) => block.kind === "roll-up");
  const own = pinned < 0 ? blocks : blocks.slice(0, pinned);
  const names = namesOf(list);
  const headers = own.flatMap((block, n) =>
    block.kind === "header" && names.includes(block.name) ? [n] : [],
  );
  const start = headers.length === 1 ? headers[0] : undefined;
  const header = start === undefined ? undefined : blocks[start];
  const parts = start === undefined ? [] : listParts(blocks.slice(start + 1));
  const listed = writtenItems(parts);
  const at = header?.at ?? 0;
  const isIntact =
    header !== undefined &&
    items.length > 0 &&
    listed.length === items.length &&
    items.every((item, n) => {
      const found = listed[n];

      return (
        found !== undefined &&
        plainSummary(item.summary) === plainSummary(found.summary) &&
        isWritten(item, found)
      );
    });

  return isIntact
    ? {
        list: list.header,
        start: at,
        end: at + 1 + parts.reduce((sum, part) => sum + part.kept.length, 0),
      }
    : undefined;
};

/**
 * Where the reply's Decide list stands, as `listSpan` finds it, each item's
 * lines writing each of its options by letter and name, so a list an
 * earlier reply wrote for an item since restated with other options is
 * drawn as written.
 */
export const decideListSpan = (
  text: string,
  items: readonly DecideItem[],
): ListSpan | undefined =>
  listSpan(text, DECIDE, items, (item, found) => hasOptionsOf(item, found.options));

/**
 * The reply's text either side of its Decide list, for `items`' boxes to
 * stand in its place: the list's header, its rule and every line of its
 * items cut out; undefined unless `decideListSpan` finds it intact.
 */
export const decideListCut = (
  text: string,
  items: readonly DecideItem[],
): Readonly<{ before: string; after: string }> | undefined => {
  const span = decideListSpan(text, items);
  const lines = text.split("\n");

  return span === undefined
    ? undefined
    : {
        before: lines.slice(0, span.start).join("\n").trim(),
        after: lines.slice(span.end).join("\n").trim(),
      };
};

/** Where the reply's Todo list stands, as `listSpan` finds it: its summary lines naming `items`, by summary, the rest of each item's lines whatever they write. */
export const todoListSpan = (
  text: string,
  items: readonly TodoItem[],
): ListSpan | undefined => listSpan(text, TODO, items, () => true);

/**
 * The Todo items a reply's text prints in its own Todo lists, as raised
 * among `items`: those of the newest turn whose Todo items hold each the
 * text prints, by number and summary, in the text's order; none where the
 * text prints none, or no turn's items hold them all. The engine doesn't
 * say which turn drew a reply, so a reply printed again word for word in a
 * later turn reads as that later turn's, as a Decide summary reads as the
 * newest item's.
 */
export const printedTodoItems = (
  text: string,
  items: readonly ListedItem[],
): readonly TodoItem[] => {
  const printed = todoItemsOfText(text, "");
  const todo = items.filter((item): item is TodoItem => !isDecide(item));
  const turns = [...new Set(todo.map((item) => item.turn))].reverse();
  const inTurn = (turn: string): readonly (TodoItem | undefined)[] =>
    printed.map((each) =>
      todo.find(
        (item) =>
          item.turn === turn &&
          item.number === each.number &&
          plainSummary(item.summary) === plainSummary(each.summary),
      ),
    );
  const found = turns
    .map(inTurn)
    .find((matched) => matched.every((item) => item !== undefined));

  return printed.length === 0 || found === undefined
    ? []
    : found.flatMap((item) => item ?? []);
};

/**
 * One part of a reply drawn round the lists cut out of it: its text between
 * them, trimmed, keyed `before` ahead of every list, `after` past every one
 * and `between-<n>` after the `n`th, from 1, or `questions` where no list
 * is cut out, the whole text, where its Decide questions are links; or a
 * list, by its header, its items' boxes standing in its place.
 */
export type ReplyPart = Readonly<
  { kind: "text"; key: string; text: string } | { kind: "list"; list: string }
>;

/** A part of text's key, by how many lists come before it, of `count`. */
const textKey = (before: number, count: number): string =>
  count === 0
    ? "questions"
    : before === 0
      ? "before"
      : before === count
        ? "after"
        : `between-${before}`;

/**
 * The reply's text cut round `spans`, in the text's order: each stretch of
 * text, the empty ones left out, and each list in its place. With no spans,
 * the text whole.
 */
export const replyParts = (
  text: string,
  spans: readonly ListSpan[],
): readonly ReplyPart[] => {
  const lines = text.split("\n");
  const ordered = [...spans].sort((a, b) => a.start - b.start);
  const starts = [0, ...ordered.map((span) => span.end)];
  const ends = [...ordered.map((span) => span.start), lines.length];
  return starts.flatMap((from, n): readonly ReplyPart[] => {
    const said = lines.slice(from, ends[n]).join("\n").trim();
    const span = ordered[n];

    return [
      ...(said === "" ? [] : [{ kind: "text", key: textKey(n, ordered.length), text: said } as const]),
      ...(span === undefined ? [] : [{ kind: "list", list: span.list } as const]),
    ];
  });
};

/** The items a reply's links name, once each, in the reply's order. */
export const linkedItems = (
  items: readonly DecideItem[],
  hrefs: readonly string[],
): readonly DecideItem[] =>
  [...new Set(hrefs)].flatMap((href) => items[itemOfLink(items, href)] ?? []);
