// The core's functions that answers.test.ts reaches only through others:
// each tested on its own here.

import { describe, test } from "node:test";
import { expect } from "expect";

import { answersIn, answerTo, lettersAfter } from "../src/answers.ts";
import {
  afterChoice,
  away,
  back,
  drawnMark,
  emptyBand,
  movedOn,
  positionIn,
  progressMarks,
  shownAt,
  shownItem,
} from "../src/band.ts";
import { glyphOf, refOf } from "../src/items.ts";
import type { Band, DecideItem } from "../types/index.d.ts";

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
const items = [radio, checkbox, binary];
const band: Band = { ...emptyBand, items };

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
});

describe("where the band stands", () => {
  test("its position is held inside its items", () => {
    expect(positionIn({ ...band, position: 7 })).toBe(2);
    expect(positionIn({ ...band, position: -1 })).toBe(0);
    expect(positionIn(emptyBand)).toBe(0);
  });

  test("the shown item is the one at its position, none when it has no items", () => {
    expect(shownItem({ ...band, position: 1 })).toBe(checkbox);
    expect(shownItem(emptyBand)).toBeUndefined();
  });

  test("an answer to the shown item moves on to the next unanswered one", () => {
    expect(movedOn(band, radio, "9efb08a1.Decide.1.A").position).toBe(1);
    expect(movedOn(band, checkbox, "9efb08a1.Decide.2.A")).toBe(band);
  });

  test("a checkbox click stays for more letters; a radio click moves on", () => {
    const onCheckbox = { ...band, position: 1 };
    expect(afterChoice(onCheckbox, checkbox, "9efb08a1.Decide.2.A")).toBe(onCheckbox);
    expect(afterChoice(band, radio, "9efb08a1.Decide.1.A").position).toBe(1);
  });

  test("a link's item is shown, and the band reopened; no item leaves it be", () => {
    const folded = { ...band, isDismissed: true, isAway: true };
    expect(shownAt(folded, 2, "")).toMatchObject({ position: 2, isDismissed: false, isAway: false });
    expect(shownAt(folded, -1, "")).toBe(folded);
  });

  test("a submitted prompt folds the band and the reply's end brings it back", () => {
    expect(away(band).isAway).toBe(true);
    expect(back(away(band)).isAway).toBe(false);
    expect(back({ ...band, isDismissed: true }).isDismissed).toBe(true);
  });
});

describe("the progress marks", () => {
  test("one mark per item, answered or not, with the shown one", () => {
    expect(progressMarks({ ...band, position: 1 }, "9efb08a1.Decide.2.A")).toEqual([
      { mark: "○", isShown: false },
      { mark: "●", isShown: true },
      { mark: "○", isShown: false },
    ]);
  });

  test("the shown mark is ringed", () => {
    expect(drawnMark("●", true)).toBe("◉");
    expect(drawnMark("○", true)).toBe("◎");
    expect(drawnMark("●", false)).toBe("●");
  });
});
