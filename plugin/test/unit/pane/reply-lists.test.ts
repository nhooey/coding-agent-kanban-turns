// A reply's Todo list cut out of its text, for its items' boxes to stand in
// its place, only when it's found intact, as a Decide list is; the Todo
// items a reply prints, as raised; and the reply's text in parts round the
// lists cut out of it.

import { describe, test } from "node:test";
import { expect } from "expect";

import {
  decideListSpan,
  linkedQuestions,
  printedTodoItems,
  replyParts,
  todoListSpan,
} from "../../../src/pane/links.ts";
import type { DecideItem, TodoItem } from "../../../types/index.d.ts";

const todoItem = (turn: string, number: number, summary: string): TodoItem => ({
  turn,
  list: "Todo",
  number,
  summary,
  ref: `${turn}.Todo.${number}`,
});
const rotate = todoItem("9efb08a1", 1, "Rotate the deploy token");
const announce = todoItem("9efb08a1", 2, "Announce the release");

const cache: DecideItem = {
  turn: "9efb08a1",
  list: "Decide",
  number: 1,
  summary: "Which cache to keep",
  kind: "radio",
  ref: "9efb08a1.Decide.1",
  options: [
    { letter: "A", name: "Disk" },
    { letter: "B", name: "Memory" },
  ],
};

const TODO = [
  "👉 **Todo:**  ",
  "▔▔▔▔▔▔▔▔",
  "1. **Rotate the deploy token**  ",
  "   It expires on Friday.",
  "   ```sh",
  "   deploy rotate",
  "   ```",
  "   ⠀",
  "2. **Announce the release**",
];
const DECIDE = [
  "🧠 **Decide:**  ",
  "▔▔▔▔▔▔▔▔▔▔",
  "1. **Which cache to keep**  ",
  "   🔘 A. **Disk**",
  "   🔘 B. **Memory**",
];
const reply = (todo: readonly string[], decide: readonly string[] = DECIDE) =>
  [
    "Some work.",
    "",
    "🚧 **Pending:**  ",
    "1. **Rework the loader**",
    "",
    ...todo,
    "",
    ...decide,
    "",
    "📌 Outstanding: 🚧 1 · 👉 2 · 🧠 1",
  ].join("\n");

/** The lines a span covers, joined. */
const spanned = (text: string, span: { start: number; end: number } | undefined) =>
  span === undefined ? undefined : text.split("\n").slice(span.start, span.end).join("\n");

describe("a reply's Todo list found intact", () => {
  test("spans its header, its rule and every item's lines, code and blank marks among them", () => {
    const text = reply(TODO);
    expect(todoListSpan(text, [rotate, announce])).toEqual({ list: "Todo", start: 5, end: 14 });
    expect(spanned(text, todoListSpan(text, [rotate, announce]))).toBe(TODO.join("\n"));
  });

  test("ends at the next list's header, with no blank line between", () => {
    const text = [...TODO, ...DECIDE].join("\n");
    expect(spanned(text, todoListSpan(text, [rotate, announce]))).toBe(TODO.join("\n"));
  });

  test("ends at prose straight after it, at a line's start", () => {
    const text = [...TODO, "Back to the loader."].join("\n");
    expect(spanned(text, todoListSpan(text, [rotate, announce]))).toBe(TODO.join("\n"));
  });
});

describe("a reply's Todo list not found intact", () => {
  test("is none when an item's summary isn't alone on its line", () => {
    const text = reply(TODO.map((line) => (line.startsWith("2. ") ? `${line} to the team` : line)));
    expect(todoListSpan(text, [rotate, todoItem("9efb08a1", 2, "Announce the release")])).toBeUndefined();
  });

  test("is none when an item is missing from the list, or one it lists isn't given", () => {
    expect(todoListSpan(reply(TODO), [rotate])).toBeUndefined();
    expect(todoListSpan(reply(TODO), [rotate, announce, todoItem("9efb08a1", 3, "Another")])).toBeUndefined();
  });

  test("is none with the items in another order, or none given", () => {
    expect(todoListSpan(reply(TODO), [announce, rotate])).toBeUndefined();
    expect(todoListSpan(reply(TODO), [])).toBeUndefined();
  });

  test("is none with two Todo lists, or only a 📌 roll-up's Todo group", () => {
    expect(todoListSpan([...TODO, "", ...TODO].join("\n"), [rotate, announce])).toBeUndefined();
    const pinned = [
      "Some work.",
      "",
      "📌 **Outstanding from previous turns:**  ",
      "👉 **Todo:**  ",
      "- **Rotate the deploy token** 🔖 9efb08a1₋₁",
    ].join("\n");
    expect(todoListSpan(pinned, [rotate])).toBeUndefined();
  });

  test("is none for a list inside a code block", () => {
    expect(todoListSpan(["```", ...TODO, "```"].join("\n"), [rotate, announce])).toBeUndefined();
  });
});

