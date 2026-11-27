// A reply's lists, every one by one rule: a Todo list cut out of its text
// for its items' boxes to stand in its place, only when it's found intact,
// by the same `listSpan` as a Decide list; the items a reply names, of any
// list, each the newest raised item of the list its summary line sits under
// that it writes; the reply's text in parts round the lists cut out; and
// the whole drawing, the summaries of every list not cut out made links,
// its boxes under the reply in the spec's list order.

import { describe, test } from "node:test";
import { expect } from "expect";

import {
  ITEM_LINK,
  linkedSummaries,
  listSpan,
  replyDrawing,
  replyParts,
} from "../../../src/views/links.ts";
import type { ReplyDrawing } from "../../../src/views/links.ts";
import { summaryText } from "../../../src/items/outstanding.ts";
import { SPEC } from "../../../src/protocol/spec.ts";
import type { DecideItem, ListedItem, TodoItem } from "../../../types/index.d.ts";

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

const TODO_LIST = SPEC.lists.todo;
const DECIDE_LIST = SPEC.lists.decide;

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

/** A Todo list whose item 2's summary runs on into its sentence, so the list isn't found intact. */
const LOOSE_TODO = TODO.map((line) => (line.startsWith("2. ") ? `${line} to the team` : line));

/** A Decide list whose item leaves out its option B, so the list isn't found intact. */
const PARTIAL_DECIDE = DECIDE.filter((line) => !line.includes("B. **Memory**"));

/** The lines a span covers, joined. */
const spanned = (text: string, span: { start: number; end: number } | undefined) =>
  span === undefined ? undefined : text.split("\n").slice(span.start, span.end).join("\n");

const todoSpan = (text: string, items: readonly ListedItem[]) => listSpan(text, TODO_LIST, items);
const decideSpan = (text: string, items: readonly ListedItem[]) => listSpan(text, DECIDE_LIST, items);

/** Each list a drawing holds, by its header, with the refs of its items and whether it's cut out. */
const listsOf = (drawing: ReplyDrawing | undefined) =>
  drawing?.lists.map((each) => [each.list.header, each.items.map((item) => item.ref), each.span !== undefined]);

/** A drawing's parts, each a text's key or a list's header. */
const partsOf = (drawing: ReplyDrawing | undefined) =>
  drawing?.parts.map((part) => (part.kind === "text" ? part.key : part.list));

describe("a reply's Todo list found intact", () => {
  test("spans its header, its rule and every item's lines, code and blank marks among them", () => {
    const text = reply(TODO);
    expect(todoSpan(text, [rotate, announce])).toEqual({ list: "Todo", start: 5, end: 14 });
    expect(spanned(text, todoSpan(text, [rotate, announce]))).toBe(TODO.join("\n"));
  });

  test("ends at the next list's header, with no blank line between", () => {
    const text = [...TODO, ...DECIDE].join("\n");
    expect(spanned(text, todoSpan(text, [rotate, announce]))).toBe(TODO.join("\n"));
  });

  test("ends at prose straight after it, at a line's start", () => {
    const text = [...TODO, "Back to the loader."].join("\n");
    expect(spanned(text, todoSpan(text, [rotate, announce]))).toBe(TODO.join("\n"));
  });

  test("holds a summary that ends in a colon, as summaryOf reads it", () => {
    const text = reply(TODO.map((line) => line.replace("**Rotate the deploy token**", "**Rotate the deploy token:**")));
    expect(spanned(text, todoSpan(text, [rotate, announce]))).toContain("**Rotate the deploy token:**");
  });
});

