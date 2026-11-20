// A reply's Decide questions as links: each raised item's summary line made
// a link that names the item, the item a pressed link names, and the items a
// reply links, drawn under it; or the reply's Decide list cut out, for the
// items' boxes to stand in its place.

import { refOf } from "./items.ts";
import { PIN } from "./outstanding.ts";
import { DECISIONS, HEADER, isTopicRule } from "./transcript.ts";
import type { DecideItem } from "../types/index.d.ts";

/** Where a question's link points: a name that never resolves, so a click the plugin misses opens nothing real. */
export const QUESTION_LINK = "https://kanban-turns.invalid/";

// A numbered item's bold summary, alone on its line.
const SUMMARY_LINE = /^(\s*\d+\.\s+)\*\*(.+?)\*\*([ \t]*)$/gm;

const plainSummary = (summary: string): string =>
  summary.replaceAll("**", "").replaceAll("`", "").trim();

/**
 * A reply's text with each given item's summary line, `1. **<summary>**`,
 * made a link to the item, `1. **[<summary>](…/<ref>)**`; the hrefs it made.
 */
export const linkedQuestions = (
  text: string,
  items: readonly DecideItem[],
): Readonly<{ text: string; hrefs: readonly string[] }> => {
  const bySummary = new Map(
    items.map((item) => [plainSummary(item.summary), item]),
  );
  const hrefOf = (summary: string): string | undefined => {
    const item = bySummary.get(plainSummary(summary));

    return item === undefined ? undefined : `${QUESTION_LINK}${refOf(item)}`;
  };

  return {
    text: text.replace(
      SUMMARY_LINE,
      (line, lead: string, summary: string, tail: string) => {
        const href = hrefOf(summary);

        return href === undefined
          ? line
          : `${lead}**[${summary}](${href})**${tail}`;
      },
    ),
    hrefs: [...text.matchAll(SUMMARY_LINE)]
      .map((m) => hrefOf(m[2] ?? ""))
      .filter((href) => href !== undefined),
  };
};

/** The item a question's link names, by its href; -1 when it names none. */
export const itemOfLink = (
  items: readonly DecideItem[],
  href: string,
): number =>
  href.startsWith(QUESTION_LINK)
    ? items.findIndex(
        (item) => refOf(item) === href.slice(QUESTION_LINK.length),
      )
    : -1;

// A numbered item's bold summary, alone on its line, one line at a time.
const SUMMARY_ONE = new RegExp(SUMMARY_LINE.source);

/** Whether a line ends the list above it: a blank line, the next header, the 📌 roll-up, or a topic header or its rule. */
const endsList = (line: string, following: string): boolean =>
  line.trim() === "" ||
  HEADER.test(line) ||
  PIN.test(line) ||
  isTopicRule(line) ||
  isTopicRule(following);

/** Whether a line is the header of a Decide list. */
const isDecideHeader = (line: string): boolean =>
  DECISIONS.includes(HEADER.exec(line)?.[1] ?? "");

/**
 * The reply's text either side of its Decide list, for `items`' boxes to
 * stand in its place: the list's header, its rule and every line of its
 * items cut out. Undefined unless the list is found intact: exactly one
 * Decide list before any 📌 roll-up, whose summary lines name `items`, every
 * one and no other, in their order.
 */
export const decideListCut = (
  text: string,
  items: readonly DecideItem[],
): Readonly<{ before: string; after: string }> | undefined => {
  const lines = text.split("\n");
  const pinned = lines.findIndex((line) => PIN.test(line));
  const ownLines = pinned < 0 ? lines : lines.slice(0, pinned);
  const headers = ownLines.flatMap((line, n) => (isDecideHeader(line) ? [n] : []));
  const start = headers.length === 1 ? (headers[0] ?? -1) : -1;
  const length = lines
    .slice(start + 1)
    .findIndex((line, n) => endsList(line, lines[start + n + 2] ?? ""));
  const end = length < 0 ? lines.length : start + 1 + length;
  const summaries = lines
    .slice(start + 1, end)
    .flatMap((line) => {
      const summary = SUMMARY_ONE.exec(line)?.[2];

      return summary === undefined ? [] : [plainSummary(summary)];
    });
  const isIntact =
    start >= 0 &&
    items.length > 0 &&
    summaries.length === items.length &&
    items.every((item, n) => plainSummary(item.summary) === summaries[n]);

  return isIntact
    ? {
        before: lines.slice(0, start).join("\n").trim(),
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
