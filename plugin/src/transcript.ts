// What the core reads from a turn's texts: the sections of a reply, the
// command a prompt runs and where the latest `reassess` starts, the kanban
// skill's `reply_turns.py` in TypeScript; and the text of a file read in
// ranges. No `$`, no I/O, and no harness's records: an adapter, such as
// claude-code-transcript.ts, builds the neutral turns read here.
//
// The user's own text is a prompt they typed, or one this plugin submitted
// for them, such as the pane's Submit sending their draft or its Reassess:
// it answers items, may run `reassess`, and is never a report. Another
// plugin's prompt, a report and a notification are not the user's own, and
// answer nothing.

import { PLUGIN } from "./instructions.ts";
import type { Owner, Turn } from "../types/index.d.ts";

/** Whether text its owner wrote is the user's own: the user's, or this plugin's sent for them. */
export const isOwn = (owner: Owner): boolean =>
  owner === "user" || owner === "this-plugin";

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

// The line a draft the plugin's clicks started opens with: the plugin's
// name, its marketplace after `@` where the engine gave one, and a colon,
// alone on the first line.
const DRAFT_HEADER = new RegExp(
  String.raw`^${PLUGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:@[\w.-]+)?:\r?\n`,
);

/** A message's text without the line naming the plugin that a draft its clicks started opens with, so that line is never read as an answer or a note. */
export const withoutDraftHeader = (text: string): string =>
  text.replace(DRAFT_HEADER, "");

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

/** The command a word names, its trailing `.,;:!` dropped, where it's only letters. */
const commandOfWord = (word: string): string | undefined => {
  const bare = word.trim().replace(/[.,;:!]+$/, "");

  return /^\p{L}+$/u.test(bare) ? commandNamed(bare) : undefined;
};

/** Whether a line is only a word naming `reassess`: one of its names or a prefix no other command's name shares, any case, trailing `.,;:!` allowed. */
export const isReassessLine = (line: string): boolean =>
  commandOfWord(line) === "reassess";

/**
 * Whether a prompt's last non-blank line names `reassess` alone, as a
 * draft the pane's Reassess button ended does; whatever comes before it,
 * answers or news, is read first.
 */
const endsOnReassess = (text: string): boolean =>
  isReassessLine(
    text
      .split("\n")
      .filter((line) => line.trim() !== "")
      .at(-1) ?? "",
  );

/**
 * The command a prompt runs, `reassess` or `open`: by its first word, bare
 * or after the skill's slash command; else `reassess` where the prompt's
 * last non-blank line names it alone, with or without answers before it,
 * which count too. The line naming the plugin that opens a draft its clicks
 * started is left out first. `open` never runs from the last line.
 */
export const commandOf = (prompt: string): string | undefined => {
  const text = withoutDraftHeader(prompt);

  return (
    commandOfWord(commandWords(text)[0] ?? "") ??
    (endsOnReassess(text) ? "reassess" : undefined)
  );
};

/**
 * The place of the latest `reassess` turn, whose lists replace every item
 * before it; else 0. Only the user's own prompt is one, this plugin's
 * prompts among them: an agent's, another session's, a task's or another
 * mod's message opening on "Recheck" or ending on a `reassess` line is not.
 * A turn that ends on `reassess` after answers still settles the items they
 * answer.
 */
export const reassessStart = (turns: readonly Turn[]): number =>
  Math.max(
    turns.findLastIndex(
      (turn) =>
        isOwn(turn.prompt.owner) && commandOf(turn.prompt.text) === "reassess",
    ),
    0,
  );
