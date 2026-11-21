// Transcript records for the tests, shaped like the ones Claude Code writes
// to a session's JSONL file, trimmed to the fields that matter and with
// made-up content.

import { isObject } from "../../src/json/fields.ts";
import { PLUGIN, TOOL_CALLED } from "../../src/protocol/instructions.ts";
import type { TranscriptRecord } from "../../src/transcript/claude-code.ts";
import type { Message, Owner, Turn } from "../../types/index.d.ts";

/** A whole prompt id from the 8 characters a turn id holds; empty stays empty. */
export const promptId = (id: string): string =>
  id === "" ? "" : `${id}-0000-4000-8000-000000000000`;

const user = (fields: TranscriptRecord, content: unknown): TranscriptRecord => ({
  parentUuid: "0fa32e64-5bf1-458a-9954-f210f15edcf9",
  isSidechain: false,
  type: "user",
  message: { role: "user", content },
  uuid: "6547bacb-17f6-4b54-8a7b-91285c40a736",
  timestamp: "2026-11-16T20:06:00.270Z",
  ...fields,
});

/** A prompt the user typed. */
export const human = (id: string, text: string): TranscriptRecord =>
  user(
    {
      promptId: promptId(id),
      turnOrigin: "human",
      origin: { kind: "human" },
      promptSource: "typed",
      turnPosition: { promptIndex: 1, turnIndex: 2 },
    },
    text,
  );

/** Another session's message, or an agent's: a prompt in the user's place, though not the user's. */
export const peer = (id: string, text: string): TranscriptRecord =>
  user(
    {
      promptId: promptId(id),
      turnOrigin: "peer",
      isMeta: true,
      origin: { kind: "peer", from: "uds:/tmp/x.sock", name: "Other session" },
    },
    text,
  );

/** A task notification, which opens a turn of its own. */
export const notification = (id: string, text: string): TranscriptRecord =>
  user(
    {
      promptId: promptId(id),
      turnOrigin: "task_notification",
      origin: { kind: "task-notification" },
    },
    text,
  );

/**
 * A prompt a plugin submitted in its own name, this plugin unless `name`
 * says another, as the engine records it: its text in `pluginPrompt`, the
 * engine's words round it in the message.
 */
export const pluginPrompt = (
  id: string,
  text: string,
  name = PLUGIN,
): TranscriptRecord =>
  user(
    {
      promptId: promptId(id),
      origin: { kind: "plugin", name },
      promptSource: "system",
      turnOrigin: "system",
      promptRewritten: true,
      pluginPrompt: { name, text },
    },
    `The ${name.slice(0, 23)}… plugin sent a message:\n${text}\n\nThis is how Claude Code surfaces a prompt a plugin submits between turns — it starts this turn in the user's place. Address the message above.`,
  );

/** Another plugin's prompt, which is never the user's own text. */
export const otherPluginPrompt = (id: string, text: string): TranscriptRecord =>
  pluginPrompt(id, text, "other-mod");

/**
 * A prompt a plugin submitted as the user, `$.prompt.submit({ asUser: true })`,
 * as this plugin's Submit and Reassess send the draft: the text as it is,
 * and the plugin named only in `origin`.
 */
export const submitted = (
  id: string,
  text: string,
  name = PLUGIN,
): TranscriptRecord =>
  user(
    {
      promptId: promptId(id),
      origin: { kind: "plugin", name, asUser: true },
      promptSource: "system",
      turnOrigin: "system",
      queuePriority: "later",
    },
    text,
  );

/** A meta message a plugin adds to the context, such as the terminal's width, which opens no turn. */
export const pluginRow = (text: string, name = "terminal-width"): TranscriptRecord =>
  user(
    { promptId: promptId("0000aaaa"), isMeta: true, origin: { kind: "plugin", name } },
    [{ type: "text", text }],
  );

/** A prompt a headless run's caller sent, which opens no turn. */
export const sdkPrompt = (id: string, text: string): TranscriptRecord =>
  user({ promptId: promptId(id), promptSource: "sdk", turnOrigin: "sdk" }, text);

