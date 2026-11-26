// The one grammar a line of answers is read by: each reference, and what
// it says from its colon, the spaces after it aside, up to the next
// reference of any list the pane draws, a separator before that aside. The
// draft's reader, answersIn, and the turn's end's, wordAnswersOfLine, read
// the same line alike; and the answers with a settling word the user's own
// lines give.

import { describe, test } from "node:test";
import { expect } from "expect";

import { answersIn } from "../../../src/items/answers.ts";
import {
  latestWord,
  referencesOfLine,
  wordAnsweredIn,
  wordAnswersOfLine,
} from "../../../src/items/word-answers.ts";
import { ownLinesOf } from "../../../src/transcript/turns.ts";
import { said, turnOf } from "../../fixtures/turns.ts";

const FIRST = "9efb08a1";
const SECOND = "b2c3d4e5";

/** What the draft's reader reads of a line: each answer's list, number, letters, word and note. */
const drafted = (line: string): readonly (readonly unknown[])[] =>
  answersIn(line).map((a) => [a.list, a.number, a.letters, a.word, a.note]);

/** What the turn's end reads of a line: each word answer's list, number, word and note. */
const ended = (line: string): readonly (readonly unknown[])[] =>
  wordAnswersOfLine(line).map((a) => [a.list, a.number, a.word, a.note]);

describe("a line's references", () => {
  test("each says what runs from its colon to the next, the separator and spaces between aside", () => {
    expect(
      referencesOfLine("Todo.1: done, 9efb08.Decide.2.B; Todo.3: later / see it").map((ref) => [
        ref.turn,
        ref.list,
        ref.number,
        ref.dotted,
        ref.said,
      ]),
    ).toEqual([
      ["", "Todo", 1, undefined, "done"],
      ["9efb08", "Decide", 2, "B", undefined],
      ["", "Todo", 3, undefined, "later / see it"],
    ]);
  });

  test("where what it says ends, the separator after it aside", () => {
    const line = "Todo.1: done, Todo.2: skip";

    expect(referencesOfLine(line).map((ref) => line.slice(ref.start, ref.end))).toEqual([
      "Todo.1: done",
      "Todo.2: skip",
    ]);
  });
});

describe("the draft and the turn's end read a line alike", () => {
  test("two Todo answers parted by a comma", () => {
    const line = `${FIRST}.Todo.3: done, ${FIRST}.Todo.4: skip`;

    expect(drafted(line)).toEqual([
      ["Todo", 3, [], "done", ""],
      ["Todo", 4, [], "skip", ""],
    ]);
    expect(ended(line)).toEqual([
      ["Todo", 3, "done", ""],
      ["Todo", 4, "skip", ""],
    ]);
  });

  test("a Todo answer's text ends at a Decide reference after it", () => {
    expect(ended("Todo.1: done, Decide.2: B")).toEqual([["Todo", 1, "done", ""]]);
    expect(drafted(`${FIRST}.Todo.1: done, ${FIRST}.Decide.2: B`)).toEqual([
      ["Todo", 1, [], "done", ""],
      ["Decide", 2, ["B"], "", ""],
    ]);
  });

  test("no space after the colon reads as one", () => {
    const line = `${FIRST}.Todo.3:done`;

    expect(drafted(line)).toEqual([["Todo", 3, [], "done", ""]]);
    expect(ended(line)).toEqual([["Todo", 3, "done", ""]]);
  });
});

describe("the words a line gives", () => {
  test("a word alone, a word and a note, and a note alone, each by its reference", () => {
    expect(wordAnswersOfLine(`${FIRST}.Todo.1: done`)).toEqual([
      { turn: FIRST, list: "Todo", number: 1, word: "done", note: "" },
    ]);
    expect(wordAnswersOfLine("Todo.3: done: rotated it yesterday")).toEqual([
      { turn: "", list: "Todo", number: 3, word: "done", note: "rotated it yesterday" },
    ]);
    expect(wordAnswersOfLine("9efb08.Todo.2: not this week")).toEqual([
      { turn: "9efb08", list: "Todo", number: 2, word: "", note: "not this week" },
    ]);
  });

  test("an upper-case word reads as the word", () => {
    expect(wordAnswersOfLine("Todo.1: Done")).toEqual([
      { turn: "", list: "Todo", number: 1, word: "done", note: "" },
    ]);
  });

  test("a reference with nothing after a colon, a question, or a Decide answer gives none", () => {
    expect(wordAnswersOfLine(`see ${FIRST}.Todo.1 above`)).toEqual([]);
    expect(wordAnswersOfLine("Todo.1: done?")).toEqual([]);
    expect(wordAnswersOfLine(`${FIRST}.Decide.1: done`)).toEqual([]);
    expect(wordAnswersOfLine(`x${FIRST}.Todo.1: done`)).toEqual([]);
  });

  test("only the user's own text gives them, the draft's header line aside, a bare one meaning the turn before", () => {
    const turns = [
      turnOf(FIRST, "go", { replies: ["Done."] }),
      turnOf(SECOND, "coding-agent-kanban-turns:\nTodo.1: done", {
        messages: [said("Todo.2: skip", "peer", ["agent-1"])],
      }),
    ];
    const words = wordAnsweredIn(ownLinesOf(turns));

    expect(words).toEqual([
      { turn: "", list: "Todo", number: 1, word: "done", note: "", at: 0, sent: SECOND },
    ]);
    expect(latestWord(words, "Todo", FIRST, 0, 1)?.sent).toBe(SECOND);
    expect(latestWord(words, "Todo", FIRST, 0, 2)).toBeUndefined();
  });
});
