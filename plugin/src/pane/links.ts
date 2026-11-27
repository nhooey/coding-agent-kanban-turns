// A reply's items, of every list the pane draws, by one rule: each summary
// line under a list's header naming a raised item of that list made a link
// that names the item, the item a
// pressed link names, and the items a reply's links name; each list found
// intact cut out, for its items' boxes to stand in its place, and the
// reply's text in parts round the lists; and the whole drawing of a reply
// those make. Each reads the reply's blocks, as parseReply gives them, and
// no list takes a path of its own: what sets one apart is its spec's data,
// its options among what an intact list must write. And the ref a link to
// an item names, a summary's or one between a superseded item and the item
// that replaced it.

import { hasOptions, refOf } from "../items/items.ts";
import { summaryText } from "../items/outstanding.ts";
import { PANE_LISTS, isLineOf, listNamed, namesOf } from "../protocol/rules.ts";
import type { List } from "../protocol/rules.ts";
import { SPEC } from "../protocol/spec.ts";
import { parseReply, sectionNamesOf } from "../transcript/reply.ts";
import type { Block, ItemHead, Option } from "../transcript/reply.ts";
import type { DecideOption, ListedItem } from "../../types/index.d.ts";

/** Where an item's link points: a name that never resolves, so a click the plugin misses opens nothing real. */
export const ITEM_LINK = "https://kanban-turns.invalid/";

const plainSummary = (summary: string): string =>
  summary.replaceAll("**", "").replaceAll("`", "").trim();

/** A summary as a reply's line and a raised item are compared by, whatever list: plain, and without a trailing colon, as `summaryOf` reads an item's summary. */
const summaryKey = (summary: string): string => plainSummary(summaryText(summary));

/** A numbered item's bold summary, the one its text opens on, alone on its line or not; undefined for a bullet or a line opening on no bold text. */
const numberedSummary = (head: ItemHead): string | undefined =>
  head.number !== undefined ? head.summary : undefined;

/** A numbered item's bold summary, where it's alone on its line; undefined for a bullet or a line holding more. */
const summaryAlone = (head: ItemHead): string | undefined =>
  head.isAlone ? numberedSummary(head) : undefined;

/** A numbered item's summary alone on its line, where the block is such an item. */
const summaryOfBlock = (block: Block): string | undefined =>
  block.kind === "item" ? summaryAlone(block.head) : undefined;

/** An item's own line, `line`, with the bold summary it opens on made a link, `**[<summary>](<href>)**`, all else as written. */
const linkedLine = (line: string, head: ItemHead, href: string): string => {
  const summary = numberedSummary(head);

  return summary === undefined
    ? line
    : `${head.lead}**[${summary}](${href})**${line.slice(head.lead.length + summary.length + 4)}`;
};

/** What a summary line and a raised item are matched by: the list the line sits under, as an item's `list` names it, and the summary, as `summaryKey` compares them. */
const matchKey = (list: string, summary: string): string =>
  JSON.stringify([list, summaryKey(summary)]);

/** The block's summary as its list's key names it: where it's a numbered item with a bold summary in the section of one of the spec's lists. */
const keyOfBlock = (block: Block, section: string | undefined): string | undefined => {
  const list = section === undefined ? undefined : listNamed(section);
  const summary = block.kind === "item" ? numberedSummary(block.head) : undefined;

  return list === undefined || summary === undefined ? undefined : matchKey(list.header, summary);
};

/**
 * A reply's text with each summary line naming one of `items`, `1.
 * **<summary>**`, made a link to the item, `1. **[<summary>](…/<ref>)**`;
 * the hrefs it made, in the text's order. A summary line is a numbered
 * item's own line opening on its bold summary, in a list's section, and
 * names the newest of `items` of that list whose summary it writes, as
 * `summaryKey` compares them: one rule for every list. A line in no list's
 * section, or in that of a list none of `items` is of, names nothing.
 */