describe("a reply's Todo list not found intact", () => {
  test("is none when an item's summary isn't alone on its line", () => {
    expect(todoSpan(reply(LOOSE_TODO), [rotate, announce])).toBeUndefined();
  });

  test("is none when an item is missing from the list, or one it lists isn't given", () => {
    expect(todoSpan(reply(TODO), [rotate])).toBeUndefined();
    expect(todoSpan(reply(TODO), [rotate, announce, todoItem("9efb08a1", 3, "Another")])).toBeUndefined();
  });

  test("is none with the items in another order, or none given", () => {
    expect(todoSpan(reply(TODO), [announce, rotate])).toBeUndefined();
    expect(todoSpan(reply(TODO), [])).toBeUndefined();
  });

  test("is none with two Todo lists, or only a 📌 roll-up's Todo group", () => {
    expect(todoSpan([...TODO, "", ...TODO].join("\n"), [rotate, announce])).toBeUndefined();
    const pinned = [
      "Some work.",
      "",
      "📌 **Outstanding from previous turns:**  ",
      "👉 **Todo:**  ",
      "- **Rotate the deploy token** 🔖 9efb08a1₋₁",
    ].join("\n");
    expect(todoSpan(pinned, [rotate])).toBeUndefined();
  });

  test("is none for a list inside a code block", () => {
    expect(todoSpan(["```", ...TODO, "```"].join("\n"), [rotate, announce])).toBeUndefined();
  });
});

describe("the items a reply names, every list by one rule", () => {
  const later = [todoItem("b2c3d4e5", 1, "Rotate the deploy token"), todoItem("b2c3d4e5", 2, "Announce the release")];

  test("are the raised items its summary lines write, each list's in the reply's order", () => {
    expect(listsOf(replyDrawing(reply(TODO), [cache, announce, rotate], true))).toEqual([
      ["Todo", ["9efb08a1.Todo.1", "9efb08a1.Todo.2"], true],
      ["Decide", ["9efb08a1.Decide.1"], true],
    ]);
  });

  test("are, for each summary line, the newest raised item writing it, of whatever turn", () => {
    expect(listsOf(replyDrawing(reply(TODO), [rotate, announce, ...later], true))?.[0]).toEqual([
      "Todo",
      ["b2c3d4e5.Todo.1", "b2c3d4e5.Todo.2"],
      true,
    ]);
    expect(listsOf(replyDrawing(reply(TODO), [rotate, announce, later[0] as TodoItem], true))?.[0]).toEqual([
      "Todo",
      ["b2c3d4e5.Todo.1", "9efb08a1.Todo.2"],
      true,
    ]);
  });

  test("of a turn still running, whose own items no turn raised yet, are the earlier turn's it prints again", () => {
    const running = reply(TODO, []);
    expect(listsOf(replyDrawing(running, [rotate, announce], true))).toEqual([
      ["Todo", ["9efb08a1.Todo.1", "9efb08a1.Todo.2"], true],
    ]);
  });

  test("match a summary that ends in a colon, and the list then cuts intact", () => {
    const text = reply(TODO.map((line) => line.replace("**Rotate the deploy token**", "**Rotate the deploy token:**")));
    expect(listsOf(replyDrawing(text, [rotate, announce], true))?.[0]).toEqual([
      "Todo",
      ["9efb08a1.Todo.1", "9efb08a1.Todo.2"],
      true,
    ]);
  });

  test("of a list whose numbers are out of order are in the text's order, and the list cuts intact", () => {
    const swapped = [...TODO.slice(0, 2), TODO[8] ?? "", ...TODO.slice(2, 8)];
    expect(listsOf(replyDrawing(reply(swapped), [rotate, announce], true))?.[0]).toEqual([
      "Todo",
      ["9efb08a1.Todo.2", "9efb08a1.Todo.1"],
      true,
    ]);
  });

  test("of a list only partly raised are those raised, and the list is drawn as written", () => {
    expect(listsOf(replyDrawing(reply(TODO), [rotate], true))).toEqual([["Todo", ["9efb08a1.Todo.1"], false]]);
  });

  test("of a block that prints its Todo list twice, or an item twice, are each item once, and no list cuts", () => {
    expect(listsOf(replyDrawing([...TODO, "", ...TODO].join("\n"), [rotate, announce], true))).toEqual([
      ["Todo", ["9efb08a1.Todo.1", "9efb08a1.Todo.2"], false],
    ]);
    expect(listsOf(replyDrawing(reply([...TODO, "1. **Rotate the deploy token**"]), [rotate, announce], true))?.[0]).toEqual(
      ["Todo", ["9efb08a1.Todo.1", "9efb08a1.Todo.2"], false],
    );
  });

  test("of a Decide list that prints an item twice are the item once, and the list is drawn as written", () => {
    const twice = [...DECIDE, "2. **Which cache to keep**", "   🔘 A. **Disk**", "   🔘 B. **Memory**"];
    expect(listsOf(replyDrawing(reply([], twice), [cache], true))).toEqual([["Decide", ["9efb08a1.Decide.1"], false]]);
  });

  test("are none, so the reply is drawn as the engine draws it, where no summary line writes a raised item", () => {
    expect(replyDrawing(reply([], []), [rotate, announce, cache], true)).toBeUndefined();
    expect(replyDrawing(reply(TODO, []), [todoItem("9efb08a1", 1, "Another")], true)).toBeUndefined();
    expect(replyDrawing(reply(TODO), [], true)).toBeUndefined();
    const fenced = ["```", "👉 **Todo:**", "1. **Rotate the deploy token**", "2. **Announce the release**", "```"];
    expect(replyDrawing(fenced.join("\n"), [rotate, announce], true)).toBeUndefined();
    const pinned = ["📌 **Outstanding from previous turns:**  ", "👉 **Todo:**  ", "- **Rotate the deploy token** 🔖 9efb08a1₋₁"].join("\n");
    expect(replyDrawing(pinned, [rotate, announce], true)).toBeUndefined();
  });
});

