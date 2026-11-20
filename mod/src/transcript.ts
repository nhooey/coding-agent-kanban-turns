// The session's turns, read from its transcript file, and the sections of a
// reply: the kanban skill's `reply_turns.py`, in TypeScript. No `$`, no I/O:
// register.tsx reads the file and hands its text here.
//
// The transcript is Claude Code's own JSONL file, one record a line, the
// same file and the same reading as the skill's Python. A turn opens on a
// `user` record whose `turnOrigin` is `human`, `peer` (an agent's or another
// session's message) or `task_notification`, or that carries `pluginPrompt`
// (a prompt a mod submitted, such as Reassess, read as the text it sent),
// not a sidechain, not a compaction's summary and not a shell command's
// output. Its id is the first 8 characters of the record's `promptId`. Its
// replies are the text blocks of the assistant records up to the next
// prompt, and its calls the `kanban_options` inputs among their tool uses.
// A message sent while it ran is a `queued_command` attachment: the user's
// is one of its asides, and an agent's, another session's or a task
// notification one of its reports. A prompt record the file repeats, as a
// continuation does, folds its replies into the first.
//
// Only a prompt the user typed is their own text: a report, a notification
// and a mod's prompt are not, and answer nothing.

import { PLUGIN, TOOL_CALLED } from "./instructions.ts";

/**
 * One turn, as a reader of the transcript builds it: its id, its prompt,
 * whether that prompt is the user's own text, its replies' texts, its
 * `kanban_options` inputs, what the user sent while it ran, and the reports
 * that came in while it ran. What settles an item reads only this.
 */
export type Turn = Readonly<{
  id: string;
  prompt: string;
  isOwn: boolean;
  /** Whether the prompt may be a command, such as `reassess`: the user's own, or this mod's Reassess. */
  canCommand: boolean;
  replies: readonly string[];
  calls: readonly unknown[];
  asides: readonly string[];
  reports: readonly string[];
}>;

/** A message sent while a turn ran: the user's own, or a report from an agent, another session or a task. */
export type Queued = Readonly<{ isOwn: boolean; text: string }>;

/** One record of the transcript, a JSON object; only what the mod reads is looked at. */
export type TranscriptRecord = Readonly<Record<string, unknown>>;

/** One section of a reply: its list's name as the header writes it, and its text, the header first. */
export type Section = Readonly<{ name: string; text: string }>;

/** Each list header followed by its aliases, the names older replies in a transcript still carry. */
export const SECTION_NAMES = [
  "Answers",
  "Questions",
  "Done",
  "Pending",
  "Unfinished",
  "Open",
  "Logged",
  "Waiting",
  "Authorizations",
  "Review",
  "To review",
  "Todo",
  "To do",
  "Decide",
  "Decisions",
  "Blocked",
] as const;

/** The Decide list's names, the first its own. */
export const DECISIONS: readonly string[] = ["Decide", "Decisions", "Blocked"];

/** A list's header line: any glyph, then its name in bold with a colon. */
export const HEADER = new RegExp(
  String.raw`^\s*\S+\s+\*\*(${SECTION_NAMES.join("|")}):\*\*`,
);
// The line older replies opened their roll-up with, which ends a section.
const STOP = "Still open from earlier";
// One per column under a topic header, in a reply grouped by topic.
const TOPIC_RULE = "═";

// The prompts that open a turn, by the record's `turnOrigin`.
const ORIGINS: readonly unknown[] = ["human", "peer", "task_notification"];
// A turn id: the first characters of the prompt's `promptId`.
const ID_LENGTH = 8;
// A shell command's output, which the engine records as a human prompt,
// though it opens no turn.
const COMMAND_OUTPUT = /^\s*<bash-(?:stdout|stderr)>/;
// Who sent a queued message, by its origin's kind: the user, or a report's sender.
const QUEUED_OWN = "human";
const QUEUED_REPORTS: readonly unknown[] = ["peer", "task-notification"];

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

/** The text a mod's prompt sent, or undefined where the record is none. */
const pluginText = (record: TranscriptRecord): string | undefined => {
  const text = field(record.pluginPrompt, "text");

  return typeof text === "string" ? text : undefined;
};

/** A prompt's text: a mod's as it sent it, not as the engine words it round. */
const promptOf = (record: TranscriptRecord): string =>
  pluginText(record) ?? textOf(contentOf(record));

/** Whether a record opens a turn. */
export const isPrompt = (record: TranscriptRecord): boolean =>
  record.type === "user" &&
  (ORIGINS.includes(record.turnOrigin) || pluginText(record) !== undefined) &&
  record.isSidechain !== true &&
  record.isCompactSummary !== true &&
  !COMMAND_OUTPUT.test(promptOf(record));

