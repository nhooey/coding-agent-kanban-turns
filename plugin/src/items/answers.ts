// The answers written in the prompt draft: reading them, and the draft once
// an option or an action is clicked or a note written. No `$`, no I/O:
// register.tsx reads the draft, calls these, and writes what they return.

import { asksQuestion } from "./answer-lines.ts";
import { feedbackOfItem, isSameTurn, picksAny, refOf } from "./items.ts";
import { saidOf, saidText } from "./said.ts";
import { referencesOfLine } from "./word-answers.ts";
import type { LineReference } from "./word-answers.ts";
import {
  LETTER,
  REASSESS,
  feedbackOf,
  paneListOf,
  settlingWordsOf,
} from "../protocol/rules.ts";
import type { Feedback } from "../protocol/rules.ts";
import { isReassessLine } from "../transcript/turns.ts";
import type { DecideItem, ListedItem } from "../../types/index.d.ts";

/**
 * One answer written in the draft, and where it sits, to an item of a list
 * the pane draws, by its header: `<turn>.Decide.<n>.<letters>`, a note
 * after it to the end of its line, `…Decide.<n>.B: <note>`, or a note
 * alone, `…Decide.<n>: <text>`, which answers the item in words; or, for a
 * list with settling words, `<turn>.Todo.<n>: <word>`, a note after the
 * word, `…: done: <note>`, or a note alone, which settles nothing.
 */
export type Answer = Readonly<{
  start: number;
  end: number;
  turn: string;
  list: string;
  number: number;
  letters: readonly string[];
  word: string;
  note: string;
}>;

// A note that is only letters, `…Decide.2: B`, is the letters written the other way.
const LETTERS_ONLY = new RegExp(
  String.raw`^(${LETTER}(?:\s*,\s*${LETTER})*)\s*$`,
);

const lettersIn = (joined: string): readonly string[] =>
  joined === "" ? [] : joined.split(",");

/** What a Decide answer picks and says: its letters, by a dot or as a note of letters alone, and its note. */
const decided = (
  dotted: string | undefined,
  said: string,
): Pick<Answer, "letters" | "word" | "note"> => {
  const asLetters = dotted === undefined ? LETTERS_ONLY.exec(said) : null;

  return {
    letters: lettersIn(dotted ?? asLetters?.[1]?.replace(/\s/g, "") ?? ""),
    word: "",
    note: asLetters ? "" : said,
  };
};

/** How an answer reads what it picks and says, by its list's header, the letters after its reference and the text after its colon. */
type Reader = (
  list: string,
  dotted: string | undefined,
  said: string,
) => Pick<Answer, "letters" | "word" | "note">;

/**
 * How an answer to an item reads, by its list's feedback: by options, its
 * letters and note, a note of letters alone being letters; by settling
 * words, its list's word and note; by none, a note alone. Each list reads
 * by its feedback alone, so a list that gains one needs no reader of its
 * own.
 */
const READERS: Readonly<Record<Feedback, Reader>> = {
  options: (_list, dotted, said) => decided(dotted, said),
  "settling-words": (list, _dotted, said) => ({
    letters: [],
    ...saidOf(said, settlingWordsOf(paneListOf(list) ?? { "settling-words": {} })),
  }),
  none: (_list, _dotted, said) => ({ letters: [], word: "", note: said }),
};

/** What an answer to an item of `list`, by its header, picks and says, as its feedback's reader reads it. */
const pickedAndSaid: Reader = (list, dotted, said) =>
  READERS[feedbackOf(list)](list, dotted, said);

/** The answer a reference on a line writes, its place moved by `offset`, where the line opens in the draft. */
const answerOf = (ref: LineReference, offset: number): Answer => ({
  start: offset + ref.start,
  end: offset + ref.end,
  turn: ref.turn,
  list: ref.list,
  number: ref.number,
  ...pickedAndSaid(ref.list, ref.dotted, ref.said ?? ""),
});

/** The feedback whose answers write letters after the reference, `….2.B`. */
const OPTIONS = "options" satisfies Feedback;

/** Whether a reference writes an answer the draft holds: it names its turn, as the pane writes it, and has letters after it, for a list answered by options, or words after its colon. */
const isAnswer = (ref: LineReference): boolean =>
  ref.turn !== "" &&
  (ref.said !== undefined || (ref.dotted !== undefined && feedbackOf(ref.list) === OPTIONS));

/** Each line of the draft, with where it opens. */
const linesOf = (draft: string): readonly Readonly<{ line: string; offset: number }>[] =>
  draft.split("\n").reduce<readonly Readonly<{ line: string; offset: number }>[]>(
    (sofar, line) => {
      const last = sofar.at(-1);

      return [...sofar, { line, offset: last === undefined ? 0 : last.offset + last.line.length + 1 }];
    },
    [],
  );

