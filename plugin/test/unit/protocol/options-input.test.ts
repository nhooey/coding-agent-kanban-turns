// The reader of the kanban_options tool's input, and the references it
// reads by the spec's grammar.

import { describe, test } from "node:test";
import { expect } from "expect";

import {
  FREED_LISTS,
  decideRefOf,
  ignoredSupersedes,
  itemsOf,
  refOfText,
  refText,
  uniqueRefs,
} from "../../../src/protocol/options-input.ts";
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

describe("uniqueRefs", () => {
  test("keeps the strings that read as references, each once, in order", () => {
    expect(
      uniqueRefs(["0f311c94.Todo.1", 3, "nothing", "0f311c94.Todo.1", "0f311c94.Decide.2"]),
    ).toEqual(["0f311c94.Todo.1", "0f311c94.Decide.2"]);
  });
});

describe("the items a kanban_options call hands over", () => {
  test("a ref and a kind left out are filled in, and a malformed item dropped", () => {
    const found = itemsOf({
      items: [
        {
          turn: "abc12345",
          number: 4,
          summary: "S",
          options: [{ letter: "A", name: "a" }],
        },
        { turn: 1 },
      ],
    });
    expect(found).toEqual([
      {
        turn: "abc12345",
        list: "Decide",
        number: 4,
        summary: "S",
        kind: "radio",
        ref: "abc12345.Decide.4",
        options: [{ letter: "A", name: "a" }],
      },
    ]);
  });

  test("an array, even one with an items field, hands over none", () => {
    const item = {
      turn: "abc12345",
      number: 4,
      summary: "S",
      options: [{ letter: "A", name: "a" }],
    };

    expect(itemsOf([item])).toEqual([]);
    expect(itemsOf(Object.assign([], { items: [item] }))).toEqual([]);
  });

  test("an item's frees keep only the references, each once, and one not given an array is dropped", () => {
    const item = { turn: "abc12345", number: 4, summary: "S", options: [{ letter: "A", name: "a" }] };
    const [given, bad] = itemsOf({
      items: [
        { ...item, frees: ["abc12345.Todo.1", "the release", 7, "abc12345.Todo.1", "abc123.Review.2"] },
        { ...item, number: 5, frees: "abc12345.Todo.1" },
      ],
    });

    expect(given?.frees).toEqual(["abc12345.Todo.1", "abc123.Review.2"]);
    expect(bad === undefined ? true : "frees" in bad).toBe(false);
  });

  test("an item's supersedes keep only Decide items' references, each once, an empty one kept, one not given an array or naming no item dropped", () => {
    const item = { turn: "abc12345", number: 4, summary: "S", options: [{ letter: "A", name: "a" }] };
    const [given, empty, bad, none, naming] = itemsOf({
      items: [
        {
          ...item,
          supersedes: ["682e71fb.Decide.1", " 682e71fb.Decide.1", "682e71.Decide.2", "682e71fb.Todo.1", "Decide.3", 7],
        },
        { ...item, number: 5, supersedes: [] },
        { ...item, number: 6, supersedes: "682e71fb.Decide.1" },
        { ...item, number: 7 },
        { ...item, number: 8, supersedes: ["682e71fb.Todo.1", "Decide.3"] },
      ],
    });

    expect(given?.supersedes).toEqual(["682e71fb.Decide.1", "682e71.Decide.2"]);
    expect(empty?.supersedes).toEqual([]);
    expect(bad === undefined ? true : "supersedes" in bad).toBe(false);
    expect(none === undefined ? true : "supersedes" in none).toBe(false);
    expect(naming === undefined ? true : "supersedes" in naming).toBe(false);
  });

  test("what an item's supersedes held that itemsOf leaves out, by the item's ref, as JSON, and whether any of it stands", () => {
    const item = { turn: "abc12345", number: 4, summary: "S", options: [{ letter: "A", name: "a" }] };

    expect(
      ignoredSupersedes({
        items: [
          { ...item, supersedes: ["682e71fb.Decide.1", "682e71fb.Todo.1", "Decide.3", 7, " 682e71fb.Decide.2 "] },
          { ...item, number: 5, supersedes: ["682e71fb.Decide.1"] },
          { ...item, number: 6, supersedes: "682e71fb.Decide.x" },
          { ...item, number: 7 },
          { ...item, number: 8, supersedes: ["Decide.3"] },
          { ...item, number: 9, supersedes: [] },
          { turn: 1, supersedes: ["x"] },
        ],
      }),
    ).toEqual([
      { ref: "abc12345.Decide.4", values: [`"682e71fb.Todo.1"`, `"Decide.3"`, "7"], left: "some" },
      { ref: "abc12345.Decide.6", values: [`"682e71fb.Decide.x"`], left: "list" },
      { ref: "abc12345.Decide.8", values: [`"Decide.3"`], left: "all" },
    ]);
    expect(ignoredSupersedes([])).toEqual([]);
  });

  test("a Decide item's reference is its turn, by an id or a long enough prefix, the list and its number, the whole text", () => {
    expect(decideRefOf("682e71fb.Decide.1")).toEqual({ turn: "682e71fb", list: "Decide", number: 1 });
    expect(decideRefOf(" 682e71.Decide.12 ")).toEqual({ turn: "682e71", list: "Decide", number: 12 });
    for (const text of ["682e7.Decide.1", "682e71fb.Todo.1", "Decide.1", "682e71fb.Decide.0", "682e71fb.Decide.1.A", 1]) {
      expect(decideRefOf(text)).toBeUndefined();
    }
  });
});
