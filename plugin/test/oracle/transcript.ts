// The differential test's oracle for reading a transcript: Claude Code's
// JSONL records read straight into turns whose prompt is the user's own or
// not, `isOwn`, with no neutral turn between. The adapter in
// src/claude-code-transcript.ts and the core reading its neutral turns must
// give what this gives; test/neutral-turns.test.ts compares them.
//
// Temporary: the oracle and its test are deleted once `protocol-spec-data`
// is rebased onto the neutral turns.

import { PLUGIN, TOOL_CALLED } from "../../src/instructions.ts";
import { commandOf } from "../../src/transcript.ts";

/** One turn as the oracle reads it: `isOwn` where the neutral turn has an owner. */
export type Turn = Readonly<{
  id: string;
  prompt: string;
  isOwn: boolean;
  replies: readonly string[];
  calls: readonly unknown[];
  asides: readonly string[];
  reports: readonly string[];
}>;

type Queued = Readonly<{ isOwn: boolean; text: string }>;

type TranscriptRecord = Readonly<Record<string, unknown>>;

const ORIGINS: readonly unknown[] = ["human", "peer", "task_notification"];
const ID_LENGTH = 8;
const COMMAND_OUTPUT = /^\s*<bash-(?:stdout|stderr)>/;
const QUEUED_OWN = "human";
const QUEUED_REPORTS: readonly unknown[] = ["peer", "task-notification"];

const isObject = (value: unknown): value is TranscriptRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const field = (value: unknown, key: string): unknown =>
  isObject(value) ? value[key] : undefined;

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

const pluginText = (record: TranscriptRecord): string | undefined => {
  const text = field(record.pluginPrompt, "text");

  return typeof text === "string" ? text : undefined;
};

const promptOf = (record: TranscriptRecord): string =>
  pluginText(record) ?? textOf(contentOf(record));

const isPrompt = (record: TranscriptRecord): boolean =>
  record.type === "user" &&
  (ORIGINS.includes(record.turnOrigin) || pluginText(record) !== undefined) &&
  record.isSidechain !== true &&
  record.isCompactSummary !== true &&
  !COMMAND_OUTPUT.test(promptOf(record));

const isOwnPrompt = (record: TranscriptRecord): boolean =>
  pluginText(record) === undefined
    ? record.turnOrigin === "human"
    : field(record.pluginPrompt, "name") === PLUGIN;

const queuedOf = (record: TranscriptRecord): Queued | undefined => {
  const attachment = record.attachment;
  const text = field(attachment, "prompt");
  const kind = field(field(attachment, "origin"), "kind");

  return record.type === "attachment" &&
    record.isSidechain !== true &&
    field(attachment, "type") === "queued_command" &&
    (kind === QUEUED_OWN || QUEUED_REPORTS.includes(kind)) &&
    typeof text === "string"
    ? { isOwn: kind === QUEUED_OWN, text }
    : undefined;
};

const isReply = (record: TranscriptRecord): boolean =>
  record.type === "assistant" && record.isSidechain !== true;

const callsOf = (record: TranscriptRecord): readonly unknown[] => {
  const content = contentOf(record);

  return Array.isArray(content)
    ? content
        .filter(
          (block) =>
            field(block, "type") === "tool_use" &&
            field(block, "name") === TOOL_CALLED,
        )
        .map((block) => field(block, "input"))
    : [];
};

type Opened = Readonly<{ promptId: string; turn: Turn }>;

const opened = (record: TranscriptRecord): Opened => {
  const promptId = typeof record.promptId === "string" ? record.promptId : "";

  return {
    promptId,
    turn: {
      id: promptId.slice(0, ID_LENGTH),
      prompt: promptOf(record),
      isOwn: isOwnPrompt(record),
      replies: [],
      calls: [],
      asides: [],
      reports: [],
    },
  };
};

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
  const text = textOf(contentOf(record));
  const queued = queuedOf(record);

  return isPrompt(record)
    ? [...turns, opened(record)]
    : isReply(record)
      ? withLast(turns, (turn) => ({
          ...turn,
          replies: text.trim() === "" ? turn.replies : [...turn.replies, text],
          calls: [...turn.calls, ...callsOf(record)],
        }))
      : queued === undefined
        ? turns
        : withLast(turns, (turn) =>
            queued.isOwn
              ? { ...turn, asides: [...turn.asides, queued.text] }
              : { ...turn, reports: [...turn.reports, queued.text] },
          );
};

const mergeRepeats = (turns: readonly Opened[]): readonly Turn[] => {
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
        calls: repeats.flatMap((other) => other.turn.calls),
        asides: repeats.flatMap((other) => other.turn.asides),
        reports: repeats.flatMap((other) => other.turn.reports),
      };
    });
};

/** The turns of the transcript's records, oldest first. */
export const turnsOf = (records: readonly TranscriptRecord[]): readonly Turn[] =>
  mergeRepeats(records.reduce(step, [] as readonly Opened[]));

/** The place of the latest `reassess` turn of the user's own; else 0. */
export const reassessStart = (turns: readonly Turn[]): number =>
  Math.max(
    turns.findLastIndex(
      (turn) => turn.isOwn && commandOf(turn.prompt) === "reassess",
    ),
    0,
  );
