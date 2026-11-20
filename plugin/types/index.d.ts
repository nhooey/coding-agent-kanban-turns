// The shapes the plugin works on, and its `$.state` contract. Self-contained,
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
 * One open Decide item, as the `kanban_options` tool takes it, in the shape
 * the kanban skill's `outstanding.py decide --json` prints.
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

/**
 * Every Decide item raised in this session, oldest first: the pane lists
 * them all, and a reply draws its own under its text. An item stays once
 * raised; one no longer open is settled, drawn dimmed, its buttons dead.
 */
export type Raised = Readonly<{
  /** The session the items were raised in: another session starts empty. */
  session: string;
  /** Each item a `kanban_options` call drew or a refresh found open, by ref once, oldest first. */
  items: readonly DecideItem[];
  /** Raised refs the last refresh didn't find open. */
  settledRefs: readonly string[];
  /** Refs raised by the last main-loop turn's end, so the pane opens by itself only for a new one. */
  seenRefs: readonly string[];
  /** Why the last refresh couldn't read the transcript, for the pane to say; empty when it could. */
  problem: string;
  /** What was wrong with the settings files at the last refresh, for the pane to say. */
  warnings: readonly string[];
}>;

/** A value a JSON or JSONC file holds. */
export type Json =
  | null
  | boolean
  | number
  | string
  | readonly Json[]
  | { readonly [key: string]: Json };

/**
 * The plugin's settings. defaults/config.jsonc lists each with its default and
 * what it does; `SETTINGS_SHAPE` in src/config.ts is the same list as a
 * schema.
 */
export type Settings = Readonly<{
  counts: Readonly<{ turns: number; "gh-timeout-ms": number }>;
  keys: Readonly<{ dismiss: string }>;
  notes: Readonly<{ rows: number }>;
  colors: Readonly<{
    border: string;
    title: string;
    "title-background": string;
    code: string;
    hover: string;
    settled: string;
    close: string;
    "close-x": string;
    kanban: string;
  }>;
}>;

/** The settings in effect, where each came from, and what was wrong with the files. */
export type Loaded = Readonly<{
  /** Null while the defaults file can't be used. */
  settings: Settings | null;
  /** One line per setting: its key, its value and the file it came from. */
  effective: readonly string[];
  /** What was wrong with a file, each naming the file; empty when nothing was. */
  problems: readonly string[];
}>;

declare module "claude-code" {
  interface PluginState {
    "coding-agent-kanban-turns": {
      raised: Shaped<Raised>;
      draft: string;
      noting: string;
      counts: string;
      merged: readonly string[];
      refreshes: number;
      settings: Shaped<Loaded>;
    };
  }
}
