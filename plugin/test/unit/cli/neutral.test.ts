import { describe, test } from "node:test";
import { expect } from "expect";

import { messageAt, turnAt, turnsOfJson } from "../../../cli/neutral.ts";
import type { Turn } from "../../../types/index.d.ts";

const TURN: Turn = {
  id: "0f311c94",
  prompt: { owner: "user", text: "Go on.", reportNames: undefined },
  replies: ["Done."],
  decide: [],
  messages: [],
};

const ITEM = {
  number: 1,
  summary: "Which?",
  kind: "radio",
  options: [{ letter: "A", name: "This" }],
};

/** The problems of a turn read with `decide` its Decide items. */
const itemProblems = (decide: readonly unknown[]): readonly string[] => {
  const read = turnAt({ ...TURN, decide }, "t");

  return "problems" in read ? read.problems : [];
};

describe("messageAt", () => {
  test("reads a message, its report names left out as none", () => {
    expect(messageAt({ owner: "peer", text: "hi" }, "m")).toEqual({
      value: { owner: "peer", text: "hi", reportNames: undefined },
    });
  });

  test("keeps a report's names", () => {
    expect(messageAt({ owner: "notification", text: "x", reportNames: ["b8a8"] }, "m")).toEqual({
      value: { owner: "notification", text: "x", reportNames: ["b8a8"] },
    });
  });

  test("names every field out of shape, an unknown one too", () => {
    expect(messageAt({ owner: "robot", text: 3, reportNames: "b8a8", from: "x" }, "m")).toEqual({
      problems: [
        "m.from is no field of a message",
        "m.owner isn't one of user, this-plugin, other-plugin, peer, notification, scheduled",
        "m.text isn't a string",
        "m.reportNames isn't a list of strings",
      ],
    });
  });

  test("refuses a value that isn't an object", () => {
    expect(messageAt("hi", "m")).toEqual({ problems: ["m isn't an object"] });
  });
});