export const linkedSummaries = (
  text: string,
  items: readonly ListedItem[],
): Readonly<{ text: string; hrefs: readonly string[] }> => {
  const byKey = new Map(items.map((item) => [matchKey(item.list, item.summary), item]));
  const blocks = parseReply(text);
  const sections = sectionNamesOf(blocks);
  const hrefOf = (block: Block, n: number): string | undefined => {
    const key = keyOfBlock(block, sections[n]);
    const item = key === undefined ? undefined : byKey.get(key);

    return item === undefined ? undefined : `${ITEM_LINK}${refOf(item)}`;
  };
  const linked = blocks.map((block, n) => ({
    block,
    href: hrefOf(block, n),
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
export const itemOfRef = (items: readonly ListedItem[], ref: string): number =>
  items.findIndex((item) => refOf(item) === ref);

/** The ref an item's link names, by its href; empty when it names none. */
export const refOfLink = (href: string): string =>
  href.startsWith(ITEM_LINK) ? href.slice(ITEM_LINK.length) : "";

/** The item an item's link names, by its href; -1 when it names none. */
export const itemOfLink = (items: readonly ListedItem[], href: string): number =>
  itemOfRef(items, refOfLink(href));

/** The items a reply's links name, once each, in the reply's order. */
export const linkedItems = (
  items: readonly ListedItem[],
  hrefs: readonly string[],
): readonly ListedItem[] =>
  [...new Set(hrefs)].flatMap((href) => items[itemOfLink(items, href)] ?? []);

/** The options an item carries: those of an item its list answers by options, none for any other. */
const optionsOf = (item: ListedItem): readonly DecideOption[] =>
  hasOptions(item) ? item.options : [];

/** Whether the options written include each of the item's, by letter and plain name; an item without options has every one written. */
const hasOptionsOf = (item: ListedItem, options: readonly Option[]): boolean => {
  const written = options.map((option) => `${option.letter}. ${plainSummary(option.name)}`);

  return optionsOf(item).every((option) =>
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
 * is one of the list's items, whether the list ends with it, and whether
 * it's a numbered item whose summary isn't alone on its line, which keeps
 * the list from being found intact.
 */
type Part = Readonly<{
  kept: readonly string[];
  options: readonly Option[];
  summary: string | undefined;
  ends: boolean;
  isLoose: boolean;
}>;

/** No part of the list: the block ends it. */
const ENDED: Part = { kept: [], options: [], summary: undefined, ends: true, isLoose: false };

/** A numbered item whose summary isn't alone on its line: in the list, its lines kept, but the list not intact. */
const loosePart = (block: Extract<Block, { kind: "item" }>): Part => ({
  kept: block.lines,
  options: [],
  summary: undefined,
  ends: false,
  isLoose: true,
});

/**
 * An item's part of the list: where its summary is alone on its line, it is
 * one of the list's items, keeping its lines up to one outside code at the
 * line's start, other than a header's underline, which is prose its lines
 * run into and ends the list; a numbered item whose summary runs on is in
 * the list but loose; a bullet ends the list.
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
    ? block.head.number === undefined
      ? ENDED
      : loosePart(block)
    : {
        kept: block.lines.slice(0, 1 + own.length),
        options: own.flatMap((under) =>
          under.isCode || under.option === undefined ? [] : [under.option],
        ),
        summary,
        ends: prose >= 0,
        isLoose: false,
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
          isLoose: false,
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

/** Whether a list writes the item where it wrote `found`: its summary, as `summaryKey` compares them, and each of its options, by letter and name, so a list an earlier reply wrote for an item since restated with other options isn't the item's. */
const isWritten = (item: ListedItem, found: WrittenItem): boolean =>
  summaryKey(item.summary) === summaryKey(found.summary) &&
  hasOptionsOf(item, found.options);

/**
 * Where a list stands in a reply's text, to be cut out for its items' boxes
 * to stand in its place: the list, by its header, as an item's `list` names
 * it, and its lines, from its header's, `start`, up to `end`, not included.
 */
export type ListSpan = Readonly<{ list: string; start: number; end: number }>;

/**
 * Where `list` stands in the reply, its header, its rule and every line of
 * its items, whatever the list. Undefined unless it's found intact: exactly
 * one list of `list`'s names before any 📌 roll-up, whose summary lines,
 * each summary alone on its line, name `items`, every one and no other, in
 * their order, each as `isWritten` says.
 */
export const listSpan = (
  text: string,
  list: List,
  items: readonly ListedItem[],
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
    !parts.some((part) => part.isLoose) &&
    listed.length === items.length &&
    items.every((item, n) => {
      const found = listed[n];

      return found !== undefined && isWritten(item, found);
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
 * The reply's text either side of `list`, the list's header, its rule and
 * every line of its items cut out; undefined unless `listSpan` finds it
 * intact. The hooks cut a reply with `replyDrawing`; this form is what the
 * tests check a cut by.
 */
export const listCut = (
  text: string,
  list: List,
  items: readonly ListedItem[],
): Readonly<{ before: string; after: string }> | undefined => {
  const span = listSpan(text, list, items);
  const lines = text.split("\n");

  return span === undefined
    ? undefined
    : {
        before: lines.slice(0, span.start).join("\n").trim(),
        after: lines.slice(span.end).join("\n").trim(),
      };
};

/**
 * One part of a reply drawn round the lists cut out of it: its text between
 * them, trimmed, keyed `before` ahead of every list, `after` past every one
 * and `between-<n>` after the `n`th, from 1, or `questions` where no list
 * is cut out, the whole text as written, whichever lists it prints; or a
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

/** A stretch of a reply's text, keyed `key`; none where it's empty. */
const textPart = (key: string, text: string): readonly ReplyPart[] =>
  text === "" ? [] : [{ kind: "text", key, text }];

/** A list's boxes, by its header. */
const listPart = (list: string): ReplyPart => ({ kind: "list", list });

/**
 * The reply's text cut round `spans`, in the text's order: each stretch of
 * text, trimmed, the empty ones left out, and each list in its place. With
 * no spans, the text whole, as written.
 */
export const replyParts = (
  text: string,
  spans: readonly ListSpan[],
): readonly ReplyPart[] => {
  const lines = text.split("\n");
  const ordered = [...spans].sort((a, b) => a.start - b.start);
  const starts = [0, ...ordered.map((span) => span.end)];
  const ends = [...ordered.map((span) => span.start), lines.length];

  return ordered.length === 0
    ? textPart(textKey(0, 0), text)
    : starts.flatMap((from, n) => {
        const span = ordered[n];

        return [
          ...textPart(textKey(n, ordered.length), lines.slice(from, ends[n]).join("\n").trim()),
          ...(span === undefined ? [] : [listPart(span.list)]),
        ];
      });
};

/** One list a reply prints items of: the list, the raised items its summary lines name, and where it stands where it's found intact. */
export type ReplyList = Readonly<{
  list: List;
  items: readonly ListedItem[];
  span: ListSpan | undefined;
}>;

/**
 * How a reply is drawn: its parts, in order, and the links its text parts
 * carry; and each list it prints items of, with its items.
 */
export type ReplyDrawing = Readonly<{
  parts: readonly ReplyPart[];
  hrefs: readonly string[];
  lists: readonly ReplyList[];
}>;

/**
 * How a reply is drawn, every list by one rule: its items, of any list, are
 * the raised ones its summary lines name, each under its list's header, as
 * `linkedSummaries` matches them, each once; each list they're of is cut out where `isCutting` and
 * `listSpan` find it intact, its items' boxes in its place; a list that
 * isn't is drawn as written, its items' summaries links that open the pane
 * at them, and its boxes under the whole reply, after any text past a list
 * cut out, in the spec's list order. Undefined where the reply names no
 * raised item, so it's drawn as the engine draws it. An item no turn
 * raised yet, as a running turn's own, names none, so its line is drawn as
 * written until one does.
 */
export const replyDrawing = (
  text: string,
  raised: readonly ListedItem[],
  isCutting: boolean,
): ReplyDrawing | undefined => {
  const named = linkedItems(raised, linkedSummaries(text, raised).hrefs);
  const lists: readonly ReplyList[] = PANE_LISTS.map((list) => {
    const items = named.filter((item) => item.list === list.header);

    return { list, items, span: isCutting ? listSpan(text, list, items) : undefined };
  }).filter((each) => each.items.length > 0);
  const uncut = lists.filter((each) => each.span === undefined);
  const linked = linkedSummaries(
    text,
    uncut.flatMap((each) => each.items),
  );

  return named.length === 0
    ? undefined
    : {
        parts: [
          ...replyParts(
            linked.text,
            lists.flatMap((each) => each.span ?? []),
          ),
          ...uncut.map((each) => listPart(each.list.header)),
        ],
        hrefs: linked.hrefs,
        lists,
      };
};