describe("a reply's drawing", () => {
  test("cuts each list found intact out, in its place, with no links", () => {
    const drawing = replyDrawing(reply(TODO), [rotate, announce, cache], true);
    expect(partsOf(drawing)).toEqual(["before", "Todo", "Decide", "after"]);
    expect(drawing?.hrefs).toEqual([]);
  });

  test("draws a Todo list not found intact as written, its summaries links, and its boxes under the reply", () => {
    const drawing = replyDrawing(reply(TODO), [rotate, cache], true);
    expect(partsOf(drawing)).toEqual(["before", "Decide", "after", "Todo"]);
    expect(drawing?.hrefs).toEqual([`${ITEM_LINK}9efb08a1.Todo.1`]);
    const before = drawing?.parts[0];
    expect(before?.kind === "text" ? before.text : "").toContain(
      `1. **[Rotate the deploy token](${ITEM_LINK}9efb08a1.Todo.1)**`,
    );
  });

  test("draws every list not found intact as written, the boxes under it in the spec's list order, every list's summaries links", () => {
    const drawing = replyDrawing(reply(TODO, PARTIAL_DECIDE), [cache, rotate], true);
    expect(partsOf(drawing)).toEqual(["questions", "Todo", "Decide"]);
    expect(drawing?.hrefs).toEqual([`${ITEM_LINK}9efb08a1.Todo.1`, `${ITEM_LINK}9efb08a1.Decide.1`]);
  });

  test("draws a list with an item whose summary runs on as written, every item it prints boxed under the reply, the run-on summary a link too", () => {
    const drawing = replyDrawing(reply(LOOSE_TODO), [rotate, announce, cache], true);
    expect(listsOf(drawing)).toEqual([
      ["Todo", ["9efb08a1.Todo.1", "9efb08a1.Todo.2"], false],
      ["Decide", ["9efb08a1.Decide.1"], true],
    ]);
    expect(partsOf(drawing)).toEqual(["before", "Decide", "after", "Todo"]);
    const before = drawing?.parts[0];
    expect(before?.kind === "text" ? before.text : "").toContain(
      `2. **[Announce the release](${ITEM_LINK}9efb08a1.Todo.2)** to the team`,
    );
  });

  test("draws a Decide list with an item whose summary runs on as written, its box under the reply, as a Todo list's", () => {
    const looseDecide = DECIDE.map((line) =>
      line.startsWith("1. ") ? "1. **Which cache to keep**, the one the loader reads" : line,
    );
    const drawing = replyDrawing(reply(TODO, looseDecide), [rotate, announce, cache], true);
    expect(listsOf(drawing)).toEqual([
      ["Todo", ["9efb08a1.Todo.1", "9efb08a1.Todo.2"], true],
      ["Decide", ["9efb08a1.Decide.1"], false],
    ]);
    expect(partsOf(drawing)).toEqual(["before", "Todo", "after", "Decide"]);
  });

  test("names an item only by a summary line under its own list's header, whatever the turn", () => {
    // Turn b2c3d4e5's Todo item shares turn 9efb08a1's Decide item's summary.
    const sameSummary = todoItem("b2c3d4e5", 1, "Which cache to keep");
    const drawing = replyDrawing(reply([]), [cache, sameSummary], true);
    expect(listsOf(drawing)).toEqual([["Decide", ["9efb08a1.Decide.1"], true]]);
    expect(partsOf(drawing)).toEqual(["before", "Decide", "after"]);
  });

  test("names nothing by a line under a list the pane doesn't draw, or under no list's header", () => {
    const done = ["✅ **Done:**", "1. **Rotate the deploy token**"].join("\n");
    const pending = ["Some work.", "", "🚧 **Pending:**", "1. **Rotate the deploy token**"].join("\n");
    const bare = ["Some work.", "", "1. **Rotate the deploy token**", "1. **Which cache to keep**"].join("\n");
    [done, pending, bare].forEach((text) => {
      expect(replyDrawing(text, [rotate, cache], true)).toBeUndefined();
      expect(linkedSummaries(text, [rotate, cache]).hrefs).toEqual([]);
    });
  });

  test("matches a Decide summary that ends in a colon, as a Todo summary, and the list cuts intact", () => {
    const colon = DECIDE.map((line) => line.replace("**Which cache to keep**", "**Which cache to keep:**"));
    expect(listsOf(replyDrawing(reply([], colon), [cache], true))).toEqual([["Decide", ["9efb08a1.Decide.1"], true]]);
  });

  test("cuts nothing while it isn't cutting, without settings, every summary a link", () => {
    const drawing = replyDrawing(reply(TODO), [rotate, announce, cache], false);
    expect(partsOf(drawing)).toEqual(["questions", "Todo", "Decide"]);
    expect(drawing?.hrefs).toEqual([
      `${ITEM_LINK}9efb08a1.Todo.1`,
      `${ITEM_LINK}9efb08a1.Todo.2`,
      `${ITEM_LINK}9efb08a1.Decide.1`,
    ]);
  });
});