describe("turnAt", () => {
  test("reads a turn written as the Turn type gives it", () => {
    expect(turnAt(JSON.parse(JSON.stringify(TURN)), "t")).toEqual({ value: TURN });
  });

  test("reads left-out replies, Decide items and messages as none, and a left-out unanswered as answered", () => {
    expect(turnAt({ id: "0f311c94", prompt: { owner: "user", text: "Go on." } }, "t")).toEqual({
      value: { ...TURN, replies: [] },
    });
  });

  test("keeps an unanswered turn's mark, and leaves it out for unanswered false", () => {
    expect(turnAt({ ...TURN, unanswered: true }, "t")).toEqual({ value: { ...TURN, unanswered: true } });
    expect(turnAt({ ...TURN, unanswered: false }, "t")).toEqual({ value: TURN });
  });

  test("keeps a turn's times, and leaves out one not given, as unknown", () => {
    const timed = { ...TURN, promptedAt: "2026-11-16T20:00:00.000Z", answeredAt: "2026-11-16T20:01:00Z" };

    expect(turnAt(timed, "t")).toEqual({ value: timed });
    expect(turnAt({ ...TURN, promptedAt: "2026-11-16T20:00:00.000Z" }, "t")).toEqual({
      value: { ...TURN, promptedAt: "2026-11-16T20:00:00.000Z" },
    });
  });

  test("refuses a time that isn't one, naming it", () => {
    expect(turnAt({ ...TURN, promptedAt: "yesterday", answeredAt: 7 }, "t")).toEqual({
      problems: [
        "t.promptedAt isn't an ISO 8601 time: \"yesterday\"",
        "t.answeredAt isn't an ISO 8601 time: 7",
      ],
    });
  });

  test("refuses a time Date.parse would take but ISO 8601 doesn't write, or one with no zone", () => {
    const refused = (time: string) => "problems" in turnAt({ ...TURN, promptedAt: time }, "t");

    expect(refused("Mon, 16 Nov 2026 20:00:00 GMT")).toBe(true);
    expect(refused("2026-11-16")).toBe(true);
    expect(refused("2026-11-16T20:00:00")).toBe(true);
    expect(refused("2026-13-16T20:00:00Z")).toBe(true);
    expect(refused("2026-11-16T20:00:00+01:00")).toBe(false);
    expect(refused("2026-11-16T20:00Z")).toBe(false);
  });

  test("gives a Decide item with no turn the turn's own id, as kanban_options reads it", () => {
    const read = turnAt({ ...TURN, decide: [ITEM] }, "t");

    expect("value" in read ? read.value.decide.map((item) => item.ref) : read).toEqual([
      "0f311c94.Decide.1",
    ]);
  });

  test("reads back a Decide item as the core gives it, its ref and list included", () => {
    const read = turnAt({ ...TURN, decide: [ITEM] }, "t");
    const again = "value" in read ? turnAt(JSON.parse(JSON.stringify(read.value)), "t") : read;

    expect(again).toEqual(read);
  });

  test("works out an item's ref and list afresh, whatever the item gives", () => {
    const read = turnAt({ ...TURN, decide: [{ ...ITEM, ref: "ffffffff.Decide.9", list: "Todo" }] }, "t");

    expect("value" in read ? read.value.decide.map((item) => [item.ref, item.list]) : read).toEqual([
      ["0f311c94.Decide.1", "Decide"],
    ]);
  });

  test("refuses an item's turn the reference grammar can't write", () => {
    expect(itemProblems([{ ...ITEM, turn: "turn one" }])).toEqual([
      `t.decide[0].turn isn't a turn's id: 8 characters of 0123456789abcdef: "turn one"`,
    ]);
  });

  test("refuses an item's number that isn't a whole number, 1 or more", () => {
    expect(
      [0, -1, 1.5, 2 ** 53, "1"].map((number) =>
        itemProblems([{ ...ITEM, number }]).find((problem) => problem.startsWith("t.decide[0].number")),
      ),
    ).toEqual([
      "t.decide[0].number isn't a whole number, 1 or more: 0",
      "t.decide[0].number isn't a whole number, 1 or more: -1",
      "t.decide[0].number isn't a whole number, 1 or more: 1.5",
      "t.decide[0].number isn't a whole number, 1 or more: 9007199254740992",
      `t.decide[0].number isn't a whole number, 1 or more: "1"`,
    ]);
  });

  test("refuses an item's note or frees that isn't a list of strings", () => {
    expect(itemProblems([{ ...ITEM, note: "a line", frees: ["0f311c94.Todo.1", 2] }])).toEqual([
      `t.decide[0].note isn't a list of strings: "a line"`,
      `t.decide[0].frees isn't a list of strings: ["0f311c94.Todo.1",2]`,
    ]);
  });

  test("refuses an option's glyph or consequence that isn't a string, and pros, cons or notes that isn't a list of strings", () => {
    expect(
      itemProblems([
        {
          ...ITEM,
          options: [{ letter: "A", name: "This", glyph: 1, consequence: ["x"], pros: "fast", cons: [1], notes: {} }],
        },
      ]),
    ).toEqual([
      "t.decide[0].options[0].glyph isn't a string: 1",
      `t.decide[0].options[0].consequence isn't a string: ["x"]`,
      `t.decide[0].options[0].pros isn't a list of strings: "fast"`,
      "t.decide[0].options[0].cons isn't a list of strings: [1]",
      "t.decide[0].options[0].notes isn't a list of strings: {}",
    ]);
  });

  test("reads an item's and an option's typed fields given as their types ask", () => {
    const item = {
      ...ITEM,
      turn: "1a2b3c4d",
      note: ["a line"],
      frees: ["0f311c94.Todo.1"],
      options: [{ letter: "A", name: "This", glyph: "🔘", consequence: "ships", pros: ["fast"], cons: [], notes: ["n"] }],
    };

    expect(itemProblems([item])).toEqual([]);
  });

  test("names every part out of shape, nested ones by their place", () => {
    expect(
      turnAt(
        {
          id: "",
          prompt: { owner: "user" },
          replies: ["ok", 2],
          decide: [{ number: 1 }],
          messages: "none",
          unanswered: "yes",
          when: "now",
        },
        "turns[3]",
      ),
    ).toEqual({
      problems: [
        "turns[3].when is no field of a turn",
        `turns[3].id "" isn't a turn's id: 8 characters of 0123456789abcdef`,
        "turns[3].prompt.text isn't a string",
        "turns[3].decide[0] isn't a Decide item as kanban_options takes one: a number, a summary and options, each with a letter and a name",
        "turns[3].messages isn't a list",
        "turns[3].replies isn't a list of strings",
        "turns[3].unanswered isn't true or false",
      ],
    });
  });

  test("refuses a turn id the reference grammar can't write", () => {
    const problems = (id: unknown) => {
      const read = turnAt({ ...TURN, id }, "t");

      return "problems" in read ? read.problems : [];
    };

    expect(problems("0F311C94")).toEqual([
      `t.id "0F311C94" isn't a turn's id: 8 characters of 0123456789abcdef`,
    ]);
    expect(problems("0f311c9")).toHaveLength(1);
    expect(problems(7)).toEqual([`t.id 7 isn't a turn's id: 8 characters of 0123456789abcdef`]);
  });

  test("refuses an item's or an option's unknown field, by its place", () => {
    expect(
      itemProblems([{ ...ITEM, colour: "red", options: [{ letter: "A", name: "This", why: "x" }] }]),
    ).toEqual(["t.decide[0].colour is no field of a Decide item", "t.decide[0].options[0].why is no field of an option"]);
  });

  test("refuses a kind the spec doesn't name", () => {
    expect(itemProblems([{ ...ITEM, kind: "dial" }])).toEqual([
      `t.decide[0].kind names no option kind of the spec: "dial"; give one of radio, checkbox, binary`,
    ]);
  });

  test("refuses a letter outside the grammar's, one its kind doesn't take, and one given twice", () => {
    expect(
      itemProblems([
        { ...ITEM, options: [{ letter: "a", name: "x" }, { letter: "B", name: "y" }, { letter: "B", name: "z" }] },
        { ...ITEM, number: 2, kind: "binary", options: [{ letter: "A", name: "x" }] },
      ]),
    ).toEqual([
      `t.decide[0].options[0].letter "a" isn't one of A to Z`,
      "t.decide[0].options give the letter B more than once",
      "t.decide[1].options[0].letter A isn't one a binary item takes: Y, N",
    ]);
  });
});

