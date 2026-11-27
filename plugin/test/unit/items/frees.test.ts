// The line an item ends on naming the items it frees, read by the spec's
// grammar, and its references resolved against the items the turns hold.

import { describe, test } from "node:test";
import { expect } from "expect";

import {
  freesLineOf,
  freesOfLine,
  isFreesLine,
  resolvedRefs,
} from "../../../src/items/frees.ts";
import { SPEC } from "../../../src/protocol/spec.ts";

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
