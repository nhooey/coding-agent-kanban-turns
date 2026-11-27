// The line an item ends on naming the items it frees, read by the spec's
// grammar, and its references resolved against the items the turns hold.

import { describe, test } from "node:test";
import { expect } from "expect";

import {
  FREED_LISTS,
  freesLineOf,
  freesOfLine,
  isFreesLine,
  refOfText,
  refText,
  resolvedRefs,
  uniqueRefs,
} from "../../../src/items/frees.ts";
import { SPEC } from "../../../src/protocol/spec.ts";

describe("the lists a reference may name", () => {
  test("are the ones that roll up, by header, in the spec's order", () => {
    expect(FREED_LISTS).toEqual(
      Object.values(SPEC.lists)
        .filter((list) => list["rolls-up"])
        .map((list) => list.header),
    );
    expect(FREED_LISTS).not.toContain(SPEC.lists.done.header);
  });
});

describe("refOfText", () => {
  test("reads a reference's turn, list and number", () => {
    expect(refOfText("0f311c94.Decide.2")).toEqual({
      turn: "0f311c94",
      list: "Decide",
      number: 2,
    });
  });

  test("reads a turn id's prefix as long as the spec's shortest", () => {
    expect(refOfText("0f311c.Todo.1")).toEqual({
      turn: "0f311c",
      list: "Todo",
      number: 1,
    });
  });

  test("refuses a reference with no turn, a short or foreign turn id, letters or a note", () => {
    [
      "Decide.2",
      "0f311.Decide.2",
      "0f311c94a.Decide.2",
      "0F311C94.Decide.2",
      "0f311c94.Decide.2.B",
      "0f311c94.Decide.2: soon",
      "",
    ].forEach((text) => expect(refOfText(text)).toBeUndefined());
  });

  test("refuses a list that doesn't roll up, a name the spec gives no list, and a number that isn't one", () => {
    [
      "0f311c94.Done.1",
      "0f311c94.Answers.1",
      "0f311c94.Backlog.1",
      "0f311c94.decide.1",
      "0f311c94.Decide.0",
      "0f311c94.Decide.02",
      "0f311c94.Decide.x",
    ].forEach((text) => expect(refOfText(text)).toBeUndefined());
  });

  test("refuses a number past the safe integers, which would read as another", () => {
    expect(refOfText("0f311c94.Todo.9007199254740991")).toEqual({
      turn: "0f311c94",
      list: "Todo",
      number: Number.MAX_SAFE_INTEGER,
    });
    expect(refOfText("0f311c94.Todo.9007199254740993")).toBeUndefined();
    expect(refOfText(`0f311c94.Todo.${"9".repeat(400)}`)).toBeUndefined();
  });

  test("writes back as it reads", () => {
    expect(refText({ turn: "0f311c", list: "Review", number: 12 })).toBe(
      "0f311c.Review.12",
    );
  });
});

describe("freesOfLine", () => {
  test("reads each reference the line names, in order, once each", () => {
    expect(
      freesOfLine(
        "   Frees: 0f311c94.Decide.2, 0f311c94.Review.1,0f311c94.Decide.2",
      ),
    ).toEqual(["0f311c94.Decide.2", "0f311c94.Review.1"]);
  });

  test("leaves out what isn't a reference, and reads a line that names none as freeing nothing", () => {
    expect(
      freesOfLine("Frees: the release, 0f311c94.Done.1, 0f311c94.Todo.3"),
    ).toEqual(["0f311c94.Todo.3"]);
    expect(freesOfLine("Frees:")).toEqual([]);
  });

  test("is undefined for a line that doesn't open on the label and its colon", () => {
    ["It frees 0f311c94.Todo.3", "frees: 0f311c94.Todo.3", "Frees 0f311c94.Todo.3"].forEach(
      (line) => expect(freesOfLine(line)).toBeUndefined(),
    );
  });
});

describe("resolvedRefs", () => {
  const ids = ["a1b2c3d4", "a1b2c3ff", "b2c3d4e5"];
  const known = new Set([
    "a1b2c3d4.Todo.1",
    "a1b2c3ff.Todo.1",
    "a1b2c3ff.Decide.1",
    "b2c3d4e5.Review.1",
  ]);

  test("gives each reference to an item of the turn or an earlier one by the turn's whole id", () => {
    expect(
      resolvedRefs(["a1b2c3d4.Todo.1", "a1b2c3f.Decide.1"], ids, { from: 0, at: 2 }, known),
    ).toEqual(["a1b2c3d4.Todo.1", "a1b2c3ff.Decide.1"]);
  });

  test("takes the latest turn a shared prefix names that holds the item", () => {
    expect(resolvedRefs(["a1b2c3.Todo.1"], ids, { from: 0, at: 2 }, known)).toEqual([
      "a1b2c3ff.Todo.1",
    ]);
    expect(resolvedRefs(["a1b2c3.Todo.1"], ids, { from: 0, at: 0 }, known)).toEqual([
      "a1b2c3d4.Todo.1",
    ]);
    expect(resolvedRefs(["a1b2c3.Decide.1"], ids, { from: 0, at: 2 }, known)).toEqual([
      "a1b2c3ff.Decide.1",
    ]);
  });

  test("leaves out a reference to a later turn, an unknown turn or an item no turn printed", () => {
    expect(
      resolvedRefs(
        ["b2c3d4e5.Review.1", "ffffffff.Todo.1", "a1b2c3d4.Todo.9"],
        ids,
        { from: 0, at: 1 },
        known,
      ),
    ).toEqual([]);
  });

  test("leaves out a reference to a turn before the span, as a reassess turn starts it", () => {
    expect(
      resolvedRefs(["a1b2c3d4.Todo.1", "a1b2c3.Todo.1"], ids, { from: 1, at: 2 }, known),
    ).toEqual(["a1b2c3ff.Todo.1"]);
  });

  test("names each item once", () => {
    expect(
      resolvedRefs(["a1b2c3d4.Todo.1", "a1b2c3d4.Todo.1"], ids, { from: 0, at: 0 }, known),
    ).toEqual(["a1b2c3d4.Todo.1"]);
  });
});

describe("isFreesLine", () => {
  test("is a line opening on the label and its colon, its indent aside, whatever follows", () => {
    expect(isFreesLine("   Frees: 0f311c94.Todo.1")).toBe(true);
    expect(isFreesLine("Frees: nothing listed")).toBe(true);
    expect(isFreesLine("It frees 0f311c94.Todo.1")).toBe(false);
    expect(isFreesLine("**Frees:** 0f311c94.Todo.1")).toBe(false);
  });
});

describe("freesLineOf", () => {
  test("writes the line as a reply does, by the spec's label and separator", () => {
    expect(freesLineOf(["0f311c94.Todo.1", "0f311c94.Review.2"])).toEqual([
      `${SPEC.frees.label}: 0f311c94.Todo.1${SPEC.frees.separator} 0f311c94.Review.2`,
    ]);
    expect(freesOfLine(freesLineOf(["0f311c94.Todo.1", "0f311c94.Review.2"])[0] ?? "")).toEqual([
      "0f311c94.Todo.1",
      "0f311c94.Review.2",
    ]);
  });

  test("is no line for an item that frees nothing", () => {
    expect(freesLineOf([])).toEqual([]);
  });
});

describe("uniqueRefs", () => {
  test("keeps the strings that read as references, each once, in order", () => {
    expect(
      uniqueRefs(["0f311c94.Todo.1", 3, "nothing", "0f311c94.Todo.1", "0f311c94.Decide.2"]),
    ).toEqual(["0f311c94.Todo.1", "0f311c94.Decide.2"]);
  });
});
