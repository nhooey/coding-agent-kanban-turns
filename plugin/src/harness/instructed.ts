// Whether the agent's instructions still have to reach this conversation,
// read from the session's transcript. No `$`, no I/O: register.tsx reads the
// file and hands its text here. Beside the Claude Code adapter,
// claude-code.ts, this is the one module that reads Claude
// Code's records themselves: what settles items reads neutral turns, and
// this reads the records for a question no turn holds.
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
// The plugin's own skill, PLUGIN_SKILL, holds the same format, so a load of
// it carries the instructions too: the agent's `Skill` tool use naming it,
// in an assistant record, whose tool result, in a user record, isn't an
// error; the command record a user's slash command for it leaves; or the
// `invoked_skills` attachment naming it that Claude Code writes after a
// compaction, which puts the skills loaded before it back in the context.
//
// A conversation starts again at a compaction, a `compact_boundary` record,
// and at `/clear`, whose command record opens the conversation after it.
// What came before is gone from the agent's context, the instructions with
// it, and a load of the skill with it unless the compaction's
// `invoked_skills` attachment, after the boundary, brings the skill back.

import { BLOCK, INSTRUCTIONS, PLUGIN_SKILL } from "../protocol/instructions.ts";
import { recordsOf } from "./claude-code.ts";
import type { TranscriptRecord } from "./claude-code.ts";
import { field } from "../json/fields.ts";

/** What the hook about to add the instructions reads: this conversation's key, and whether they are still owed. */
export type Instructing = Readonly<{ key: string; isOwed: boolean }>;

// The command whose record opens a conversation.
const CLEAR = "/clear";

// The tags a command record opens with, one or the other first, and what
// opens and closes its name.
const COMMAND_OPENINGS: readonly string[] = ["<command-message>", "<command-name>"];
const NAME_OPEN = "<command-name>";
const NAME_CLOSE = "</command-name>";

const listed = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value : [];

/**
 * The name in a command record's `<command-name>` tags, trimmed; undefined
 * where the content, trimmed, doesn't open on a command record's first tag,
 * `<command-message>` or `<command-name>`, or holds no name opened and closed.
 */
export const commandNameOf = (content: string): string | undefined => {
  const trimmed = content.trim();
  const start = COMMAND_OPENINGS.some((tag) => trimmed.startsWith(tag))
    ? trimmed.indexOf(NAME_OPEN)
    : -1;
  const end = start < 0 ? -1 : trimmed.indexOf(NAME_CLOSE, start);

  return end < 0 ? undefined : trimmed.slice(start + NAME_OPEN.length, end).trim();
};

/** The command a user record's command record names, `/clear`; undefined for any other record. */
const commandOf = (record: TranscriptRecord): string | undefined => {
  const content = field(record.message, "content");

  return record.type === "user" && typeof content === "string"
    ? commandNameOf(content)
    : undefined;
};

/** Whether a record is the `/clear` command's own. */
const isClear = (record: TranscriptRecord): boolean => commandOf(record) === CLEAR;

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

// The tool the agent loads a skill with, and the field of its input naming the skill.
const SKILL_TOOL = "Skill";
const SKILL_FIELD = "skill";

// The attachment a compaction writes with the skills loaded before it.
const INVOKED_SKILLS = "invoked_skills";

/** Whether a record is the command record a user's slash command for `skill` leaves. */
export const isSkillCommand = (record: TranscriptRecord, skill: string): boolean =>
  record.isSidechain !== true && commandOf(record) === `/${skill}`;

/** Whether a record is the `invoked_skills` attachment a compaction writes, one of its skills named `skill`. */
export const reattaches = (record: TranscriptRecord, skill: string): boolean =>
  record.type === "attachment" &&
  record.isSidechain !== true &&
  field(record.attachment, "type") === INVOKED_SKILLS &&
  listed(field(record.attachment, "skills")).some(
    (invoked) => field(invoked, "name") === skill,
  );

/** The content blocks of the records of `type` outside a sidechain. */
const blocksOf = (
  records: readonly TranscriptRecord[],
  type: string,
): readonly unknown[] =>
  records
    .filter((record) => record.type === type && record.isSidechain !== true)
    .flatMap((record) => listed(field(record.message, "content")));

/** The ids of the `Skill` tool uses in `records` that name `skill`. */
const skillUseIds = (
  records: readonly TranscriptRecord[],
  skill: string,
): readonly unknown[] =>
  blocksOf(records, "assistant")
    .filter(
      (block) =>
        field(block, "type") === "tool_use" &&
        field(block, "name") === SKILL_TOOL &&
        field(field(block, "input"), SKILL_FIELD) === skill,
    )
    .map((block) => field(block, "id"))
    .filter((id) => typeof id === "string");

/**
 * Whether `records` load `skill`: a `Skill` tool use naming it whose tool
 * result isn't an error, the command record of a user's slash command for
 * it, or a compaction's `invoked_skills` attachment naming it.
 */
export const loadsSkill = (
  records: readonly TranscriptRecord[],
  skill: string,
): boolean => {
  const uses = skillUseIds(records, skill);

  return (
    records.some(
      (record) => isSkillCommand(record, skill) || reattaches(record, skill),
    ) ||
    (uses.length > 0 &&
      blocksOf(records, "user").some(
        (block) =>
          field(block, "type") === "tool_result" &&
          uses.includes(field(block, "tool_use_id")) &&
          field(block, "is_error") !== true,
      ))
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
 * The key of the conversation the transcript at `path`, whose text is
 * `text`, holds now. A `/rewind` writes no boundary, so it keeps the key.
 */
export const conversationKeyOf = (path: string, text: string): string =>
  conversationKey(path, recordsOf(text));

/**
 * Whether the instructions are still owed to the conversation of the
 * transcript at `path`, whose text is `text`: none of its records since the
 * last boundary carries them or loads the plugin's skill, `skill`, and no
 * hook added them under its key, `sent`.
 */
export const instructing = (
  path: string,
  text: string,
  sent: string,
  instructions: string = INSTRUCTIONS,
  skill: string = PLUGIN_SKILL,
): Instructing => {
  const records = recordsOf(text);
  const key = conversationKey(path, records);
  const conversation = conversationOf(records);

  return {
    key,
    isOwed:
      key !== sent &&
      !conversation.some((record) => carries(record, instructions)) &&
      !loadsSkill(conversation, skill),
  };
};