describe("the Todo items a reply prints", () => {
  const later = [todoItem("b2c3d4e5", 1, "Rotate the deploy token"), todoItem("b2c3d4e5", 2, "Announce the release")];

  test("are its turn's raised items, in the reply's order, among other lists' items", () => {
    expect(printedTodoItems(reply(TODO), [cache, announce, rotate])).toEqual([rotate, announce]);
  });

  test("are the newest turn's whose items hold every one it prints", () => {
    expect(printedTodoItems(reply(TODO), [rotate, announce, ...later])).toEqual(later);
    expect(printedTodoItems(reply(TODO), [rotate, announce, later[0] as TodoItem])).toEqual([rotate, announce]);
  });

  test("match by number and summary, its bold and code marks aside", () => {
    const coded = todoItem("9efb08a1", 1, "Rotate the `deploy` token");
    const text = reply(TODO.map((line) => line.replace("the deploy token", "the `deploy` token")));
    expect(printedTodoItems(text, [coded, announce])).toEqual([coded, announce]);
    expect(printedTodoItems(reply(TODO), [todoItem("9efb08a1", 3, "Rotate the deploy token"), announce])).toEqual([]);
  });

  test("are none where it prints no Todo list, or no turn raised them all", () => {
    expect(printedTodoItems(reply([]), [rotate, announce])).toEqual([]);
    expect(printedTodoItems(reply(TODO), [rotate])).toEqual([]);
    expect(printedTodoItems(reply(TODO), [])).toEqual([]);
  });

  test("leave out a 📌 roll-up's Todo bullets", () => {
    const pinned = ["📌 **Outstanding from previous turns:**  ", "👉 **Todo:**  ", "- **Rotate the deploy token** 🔖 9efb08a1₋₁"].join("\n");
    expect(printedTodoItems(pinned, [rotate, announce])).toEqual([]);
  });
});

describe("a reply's text in parts round the lists cut out of it", () => {
  const text = reply(TODO);
  const spans = [decideListSpan(text, [cache]), todoListSpan(text, [rotate, announce])].flatMap(
    (span) => span ?? [],
  );

  test("draws each list in its place, in the text's order, the text between trimmed", () => {
    expect(replyParts(text, spans)).toEqual([
      { kind: "text", key: "before", text: "Some work.\n\n🚧 **Pending:**  \n1. **Rework the loader**" },
      { kind: "list", list: "Todo" },
      { kind: "list", list: "Decide" },
      { kind: "text", key: "after", text: "📌 Outstanding: 🚧 1 · 👉 2 · 🧠 1" },
    ]);
  });

  test("keys text between two lists by the lists above it", () => {
    const between = reply([...TODO, "", "Then:"]);
    const cut = [todoListSpan(between, [rotate, announce]), decideListSpan(between, [cache])].flatMap(
      (span) => span ?? [],
    );
    expect(replyParts(between, cut).map((part) => (part.kind === "text" ? part.key : part.list))).toEqual([
      "before",
      "Todo",
      "between-1",
      "Decide",
      "after",
    ]);
  });

  test("leaves out empty text either side, and keeps the text whole with no list cut", () => {
    const bare = TODO.join("\n");
    expect(replyParts(bare, [todoListSpan(bare, [rotate, announce])].flatMap((span) => span ?? []))).toEqual([
      { kind: "list", list: "Todo" },
    ]);
    expect(replyParts(" Some work. \n", [])).toEqual([{ kind: "text", key: "questions", text: "Some work." }]);
  });

  test("cuts a reply whose Decide summaries are links where it cuts the reply as written", () => {
    const linked = linkedQuestions(text, [cache]);
    expect(linked.text.split("\n")).toHaveLength(text.split("\n").length);
    const todo = todoListSpan(text, [rotate, announce]);
    expect(spanned(linked.text, todo)).toBe(TODO.join("\n"));
  });
});