/** Whether a prompt is the user's own text: typed by them, no mod's prompt. */
export const isOwnPrompt = (record: TranscriptRecord): boolean =>
  record.turnOrigin === "human" && pluginText(record) === undefined;

/** Whether a prompt may be a command: the user's own, or one this mod submitted, as the engine names it in `pluginPrompt`. */
export const canCommand = (record: TranscriptRecord): boolean =>
  isOwnPrompt(record) ||
  (pluginText(record) !== undefined && field(record.pluginPrompt, "name") === PLUGIN);

/** A message sent while a turn ran, the user's or a report, or undefined where the record is none. */
export const queuedOf = (record: TranscriptRecord): Queued | undefined => {
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

/** The `kanban_options` inputs among an assistant record's tool uses. */
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

/** A turn as it's read, with the whole `promptId` a repeat is matched by. */
type Opened = Readonly<{ promptId: string; turn: Turn }>;

const opened = (record: TranscriptRecord): Opened => {
  const promptId = typeof record.promptId === "string" ? record.promptId : "";

  return {
    promptId,
    turn: {
      id: promptId.slice(0, ID_LENGTH),
      prompt: promptOf(record),
      isOwn: isOwnPrompt(record),
      canCommand: canCommand(record),
      replies: [],
      calls: [],
      asides: [],
      reports: [],
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

/**
 * One turn per prompt id: a prompt record the file repeats, as a
 * continuation does, folds its replies, calls, asides and reports into the
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
        calls: repeats.flatMap((other) => other.turn.calls),
        asides: repeats.flatMap((other) => other.turn.asides),
        reports: repeats.flatMap((other) => other.turn.reports),
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

/** The offsets of the reads, `chunk` bytes each, that cover a file of `size` bytes. */
export const chunkOffsets = (size: number, chunk: number): readonly number[] =>
  Array.from({ length: Math.ceil(Math.max(size, 0) / chunk) }, (_, n) => n * chunk);

/**
 * `Uint8Array` with `fromBase64`, which gives the bytes of standard base64,
 * as `$.fs.read` answers with them: Node and the engine have it, though the
 * ES2023 library the type checks read doesn't yet, and the engine's type
 * contract may not add it to the global scope.
 */
const BYTES = Uint8Array as unknown as Readonly<{
  fromBase64: (base64: string) => Uint8Array;
}>;

// Each decode is whole: the engine's TextDecoder takes no `stream` option,
// so a character a range cuts is carried to the next range here instead.
const UTF8 = new TextDecoder();

/** How many bytes the UTF-8 character a byte opens takes: 1 for a byte that opens none. */
const charLength = (lead: number): number =>
  lead >= 0xf0 ? 4 : lead >= 0xe0 ? 3 : lead >= 0xc0 ? 2 : 1;

const isContinuation = (byte: number): boolean => (byte & 0xc0) === 0x80;

/** Where the whole characters of `bytes` end: before the last one, where the end cuts it. */
export const wholeEnd = (bytes: Uint8Array): number => {
  const lead = [1, 2, 3]
    .map((back) => bytes.length - back)
    .find((n) => n >= 0 && !isContinuation(bytes[n] ?? 0));

  return lead !== undefined && lead + charLength(bytes[lead] ?? 0) > bytes.length
    ? lead
    : bytes.length;
};

/** A file decoded so far, range by range: its text, and the bytes of a character the last range cut. */
export type Decoding = Readonly<{ text: string; carry: Uint8Array }>;

/** Nothing decoded yet. */
export const NOT_DECODED: Decoding = { text: "", carry: new Uint8Array() };

/**
 * The decoding once the next range, as the base64 `$.fs.read` gives, is
 * read: the character the last range cut finished from this one's first
 * bytes, then this one's whole characters, a character its end cuts carried.
 */
export const withRange = (decoding: Decoding, base64: string): Decoding => {
  const bytes = BYTES.fromBase64(base64);
  const carried = decoding.carry;
  const need =
    carried.length === 0
      ? 0
      : Math.max(charLength(carried[0] ?? 0) - carried.length, 0);
  // At most 3 bytes carried and 3 needed, so spread is cheap here.
  const head = Uint8Array.of(...carried, ...bytes.subarray(0, need));
  const body = bytes.subarray(need);
  const headEnd = body.length === 0 ? wholeEnd(head) : head.length;
  const bodyEnd = wholeEnd(body);

  return {
    text:
      decoding.text +
      UTF8.decode(head.subarray(0, headEnd)) +
      UTF8.decode(body.subarray(0, bodyEnd)),
    carry: body.length === 0 ? head.subarray(headEnd) : body.subarray(bodyEnd),
  };
};

/** The text decoded, with what a cut last character leaves. */
export const decodedText = (decoding: Decoding): string =>
  decoding.text + UTF8.decode(decoding.carry);

/** The text of a file read in ranges, each as base64, in order. */
export const textOfChunks = (chunks: readonly string[]): string =>
  decodedText(chunks.reduce(withRange, NOT_DECODED));

/** A topic header's underline: a line of `═` alone. */
export const isTopicRule = (line: string): boolean =>
  line.trim() !== "" && [...line.trim()].every((c) => c === TOPIC_RULE);

type Fold = Readonly<{
  open: string | undefined;
  done: readonly Readonly<{ name: string; lines: readonly string[] }>[];
}>;

const fold = (
  { open, done }: Fold,
  [line, following]: readonly [string, string],
): Fold => {
  const header = HEADER.exec(line)?.[1];

  return header !== undefined
    ? { open: header, done: [...done, { name: header, lines: [line] }] }
    : line.startsWith(STOP) || isTopicRule(line) || isTopicRule(following)
      ? { open: undefined, done }
      : open !== undefined
        ? {
            open,
            done: done.map((section, n) =>
              n === done.length - 1
                ? { ...section, lines: [...section.lines, line] }
                : section,
            ),
          }
        : { open, done };
};

/**
 * Each section of one reply text, in order, trailing blank lines trimmed. A
 * section ends at the next header, at a line opening `Still open from
 * earlier`, or at a topic header, the line above a line of `═`.
 */
export const sectionsOf = (text: string): readonly Section[] => {
  const lines = text.split("\n");
  const pairs = lines.map(
    (line, n) => [line, lines[n + 1] ?? ""] as const,
  );

  return pairs
    .reduce(fold, { open: undefined, done: [] } as Fold)
    .done.map(({ name, lines: own }) => ({
      name,
      text: own.join("\n").trimEnd(),
    }));
};

/** Each command by its names, the primary one first. */
export const COMMANDS: Readonly<Record<string, readonly string[]>> = {
  reassess: ["reassess", "recheck", "regenerate", "recalculate"],
  open: ["open", "pending", "restate"],
};
// The slash commands that run the skill, whose argument is the command.
const SKILL_COMMANDS: readonly string[] = [
  "coding-agent-kanban-turn-responses",
  "reply-block",
];

/** The command a word names: one of its names, or a prefix of them that no other command's name shares. */
export const commandNamed = (word: string): string | undefined => {
  const lowered = word.toLowerCase();
  const found = Object.entries(COMMANDS)
    .filter(
      ([, names]) =>
        lowered !== "" && names.some((name) => name.startsWith(lowered)),
    )
    .map(([command]) => command);

  return found.length === 1 ? found[0] : undefined;
};

/** The text between the first `opening` tag and the `closing` tag after it; undefined where `opening` is absent. */
const between = (
  text: string,
  opening: string,
  closing: string,
): string | undefined => {
  const at = text.indexOf(opening);

  return at < 0
    ? undefined
    : text.slice(at + opening.length).split(closing)[0];
};

/**
 * The words a command is read from: the `<command-args>` of the skill's own
 * slash command, else the prompt's words after `/coding-agent-kanban-turn-responses`
 * where it opens on it, else the prompt's words.
 */
const commandWords = (prompt: string): readonly string[] => {
  const name = between(prompt, "<command-name>", "</command-name>");
  const words = prompt.split(/\s+/).filter((word) => word !== "");
  const first = words[0] ?? "";

  return name !== undefined
    ? SKILL_COMMANDS.includes(name.trim().replace(/^\//, ""))
      ? (between(prompt, "<command-args>", "</command-args>") ?? "")
          .split(/\s+/)
          .filter((word) => word !== "")
      : []
    : first.startsWith("/") && SKILL_COMMANDS.includes(first.slice(1))
      ? words.slice(1)
      : words;
};

/** The command a prompt runs, `reassess` or `open`, by its first word, bare or after the skill's slash command. */
export const commandOf = (prompt: string): string | undefined => {
  const first = (commandWords(prompt)[0] ?? "").replace(/[.,;:!]+$/, "");

  return /^\p{L}+$/u.test(first) ? commandNamed(first) : undefined;
};

/**
 * The place of the latest `reassess` turn, whose lists replace every item
 * before it; else 0. Only the user's prompt or this mod's Reassess is one:
 * an agent's, another session's or a task's message opening on "Recheck"
 * is not.
 */
export const reassessStart = (turns: readonly Turn[]): number =>
  Math.max(
    turns.findLastIndex(
      (turn) => turn.canCommand && commandOf(turn.prompt) === "reassess",
    ),
    0,
  );