describe("a summary's text as an item keeps it", () => {
  test("is trimmed, a trailing colon dropped, and nothing more", () => {
    expect(summaryText("  Rotate the deploy token: ")).toBe("Rotate the deploy token");
    expect(summaryText("Why: the token")).toBe("Why: the token");
    expect(summaryText("Ends in two::")).toBe("Ends in two:");
  });
});

describe("a reply's text in parts round the lists cut out of it", () => {
  const text = reply(TODO);
  const spans = [decideSpan(text, [cache]), todoSpan(text, [rotate, announce])].flatMap(
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
    const cut = [todoSpan(between, [rotate, announce]), decideSpan(between, [cache])].flatMap(
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
    expect(replyParts(bare, [todoSpan(bare, [rotate, announce])].flatMap((span) => span ?? []))).toEqual([
      { kind: "list", list: "Todo" },
    ]);
    expect(replyParts(" Some work. \n", [])).toEqual([{ kind: "text", key: "questions", text: " Some work. \n" }]);
    expect(replyParts("", [])).toEqual([]);
  });

  test("cuts a reply whose summaries are links where it cuts the reply as written", () => {
    const linked = linkedSummaries(text, [cache, rotate]);
    expect(linked.text.split("\n")).toHaveLength(text.split("\n").length);
    expect(spanned(linked.text, todoSpan(text, [rotate, announce]))).toContain("[Rotate the deploy token]");
    expect(spanned(linked.text, decideSpan(text, [cache]))).toContain("[Which cache to keep]");
  });
});
