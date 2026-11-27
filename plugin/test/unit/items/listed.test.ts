// The Todo items a reply's own list prints, read by turn, number, summary
// and body, a line of code in it among them; and how each settles: by a
// settling word, a later `reassess` turn or a later item on its subject,
// never by a note alone. The count line and the 📌 roll-up drop an item a
// word settled too, by Todo's `settled-by`, `settling-word`. What a line's
// words say is word-answers.test.ts's.

import { describe, test } from "node:test";
import { expect } from "expect";

import { openTodoOf, todoStates, wordedSubjects } from "../../../src/items/listed.ts";
import { countLine, rollUp, settlingOf, summaryOf, unsettled } from "../../../src/items/outstanding.ts";
import type { TodoItem, Turn } from "../../../types/index.d.ts";
import { turnOf } from "../../fixtures/turns.ts";

/** The Todo items one reply `text` prints, as the turn `turn` raises them, in order. */
const todoItemsOfText = (text: string, turn: string): readonly TodoItem[] =>
  todoStates([turnOf(turn, "go", { replies: [text] })]).map((state) => state.item);

const FIRST = "9efb08a1";
const SECOND = "b2c3d4e5";
const THIRD = "c3d4e5f6";

/** A reply printing a Pending list, then a Todo list of `items`, each `[summary, body lines]`. */
const todoReply = (items: readonly (readonly [string, readonly string[]])[]): string =>
  [
    "Some work.",
    "",
    "🚧 **Pending:**  ",
    "▔▔▔▔▔▔▔▔▔▔▔",
    "1. **Rework the loader**",
    "",
    "👉 **Todo:**  ",
    "▔▔▔▔▔▔▔▔",
    ...items.flatMap(([summary, body], n) => [
      `${n + 1}. **${summary}**${body.length > 0 ? "  " : ""}`,
      ...body.map((line) => `   ${line}`),
      ...(body.length > 0 ? ["   ⠀"] : []),
    ]),
    "",
  ].join("\n");

const LISTED = todoReply([
  ["Rotate the deploy token", ["It expires on Friday.", "Frees: 9efb08a1.Decide.1"]],
  ["Announce the release", []],
]);

const raising = (id = FIRST): Turn => turnOf(id, "go", { replies: [LISTED] });

/** The summaries of the Todo items the 📌 roll-up still carries, nothing settled by a merge. */
const outstandingTodos = (turns: readonly Turn[]): readonly string[] =>
  unsettled(turns, rollUp(turns, 0), new Set())
    .filter((item) => item.list === "todo")
    .map((item) => summaryOf(item.line));

describe("the Todo items of a reply", () => {
  test("each numbered item of its Todo list, by turn, number, summary and body, its Frees: line apart", () => {
    // The Frees: line names the reply's own Decide item, which it frees.
    const withDecide = `${LISTED}\n🧠 **Decide:**  \n▔▔▔▔▔▔▔▔▔▔\n1. **Which cache to keep**\n   🔘 A. **Disk**\n`;

    expect(todoItemsOfText(withDecide, FIRST)).toEqual([
      {
        turn: FIRST,
        list: "Todo",
        number: 1,
        summary: "Rotate the deploy token",
        ref: `${FIRST}.Todo.1`,
        note: ["It expires on Friday."],
        frees: ["9efb08a1.Decide.1"],
      },
      {
        turn: FIRST,
        list: "Todo",
        number: 2,
        summary: "Announce the release",
        ref: `${FIRST}.Todo.2`,
      },
    ]);
  });

  test("the rest of an item's own line after its summary opens its body", () => {
    const text = "👉 **Todo:**  \n▔▔▔▔▔▔▔▔\n1. **Rotate the token**: it expires on Friday.\n";

    expect(todoItemsOfText(text, FIRST)[0]).toMatchObject({
      summary: "Rotate the token",
      note: ["it expires on Friday."],
    });
  });

  test("a fenced command in its body is kept, each line of it as code, its fences left out", () => {
    const text = [
      "👉 **Todo:**  ",
      "▔▔▔▔▔▔▔▔",
      "1. **Push the release tag**  ",
      "   From the repository's root:",
      "   ```sh",
      "   git push origin v2.4",
      "     --follow-tags",
      "   ```",
      "",
    ].join("\n");

    expect(todoItemsOfText(text, FIRST)[0]?.note).toEqual([
      "From the repository's root:",
      "`git push origin v2.4`",
      "`  --follow-tags`",
    ]);
  });

  test("an older reply's alias for the list reads too", () => {
    expect(todoItemsOfText("👉 **To do:**\n1. **Rotate the token**\n", FIRST)).toHaveLength(1);
  });

  test("no other list's items, no 📌 roll-up bullet, and no unnumbered item are Todo items", () => {
    const text = [
      "🧠 **Decide:**",
      "1. **Which cache**",
      "   🔘 A. **Disk**",
      "",
      "👉 **Todo:**",
      "- **A bullet**",
      "",
      "📌 **Outstanding from previous turns:**",
      "- 👉 **Rotate the token** 🔖 9efb08a1₋₁",
    ].join("\n");

    expect(todoItemsOfText(text, FIRST)).toEqual([]);
  });
});

