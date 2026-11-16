// How an item's text is laid out: its code spans, and the rows it takes, so
// the band knows whether every open item fits above the prompt.

import type { DecideItem, DecideOption } from "../types/index.d.ts";

/** A line split at its backticks: even parts are prose, odd parts code. */
export const codeSpans = (
  line: string,
): readonly { text: string; isCode: boolean }[] =>
  line
    .split("`")
    .map((text, n) => ({
      text: text.replaceAll("**", ""),
      isCode: n % 2 === 1,
    }))
    .filter((part) => part.text !== "");

const sum = (counts: readonly number[]): number =>
  counts.reduce((total, count) => total + count, 0);

/** Rows a line takes wrapped into `width` columns, at least one. */
const wrappedRows = (line: string, width: number): number =>
  Math.max(1, Math.ceil([...line].length / Math.max(10, width)));

/** Rows an option takes: its name line, then its ➕, ➖ and note lines, indented under it. */
const optionRows = (option: DecideOption, inner: number): number =>
  wrappedRows(
    `🔘 ${option.letter}. ${option.name}: ${option.consequence ?? ""}`,
    inner - 3,
  ) +
  sum(
    [
      ...(option.pros ?? []),
      ...(option.cons ?? []),
      ...(option.notes ?? []),
    ].map((line) => wrappedRows(`➕ ${line}`, inner - 6)),
  );

/**
 * Rows an item takes drawn in full in a bordered box `columns` wide: the
 * border, the controls and the gap under them, the title, the note, and each
 * option with its ➕, ➖ and note lines, every line wrapped at its indent.
 */
export const rowsNeeded = (item: DecideItem, columns: number): number => {
  const inner = columns - 4;

  return (
    4 +
    wrappedRows(`🧠 99/99 · ${item.summary}`, inner) +
    sum((item.note ?? []).map((line) => wrappedRows(line, inner - 3))) +
    sum(item.options.map((option) => optionRows(option, inner)))
  );
};

/** Whether every open item fits the band, so paging through them never moves between band and pane. */
export const fitsBand = (
  items: readonly DecideItem[],
  layout: Readonly<{ rows: number; columns: number }>,
): boolean =>
  layout.rows > 0 &&
  items.every((item) => rowsNeeded(item, layout.columns) <= layout.rows);