/**
 * A scheduled prompt, a `/loop` wakeup or a `ScheduleWakeup`, unless
 * `wakeupSource` says another: a meta message with no `origin`, its stored
 * prompt the message.
 */
export const scheduled = (
  id: string,
  text: string,
  wakeupSource = "schedule_wakeup",
): TranscriptRecord =>
  user(
    {
      promptId: promptId(id),
      isMeta: true,
      promptSource: "system",
      turnOrigin: "scheduled",
      wakeupSource,
    },
    text,
  );

/** A compaction's summary, recorded with the turn's own origin. */
export const compactSummary = (id: string): TranscriptRecord =>
  user(
    {
      promptId: promptId(id),
      turnOrigin: "human",
      isCompactSummary: true,
      isVisibleInTranscriptOnly: true,
    },
    "This session is being continued from a previous conversation that ran out of context.",
  );

/** A user record with no turn origin: a reminder, a skill's body, a local command and its output. */
export const engineRow = (
  text: string,
  fields: TranscriptRecord = {},
): TranscriptRecord => user({ promptId: promptId("0000aaaa"), ...fields }, text);

/** A skill's body, which the engine sends as a meta message after the Skill tool runs. */
export const skillBody = (): TranscriptRecord =>
  user(
    { promptId: promptId("0000aaaa"), isMeta: true, sourceToolUseID: "toolu_01" },
    [{ type: "text", text: "Base directory for this skill: /x\n\n1. A\nDecide.1: B" }],
  );

/** A command's output, which the engine records as a human prompt. */
export const commandOutput = (id: string): TranscriptRecord =>
  user(
    { promptId: promptId(id), turnOrigin: "human" },
    "<bash-stdout>1. A</bash-stdout><bash-stderr></bash-stderr>",
  );

/** A tool's result, a user record that opens no turn. */
export const toolResult = (): TranscriptRecord =>
  user({ promptId: promptId("0000aaaa") }, [
    { tool_use_id: "toolu_01", type: "tool_result", content: "ok" },
  ]);

/** An assistant record: its text, and a `kanban_options` call for each of `calls`. */
export const assistant = (
  text: string,
  calls: readonly unknown[] = [],
  fields: TranscriptRecord = {},
): TranscriptRecord => ({
  parentUuid: "29987975-e52f-4287-8fac-ee0dbb349382",
  isSidechain: false,
  type: "assistant",
  message: {
    role: "assistant",
    content: [
      { type: "text", text },
      { type: "tool_use", id: "toolu_02", name: "Bash", input: { command: "ls" } },
      ...calls.map((input) => ({
        type: "tool_use",
        id: "toolu_03",
        name: TOOL_CALLED,
        input,
      })),
    ],
  },
  uuid: "55f4a48a-7d07-4d12-9287-5989422d4dc0",
  timestamp: "2026-11-16T20:06:30.000Z",
  ...fields,
});

/** A message sent while a turn ran, as the file keeps it: a `queued_command` attachment. */
export const queued = (text: string, kind = "human"): TranscriptRecord => ({
  parentUuid: "29987975-e52f-4287-8fac-ee0dbb349382",
  isSidechain: false,
  type: "attachment",
  attachment: {
    type: "queued_command",
    prompt: text,
    origin: { kind },
    commandMode: "prompt",
  },
  uuid: "77aa0c3f-9e2b-4d81-a1c3-5e1d0c3f9e00",
  timestamp: "2026-11-16T20:06:10.000Z",
});

/** The records as the file holds them, one JSON object a line. */
export const jsonl = (records: readonly TranscriptRecord[]): string =>
  records.map((record) => `${JSON.stringify(record)}\n`).join("");

/** The record each writer's prompt opens a turn on. */
const PROMPTS: Readonly<Record<Owner, (id: string, text: string) => TranscriptRecord>> = {
  user: human,
  "this-plugin": submitted,
  "other-plugin": otherPluginPrompt,
  peer,
  notification,
  scheduled,
};

