// What an answer says after an item's reference and its `: `, for a list
// with settling words: Todo's `done` and `skip`, from the spec, alone or
// before a note, and any other text a note alone.

import { describe, test } from "node:test";
import { expect } from "expect";
import fc from "fast-check";

import { saidOf, saidText } from "../../../src/items/said.ts";
import {
  DECIDE,
  PANE_LISTS,
  TODO,
  itemLabel,
  paneListOf,
  settlingWordsOf,
} from "../../../src/protocol/rules.ts";
import { SPEC } from "../../../src/protocol/spec.ts";
import { SETTINGS } from "../../fixtures/settings.ts";

const WORDS = settlingWordsOf(TODO);

describe("the spec's settling words", () => {
  test("Todo's are done and skip, in that order; Decide has none", () => {
    expect(WORDS).toEqual(["done", "skip"]);
    expect(settlingWordsOf(DECIDE)).toEqual([]);
  });

  test("the shipped actions name each of Todo's words, and no other", () => {
    expect(Object.keys(SETTINGS.actions.todo)).toEqual(WORDS);
  });

  test("the pane draws Todo's items, then Decide's, in the spec's order", () => {
    expect(PANE_LISTS.map((list) => list.header)).toEqual(["Todo", "Decide"]);
    expect(
      PANE_LISTS.map((list) => Object.values(SPEC.lists).indexOf(list)),
    ).toEqual(
      PANE_LISTS.map((list) => Object.values(SPEC.lists).indexOf(list)).toSorted((a, b) => a - b),
    );
    expect(paneListOf("Todo")).toBe(TODO);
    expect(paneListOf("Review")).toBeUndefined();
  });

  test("an item's label names its list, Decide's when none is given", () => {
    expect(itemLabel(2)).toBe("🧠 Decide.2");
    expect(itemLabel(3, TODO)).toBe("👉 Todo.3");
  });
});

describe("what an answer says", () => {
  test("a word alone settles", () => {
    expect(saidOf("done", WORDS)).toEqual({ word: "done", note: "" });
    expect(saidOf(" skip ", WORDS)).toEqual({ word: "skip", note: "" });
  });

  test("a word, a colon and a note settle, with the note", () => {
    expect(saidOf("done: rotated it yesterday", WORDS)).toEqual({
      word: "done",
      note: "rotated it yesterday",
    });
    expect(saidOf("skip: not: this week", WORDS)).toEqual({ word: "skip", note: "not: this week" });
  });

  test("a word in another case is the word", () => {
    expect(saidOf("Done", WORDS)).toEqual({ word: "done", note: "" });
  });

  test("any other text is a note alone, a word inside it among them", () => {
    expect(saidOf("done with half of it", WORDS)).toEqual({ word: "", note: "done with half of it" });
    expect(saidOf("later: after the deploy", WORDS)).toEqual({
      word: "",
      note: "later: after the deploy",
    });
    expect(saidOf("finished", WORDS)).toEqual({ word: "", note: "finished" });
  });

  test("a list with no words reads every text as a note", () => {
    expect(saidOf("done", [])).toEqual({ word: "", note: "done" });
  });

  test("is written as the word, then a colon and the note, either alone", () => {
    expect(saidText({ word: "done", note: "" })).toBe("done");
    expect(saidText({ word: "done", note: "rotated" })).toBe("done: rotated");
    expect(saidText({ word: "", note: "rotated" })).toBe("rotated");
    expect(saidText({ word: "", note: "" })).toBe("");
  });

  test("reads back what it writes, for any word and any note; a note alone that opens on a word reads back as that word", () => {
    const opening = fc
      .tuple(fc.constantFrom(...WORDS, ...WORDS.map((word) => word.toUpperCase())), fc.constantFrom("", ":", ": ", " "), fc.string())
      .map(([word, colon, rest]) => `${word}${colon}${rest}`);

    fc.assert(
      fc.property(
        fc.constantFrom("", ...WORDS),
        fc.oneof(fc.string(), opening).map((note) => note.replace(/\s+/g, " ").trim()),
        (word, note) => {
          const read = saidOf(saidText({ word, note }), WORDS);

          expect(read).toEqual(word === "" ? saidOf(note, WORDS) : { word, note });
          expect(read.word === "").toBe(word === "" && saidOf(note, WORDS).word === "");
        },
      ),
    );
  });

  test("a note alone that opens on a word, any case, is that word and the rest its note", () => {
    expect(saidOf(saidText({ word: "", note: "skip" }), WORDS)).toEqual({ word: "skip", note: "" });
    expect(saidOf(saidText({ word: "", note: "Done: rotated it" }), WORDS)).toEqual({
      word: "done",
      note: "rotated it",
    });
    expect(saidOf(saidText({ word: "", note: "skipping it" }), WORDS)).toEqual({
      word: "",
      note: "skipping it",
    });
  });
});
