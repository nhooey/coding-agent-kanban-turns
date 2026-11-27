// Every list the pane draws takes one path through the pane, the reply's
// drawing and the draft's answers: what sets one apart there is the spec's
// `feedback` and the settings' labels, never its name. The lists the
// pane draws, an item's answers and their keys, how many picks one takes,
// where /answers scrolls, what opens the pane by itself, what Submit sends,
// and an item's notes field each read the feedback alone.

import { describe, test } from "node:test";
import { expect } from "expect";

import { settles, toggledWord, withNote } from "../../../src/items/answers.ts";
import {
  answerKeysOf,
  feedbackOfItem,
  hasOptions,
  listNameOf,
  listOf,
  picksAny,
  settlingWordsOfItem,
} from "../../../src/items/items.ts";
import { emptyRaised, sentOf, unseen, withItems } from "../../../src/items/raised.ts";
import { PANE_LISTS, feedbackOf, listKeyOf, listNamed } from "../../../src/protocol/rules.ts";
import { SPEC } from "../../../src/protocol/spec.ts";
import { parseReply, sectionNamesOf } from "../../../src/transcript/reply.ts";
import { firstUnansweredIn, heldAfterPick, paneGroups } from "../../../src/pane/sections.ts";
import { PANE_NAME, actionsOf, notePlaceholder } from "../../../src/pane/view.ts";
import type { DecideItem, RaisedItem, TodoItem } from "../../../types/index.d.ts";
import { SETTINGS } from "../../fixtures/settings.ts";

const token: TodoItem = {
  turn: "9efb08a1",
  list: "Todo",
  number: 1,
  summary: "Rotate the deploy token",
  ref: "9efb08a1.Todo.1",
};
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
const boxes: DecideItem = { ...cache, number: 2, ref: "9efb08a1.Decide.2", kind: "checkbox" };
const open = (items: readonly (TodoItem | DecideItem)[]): readonly RaisedItem[] =>
  items.map((item) => ({ item, state: { tag: "open" } }));

describe("the spec's feedback", () => {
  test("is given for every list, and the pane draws exactly the lists with some, in the spec's order", () => {
    expect(Object.values(SPEC.lists).map((list) => list.feedback)).toEqual([
      "none",
      "none",
      "none",
      "none",
      "none",
      "none",
      "none",
      "settling-words",
      "options",
    ]);
    expect(PANE_LISTS).toEqual(Object.values(SPEC.lists).filter((list) => list.feedback !== "none"));
  });

  test("names a list's feedback by its header, none for a list the pane doesn't draw", () => {
    expect(feedbackOf("Todo")).toBe("settling-words");
    expect(feedbackOf("Decide")).toBe("options");
    expect(feedbackOf("Review")).toBe("none");
    expect(feedbackOf("Nothing")).toBe("none");
    expect(feedbackOfItem(token)).toBe("settling-words");
    expect(feedbackOfItem(cache)).toBe("options");
  });

  test("keys a list by its name in code, as the settings name it", () => {
    expect(listKeyOf(SPEC.lists.todo)).toBe("todo");
    expect(listKeyOf(SPEC.lists.decide)).toBe("decide");
  });

  test("finds any of the spec's lists by its header, none for another name", () => {
    expect(listNamed("Todo")).toBe(SPEC.lists.todo);
    expect(listNamed("Backlog")).toBeUndefined();
    expect(listNamed("Pending")).toBe(SPEC.lists.pending);
    expect(listNamed("Nothing")).toBeUndefined();
  });

  test("gives an item of a list the pane doesn't draw no list, feedback none and no words, as feedbackOf does, and its own name as its label", () => {
    const stray = { ...token, list: "Review" } as unknown as TodoItem;
    expect(listOf(stray)).toBeUndefined();
    expect(feedbackOfItem(stray)).toBe(feedbackOf("Review"));
    expect(feedbackOfItem(stray)).toBe("none");
    expect(settlingWordsOfItem(stray)).toEqual([]);
    expect(answerKeysOf(stray)).toEqual([]);
    expect(listNameOf(stray)).toEqual({ glyph: "", header: "Review" });
    expect(listNameOf(token)).toBe(SPEC.lists.todo);
    expect(settlingWordsOfItem(token)).toEqual(["done", "skip"]);
  });
});