/** The origin's kind a message sent while a turn ran carries, by who sent it; the engine queues no other's. */
const QUEUED_KINDS: Readonly<Partial<Record<Owner, string>>> = {
  user: "human",
  peer: "peer",
  notification: "task-notification",
};

const queuedBy = (message: Message): TranscriptRecord => {
  const kind = QUEUED_KINDS[message.owner];

  if (kind === undefined) {
    throw new Error(`Claude Code queues no message of a ${message.owner}'s`);
  }

  return queued(message.text, kind);
};

/** An assistant record whose response stopped for `reason`, as the engine writes each record of a response. */
export const stoppedFor = (reason: string, record: TranscriptRecord): TranscriptRecord => ({
  ...record,
  message: { ...(isObject(record.message) ? record.message : {}), stop_reason: reason },
});

/**
 * The record the engine writes when the user interrupts a response, the
 * Escape key: `[Request interrupted by user]` while it wrote, or `… for tool
 * use]` while a tool ran. It opens no turn.
 */
export const interrupted = (isForTool = false): TranscriptRecord =>
  user(
    { promptId: promptId("0000aaaa"), interruptedMessageId: "msg_011ChBhXUXJzGAmnihSJKbea" },
    [{ type: "text", text: `[Request interrupted by user${isForTool ? " for tool use" : ""}]` }],
  );

/** A tool's result when the user stopped the tool, which the engine writes before `interrupted(true)`. */
export const toolRejected = (): TranscriptRecord =>
  user({ promptId: promptId("0000aaaa") }, [
    {
      tool_use_id: "toolu_02",
      type: "tool_result",
      content: "The user doesn't want to proceed with this tool use. The tool use was rejected.",
      is_error: true,
    },
  ]);

/** The record the engine writes in the model's place for an API error: its model `<synthetic>`, its stop reason `stop_sequence`. */
export const apiError = (text: string): TranscriptRecord => ({
  parentUuid: "29987975-e52f-4287-8fac-ee0dbb349382",
  isSidechain: false,
  type: "assistant",
  message: {
    role: "assistant",
    model: "<synthetic>",
    stop_reason: "stop_sequence",
    content: [{ type: "text", text }],
  },
  isApiErrorMessage: true,
  uuid: "88bb1d40-af93-4c2e-b2d4-6f2e1d4fa011",
  timestamp: "2026-11-16T20:06:40.000Z",
});

/** The boundary a compaction writes before its summary. */
export const compactBoundary = (): TranscriptRecord => ({
  parentUuid: null,
  isSidechain: false,
  type: "system",
  subtype: "compact_boundary",
  content: "Conversation compacted",
  uuid: "99cc2e51-b0a4-4d3f-83e5-7a3f2e5ab122",
  timestamp: "2026-11-16T20:07:00.000Z",
});

/**
 * The records Claude Code would write for neutral turns, for the adapter
 * to read back: each turn's prompt, by who wrote it, the messages sent
 * while it ran, a record whose `kanban_options` call raises its Decide
 * items, and a record for each reply. Each response stops to call a tool
 * but the turn's last, which ends the turn, or, for an unanswered turn,
 * stops for a tool too. A report's names are left for the adapter to read
 * from its text.
 */
export const recordsOfTurns = (turns: readonly Turn[]): readonly TranscriptRecord[] =>
  turns.flatMap((turn) => {
    const responses = [
      ...(turn.decide.length === 0 ? [] : [assistant("", [{ items: turn.decide }])]),
      ...turn.replies.map((reply) => assistant(reply)),
    ];

    return [
      PROMPTS[turn.prompt.owner](turn.id, turn.prompt.text),
      ...turn.messages.map(queuedBy),
      ...responses.map((record, n) =>
        stoppedFor(
          n === responses.length - 1 && turn.unanswered !== true ? "end_turn" : "tool_use",
          record,
        ),
      ),
    ];
  });
