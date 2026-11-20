// The shapes the plugin works on, and its `$.state` contract. Self-contained,
// as `claude plugin validate` asks: the core in src/ imports its types from
// here, and Node's type-check reads the `claude-code` module from the stub
// in test/types/claude-code.d.ts.

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
 * Who wrote a turn's prompt, or a message sent while it ran: the user;
 * this plugin, sending the user's draft or Reassess for them; another
 * plugin; a peer, an agent's report or another session's message; a
 * task's notification; or a schedule, whose stored prompt a wakeup or a
 * scheduled task sends. The user's and this plugin's are the user's own
 * text, which answers items and runs commands; the others answer nothing.
 */
export type Owner =
  | "user"
  | "this-plugin"
  | "other-plugin"
  | "peer"
  | "notification"
  | "scheduled";

/**
 * A turn's prompt, or a message sent while the turn ran: who wrote it, its
 * text, and, where it reports that some work ended, the names it goes by,
 * such as the sending session's name, the agent's id or the finished task's
 * id. A report naming a Waiting item settles it.
 */
export type Message = Readonly<{
  owner: Owner;
  text: string;
  /** The names a report goes by; undefined where the text is no report. */
  reportNames: readonly string[] | undefined;
}>;

/**
 * One turn of a session, whatever harness ran it: a harness's adapter
 * builds these from its own transcript, and the core reads nothing else.
 */
export type Turn = Readonly<{
  /** The turn's id, as an item reference names it. */
  id: string;
  /** The prompt that opened the turn, and who wrote it. */
  prompt: Message;
  /** The texts of the agent's responses, oldest first, the last its final one. */
  replies: readonly string[];
  /** The Decide items the `kanban_options` tool raised, in the order the agent raised them. */
  decide: readonly DecideItem[];
  /** The messages sent while the turn ran, the user's and others', in order. */
  messages: readonly Message[];
}>;

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

/**
 * Where a draft Submit sends is: the box being emptied; the draft sent,
 * with the answers it moved to Done; the engine having refused it, the box
 * being read to put it back; or the box taking it back after `box`.
 */
export type SubmitStage = Readonly<
  | { at: "emptying" }
  | { at: "submitting"; moved: readonly Settlement[] }
  | { at: "reading-back"; refusal: string }
  | { at: "putting-back"; refusal: string; box: string }
>;

/**
 * One press of Submit under way, by its number: reading the box, or
 * sending the draft it read. Every prompt call it makes, and the call's
 * answer, carry the number, so an answer moves only the press that asked.
 */
export type Press = Readonly<
  | { press: number; at: "reading" }
  | { press: number; at: "sending"; draft: string; stage: SubmitStage }
>;

/**
 * The pane's Submit: idle; a main-loop turn running, by its id, which only
 * that turn's end clears; refused, with why; or a press under way. A turn
 * that started meanwhile is kept with either of the last two. `said` is
 * what the pane still says from before the press, until it ends; a turn's
 * start clears it.
 */
export type Submit = Readonly<
  | { tag: "idle" }
  | { tag: "running"; turn: string }
  | { tag: "refused"; why: string; turn?: string }
  | { tag: "pressed"; press: Press; said: string; turn?: string }
>;

/**
 * The pane's state, one value that `step` moves: how many presses there
 * have been, which numbers them; Submit; and the presses a session's start
 * overtook, which finish as they would have, since a hook already running
 * when the plugin reloads still settles.
 */
export type PaneState = Readonly<{
  presses: number;
  submit: Submit;
  overtaken: readonly Press[];
}>;

/** A value a settings file holds, as YAML reads it. */
export type Json =
  | null
  | boolean
  | number
  | string
  | readonly Json[]
  | { readonly [key: string]: Json };

/**
 * The plugin's settings. defaults/config.yaml lists each with its default and
 * what it does; `SETTINGS_SHAPE` in src/config/config.ts is the same list as a
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
      pane: Shaped<PaneState>;
      counts: string;
      merged: readonly string[];
      refreshes: number;
      settings: Shaped<Loaded>;
      instructed: string;
    };
  }
}
