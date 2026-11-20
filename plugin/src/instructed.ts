// Whether the agent's instructions still have to reach this conversation,
// read from the session's transcript. No `$`, no I/O: register.tsx reads the
// file and hands its text here.
//
// They reach the agent by one of two routes. This plugin's `prompt.context`
// hook adds them to the context the engine prepends to the first message,
// which the transcript keeps as a `context_sections` attachment, a section
// named BLOCK. A plugin seated above may send `prompt.context` on past every
// plugin a person installs, as cc-plugin-sec-default does on a machine with
// managed settings; then the `prompt.submit` hook puts them in the prompt's
// context, which the transcript keeps as a `hook_additional_context`
// attachment. Either way they hold the instructions' text as it is.
//
// A conversation starts again at a compaction, a `compact_boundary` record,
// and at `/clear`, whose command record opens the conversation after it.
// What came before is gone from the agent's context, the instructions with it.

import { BLOCK, INSTRUCTIONS } from "./instructions.ts";
import { recordsOf } from "./transcript.ts";
import type { TranscriptRecord } from "./transcript.ts";

/** What the hook about to add the instructions reads: this conversation's key, and whether they are still owed. */
export type Instructing = Readonly<{ key: string; isOwed: boolean }>;

// The command record `/clear` leaves, which opens a conversation.
const CLEAR = /^\s*<command-name>\/clear<\/command-name>/;

const isObject = (value: unknown): value is TranscriptRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const field = (value: unknown, key: string): unknown =>
  isObject(value) ? value[key] : undefined;

const listed = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value : [];

/** Whether a record is the `/clear` command's own. */
const isClear = (record: TranscriptRecord): boolean => {
  const content = field(record.message, "content");

  return record.type === "user" && typeof content === "string" && CLEAR.test(content);
};

/** Whether a record opens a new conversation: a compaction's boundary, or `/clear`. */
export const isBoundary = (record: TranscriptRecord): boolean =>
  record.isSidechain !== true &&
  ((record.type === "system" && record.subtype === "compact_boundary") ||
    isClear(record));

/** The records of the conversation the agent has now: those after the last boundary. */
export const conversationOf = (
  records: readonly TranscriptRecord[],
): readonly TranscriptRecord[] =>
  records.slice(records.findLastIndex(isBoundary) + 1);

/** Whether a record brought the agent `text`, through the context's section or a prompt's context. */
export const carries = (record: TranscriptRecord, text: string): boolean => {
  const attachment = record.attachment;
  const kind = field(attachment, "type");

  return (
    record.type === "attachment" &&
    record.isSidechain !== true &&
    (kind === "context_sections"
      ? listed(field(attachment, "sections")).some(
          (section) =>
            field(section, "name") === BLOCK && field(section, "text") === text,
        )
      : kind === "hook_additional_context" &&
        listed(field(attachment, "content")).includes(text))
  );
};

/**
 * The conversation's key: the transcript's path and how many conversations
 * it held before this one. A hook that adds the instructions keeps it, so
 * the other route, raised before the transcript shows them, adds none.
 */
export const conversationKey = (
  path: string,
  records: readonly TranscriptRecord[],
): string => `${path}#${records.filter(isBoundary).length}`;

/**
 * Whether the instructions are still owed to the conversation of the
 * transcript at `path`, whose text is `text`: none of its records since the
 * last boundary carries them, and no hook added them under its key, `sent`.
 */
export const instructing = (
  path: string,
  text: string,
  sent: string,
  instructions: string = INSTRUCTIONS,
): Instructing => {
  const records = recordsOf(text);
  const key = conversationKey(path, records);

  return {
    key,
    isOwed:
      key !== sent &&
      !conversationOf(records).some((record) => carries(record, instructions)),
  };
};
