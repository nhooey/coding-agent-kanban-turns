// What the hooks draw, worked out apart from drawing it: the text of the
// commands, the tool's result and an item's title, and whether the tool's
// row is plain enough to be drawn as nothing, the buttons going under the
// reply instead.

import type { DecideItem, Raised } from "../types/index.d.ts";
import { refOf } from "./items.ts";
import { problemsOf, stillOpen } from "./raised.ts";

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

/** An item's title in its box, marked when the item is settled. */
export const itemTitle = (item: DecideItem, isSettled: boolean): string =>
  `🧠 Decide.${item.number} · ${item.summary}${isSettled ? " (settled)" : ""}`;

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
