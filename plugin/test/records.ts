// Transcript records for the tests, shaped like the ones Claude Code writes
// to a session's JSONL file, trimmed to the fields that matter and with
// made-up content.

import { TOOL_CALLED } from "../src/instructions.ts";
import type { TranscriptRecord } from "../src/transcript.ts";

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

/** A prompt a mod submitted, as the engine records it: its text in `pluginPrompt`, the engine's words round it in the message. */
export const pluginPrompt = (id: string, text: string): TranscriptRecord =>
  user(
    {
      promptId: promptId(id),
      turnOrigin: "system",
      pluginPrompt: { name: "coding-agent-kanban-turns", text },
    },
    `The coding-agent-kanban-tur… plugin sent a message:\n${text}\n\nThis is how Claude Code surfaces a prompt a plugin submits between turns — it starts this turn in the user's place. Address the message above.`,
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
