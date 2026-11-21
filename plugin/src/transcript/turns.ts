// What the core reads from a turn's texts: the sections of a reply, the
// command a prompt runs and where the latest `reassess` starts, the kanban
// skill's `reply_turns.py` in TypeScript; and the text of a file read in
// ranges. No `$`, no I/O, and no harness's records: an adapter, such as
// claude-code.ts, builds the neutral turns read here.
//
// The user's own text is a prompt they typed, or one this plugin submitted
// for them, such as the pane's Submit sending their draft or its Reassess:
// it answers items, may run `reassess`, and is never a report. Another
// plugin's prompt, a report, a notification and a scheduled prompt are not
// the user's own, and answer nothing.

import { PLUGIN } from "../protocol/instructions.ts";
import {
  DECIDE,
  REASSESS,
  classOf,
  isLineOf,
  namesOf,
} from "../protocol/rules.ts";
import { SPEC } from "../protocol/spec.ts";
import { escaped } from "../text/patterns.ts";
import type { Owner, Turn } from "../../types/index.d.ts";

/** Whether text its owner wrote is the user's own: the user's, or this plugin's sent for them. */
export const isOwn = (owner: Owner): boolean =>
  owner === "user" || owner === "this-plugin";

/** One section of a reply: its list's name as the header writes it, and its text, the header first. */
export type Section = Readonly<{ name: string; text: string }>;

/** Each list header followed by its aliases, the names older replies in a transcript still carry. */
export const SECTION_NAMES: readonly string[] =
  Object.values(SPEC.lists).flatMap(namesOf);

/** The Decide list's names, the first its own. */
export const DECISIONS: readonly string[] = namesOf(DECIDE);

/** A list's header line: any glyph, then its name in bold with a colon. */
export const HEADER = new RegExp(
  String.raw`^\s*\S+\s+\*\*(${SECTION_NAMES.map(escaped).join("|")}):\*\*`,
);
// The lines older replies opened their roll-up with, which end a section.
const STOPS: readonly string[] = SPEC["roll-up"].aliases;
// One per column under a topic header, in a reply grouped by topic.
const TOPIC_RULE = SPEC.characters["topic-underline"];

// The line a draft the plugin's clicks started opens with: the plugin's
// name, its marketplace after `@` where the engine gave one, and a colon,
// alone on the first line.
const DRAFT_HEADER = new RegExp(
  String.raw`^${escaped(PLUGIN)}(?:@[\w.-]+)?:\r?\n`,
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
  isLineOf(TOPIC_RULE, line);

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
    : STOPS.some((stop) => line.startsWith(stop)) ||
        isTopicRule(line) ||
        isTopicRule(following)
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
export const COMMANDS: Readonly<Record<string, readonly string[]>> =
  Object.fromEntries(
    Object.entries(SPEC.commands.names).map(([command, { synonyms }]) => [
      command,
      [command, ...synonyms],
    ]),
  );
/**
 * The slash commands whose argument is the command: the spec's skill
 * commands, and the plugin's own skill, bare and after the plugin's name and
 * a colon, as Claude Code names a plugin's skill.
 */
export const SKILL_COMMANDS: readonly string[] = [
  ...new Set([
    ...SPEC.commands["skill-commands"],
    SPEC.skill.name,
    `${PLUGIN}:${SPEC.skill.name}`,
  ]),
];
// Whether a prefix of one command's names alone runs it, or only a whole name.
const PREFIX_RUNS: boolean = SPEC.commands["unique-prefix-runs"];
// The characters a command's word may end on.
const TRAILING = new RegExp(
  `${classOf(SPEC.commands["trailing-punctuation"])}+$`,
);

/** The command a word names: one of its names, or a prefix of them that no other command's name shares. */
export const commandNamed = (word: string): string | undefined => {
  const lowered = word.toLowerCase();
  const found = Object.entries(COMMANDS)
    .filter(
      ([, names]) =>
        lowered !== "" &&
        names.some((name) =>
          PREFIX_RUNS ? name.startsWith(lowered) : name === lowered,
        ),
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

/** The command a word names, its trailing punctuation (`.,;:!`) dropped, where it's only letters. */
const commandOfWord = (word: string): string | undefined => {
  const bare = word.trim().replace(TRAILING, "");

  return /^\p{L}+$/u.test(bare) ? commandNamed(bare) : undefined;
};

/** Whether a line is only a word naming `reassess`: one of its names or a prefix no other command's name shares, any case, trailing `.,;:!` allowed. */
export const isReassessLine = (line: string): boolean =>
  commandOfWord(line) === REASSESS;

/** Whether a command also runs from a prompt's last line, as `reassess` does and `open` doesn't. */
const runsFromLastLine = (command: string): boolean =>
  Object.entries(SPEC.commands.names).some(
    ([name, spec]) => name === command && spec["from-last-line"],
  );

/**
 * The command a prompt's last non-blank line names alone, where that
 * command runs from the last line, as a draft the pane's Reassess button
 * ended does; whatever comes before it, answers or news, is read first.
 */
const lastLineCommand = (text: string): string | undefined => {
  const command = commandOfWord(
    text
      .split("\n")
      .filter((line) => line.trim() !== "")
      .at(-1) ?? "",
  );

  return command !== undefined && runsFromLastLine(command)
    ? command
    : undefined;
};

/**
 * The command a prompt runs, `reassess` or `open`: by its first word, bare
 * or after the skill's slash command; else `reassess` where the prompt's
 * last non-blank line names it alone, with or without answers before it,
 * which count too. The line naming the plugin that opens a draft its clicks
 * started is left out first. `open` never runs from the last line.
 */
export const commandOf = (prompt: string): string | undefined => {
  const text = withoutDraftHeader(prompt);

  return commandOfWord(commandWords(text)[0] ?? "") ?? lastLineCommand(text);
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
  Math.max(turns.findLastIndex(isReassessTurn), 0);

/** Whether a turn reassesses: its prompt the user's own, running `reassess`. */
export const isReassessTurn = (turn: Turn): boolean =>
  isOwn(turn.prompt.owner) && commandOf(turn.prompt.text) === REASSESS;

/** For each turn, the place of the latest `reassess` turn at or before it, as reassessStart gives for the turns up to it; else 0. */
export const reassessStarts = (turns: readonly Turn[]): readonly number[] => {
  const reassesses = turns.map(isReassessTurn);

  return reassesses.map((_, at) =>
    Math.max(reassesses.lastIndexOf(true, at), 0),
  );
};
