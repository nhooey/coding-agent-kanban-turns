// A reply's Decide questions as links: each raised item's summary line made
// a link that names the item, the item a pressed link names, and the items a
// reply links, drawn under it; or the reply's Decide list cut out, for the
// items' boxes to stand in its place. Both read the reply's blocks, as
// parseReply gives them. And the ref a link to an item names, a question's
// or one between a superseded item and the item that replaced it.

import { refOf } from "../items/items.ts";
import { DECISIONS, isLineOf } from "../protocol/rules.ts";
import { SPEC } from "../protocol/spec.ts";
import { parseReply } from "../transcript/reply.ts";
import type { Block, ItemHead, Option } from "../transcript/reply.ts";
import type { DecideItem, TodoItem } from "../../types/index.d.ts";

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
 * One block's part of the Decide list above it: the lines it keeps in the
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

/** A block's part of the Decide list above it. */
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
type ListedItem = Readonly<{ summary: string; options: readonly Option[] }>;

const listedItems = (parts: readonly Part[]): readonly ListedItem[] =>
  parts.reduce<readonly ListedItem[]>((listed, part) => {
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
 * The reply's text either side of its Decide list, for `items`' boxes to
 * stand in its place: the list's header, its rule and every line of its
 * items cut out. Undefined unless the list is found intact: exactly one
 * Decide list before any 📌 roll-up, whose summary lines name `items`, every
 * one and no other, in their order, each item's lines writing each of its
 * options by letter and name, so a list an earlier reply wrote for an item
 * since restated with other options is drawn as written.
 */
export const decideListCut = (
  text: string,
  items: readonly DecideItem[],
): Readonly<{ before: string; after: string }> | undefined => {
  const blocks = parseReply(text);
  const pinned = blocks.findIndex((block) => block.kind === "roll-up");
  const own = pinned < 0 ? blocks : blocks.slice(0, pinned);
  const headers = own.flatMap((block, n) =>
    block.kind === "header" && DECISIONS.includes(block.name) ? [n] : [],
  );
  const start = headers.length === 1 ? headers[0] : undefined;
  const header = start === undefined ? undefined : blocks[start];
  const parts = start === undefined ? [] : listParts(blocks.slice(start + 1));
  const listed = listedItems(parts);
  const lines = text.split("\n");
  const at = header?.at ?? 0;
  const end = at + 1 + parts.reduce((sum, part) => sum + part.kept.length, 0);
  const isIntact =
    header !== undefined &&
    items.length > 0 &&
    listed.length === items.length &&
    items.every((item, n) => {
      const found = listed[n];

      return (
        found !== undefined &&
        plainSummary(item.summary) === plainSummary(found.summary) &&
        hasOptionsOf(item, found.options)
      );
    });

  return isIntact
    ? {
        before: lines.slice(0, at).join("\n").trim(),
        after: lines.slice(end).join("\n").trim(),
      }
    : undefined;
};

/** The items a reply's links name, once each, in the reply's order. */
export const linkedItems = (
  items: readonly DecideItem[],
  hrefs: readonly string[],
): readonly DecideItem[] =>
  [...new Set(hrefs)].flatMap((href) => items[itemOfLink(items, href)] ?? []);
