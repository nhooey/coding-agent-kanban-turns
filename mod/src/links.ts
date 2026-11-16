// A reply's Decide questions as links: each open item's summary line made a
// link that names the item, and the item a pressed link names.

import { refOf } from "./items.ts";
import type { DecideItem } from "../types/index.d.ts";

/** Where a question's link points: a name that never resolves, so a click the mod misses opens nothing real. */
export const QUESTION_LINK = "https://kanban-turns.invalid/";

// A numbered item's bold summary, alone on its line.
const SUMMARY_LINE = /^(\s*\d+\.\s+)\*\*(.+?)\*\*([ \t]*)$/gm;

const plainSummary = (summary: string): string =>
  summary.replaceAll("**", "").replaceAll("`", "").trim();

/**
 * A reply's text with each open item's summary line, `1. **<summary>**`,
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