describe("turnsOfJson", () => {
  test("reads a JSON list of turns", () => {
    expect(turnsOfJson(JSON.stringify([TURN, { ...TURN, id: "1a2b3c4d" }]))).toEqual({
      value: [TURN, { ...TURN, id: "1a2b3c4d" }],
    });
  });

  test("reads an empty list as no turns", () => {
    expect(turnsOfJson("[]")).toEqual({ value: [] });
  });

  test("refuses text that isn't JSON, or JSON that isn't a list", () => {
    expect(turnsOfJson("[{")).toEqual({ problems: ["the input isn't JSON"] });
    expect(turnsOfJson('{"turns": []}')).toEqual({
      problems: ["the input isn't a JSON list of turns"],
    });
  });

  test("names each turn out of shape by its place, and reads none", () => {
    expect(turnsOfJson(JSON.stringify([TURN, { prompt: TURN.prompt }]))).toEqual({
      problems: [`turns[1].id undefined isn't a turn's id: 8 characters of 0123456789abcdef`],
    });
  });

  test("refuses a turn id that opens a second turn, by its place", () => {
    expect(turnsOfJson(JSON.stringify([TURN, { ...TURN, id: "1a2b3c4d" }, TURN]))).toEqual({
      problems: ["turns[2].id 0f311c94 opens a second turn, as turns[0].id does"],
    });
  });
});
