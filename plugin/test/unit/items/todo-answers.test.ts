// A Todo item's answers in the draft: a settling word its Done and Skip
// buttons write and take out again, a note beside the word or alone, read
// back beside Decide's answers; what Submit sends of them; and what the
// pane counts.

import { describe, test } from "node:test";
import { expect } from "expect";

import {
  answersIn,
  choose,
  noteFor,
  settles,
  toggledWord,
  withNote,
  wordFor,
} from "../../../src/items/answers.ts";
import {
  answeredCount,
  decideItemsOf,
  sentOf,
  stillOpen,
  unseen,
  withItems,
} from "../../../src/items/raised.ts";
import { emptyRaised } from "../../../src/items/raised.ts";
import type { DecideItem, TodoItem } from "../../../types/index.d.ts";

const TODO: TodoItem = {
  turn: "9efb08a1",
  list: "Todo",
  number: 3,
  summary: "Rotate the deploy token",
  ref: "9efb08a1.Todo.3",
};

const DECIDE: DecideItem = {
  turn: "9efb08a1",
  list: "Decide",
  number: 3,
  summary: "Which cache to keep",
  kind: "radio",
  ref: "9efb08a1.Decide.3",
  options: [
    { letter: "A", name: "Disk" },
    { letter: "B", name: "Memory" },
  ],
};

describe("a Todo item's answer in the draft", () => {
  test("reads its word and its note, apart from a Decide item of the same number", () => {
    const draft = "9efb08a1.Decide.3.A\n9efb08a1.Todo.3: done: rotated it\n";

    expect(answersIn(draft).map((a) => [a.list, a.number, a.letters, a.word, a.note])).toEqual([
      ["Decide", 3, ["A"], "", ""],
      ["Todo", 3, [], "done", "rotated it"],
    ]);
    expect(wordFor(draft, TODO)).toBe("done");
    expect(noteFor(draft, TODO)).toBe("rotated it");
    expect(wordFor(draft, DECIDE)).toBe("");
  });

  test("a note alone is no word, and settles nothing; a Decide item's note does", () => {
    expect(settles("9efb08a1.Todo.3: later\n", TODO)).toBe(false);
    expect(settles("9efb08a1.Todo.3: skip\n", TODO)).toBe(true);
    expect(settles("9efb08a1.Decide.3: later\n", DECIDE)).toBe(true);
  });

  test("letters after a Todo reference are no answer", () => {
    expect(answersIn("9efb08a1.Todo.3.A\n")).toEqual([]);
  });
});

describe("the draft once Done or Skip is pressed", () => {
  test("writes the word on a line of its own, and a second press takes it out", () => {
    const once = toggledWord("", TODO, "done");

    expect(once).toBe("9efb08a1.Todo.3: done\n");
    expect(toggledWord(once, TODO, "done")).toBe("");
  });

  test("the other word replaces it, in place", () => {
    expect(toggledWord("go on\n9efb08a1.Todo.3: done\nthanks\n", TODO, "skip")).toBe(
      "go on\n9efb08a1.Todo.3: skip\nthanks\n",
    );
  });

  test("keeps the note, and leaves it alone when the word is taken out", () => {
    const noted = withNote("", TODO, "rotated it");

    expect(noted).toBe("9efb08a1.Todo.3: rotated it\n");
    expect(toggledWord(noted, TODO, "done")).toBe("9efb08a1.Todo.3: done: rotated it\n");
    expect(toggledWord("9efb08a1.Todo.3: done: rotated it\n", TODO, "done")).toBe(
      "9efb08a1.Todo.3: rotated it\n",
    );
  });

  test("a note keeps the word, and an empty note keeps the word alone", () => {
    expect(withNote("9efb08a1.Todo.3: skip\n", TODO, "not this week")).toBe(
      "9efb08a1.Todo.3: skip: not this week\n",
    );
    expect(withNote("9efb08a1.Todo.3: skip: not this week\n", TODO, "")).toBe("9efb08a1.Todo.3: skip\n");
    expect(withNote("9efb08a1.Todo.3: later\n", TODO, "")).toBe("");
  });

  test("leaves a Decide item's answer of the same number as it is", () => {
    const draft = choose("", DECIDE, "B");

    expect(toggledWord(draft, TODO, "done")).toBe("9efb08a1.Decide.3.B\n9efb08a1.Todo.3: done\n");
  });
});

describe("what Submit sends and the pane counts", () => {
  const raised = withItems(emptyRaised, [DECIDE, TODO]);

  test("a word is sent with its note; a note alone is sent as text, settling nothing", () => {
    expect(sentOf("9efb08a1.Todo.3: skip: not this week\n", raised)).toEqual([
      { ref: TODO.ref, how: "sent-word", word: "skip", note: "not this week" },
    ]);
    expect(sentOf("9efb08a1.Todo.3: not this week\n", raised)).toEqual([]);
    expect(sentOf("9efb08a1.Decide.3.A\n", raised)).toEqual([
      { ref: DECIDE.ref, how: "sent", letters: ["A"], note: "" },
    ]);
  });

  test("the draft's answers count as the pane's Queued does: a word, not a note alone", () => {
    expect(answeredCount(raised, "9efb08a1.Todo.3: later\n")).toBe(0);
    expect(answeredCount(raised, "9efb08a1.Todo.3: done\n9efb08a1.Decide.3.A\n")).toBe(2);
  });

  test("both lists are open, a reply draws its Decide items alone, and only a new Decide item opens the pane", () => {
    expect(stillOpen(raised)).toEqual([DECIDE, TODO]);
    expect(decideItemsOf(raised)).toEqual([DECIDE]);
    expect(unseen(raised)).toEqual([DECIDE]);
    expect(unseen(withItems(emptyRaised, [TODO]))).toEqual([]);
  });
});