describe("the section each block of a reply sits in", () => {
  test("is the list whose header is above it, up to the next header, the roll-up or a topic; none before any header", () => {
    const text = [
      "Some work.",
      "🚧 **Pending:**",
      "1. **Rework the loader**",
      "",
      "1. **Still Pending's**",
      "👉 **Todo:**",
      "1. **Rotate the deploy token**",
      "📌 **Outstanding from previous turns:**",
      "- 👉 **Rotate the deploy token**",
    ].join("\n");
    const blocks = parseReply(text);
    const names = sectionNamesOf(blocks);
    const named = blocks.flatMap((block, n) =>
      block.kind === "item" ? [[block.head.summary, names[n]]] : [],
    );

    expect(names).toHaveLength(blocks.length);
    expect(names[0]).toBeUndefined();
    expect(named).toEqual([
      ["Rework the loader", "Pending"],
      ["Still Pending's", "Pending"],
      ["Rotate the deploy token", "Todo"],
      // The roll-up's bullet, its glyph before its bold, in no section.
      [undefined, undefined],
    ]);
  });
});

describe("an item's answers, by its list's feedback", () => {
  test("carry options only where its feedback is options", () => {
    expect(hasOptions(cache)).toBe(true);
    expect(hasOptions(token)).toBe(false);
  });

  test("are keyed by its options' letters, or by its list's settling words", () => {
    expect(answerKeysOf(cache)).toEqual(["A", "B"]);
    expect(answerKeysOf(token)).toEqual(["done", "skip"]);
  });

  test("take any number of picks only where the option kind says so", () => {
    expect(picksAny(boxes)).toBe(true);
    expect(picksAny(cache)).toBe(false);
    expect(picksAny(token)).toBe(false);
    expect(heldAfterPick(boxes, "open")).toBe(boxes.ref);
    expect(heldAfterPick(token, "open")).toBe("");
  });

  test("settle by any answer for options, by a word alone for settling words", () => {
    expect(settles("9efb08a1.Decide.1: later, maybe", cache)).toBe(true);
    expect(settles(withNote("", token, "later"), token)).toBe(false);
    expect(settles(toggledWord("", token, "done"), token)).toBe(true);
  });

  test("are sent by Submit as letters for options, as a word for settling words", () => {
    const raised = withItems(emptyRaised, [cache, token]);
    expect(sentOf("9efb08a1.Decide.1.B\n9efb08a1.Todo.1: skip\n", raised)).toEqual([
      { ref: cache.ref, how: "sent", letters: ["B"], note: "" },
      { ref: token.ref, how: "sent-word", word: "skip", note: "" },
    ]);
  });
});

describe("where /answers scrolls, every list by one rule", () => {
  test("passes over an item of any list the draft writes anything for, a note alone to a Todo item among them", () => {
    const groups = paneGroups(open([token, cache]), "", ["9efb08a1"]);
    expect(firstUnansweredIn(groups, "")).toBe(token);
    expect(firstUnansweredIn(groups, withNote("", token, "later"))).toBe(cache);
    expect(firstUnansweredIn(groups, "9efb08a1.Decide.1: is it?\n")).toBe(token);
  });
});

describe("what opens the pane by itself", () => {
  test("is any open item of any list not looked at yet, a Todo item's as a Decide item's", () => {
    const raised = withItems(emptyRaised, [token]);
    expect(unseen(raised)).toEqual([token]);
    expect(unseen({ ...raised, seenRefs: [token.ref] })).toEqual([]);
  });
});

describe("an item's box, by its list's data", () => {
  test("has its list's actions, labelled by the list's settings; none for a list without settling words", () => {
    expect(actionsOf(token, SETTINGS.actions).map((action) => action.label)).toEqual(["Done", "Skip"]);
    expect(actionsOf(cache, SETTINGS.actions)).toEqual([]);
  });

  test("has a notes field that says what its feedback takes", () => {
    expect(notePlaceholder(cache, [])).toBe("Notes, or an answer in your own words");
    expect(notePlaceholder(token, actionsOf(token, SETTINGS.actions))).toMatch(/^A note: with Done or Skip/);
  });

  test("sits in a pane named for no list", () => {
    expect(PANE_NAME).toBe("Kanban");
    expect(PANE_LISTS.map((list) => list.header)).not.toContain(PANE_NAME);
  });
});
