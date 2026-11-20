// The answers one line of the user's text gives, by the patterns the kanban
// skill's `outstanding.py` reads them with: which item each answers, the
// letters it picks and its note. No `$`, no I/O. Both the transcript's
// reading of a command and what settles a Decide item read answers here.

import {
  DECIDE,
  LETTER,
  TURN_ID_CHAR,
  TURN_ID_PREFIX,
  escaped,
} from "./protocol.ts";
import { SPEC } from "./spec.ts";

/**
 * One answer a line of the user's gives: the item's number, and its turn, by
 * an id or a prefix of one, or empty for the turn before the answer's; the
 * letters it picks and the note it gives, either of them empty.
 */
export type LineAnswer = Readonly<{
  turn: string;
  number: number;
  letters: readonly string[];
  note: string;
}>;

// What follows an item's reference in an answer: its letters after a dot,
// `.B` or `.A,C`, a note or not after them; its letters after a colon or a
// space, `: B` or ` A, C`, only where they end the line or another reference
// or `of <turn>` follows, so `Decide.2: A red one` is not option A; or, after
// a colon, words, `Decide.2: I'd rather wait`, an answer in the user's own
// words.
const LETTERS = String.raw`${LETTER}(?:\s*,\s*${LETTER})*`;
// The Decide list's name, as a reference writes it.
const LIST = escaped(DECIDE.header);
// The words that name an answer's turn after it: `of` or `from`.
const OF = `(?:${SPEC.reference["turn-after"].map(escaped).join("|")})`;
const AFTER_REF = String.raw`(?:\.(?<dot>${LETTERS})(?!\w)|(?::\s*|\s+)(?<spaced>${LETTERS})(?=\s*$|\s+${OF}\s|\s+(?:${TURN_ID_PREFIX}\.)?${LIST}\.)|:\s*(?=\S))`;
// `9efb08a1.Decide.2.B`, `9efb08a.Decide.2: B,C`, `9efb08a1.Decide.2: <words>`.
const ANSWER_WITH_ID = new RegExp(
  String.raw`\b(${TURN_ID_PREFIX})\.${LIST}\.(\d+)${AFTER_REF}`,
  "g",
);
// `Decide.2.B of 9efb08a1`, `Decide.2: B,C from 9efb08a1`.
const ANSWER_ID_AFTER = new RegExp(
  String.raw`\b${LIST}\.(\d+)(?:\.|:\s*|\s+)(${LETTERS})\s+${OF}\s+(${TURN_ID_PREFIX})\b`,
  "g",
);
// An answer to the turn before, naming no turn: `Decide.2.B`, `Decide.2: B`
// or `Decide.2: <words>`. Whatever ANSWER_ID_AFTER matches is turned away
// first, so `Decide.2: B,C of 9efb08a1` can't also pass as words after the
// colon.
const ANSWER_BARE = new RegExp(
  String.raw`(?<!${TURN_ID_CHAR}\.)\b${LIST}\.(\d+)(?!(?:\.|:\s*|\s+)${LETTERS}\s+${OF}\s+${TURN_ID_PREFIX}\b)${AFTER_REF}(?!\s+${OF}\s)`,
  "g",
);
// A line of numbered answers to the turn before, `2. B`, `2. A, C`, or
// several parted by `/`, `;` or `,`: `1. A / 3. B`. The line must hold
// nothing else, so prose opening on a number answers nothing.
const NUMBERED = String.raw`(\d+)[.:]\s*(${LETTERS})`;
const ANSWER_NUMBER = new RegExp(NUMBERED, "g");
const ANSWER_NUMBERS_LINE = new RegExp(
  String.raw`^\s*${NUMBERED}(?:\s*[/;,]\s*${NUMBERED})*\s*$`,
);

/**
 * The answer one match gives: its turn and number, its letters, and its
 * note, the words after `: ` that follow its letters to the end of the line,
 * or, with no letters, all that follows the match.
 */
const answerOfMatch = (
  line: string,
  m: RegExpMatchArray,
  found: Readonly<{ turn?: string; number?: string; letters?: string }>,
): LineAnswer => {
  const rest = line.slice((m.index ?? 0) + m[0].length);

  return {
    turn: found.turn ?? "",
    number: Number(found.number),
    letters:
      found.letters === undefined
        ? []
        : found.letters.replace(/\s/g, "").split(","),
    note: (found.letters === undefined
      ? rest
      : (/^:\s*(.*)$/.exec(rest)?.[1] ?? "")
    ).trim(),
  };
};

/** The letters an AFTER_REF match picks, by the dot or after a colon or a space; none for words. */
const lettersAfterRef = (m: RegExpMatchArray): string | undefined =>
  m.groups?.["dot"] ?? m.groups?.["spaced"];

const answerKey = (answer: LineAnswer): string =>
  `${answer.turn}\t${answer.number}`;

/** The answers one line of the user's gives, each item once, as first found; none where the line asks a question. */
export const answersOfLine = (line: string): readonly LineAnswer[] => {
  const found = line.includes("?")
    ? []
    : [
        ...[...line.matchAll(ANSWER_WITH_ID)].map((m) =>
          answerOfMatch(line, m, {
            turn: m[1],
            number: m[2],
            letters: lettersAfterRef(m),
          }),
        ),
        ...[...line.matchAll(ANSWER_ID_AFTER)].map((m) =>
          answerOfMatch(line, m, { turn: m[3], number: m[1], letters: m[2] }),
        ),
        ...[...line.matchAll(ANSWER_BARE)].map((m) =>
          answerOfMatch(line, m, { number: m[1], letters: lettersAfterRef(m) }),
        ),
        ...(ANSWER_NUMBERS_LINE.test(line)
          ? [...line.matchAll(ANSWER_NUMBER)].map((m) =>
              answerOfMatch(line, m, { number: m[1], letters: m[2] }),
            )
          : []),
      ];

  return found.filter(
    (answer, n) =>
      found.findIndex((other) => answerKey(other) === answerKey(answer)) === n,
  );
};
