// The answers written in the prompt draft: reading them, and the draft once
// an option is clicked or a note written. No `$`, no I/O: register.tsx reads
// the draft, calls these, and writes what they return.

import { refOf } from "./items.ts";
import type { DecideItem } from "../types/index.d.ts";

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
const ANSWER =
  /(?<![\w.])([0-9a-f]{6,8})\.Decide\.(\d+)(?:\.([A-Z](?:,[A-Z])*)(?!\w))?(?:: ([^\n]*))?/g;
// A note that is only letters, `…Decide.2: B`, is the letters written the other way.
const LETTERS_ONLY = /^([A-Z](?:\s*,\s*[A-Z])*)\s*$/;

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
  answer.number === item.number &&
  (item.turn.startsWith(answer.turn) || answer.turn.startsWith(item.turn));

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

/** The letters an item holds once `letter` is clicked: a checkbox toggles it, the others take it alone. */
export const lettersAfter = (
  item: DecideItem,
  held: readonly string[],
  letter: string,
): readonly string[] =>
  item.kind === "checkbox"
    ? inOptionOrder(item, toggled(held, letter))
    : [letter];

/** The draft with `text` in place of the answer. */
const replaced = (draft: string, answer: Answer, text: string): string =>
  draft.slice(0, answer.start) + text + draft.slice(answer.end);

/** The draft with the answer taken out, and the gap it leaves closed. */
const withoutAnswer = (draft: string, answer: Answer): string => {
  const before = draft.slice(0, answer.start);
  const after = draft.slice(answer.end);
  const isBetweenWords =
    before.endsWith(" ") && (after.startsWith(" ") || after === "");
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

// A note runs to the end of its line, so what follows one starts a new line.
const endsInNote = (draft: string): boolean => {
  const last = answersIn(draft).at(-1);

  return (
    last !== undefined &&
    last.note !== "" &&
    !draft.slice(last.end).includes("\n")
  );
};

const appended = (draft: string, text: string): string =>
  draft === "" || /\s$/.test(draft)
    ? draft + text
    : endsInNote(draft)
      ? `${draft}\n${text}`
      : `${draft} ${text}`;

/** `text` on a line of its own after `base`, or alone when `base` is empty. */
const onNewLine = (base: string, text: string): string =>
  base === "" ? text : `${base}\n${text}`;

/**
 * The draft once a note is written for the item: its answer, letters kept,
 * moved to a line of its own at the end, since a note runs to its line's end;
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
    ? onNewLine(rest.replace(/\s+$/, ""), text)
    : held === undefined || letters.length === 0
      ? rest
      : replaced(draft, held, text);
};

/**
 * The draft once an option is clicked: the item's answer written in place of
 * the one the draft held, or added at the end; a checkbox item's letter
 * toggled, its answer dropped when no letter is left.
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
