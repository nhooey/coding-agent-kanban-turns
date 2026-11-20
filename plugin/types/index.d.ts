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
 * How a Decide item stopped being open, which the UI calls Done: the user's
 * answer to it, the letters and note it gave and the id of the turn it was
 * sent in; a later `reassess` turn; a later item on its subject, the item
 * asked again; or, until the turn's end reads the transcript, the answer the
 * pane's Submit sent.
 */
export type Settlement = Readonly<
  | {
      ref: string;
      how: "answered";
      turn: string;
      letters: readonly string[];
      note: string;
    }
  | { ref: string; how: "reassessed" | "restated" }
  | { ref: string; how: "sent"; letters: readonly string[]; note: string }
>;

/**
 * Every Decide item raised in this session, oldest first: the pane lists
 * them all, and a reply draws its own under its text. An item stays once
 * raised; one no longer open is settled, Done in the UI, drawn dimmed, its
 * options still live, so a click answers it again.
 */
export type Raised = Readonly<{
  /** The session the items were raised in: another session starts empty. */
  session: string;
  /** The ids of the turns the last refresh read, oldest first: what a turn's index in the pane counts back from. */
  turns: readonly string[];
  /** Each item a `kanban_options` call drew or a refresh found open, by ref once, oldest first. */
  items: readonly DecideItem[];
  /** Raised refs the last refresh didn't find open. */
  settledRefs: readonly string[];
  /** How each item the last refresh found settled settled, by its ref. */
  settlements: readonly Settlement[];
  /** Refs raised by the last main-loop turn's end, so the pane opens by itself only for a new one. */
  seenRefs: readonly string[];
  /** Why the last refresh couldn't read the transcript, for the pane to say; empty when it could. */
  problem: string;
  /** What was wrong with the settings files at the last refresh, for the pane to say. */
  warnings: readonly string[];
}>;

/** A value a settings file holds, YAML or JSONC. */
export type Json =
  | null
  | boolean
  | number
  | string
  | readonly Json[]
  | { readonly [key: string]: Json };

/**
 * The plugin's settings. defaults/config.yaml lists each with its default and
 * what it does; `SETTINGS_SHAPE` in src/config.ts is the same list as a
 * schema.
 */
export type Settings = Readonly<{
  counts: Readonly<{ turns: number; "gh-timeout-ms": number }>;
  keys: Readonly<{
    dismiss: string;
    next: string;
    previous: string;
    submit: string;
    reassess: string;
    help: string;
  }>;
  pane: Readonly<{ "close-when-all-submitted": boolean }>;
  notes: Readonly<{ rows: number }>;
  marks: Readonly<{ sent: string }>;
  colors: Readonly<{
    border: string;
    "title-label": string;
    "title-background": string;
    code: string;
    hover: string;
    settled: string;
    close: string;
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
  /** What to change in a file that's read as it is, each naming the file: /answers-config says them, the pane doesn't. */
  warnings: readonly string[];
}>;

declare module "claude-code" {
  interface PluginState {
    "coding-agent-kanban-turns": {
      raised: Shaped<Raised>;
      sent: Shaped<readonly Settlement[]>;
      expanded: readonly string[];
      focused: string;
      isKeysOpen: boolean;
      draft: string;
      noting: string;
      submits: number;
      submitting: number;
      runningTurn: string;
      submitProblem: string;
      counts: string;
      merged: readonly string[];
      refreshes: number;
      settings: Shaped<Loaded>;
      instructed: string;
    };
  }
}
