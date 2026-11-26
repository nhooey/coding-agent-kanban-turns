// The answers written in the prompt draft: reading them, and the draft once
// an option is clicked or a note written. No `$`, no I/O: register.tsx reads
// the draft, calls these, and writes what they return.

import { asksQuestion } from "./answer-lines.ts";
import { isSameTurn, refOf } from "./items.ts";
import { DECIDE, LETTER, REASSESS, TURN_ID_PREFIX } from "../protocol/rules.ts";
import { SPEC } from "../protocol/spec.ts";
import { escaped } from "../text/patterns.ts";
import { isReassessLine } from "../transcript/turns.ts";
import type { DecideItem } from "../../types/index.d.ts";

/**
 * One answer written in the draft, and where it sits: `<turn>.Decide.<n>.<letters>`,
 * a note after it to the end of its line, `…Decide.<n>.B: <note>`, or a note
 * alone, `…Decide.<n>: <text>`, which answers the item in words.
 */
export type Answer = Readonly<{
  start: number;
  end: number;
  turn: string;
  number: number;
  letters: readonly string[];
  note: string;
}>;

// A turn id of 6 to 8 hex characters (a prefix of the 8 is as good), the item
// number, then one capital or several joined by commas, a note after `: ` to
// the end of the line, or both. Not part of a longer word.
const ANSWER = new RegExp(
  String.raw`(?<![\w.])(${TURN_ID_PREFIX})\.${escaped(DECIDE.header)}\.(\d+)(?:\.(${LETTER}(?:,${LETTER})*)(?!\w))?(?:: ([^\n]*))?`,
  "g",
);
// A note that is only letters, `…Decide.2: B`, is the letters written the other way.
const LETTERS_ONLY = new RegExp(
  String.raw`^(${LETTER}(?:\s*,\s*${LETTER})*)\s*$`,
);

const lettersIn = (joined: string): readonly string[] =>
  joined === "" ? [] : joined.split(",");

const answerOf = (m: RegExpMatchArray): Answer => {
  const said = (m[4] ?? "").trim();
  const asLetters = m[3] === undefined ? LETTERS_ONLY.exec(said) : null;
  const start = m.index ?? 0;

  return {
    start,
    end: start + m[0].length,
    turn: m[1] ?? "",
    number: Number(m[2]),
    letters: lettersIn(m[3] ?? asLetters?.[1]?.replace(/\s/g, "") ?? ""),
    note: asLetters ? "" : said,
  };
};

/** Every answer written in the draft, in order. */
export const answersIn = (draft: string): readonly Answer[] =>
  [...draft.matchAll(ANSWER)]
    .filter((m) => m[3] !== undefined || m[4] !== undefined)
    .map(answerOf);

const isFor = (answer: Answer, item: DecideItem): boolean =>
  answer.number === item.number && isSameTurn(answer.turn, item.turn);

/** The draft's answer to the item, if it holds one. */
export const answerTo = (draft: string, item: DecideItem): Answer | undefined =>
  answersIn(draft).find((answer) => isFor(answer, item));

/** The letters the draft picks for the item; none when it does not answer it. */
export const lettersFor = (
  draft: string,
  item: DecideItem,
): readonly string[] => answerTo(draft, item)?.letters ?? [];

/** The note the draft gives the item; empty when it gives none. */
export const noteFor = (draft: string, item: DecideItem): string =>
  answerTo(draft, item)?.note ?? "";

export const isAnswered = (draft: string, item: DecideItem): boolean =>
  answerTo(draft, item) !== undefined;

/** The draft's line the answer sits on. */
const lineOf = (draft: string, answer: Answer): string => {
  const end = draft.indexOf("\n", answer.end);

  return draft.slice(
    draft.lastIndexOf("\n", answer.start - 1) + 1,
    end < 0 ? draft.length : end,
  );
};

/**
 * The draft's answer to the item where it picks: the latest of its answers
 * to the item on a line that asks no question, as the turn's end reads
 * them, since it reads a line that asks one as a question about the item
 * that picks nothing; none where no such answer is left.
 */
export const choiceTo = (draft: string, item: DecideItem): Answer | undefined =>
  answersIn(draft).findLast(
    (answer) => isFor(answer, item) && !asksQuestion(lineOf(draft, answer)),
  );

/** An answer as the draft holds it: the letters, then the note. */
const written = (
  item: DecideItem,
  letters: readonly string[],
  note: string,
): string =>
  `${refOf(item)}${letters.length > 0 ? `.${letters.join(",")}` : ""}${note ? `: ${note}` : ""}`;

const inOptionOrder = (
  item: DecideItem,
  letters: readonly string[],
): readonly string[] =>
  item.options
    .map((o) => o.letter)
    .filter((letter) => letters.includes(letter));

const toggled = (
  held: readonly string[],
  letter: string,
): readonly string[] =>
  held.includes(letter) ? held.filter((l) => l !== letter) : [...held, letter];

/**
 * The letters an item holds once `letter` is clicked: a kind that picks any
 * number, a checkbox, toggles it; the others take it alone, or drop it when
 * it was already the one chosen.
 */
