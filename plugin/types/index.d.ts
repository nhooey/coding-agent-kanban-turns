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
  /** The items it frees, by reference, `0f311c94.Todo.1`: those its `Frees:` line names. */
  frees?: readonly string[];
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
  /**
   * True where the turn has no final response: it still runs, or it ended
   * without one, interrupted or cut off by an error, so its last reply is
   * text written on the way. Left out where it has one, as a harness that
   * doesn't say leaves it.
   */
  unanswered?: true;
  /**
   * When the prompt that opened the turn came, an ISO 8601 time. Left out
   * where it's unknown, as a harness that doesn't say leaves it.
   */
  promptedAt?: string;
  /**
   * When the turn's last response came, an ISO 8601 time: its final
   * response's, where it has one. Left out where it's unknown, as a
   * harness that doesn't say leaves it.
   */
  answeredAt?: string;
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
 * An answer Submit sent, Done until a turn's end reads the transcript it
 * went into, by the press that sent it: a press that ends without sending
 * puts back only its own, and two presses may hold an answer to one item.
 */
export type Held = Readonly<{ press: number; settled: Settlement }>;

/**
 * A refresh's read that hasn't answered, by the refresh's number: first of
 * the settings files, by the settings read's number, then of the
 * transcript. It holds the answers Submit held when it was asked, which
 * the read takes out once it has read the transcript they went into: a
 * turn's end's holds; none for any other refresh.
 */
export type Reading = Readonly<{
  refresh: number;
  releases: readonly Held[];
  on: Readonly<{ at: "settings"; read: number } | { at: "transcript" }>;
}>;

/**
 * The refresh: how many refreshes have been asked for, which numbers them;
 * the refresh whose transcript read the items and the count line show, 0
 * before any; and the refreshes' reads not answered yet, oldest first. A read no newer
 * than the one shown is dropped when it answers, so an older refresh never
 * replaces a newer one.
 */
export type Refresh = Readonly<{
  asked: number;
  shown: number;
  reads: readonly Reading[];
}>;

/**
 * What the last overtaken press to end said, apart from what the pane says
 * of the press under way, and how many presses there had been when it did:
 * a press pressed since that ends clears it, unless it ends sending nothing
 * and saying nothing new, as a box of blanks does, which leaves what the
 * pane said before it.
 */
export type Aside = Readonly<{ said: string; presses: number }>;

/**
 * The settings, as the newest read of the files to answer found them: none
 * read yet; loaded, with the settings in effect, where each came from and
 * what was wrong with a file that still left them usable; or broken, the
 * defaults file unusable, with why. `asked` counts the reads asked for,
 * which numbers them, and `read` is the one whose answer this is: a read no
 * newer than it is dropped when it answers, so an older read never
 * replaces a newer one.
 */
export type SettingsState = Readonly<
  | { tag: "unread"; asked: number }
  | {
      tag: "loaded";
      asked: number;
      read: number;
      settings: Settings;
      effective: readonly string[];
      warnings: readonly string[];
    }
  | { tag: "broken"; asked: number; read: number; problems: readonly string[] }
>;

/**
 * The pane's state, one value that `step` moves: how many presses there
 * have been, which numbers them; Submit; the presses a session's start
 * overtook, which finish as they would have, since a hook already running
 * when the plugin reloads still settles, and what the last of them to end
 * said; the refresh; the raised items; the answers Submit holds Done; the
 * pull requests `gh` said merged, as `owner/repo#N`, a merge staying so
 * none is asked about again; the skill's count line, empty when nothing is
 * open; and the settings.
 */
export type PaneState = Readonly<{
  presses: number;
  submit: Submit;
  overtaken: readonly Press[];
  aside: Aside;
  refresh: Refresh;
  raised: Raised;
  sent: readonly Held[];
  merged: readonly string[];
  counts: string;
  settings: SettingsState;
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
 * what it does, and gives the shape every file is checked against: each
 * setting the type of its default, unless `KINDS` in src/config/config.ts
 * names one.
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
  marks: Readonly<{
    sent: string;
    chosen: string;
    note: string;
    "settled-bar": string;
    collapsed: string;
    expanded: string;
    buttons: Readonly<{
      dismiss: string;
      next: string;
      previous: string;
      submit: string;
      reassess: string;
      help: string;
      kanban: string;
    }>;
  }>;
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
  "roll-up": Readonly<{ "summary-width": number }>;
  lint: Readonly<{ "turn-end": boolean }>;
}>;

/**
 * What the reply lint found in the main loop's last final response, for the
 * next prompt's context: the conversation it was found in, by
 * `conversationKey`, and the note; an empty note when there's none.
 */
export type LintNote = Readonly<{ conversation: string; text: string }>;

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
      expanded: readonly string[];
      focused: string;
      isKeysOpen: boolean;
      draft: string;
      noting: string;
      pane: Shaped<PaneState>;
      instructed: string;
      lintNote: Shaped<LintNote>;
    };
  }
}
