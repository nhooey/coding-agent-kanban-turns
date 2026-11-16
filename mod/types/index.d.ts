// The shapes the mod works on, and its `$.state` contract. Self-contained,
// as `claude plugin validate` asks: the core in src/ imports its types from
// here, and Node's type-check reads the `claude-code` module from the stub
// in test/claude-code.d.ts.

/**
 * One option of a Decide item: its capital letter and bold name, and, as the
 * skill writes it, its glyph, the consequence after the name, and the ➕, ➖
 * and note lines under it. A tool call may leave out all but letter and name.
 */
export type DecideOption = Readonly<{
  letter: string;
  name: string;
  glyph?: string;
  consequence?: string;
  pros?: readonly string[];
  cons?: readonly string[];
  notes?: readonly string[];
}>;

/** radio: exactly one letter; checkbox: any number; binary: Y or N. */
export type DecideKind = "radio" | "checkbox" | "binary";

/**
 * One open Decide item, as `outstanding.py decide --json` prints it and the
 * `kanban_options` tool takes it.
 */
export type DecideItem = Readonly<{
  turn: string;
  list: "Decide";
  number: number;
  summary: string;
  kind: DecideKind;
  ref: string;
  /** The lines under the summary, before the options. */
  note?: readonly string[];
  options: readonly DecideOption[];
}>;

/** The band above the prompt: the open items and where it stands among them. */
export type Band = Readonly<{
  /** The open Decide items, oldest first, from the last refresh. */
  items: readonly DecideItem[];
  /** Which item the band shows, an index into `items`. */
  position: number;
  /** True after ❌, until a refresh raises an item not in `dismissedRefs`, or /answers. */
  isDismissed: boolean;
  /** True from a submitted prompt until the main loop's reply ends: folded meanwhile, then shown again. */
  isAway: boolean;
  /** The items' refs when ✕ was pressed. */
  dismissedRefs: readonly string[];
  /** Every ref a tool row drew or a refresh found open, so a ref gone from the open list reads as settled. */
  knownRefs: readonly string[];
  /** Known refs no longer open: their tool-row buttons are dimmed and do nothing. */
  settledRefs: readonly string[];
  /** Why the last refresh found nothing, for the band to say; empty when it worked. */
  problem: string;
}>;

declare module "claude-code" {
  interface PluginState {
    "coding-agent-kanban-answers": {
      band: Shaped<Band>;
      draft: string;
    };
  }
}