/** Every answer written in the draft, in order, each line read by the grammar the turn's end reads it by. */
export const answersIn = (draft: string): readonly Answer[] =>
  linesOf(draft).flatMap(({ line, offset }) =>
    referencesOfLine(line)
      .filter(isAnswer)
      .map((ref) => answerOf(ref, offset)),
  );

const isFor = (answer: Answer, item: ListedItem): boolean =>
  answer.list === item.list &&
  answer.number === item.number &&
  isSameTurn(answer.turn, item.turn);

/** The draft's answer to the item, if it holds one. */
export const answerTo = (draft: string, item: ListedItem): Answer | undefined =>
  answersIn(draft).find((answer) => isFor(answer, item));

/** The letters the draft picks for the item; none when it does not answer it. */
export const lettersFor = (
  draft: string,
  item: ListedItem,
): readonly string[] => answerTo(draft, item)?.letters ?? [];

/** The settling word the draft gives the item; empty when it gives none. */
export const wordFor = (draft: string, item: ListedItem): string =>
  answerTo(draft, item)?.word ?? "";

/** The note the draft gives the item; empty when it gives none. */
export const noteFor = (draft: string, item: ListedItem): string =>
  answerTo(draft, item)?.note ?? "";

/** Whether the draft holds an answer to the item, of any list, a note alone or a question among them: whether the person has written anything for it. */
export const isAnswered = (draft: string, item: ListedItem): boolean =>
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
export const choiceTo = (draft: string, item: ListedItem): Answer | undefined =>
  answersIn(draft).findLast(
    (answer) => isFor(answer, item) && !asksQuestion(lineOf(draft, answer)),
  );

/**
 * Whether a choice settles its item, by the item's list's feedback: any
 * choice to an item answered by options, a note in words among them; a
 * settling word to one answered by settling words, whose note alone
 * settles nothing; nothing to one answered by none.
 */
const SETTLING: Readonly<Record<Feedback, (choice: Answer | undefined) => boolean>> = {
  options: (choice) => choice !== undefined,
  "settling-words": (choice) => (choice?.word ?? "") !== "",
  none: () => false,
};

/**
 * Whether sending the draft would settle the item, by its choice, the
 * latest answer to it on a line that asks no question, as its list's
 * feedback says in `SETTLING`.
 */
export const settles = (draft: string, item: ListedItem): boolean =>
  SETTLING[feedbackOfItem(item)](choiceTo(draft, item));

/** An answer as the draft holds it: the letters, then the word and the note. */
const written = (
  item: ListedItem,
  letters: readonly string[],
  word: string,
  note: string,
): string => {
  const said = saidText({ word, note });

  return `${refOf(item)}${letters.length > 0 ? `.${letters.join(",")}` : ""}${said ? `: ${said}` : ""}`;
};

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
  picksAny(item)
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
 * The draft once a note is written for the item: its answer, letters or
 * settling word kept, moved to a line of its own at the end, as `choose`
 * adds one, since a note runs to its line's end; an empty note leaves the
 * letters or the word alone, or drops an answer with neither.
 */
export const withNote = (
  draft: string,
  item: ListedItem,
  note: string,
): string => {
  const held = answerTo(draft, item);
  const letters = held?.letters ?? [];
  const word = held?.word ?? "";
  const said = note.replace(/\s+/g, " ").trim();
  const rest = held === undefined ? draft : withoutAnswer(draft, held);
  const text = written(item, letters, word, said);

  return said !== ""
    ? appended(rest.replace(/\s+$/, ""), text)
    : held === undefined || (letters.length === 0 && word === "")
      ? rest
      : replaced(draft, held, text);
};

/**
 * The draft once an item's action is clicked, the button writing `word`, a
 * settling word: the item's answer written with it in place of the one the
 * draft held, its note kept, or added on a line of its own at the end; a
 * click on the word the answer holds takes it out, and the answer is
 * dropped when no note is left.
 */
export const toggledWord = (
  draft: string,
  item: ListedItem,
  word: string,
): string => {
  const held = answerTo(draft, item);
  const next = held?.word === word ? "" : word;
  const note = held?.note ?? "";
  const text = written(item, [], next, note);

  return held === undefined
    ? appended(draft, text)
    : next === "" && note === ""
      ? withoutAnswer(draft, held)
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
  const text = written(item, letters, "", note);

  return held === undefined
    ? appended(draft, text)
    : letters.length === 0 && note === ""
      ? withoutAnswer(draft, held)
      : replaced(draft, held, text);
};
