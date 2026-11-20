// The Claude Code adapter: the session's JSONL transcript read into neutral
// turns, and where that transcript lies. Every reading of a Claude Code
// record that settles items is here: whose a prompt is, the names a report
// goes by, the Decide items a tool call raised. The core reads only the
// turns. instructed.ts reads the same records for one other question,
// whether the agent's instructions reached the conversation. No `$`, no
// I/O: register.tsx reads the file and hands its text here.
//
// A turn opens on a `user` record, not a sidechain, not a compaction's
// summary and not a shell command's output, that one of these wrote:
//
// - the user: `turnOrigin` `human`;
// - a peer, an agent's or another session's message: `turnOrigin` `peer`;
// - a task's notification: `turnOrigin` `task_notification`;
// - a plugin: a `pluginPrompt`, read as the text it sent, for a prompt sent
//   in the plugin's own name; else an `origin` of kind `plugin`, read as
//   the message, for one sent as the user, as this plugin's Submit and
//   Reassess send theirs. A plugin's meta message with no `turnOrigin`,
//   such as the terminal's width, opens none.
//
// Any other `turnOrigin` opens no turn: a headless run's prompt, `sdk`, a
// scheduled one, or a system prompt no plugin names.
//
// A turn's id is the record's `promptId` cut to the spec's turn-id
// length. Its replies are the text blocks of the assistant records up to
// the next prompt, and its Decide items those of the `kanban_options`
// inputs among their tool uses. A message sent while it ran is a `queued_command`
// attachment: the user's, a peer's or a task's. A prompt record the file
// repeats, as a continuation does, folds its replies into the first.

import { itemsOf } from "./items.ts";
import { PLUGIN, TOOL_CALLED } from "./instructions.ts";
import { elements } from "./reports.ts";
import { SPEC } from "./spec.ts";
import type { DecideItem, Message, Owner, Turn } from "../types/index.d.ts";

/** One record of the transcript, a JSON object; only what the plugin reads is looked at. */
export type TranscriptRecord = Readonly<Record<string, unknown>>;

// Who wrote a prompt no plugin sent, by the record's `turnOrigin`.
const ORIGIN_OWNERS: ReadonlyMap<unknown, Owner> = new Map([
  ["human", "user"],
  ["peer", "peer"],
  ["task_notification", "notification"],
]);
// Who sent a queued message, by its origin's kind.
const QUEUED_OWNERS: ReadonlyMap<unknown, Owner> = new Map([
  ["human", "user"],
  ["peer", "peer"],
  ["task-notification", "notification"],
]);
// The origin's kind a plugin's prompt carries.
const PLUGIN_ORIGIN = "plugin";
// A turn id: the first characters of the prompt's `promptId`.
const ID_LENGTH = SPEC.reference["turn-id"].length;
// A shell command's output, which the engine records as a human prompt,
// though it opens no turn.
const COMMAND_OUTPUT = /^\s*<bash-(?:stdout|stderr)>/;
// A task notification reports a finished task by its status, unless its
// agent still waits on work of its own; a Monitor reports its end in its
// event.
const DONE_STATUSES: readonly string[] = [
  "completed",
  "failed",
  "killed",
  "stopped",
  "cancelled",
];
const STILL_WAITING = "is waiting on its own background work";
const MONITOR_ENDED = "[Monitor expired";
const QUOTED = /"([^"]+)"/g;

const isObject = (value: unknown): value is TranscriptRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parsed = (line: string): unknown => {
  try {
    return JSON.parse(line) as unknown;
  } catch {
    return undefined;
  }
};

/**
 * The records of a transcript's text, in order: one JSON object a line. A
 * line that is no JSON object is skipped, such as the last one, cut short
 * while the engine still writes it.
 */
export const recordsOf = (text: string): readonly TranscriptRecord[] =>
  text.split("\n").flatMap((line) => {
    const value = line.trim() === "" ? undefined : parsed(line);

    return isObject(value) ? [value] : [];
  });

const field = (value: unknown, key: string): unknown =>
  isObject(value) ? value[key] : undefined;

