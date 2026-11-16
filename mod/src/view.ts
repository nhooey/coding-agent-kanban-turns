// What the hooks draw, worked out apart from drawing it: which way the band
// shows, the text of the commands, the tool's result and its row's title,
// and whether the tool's row is plain enough to be drawn as buttons alone.

import type { Band, DecideItem } from "../types/index.d.ts";
import { shownItem } from "./band.ts";
import { refOf } from "./items.ts";

/**
 * How the band above the prompt shows: not at all, the item in full, or
 * folded to its 🧠, with a button for the pane when the items are too tall.
 */
export type BandView = "none" | "full" | "folded" | "folded-tall";

/** What the band's drawing depends on beside the band itself. */
export type BandSurroundings = Readonly<{
  /** Every open item fits the band's rows. */
  fits: boolean;
  /** The pane is showing the items. */
  paneShown: boolean;
  /** A survey holds the place above the prompt. */
  hasSurvey: boolean;
  /** The settings could be read. */
  hasSettings: boolean;
}>;

/** How the band shows: in full when it's neither put away nor dismissed, every item fits and the pane isn't showing them; else folded. */
export const bandView = (band: Band, around: BandSurroundings): BandView =>
  around.hasSurvey || !around.hasSettings || shownItem(band) === undefined
    ? "none"
    : !band.isDismissed && !band.isAway && around.fits && !around.paneShown
      ? "full"
      : around.fits
        ? "folded"
        : "folded-tall";

/** The folded band's words after its 🧠: the count, and that the items are too tall when they are. */
export const foldedLabel = (count: number, fits: boolean): string =>
  ` ${count} open ${count === 1 ? "decision" : "decisions"}${fits ? "" : ", too tall for here "}`;

/** What the pane and /answers say when there are no open items, with why when it's known. */
export const noItemsText = (problem: string): string =>
  `No open Decide items${problem ? `: ${problem}` : ""}.`;

/** /answers's reply: the pane opened over the open items, or why there are none. */
export const answersText = (band: Band): string =>
  band.items.length === 0
    ? noItemsText(band.problem)
    : `Decide pane opened: ${band.items.length} open Decide items.`;

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
  `Drew buttons for ${items.length} Decide items above the final response: ${items
    .map(refOf)
    .join(", ")}.`;

/** An item's title on the tool's row, marked when the item is settled. */
export const toolRowTitle = (item: DecideItem, isSettled: boolean): string =>
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
 * Whether the tool's row, or its result line, is drawn as the buttons
 * alone: not where it says more than they do, under ctrl+o, after an error
 * or an interruption, or for a call that drew no items.
 */
export const isPlainToolRow = (row: ToolRow): boolean =>
  !row.isExpanded &&
  !row.isErrored &&
  row.isInterrupted !== true &&
  row.itemCount !== 0;