export const lettersAfter = (
  item: DecideItem,
  held: readonly string[],
  letter: string,
): readonly string[] =>
  SPEC.options.kinds[item.kind].picks === "any"
    ? inOptionOrder(item, toggled(held, letter))
    : held.includes(letter)
      ? []
      : [letter];

/** The draft with `text` in place of the answer. */
const replaced = (draft: string, answer: Answer, text: string): string =>
  draft.slice(0, answer.start) + text + draft.slice(answer.end);

/** The draft with the answer taken out, and the gap it leaves closed. */
const withoutAnswer = (draft: string, answer: Answer): string => {
  const before = draft.slice(0, answer.start);
  const after = draft.slice(answer.end);
  const isBetweenWords = before.endsWith(" ") && /^(?: |\n|$)/.test(after);
  const isOnOwnLine =
    (before.endsWith("\n") || before === "") &&
    (after.startsWith("\n") || after === "");

  return isBetweenWords
    ? before.slice(0, -1) + after
    : isOnOwnLine
      ? before.replace(/\n$/, "") +
        (before === "" ? after.replace(/^\n/, "") : after)
      : before + after.replace(/^ /, "");
};

/**
 * `text` on a line of its own after `draft`, ending in a newline, so each
 * answer the draft gains sits on its own line; spaces trailing the draft go,
 * and a draft already ending its line gains no blank one.
 */
const appended = (draft: string, text: string): string => {
  const base = draft.replace(/[ \t]+$/, "");

  return base === "" || base.endsWith("\n")
    ? `${base}${text}\n`
    : `${base}\n${text}\n`;
};

/**
 * The draft once a note is written for the item: its answer, letters kept,
 * moved to a line of its own at the end, as `choose` adds one, since a note
 * runs to its line's end;
 * an empty note leaves the letters alone, or drops a letterless answer.
 */
export const withNote = (
  draft: string,
  item: DecideItem,
  note: string,
): string => {
  const held = answerTo(draft, item);
  const letters = held?.letters ?? [];
  const said = note.replace(/\s+/g, " ").trim();
  const rest = held === undefined ? draft : withoutAnswer(draft, held);
  const text = written(item, letters, said);

  return said !== ""
    ? appended(rest.replace(/\s+$/, ""), text)
    : held === undefined || letters.length === 0
      ? rest
      : replaced(draft, held, text);
};

/** The line that opens a draft the plugin's clicks start: the plugin's id, `<name>@<marketplace>` or its name, and a colon. */
export const draftHeader = (id: string): string => `${id}:`;

/**
 * The draft once a click or a note changes its answers by `edit`, the
 * header line kept first. A draft the click starts, from an empty box,
 * opens with the header; one that already does keeps it, once; one the
 * person began without it stays without it. A draft left with no answers
 * and nothing else loses the header too, leaving the box empty.
 */
export const headed = (
  draft: string,
  header: string,
  edit: (body: string) => string,
): string => {
  const body = draft.startsWith(`${header}\n`)
    ? draft.slice(header.length + 1)
    : draft === header
      ? ""
      : draft;
  const hasHeader = body !== draft;
  const edited = edit(body);

  return edited.trim() === ""
    ? hasHeader
      ? ""
      : edited
    : hasHeader || body.trim() === ""
      ? `${header}\n${edited}`
      : edited;
};

/** The line the Reassess button adds at the draft's end. */
export const REASSESS_LINE: string = REASSESS;

/** The draft parted into what comes before a last line naming `reassess`, and that line; undefined when its last line names none. */
const reassessSplit = (
  draft: string,
): Readonly<{ body: string; last: string }> | undefined => {
  const lines = draft.replace(/\s+$/, "").split("\n");
  const last = lines.at(-1) ?? "";

  return last.trim() !== "" && isReassessLine(last)
    ? {
        body: lines.length > 1 ? `${lines.slice(0, -1).join("\n")}\n` : "",
        last: last.trim(),
      }
    : undefined;
};

/** Whether the draft's last line is only a word naming `reassess`, so sending it reassesses, after any answers it holds. */
export const hasReassess = (draft: string): boolean =>
  reassessSplit(draft) !== undefined;

/** The draft once the Reassess button is pressed: a `reassess` line added at its end, or the one there taken out. */
export const toggledReassess = (draft: string): string => {
  const split = reassessSplit(draft);

  return split === undefined ? appended(draft, REASSESS_LINE) : split.body;
};

/** The draft once `edit` changes its answers, a last line naming `reassess` kept last. */
export const reassessKept = (
  draft: string,
  edit: (body: string) => string,
): string => {
  const split = reassessSplit(draft);

  return split === undefined
    ? edit(draft)
    : appended(edit(split.body), split.last);
};

/**
 * The draft once an option is clicked: the item's answer written in place of
 * the one the draft held, or added on a line of its own at the end; a click
 * on a chosen letter unchooses it, and the answer is dropped when no letter
 * and no note is left.
 */
export const choose = (
  draft: string,
  item: DecideItem,
  letter: string,
): string => {
  const held = answerTo(draft, item);
  const letters = lettersAfter(item, held?.letters ?? [], letter);
  const note = held?.note ?? "";
  const text = written(item, letters, note);

  return held === undefined
    ? appended(draft, text)
    : letters.length === 0 && note === ""
      ? withoutAnswer(draft, held)
      : replaced(draft, held, text);
};