/** A message's text: the string it is, or its text blocks joined by newlines. */
const textOf = (content: unknown): string =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content
          .filter((block) => field(block, "type") === "text")
          .map((block) => {
            const text = field(block, "text");

            return typeof text === "string" ? text : "";
          })
          .join("\n")
      : "";

const contentOf = (record: TranscriptRecord): unknown =>
  field(record.message, "content");

/** The text a plugin's prompt sent in its own name, or undefined where the record carries none. */
const pluginText = (record: TranscriptRecord): string | undefined => {
  const text = field(record.pluginPrompt, "text");

  return typeof text === "string" ? text : undefined;
};

/** A prompt's text: a plugin's as it sent it, not as the engine words it round. */
const promptOf = (record: TranscriptRecord): string =>
  pluginText(record) ?? textOf(contentOf(record));

/** This plugin or another, by the name a plugin's prompt carries. */
const pluginOwner = (name: unknown): Owner =>
  name === PLUGIN ? "this-plugin" : "other-plugin";

/** Whether a record is a plugin's prompt sent as the user: an `origin` of kind `plugin`, and no meta message. */
const isSentAsUser = (record: TranscriptRecord): boolean =>
  field(record.origin, "kind") === PLUGIN_ORIGIN &&
  (record.turnOrigin !== undefined || record.isMeta !== true);

/**
 * Who wrote a prompt record, read from whatever names it: its
 * `pluginPrompt`, its plugin `origin` or its `turnOrigin`; undefined where
 * none names a writer that opens a turn. A `pluginPrompt` whose text isn't
 * text names none.
 */
const writerOf = (record: TranscriptRecord): Owner | undefined =>
  record.pluginPrompt !== undefined
    ? pluginText(record) === undefined
      ? undefined
      : pluginOwner(field(record.pluginPrompt, "name"))
    : isSentAsUser(record)
      ? pluginOwner(field(record.origin, "name"))
      : ORIGIN_OWNERS.get(record.turnOrigin);

/** Who wrote the prompt a record opens a turn on; undefined where it opens none. */
export const promptOwnerOf = (record: TranscriptRecord): Owner | undefined =>
  record.type === "user" &&
  record.isSidechain !== true &&
  record.isCompactSummary !== true &&
  !COMMAND_OUTPUT.test(promptOf(record))
    ? writerOf(record)
    : undefined;

/** Whether a record opens a turn. */
export const isPrompt = (record: TranscriptRecord): boolean =>
  promptOwnerOf(record) !== undefined;

/**
 * The names a report goes by, where a text is one: the sending session's
 * name, the agent's id, or a finished task's id and the quoted names in its
 * summary. Undefined where the text is no report, such as a notification
 * for a task still running or a Monitor's event.
 */
export const reportNames = (text: string): readonly string[] | undefined => {
  const found = text.includes("<") ? elements(text) : [];
  const first = (tag: string) => found.find((element) => element.tag === tag);
  const summary = first("summary")?.text ?? "";
  const isFinished =
    (DONE_STATUSES.includes((first("status")?.text ?? "").toLowerCase()) &&
      !summary.includes(STILL_WAITING)) ||
    (first("event")?.text ?? "").startsWith(MONITOR_ENDED);
  const session = first("cross-session-message");
  const agent = first("agent-message");

  return session !== undefined
    ? [session.attrs["from-name"] ?? ""]
    : agent !== undefined
      ? [agent.attrs["from"] ?? ""]
      : first("task-notification") !== undefined && isFinished
        ? [
            first("task-id")?.text ?? "",
            ...[...summary.matchAll(QUOTED)].map((m) => m[1] ?? ""),
          ]
        : undefined;
};

/** A message: who wrote it, its text, and the names it goes by where it's a report. */
export const messageOf = (owner: Owner, text: string): Message => ({
  owner,
  text,
  reportNames: reportNames(text),
});

/** A message sent while a turn ran, or undefined where the record is none. */
export const queuedOf = (record: TranscriptRecord): Message | undefined => {
  const attachment = record.attachment;
  const text = field(attachment, "prompt");
  const owner = QUEUED_OWNERS.get(field(field(attachment, "origin"), "kind"));

  return record.type === "attachment" &&
    record.isSidechain !== true &&
    field(attachment, "type") === "queued_command" &&
    owner !== undefined &&
    typeof text === "string"
    ? messageOf(owner, text)
    : undefined;
};

