// The core's functions that answers.test.ts reaches only through others:
// each tested on its own here.

import { describe, test } from "node:test";
import { expect } from "expect";

import { answersIn, answerTo, lettersAfter } from "../src/answers.ts";
import { glyphOf, markOf, refOf } from "../src/items.ts";
import type { DecideItem } from "../types/index.d.ts";

const radio: DecideItem = {
  turn: "9efb08a1",
  list: "Decide",
  number: 1,
  summary: "Which cache to keep",
  kind: "radio",
  ref: "9efb08a1.Decide.1",
  options: [
    { letter: "A", name: "Disk" },
    { letter: "B", name: "Memory", glyph: "🔵" },
  ],
};
const checkbox: DecideItem = {
  ...radio,
  number: 2,
  kind: "checkbox",
  ref: "9efb08a1.Decide.2",
  options: [
    { letter: "A", name: "Matchers" },
    { letter: "B", name: "Dead code" },
    { letter: "C", name: "Stale render" },
  ],
};
const binary: DecideItem = {
  ...radio,
  number: 3,
  kind: "binary",
  ref: "9efb08a1.Decide.3",
  options: [
    { letter: "Y", name: "Ship" },
    { letter: "N", name: "Hold" },
  ],
};

describe("reading the answers in a draft", () => {
  test("each answer is found with where it sits, its letters and its note", () => {
    expect(answersIn("ok 9efb08a1.Decide.2.A,C then 9efb08.Decide.1: why")).toEqual([
      { start: 3, end: 24, turn: "9efb08a1", number: 2, letters: ["A", "C"], note: "" },
      { start: 30, end: 50, turn: "9efb08", number: 1, letters: [], note: "why" },
    ]);
  });

  test("a note of letters alone is read as the letters", () => {
    expect(answersIn("9efb08a1.Decide.2: A, C")[0]?.letters).toEqual(["A", "C"]);
  });

  test("a bare reference with no letters and no note is no answer", () => {
    expect(answersIn("see 9efb08a1.Decide.2 above")).toEqual([]);
  });

  test("the answer to an item is the one with its number and turn", () => {
    expect(answerTo("0f311c94.Decide.1.A 9efb08a1.Decide.1.B", radio)?.letters).toEqual(["B"]);
    expect(answerTo("0f311c94.Decide.1.A", radio)).toBeUndefined();
  });
});

describe("the letters a click leaves", () => {
  test("a radio or binary item takes the clicked letter alone", () => {
    expect(lettersAfter(radio, ["A"], "B")).toEqual(["B"]);
    expect(lettersAfter(binary, [], "N")).toEqual(["N"]);
  });

  test("a click on the chosen letter of a radio or binary item unchooses it", () => {
    expect(lettersAfter(radio, ["A"], "A")).toEqual([]);
    expect(lettersAfter(binary, ["Y"], "Y")).toEqual([]);
  });

  test("a checkbox item toggles the letter and keeps option order", () => {
    expect(lettersAfter(checkbox, ["C"], "A")).toEqual(["A", "C"]);
    expect(lettersAfter(checkbox, ["A", "C"], "A")).toEqual(["C"]);
  });
});

describe("the items themselves", () => {
  test("a ref left empty is made from the turn and number", () => {
    expect(refOf({ ...radio, ref: "" })).toBe("9efb08a1.Decide.1");
    expect(refOf(radio)).toBe("9efb08a1.Decide.1");
  });

  test("an option's own glyph wins, else its item kind's", () => {
    expect(glyphOf(radio, "B")).toBe("🔵");
    expect(glyphOf(radio, "A")).toBe("🔘");
    expect(glyphOf(checkbox, "A")).toBe("🔲");
    expect(glyphOf(binary, "Y")).toBe("👍");
    expect(glyphOf(binary, "N")).toBe("👎");
  });

  test("a chosen option is marked ✅, the others keep their glyph", () => {
    expect(markOf(radio, "A", true)).toBe("✅");
    expect(markOf(checkbox, "A", true)).toBe("✅");
    expect(markOf(radio, "A", false)).toBe("🔘");
    expect(markOf(binary, "N", false)).toBe("👎");
  });
});