describe("how a Todo item settles", () => {
  test("a word settles it, keeping the answer that did; a note alone settles nothing", () => {
    const turns = [raising(), turnOf(SECOND, "Todo.1: done: rotated it\nTodo.2: after lunch")];

    expect(todoStates(turns).map((state) => [state.item.ref, state.settlement])).toEqual([
      [
        `${FIRST}.Todo.1`,
        { ref: `${FIRST}.Todo.1`, how: "worded", turn: SECOND, word: "done", note: "rotated it" },
      ],
      [`${FIRST}.Todo.2`, undefined],
    ]);
  });

  test("skip settles it too, and the latest word wins", () => {
    const turns = [
      raising(),
      turnOf(SECOND, "9efb08a1.Todo.2: done", { replies: ["On it."] }),
      turnOf(THIRD, "9efb08a1.Todo.2: skip"),
    ];

    expect(todoStates(turns)[1]?.settlement).toEqual({
      ref: `${FIRST}.Todo.2`,
      how: "worded",
      turn: THIRD,
      word: "skip",
      note: "",
    });
  });

  test("a bare word two turns later settles nothing of the first turn's items", () => {
    const turns = [raising(), turnOf(SECOND, "go on", { replies: ["On it."] }), turnOf(THIRD, "Todo.1: done")];

    expect(openTodoOf(turns).items.map((item) => item.ref)).toEqual([`${FIRST}.Todo.1`, `${FIRST}.Todo.2`]);
  });

  test("a later reassess settles every earlier item, an answer in its own prompt applied first", () => {
    const turns = [raising(), turnOf(SECOND, "Todo.1: done\nreassess", { replies: ["Rechecked."] })];

    expect(todoStates(turns).map((state) => state.settlement?.how)).toEqual(["worded", "reassessed"]);
  });

  test("an item a reassess turn prints again is open in that turn, and a word to it there settles it, in the pane and the roll-up", () => {
    const reassessed = [raising(), turnOf(SECOND, "reassess", { replies: [LISTED] })];
    const answered = [...reassessed, turnOf(THIRD, "Todo.1: done")];

    expect(openTodoOf(reassessed).items.map((item) => item.ref)).toEqual([
      `${SECOND}.Todo.1`,
      `${SECOND}.Todo.2`,
    ]);
    expect(openTodoOf(reassessed).settlements.map((s) => s.how)).toEqual(["reassessed", "reassessed"]);
    expect(openTodoOf(answered).items.map((item) => item.ref)).toEqual([`${SECOND}.Todo.2`]);
    expect(outstandingTodos(answered)).toEqual(["Announce the release"]);
  });

  test("a later item on its subject supersedes the earlier one, naming it", () => {
    const turns = [raising(), turnOf(SECOND, "go on", { replies: [LISTED] })];
    const open = openTodoOf(turns);

    expect(open.items.map((item) => item.ref)).toEqual([`${SECOND}.Todo.1`, `${SECOND}.Todo.2`]);
    expect(open.settlements).toEqual([
      { ref: `${FIRST}.Todo.1`, how: "superseded", by: `${SECOND}.Todo.1` },
      { ref: `${FIRST}.Todo.2`, how: "superseded", by: `${SECOND}.Todo.2` },
    ]);
  });

  test("a turn printing its list twice holds each item once, as the later printing reads it", () => {
    const later = todoReply([["Rotate the deploy token now", []]]);

    expect(
      todoStates([turnOf(FIRST, "go", { replies: [LISTED, later] })]).map((state) => state.item.summary),
    ).toEqual(["Rotate the deploy token now", "Announce the release"]);
  });

  test("the count line and the 📌 roll-up drop an item a word settled, and keep one given a note alone", () => {
    const before = [raising(), turnOf(SECOND, "go on")];
    const after = [raising(), turnOf(SECOND, "Todo.1: done\nTodo.2: tomorrow")];

    expect(countLine(before, 0)).toBe("📌 Outstanding: 🚧 1 · 👉 2");
    expect(countLine(after, 0)).toBe("📌 Outstanding: 🚧 1 · 👉 1");
    expect(outstandingTodos(after)).toEqual(["Announce the release"]);
  });

  test("a later printing of a settled item's subject, which no word answers, is carried again", () => {
    const turns = [
      raising(),
      turnOf(SECOND, "Todo.1: done", { replies: [todoReply([["Rotate the deploy token", []]])] }),
    ];

    expect(outstandingTodos(turns)).toEqual(["Rotate the deploy token", "Announce the release"]);
    expect(wordedSubjects(turns)).toEqual(new Set());
  });

  test("a 📌 bullet restating an item a word settled reopens it nowhere", () => {
    const restating = [
      "Noted.",
      "",
      "📌 **Outstanding from previous turns:**  ",
      "▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔",
      "👉 **Todo:**  ",
      "- **Rotate the deploy token** 🔖 9efb08a1₋₁",
      "",
    ].join("\n");
    const turns = [raising(), turnOf(SECOND, "Todo.1: done", { replies: [restating] })];

    expect(outstandingTodos(turns)).toEqual(["Announce the release"]);
    expect(openTodoOf(turns).items.map((item) => item.ref)).toEqual([`${FIRST}.Todo.2`]);
    expect(wordedSubjects(turns).size).toBe(1);
  });

  test("a word on a line that asks a question settles nothing", () => {
    expect(countLine([raising(), turnOf(SECOND, "Todo.1: done?")], 0)).toBe("📌 Outstanding: 🚧 1 · 👉 2");
  });

  test("the 📌 roll-up's settling word settles the subjects a word settled since the latest reassess; the items' states keep those before it too", () => {
    const later = todoReply([["Rotate the deploy token", []]]);
    const rotate = "rotate deploy token";
    // Each case: the turns, the roll-up's worded subjects, the items' states'.
    const cases: readonly (readonly [readonly Turn[], readonly string[], readonly string[]])[] = [
      [[raising()], [], []],
      [[raising(), turnOf(SECOND, "go on")], [], []],
      [[raising(), turnOf(SECOND, "Todo.1: done\nTodo.2: tomorrow")], [rotate], [rotate]],
      [[raising(), turnOf(SECOND, "Todo.1: done?")], [], []],
      [[raising(), turnOf(SECOND, "Todo.1: done", { replies: [later] })], [], []],
      [[raising(), turnOf(SECOND, "Todo.1: done"), turnOf(THIRD, "go on")], [rotate], [rotate]],
      [[raising(), turnOf(SECOND, "Todo.1: done"), turnOf(THIRD, "reassess")], [], [rotate]],
      [
        [raising(), turnOf(SECOND, "reassess", { replies: [LISTED] }), turnOf(THIRD, "Todo.2: done")],
        ["announce release"],
        ["announce release"],
      ],
    ];

    expect(
      cases.map(([turns]) => [[...settlingOf(turns, new Set()).worded], [...wordedSubjects(turns)]]),
    ).toEqual(cases.map(([, rollUp, states]) => [rollUp, states]));
  });
});