const isReply = (record: TranscriptRecord): boolean =>
  record.type === "assistant" && record.isSidechain !== true;

/** The Decide items of the `kanban_options` inputs among an assistant record's tool uses. */
export const decideOf = (record: TranscriptRecord): readonly DecideItem[] => {
  const content = contentOf(record);

  return Array.isArray(content)
    ? content
        .filter(
          (block) =>
            field(block, "type") === "tool_use" &&
            field(block, "name") === TOOL_CALLED,
        )
        .flatMap((block) => itemsOf(field(block, "input")))
    : [];
};

/** A turn as it's read, with the whole `promptId` a repeat is matched by. */
type Opened = Readonly<{ promptId: string; turn: Turn }>;

const opened = (record: TranscriptRecord, owner: Owner): Opened => {
  const promptId = typeof record.promptId === "string" ? record.promptId : "";

  return {
    promptId,
    turn: {
      id: promptId.slice(0, ID_LENGTH),
      prompt: messageOf(owner, promptOf(record)),
      replies: [],
      decide: [],
      messages: [],
    },
  };
};

/** The turns read so far with the last one's turn changed by `change`. */
const withLast = (
  turns: readonly Opened[],
  change: (turn: Turn) => Turn,
): readonly Opened[] => {
  const last = turns.at(-1);

  return last === undefined
    ? turns
    : [...turns.slice(0, -1), { ...last, turn: change(last.turn) }];
};

const step = (
  turns: readonly Opened[],
  record: TranscriptRecord,
): readonly Opened[] => {
  const owner = promptOwnerOf(record);
  const text = textOf(contentOf(record));
  const queued = queuedOf(record);

  return owner !== undefined
    ? [...turns, opened(record, owner)]
    : isReply(record)
      ? withLast(turns, (turn) => ({
          ...turn,
          replies: text.trim() === "" ? turn.replies : [...turn.replies, text],
          decide: [...turn.decide, ...decideOf(record)],
        }))
      : queued === undefined
        ? turns
        : withLast(turns, (turn) => ({
            ...turn,
            messages: [...turn.messages, queued],
          }));
};

/**
 * One turn per prompt id: a prompt record the file repeats, as a
 * continuation does, folds its replies, Decide items and messages into the
 * first's.
 */
const mergeRepeats = (turns: readonly Opened[]): readonly Turn[] => {
  // Built from the last turn back, so each id keeps its first place.
  const first = new Map(
    turns.map((opened, n) => [opened.promptId, n] as const).reverse(),
  );

  return turns
    .filter((opened, n) => first.get(opened.promptId) === n)
    .map(({ promptId, turn }) => {
      const repeats = turns.filter((other) => other.promptId === promptId);

      return {
        ...turn,
        replies: repeats.flatMap((other) => other.turn.replies),
        decide: repeats.flatMap((other) => other.turn.decide),
        messages: repeats.flatMap((other) => other.turn.messages),
      };
    });
};

/** The turns of the transcript's records, oldest first. */
export const turnsOf = (records: readonly TranscriptRecord[]): readonly Turn[] =>
  mergeRepeats(records.reduce(step, [] as readonly Opened[]));

/** The turns of a transcript's text. */
export const turnsOfText = (text: string): readonly Turn[] =>
  turnsOf(recordsOf(text));

/**
 * The project folder a session's transcript lies in: the working directory,
 * a worktree's main checkout in place of the worktree, with each `/` and `.`
 * a `-`.
 */
export const projectSlug = (cwd: string): string =>
  cwd
    .replace(/\/(?:\.worktrees|\.claude\/worktrees)\/.*$/, "")
    .replace(/[/.]/g, "-");

/** Where a session's transcript lies, when the engine doesn't say: under the home's `.claude/projects`. */
export const transcriptPathFor = (
  home: string,
  cwd: string,
  session: string,
): string => `${home}/.claude/projects/${projectSlug(cwd)}/${session}.jsonl`;
