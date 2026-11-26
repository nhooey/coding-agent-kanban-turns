// The one grammar a line of answers to the items the pane draws is read
// by, which the draft's reader, answers.ts, and the turn's end's reading of
// settling words share: each reference, `<turn>.<List>.<n>`, its turn's id
// or a prefix of one, or none, then a Decide item's letters after a dot,
// then what it says after a colon, the spaces after the colon aside, up to
// the next reference of a list the pane draws, a separator before that
// aside, as the spec's `reference.separators` gives them. Then the answers
// with a settling word the user's own lines give, as the turn's end reads
// them. No `$`, no I/O.

import { asksQuestion } from "./answer-lines.ts";
import { isSameTurn } from "./items.ts";
import { saidOf } from "./said.ts";
import type { Said } from "./said.ts";
import {
  DECIDE,
  LETTER,
  PANE_LISTS,
  TURN_ID_PREFIX,
  paneListOf,
  settlingWordsOf,
} from "../protocol/rules.ts";
import { SPEC } from "../protocol/spec.ts";
import { escaped } from "../text/patterns.ts";
import type { OwnLine } from "../transcript/turns.ts";

/**
 * One reference a line writes to an item of a list the pane draws: where
 * it opens on the line, and where what it says ends, a separator after
 * that aside; the item's turn, by an id or a prefix of one, or empty for
 * none; its list's header and number; the letters after a dot, if any;
 * and what it says after its colon, trimmed, undefined where no colon
 * follows it.
 */
export type LineReference = Readonly<{
  start: number;
  end: number;
  turn: string;
  list: string;
  number: number;
  dotted: string | undefined;
  said: string | undefined;
}>;

// A reference: its turn's id or a prefix of one, or none, the list's
// header, the number, a capital or several joined by commas after a dot,
// then a colon and the spaces after it, or not. Not part of a longer word
// or reference.
const REFERENCE = new RegExp(
  String.raw`(?<![\w.])(?:(${TURN_ID_PREFIX})\.)?(${PANE_LISTS.map((list) => escaped(list.header)).join("|")})\.(\d+)(?:\.(${LETTER}(?:,${LETTER})*)(?!\w))?(:[ \t]*)?`,
  "g",
);

// What parts one answer on a line from the next: a separator the spec
// names, or several, with the spaces around them, at the end of the text.
const TRAILING_PARTS = new RegExp(
  String.raw`(?:\s|${SPEC.reference.separators.map(escaped).join("|")})+$`,
);

/** Every reference a line writes to an item of a list the pane draws, in order, each saying what the line holds from its colon up to the next one. */
export const referencesOfLine = (line: string): readonly LineReference[] => {
  const found = [...line.matchAll(REFERENCE)];

  return found.map((m, n) => {
    const start = m.index ?? 0;
    const after = start + m[0].length;
    const hasColon = m[5] !== undefined;
    const text = hasColon
      ? line.slice(after, found[n + 1]?.index ?? line.length).replace(TRAILING_PARTS, "")
      : "";

    return {
      start,
      end: after + text.length,
      turn: m[1] ?? "",
      list: m[2] ?? DECIDE.header,
      number: Number(m[3]),
      dotted: m[4],
      said: hasColon ? text.trim() : undefined,
    };
  });
};

/**
 * An answer to an item of a list with settling words, as one line of the
 * user's text writes it: the item's turn, by an id or a prefix of one, or
 * empty for the turn before the answer's; its list's header and number;
 * and what it says, its word, empty for none, and its note.
 */
export type WordAnswer = Readonly<{ turn: string; list: string; number: number } & Said>;

/** The settling words of the list a reference's header names; none for a list without them. */
const wordsOf = (header: string): readonly string[] => {
  const list = paneListOf(header);

  return list === undefined ? [] : settlingWordsOf(list);
};

/**
 * The answers to items of lists with settling words one line of the
 * user's gives, each saying what its reference's colon is followed by, as
 * `saidOf` reads it; none where the line asks a question, as a Decide
 * answer's line gives none either.
 */
export const wordAnswersOfLine = (line: string): readonly WordAnswer[] =>
  asksQuestion(line)
    ? []
    : referencesOfLine(line).flatMap((ref) => {
        const words = wordsOf(ref.list);

        return ref.said === undefined || words.length === 0
          ? []
          : [{ turn: ref.turn, list: ref.list, number: ref.number, ...saidOf(ref.said, words) }];
      });

/** A word answer as the turns hold it: the line's, with the place `at` of the turn a bare one answers and the id of the turn it was `sent` in. */
export type HeldWordAnswer = WordAnswer & Readonly<{ at: number; sent: string }>;

/** Every answer the user's own lines give an item of a list with settling words, oldest first, a bare one answering the turn before its own. */
export const wordAnsweredIn = (lines: readonly OwnLine[]): readonly HeldWordAnswer[] =>
  lines.flatMap(({ line, at, sent }) =>
    wordAnswersOfLine(line).map((answer) => ({ ...answer, at, sent })),
  );

/** The latest answer with a settling word to item `number` of list `list`, by its header, of the turn at `at`, whose id is `id`, if one gives it. */
export const latestWord = (
  answers: readonly HeldWordAnswer[],
  list: string,
  id: string,
  at: number,
  number: number,
): HeldWordAnswer | undefined =>
  answers.findLast(
    (answer) =>
      answer.word !== "" &&
      answer.list === list &&
      answer.number === number &&
      (answer.turn === "" ? answer.at === at : isSameTurn(answer.turn, id)),
  );
