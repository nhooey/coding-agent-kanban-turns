// Todo items in the pane beside Decide items: a Todo item's branch, Queued
// for a settling word in the draft and Open for a note alone; a turn's
// group holding both lists, Todo's first, each list's run under its
// header; its stop on its first action; its title, its actions and its Done
// row; and the refresh that raises and settles it.

import { describe, test } from "node:test";
import { expect } from "expect";

import { toggledWord, withNote } from "../../../src/items/answers.ts";
import { INITIAL_PANE, step } from "../../../src/views/pane-state.ts";
import type { Event } from "../../../src/views/pane-state.ts";
import {
  NO_FOLDS,
  actionKey,
  doneLine,
  listRuns,
  paneGroups,
  paneStateOf,
  paneStops,
} from "../../../src/views/sections.ts";
import {
  actionLead,
  itemTitle,
  sentWord,
  actionsOf,
  notePlaceholder,
  settledText,
  wordSaidBy,
} from "../../../src/views/view.ts";
import type {
  DecideItem,
  PaneState,
  RaisedItem,
  TodoItem,
  Turn,
} from "../../../types/index.d.ts";
import { SETTINGS, usable } from "../../fixtures/settings.ts";
import { turnOf } from "../../fixtures/turns.ts";

const todo = (turn: string, number: number, summary: string): TodoItem => ({
  turn,
  list: "Todo",
  number,
  summary,
  ref: `${turn}.Todo.${number}`,
});
const decide = (turn: string, number: number, summary: string): DecideItem => ({
  turn,
  list: "Decide",
  number,
  summary,
  kind: "radio",
  ref: `${turn}.Decide.${number}`,
  options: [
    { letter: "A", name: "Disk" },
    { letter: "B", name: "Memory" },
  ],
});
const TOKEN = todo("9efb08a1", 1, "Rotate the deploy token");
const CACHE = decide("9efb08a1", 1, "Which cache to keep");
const OPEN: RaisedItem["state"] = { tag: "open" };
const raised = (items: readonly (TodoItem | DecideItem)[]): readonly RaisedItem[] =>
  items.map((item) => ({ item, state: OPEN }));
const TURNS = ["9efb08a1"];

describe("a Todo item's state in the pane", () => {
  test("Open with no answer, Queued once the draft gives it a word, Open again for a note alone", () => {
    const [each] = raised([TOKEN]);

    expect(each && paneStateOf(each, "")).toBe("open");
    expect(each && paneStateOf(each, toggledWord("", TOKEN, "done"))).toBe("queued");
    expect(each && paneStateOf(each, toggledWord("", TOKEN, "skip"))).toBe("queued");
    expect(each && paneStateOf(each, withNote("", TOKEN, "later"))).toBe("open");
  });

  test("Done once settled, whatever the draft holds", () => {
    expect(paneStateOf({ item: TOKEN, state: { tag: "settled" } }, "")).toBe("done");
  });
});

describe("a turn's group with both lists", () => {
  test("holds Todo's items before Decide's, whichever was raised first, each run under its list's header", () => {
    const groups = paneGroups(raised([CACHE, TOKEN, todo("9efb08a1", 2, "Announce it")]), "", TURNS);
    const items = groups.open[0]?.items ?? [];

    expect(items.map((item) => item.ref)).toEqual([
      "9efb08a1.Todo.1",
      "9efb08a1.Todo.2",
      "9efb08a1.Decide.1",
    ]);
    expect(listRuns(items).map((run) => [run.header, run.items.length])).toEqual([
      ["👉 Todo", 2],
      ["🧠 Decide", 1],
    ]);
  });

  test("a word in the draft moves the Todo item alone to Queued, in its own turn there", () => {
    const groups = paneGroups(raised([CACHE, TOKEN]), "9efb08a1.Todo.1: done\n", TURNS);

    expect(groups.open[0]?.items.map((item) => item.ref)).toEqual(["9efb08a1.Decide.1"]);
    expect(groups.queued[0]?.items.map((item) => item.ref)).toEqual(["9efb08a1.Todo.1"]);
  });

  test("a list with no item in the group has no run", () => {
    expect(listRuns([CACHE]).map((run) => run.header)).toEqual(["🧠 Decide"]);
  });

  test("its stops are each branch's and turn's header, then each item's first action or option", () => {
    const groups = paneGroups(raised([CACHE, TOKEN]), "", TURNS);

    expect(paneStops(groups, NO_FOLDS).map((stop) => stop.key)).toEqual([
      "open",
      "open.9efb08a1",
      "9efb08a1.Todo.1.done",
      "9efb08a1.Decide.1.A",
    ]);
    expect(actionKey(TOKEN, "skip")).toBe("9efb08a1.Todo.1.skip");
  });
});

describe("a Todo item's box and Done row", () => {
  test("its title names its list and number", () => {
    expect(itemTitle(TOKEN, false)).toEqual({ label: " 👉 Todo.1 ", summary: "Rotate the deploy token" });
    expect(doneLine(TOKEN, "Done: done").label).toBe("👉 Todo.1");
  });

  test("its actions are Done and Skip, from the settings, each by its word", () => {
    expect(actionsOf(TOKEN, SETTINGS.actions)).toEqual([
      { word: "done", label: "Done" },
      { word: "skip", label: "Skip" },
    ]);
    expect(
      actionsOf(TOKEN, {
        note: { label: "Comment" },
        todo: { done: { label: "Did it", settled: "did" }, skip: { label: "Drop", settled: "dropped" } },
      }).map((action) => action.label),
    ).toEqual(["Did it", "Drop"]);
  });

  test("its notes field says a note goes with an action or alone, and settles nothing alone unless it opens with a word", () => {
    expect(notePlaceholder(TOKEN, actionsOf(TOKEN, SETTINGS.actions))).toBe(
      'A note: with Done or Skip, or alone, which settles nothing unless it opens with "done" or "skip"',
    );
  });

  test("skip typed into the notes field reads back as the word, Queued, as its button would", () => {
    const [each] = raised([TOKEN]);
    const typed = withNote("", TOKEN, "skip");

    expect(typed).toBe(toggledWord("", TOKEN, "skip"));
    expect(each && paneStateOf(each, typed)).toBe("queued");
    expect(each && paneStateOf(each, withNote("", TOKEN, "Skip: not this week"))).toBe("queued");
  });

  test("an action opens on the chosen mark, the sent one, or blanks as wide, so a press moves no label", () => {
    const marks = { chosen: "✅", sent: "☑️" };

    expect(actionLead({ chosen: true, sent: false }, marks)).toBe("✅");
    expect(actionLead({ chosen: false, sent: true }, marks)).toBe("☑️");
    expect(actionLead({ chosen: false, sent: false }, marks)).toBe("  ");
  });

  test("its Done row says what the word did, its note after, sent or read", () => {
    const said = wordSaidBy(SETTINGS.actions);
    const worded = { ref: TOKEN.ref, how: "worded", turn: "b2c3d4e5", word: "skip", note: "" } as const;

    expect(settledText(worded, said)).toBe("Done: skipped");
    expect(settledText({ ...worded, word: "done", note: "rotated it" }, said)).toBe("Done: done · rotated it");
    expect(settledText({ ref: TOKEN.ref, how: "sent-word", word: "skip", note: "" }, said)).toBe(
      "Sent: skipped",
    );
    expect(settledText(worded)).toBe("Done: skip");
    // The note button's setting is no list's: none of its keys is a word.
    expect(said("label")).toBe("label");
    expect(SETTINGS.actions.note.label).toBe("Add a note");
    expect(sentWord(worded)).toBe("skip");
    expect(sentWord({ ref: TOKEN.ref, how: "reassessed" })).toBe("");
  });
});

describe("the refresh, with Todo items", () => {
  const LISTED = "👉 **Todo:**  \n▔▔▔▔▔▔▔▔\n1. **Rotate the deploy token**\n2. **Announce it**\n";

  /** The state once a refresh reads `turns`, the settings answering at once. */
  const refreshed = (turns: readonly Turn[]): PaneState => {
    const events: readonly Event[] = [
      { type: "refresh-asked", releases: false },
      { type: "settings-read", read: 1, loaded: usable(false) },
      { type: "transcript-read", refresh: 1, found: { turns } },
    ];

    return events.reduce((state, event) => step(state, event).state, INITIAL_PANE);
  };

  test("raises a reply's Todo items, open, beside the count line as before", () => {
    const state = refreshed([turnOf("9efb08a1", "go", { replies: [LISTED] })]);

    expect(state.raised.items.map((each) => [each.item.ref, each.state.tag])).toEqual([
      ["9efb08a1.Todo.1", "open"],
      ["9efb08a1.Todo.2", "open"],
    ]);
    expect(state.counts).toBe("📌 Outstanding: 👉 2");
  });

  test("settles one a later prompt gives a word, keeping the answer, and leaves one given a note open", () => {
    const first = refreshed([turnOf("9efb08a1", "go", { replies: [LISTED] })]);
    const turns = [
      turnOf("9efb08a1", "go", { replies: [LISTED] }),
      turnOf("b2c3d4e5", "Todo.1: done: rotated it\nTodo.2: tomorrow"),
    ];
    const events: readonly Event[] = [
      { type: "refresh-asked", releases: false },
      { type: "settings-read", read: 2, loaded: usable(false) },
      { type: "transcript-read", refresh: 2, found: { turns } },
    ];
    const state = events.reduce((sofar, event) => step(sofar, event).state, first);

    expect(state.raised.items.map((each) => [each.item.ref, each.state])).toEqual([
      [
        "9efb08a1.Todo.1",
        {
          tag: "settled",
          settlement: { how: "worded", turn: "b2c3d4e5", word: "done", note: "rotated it" },
        },
      ],
      ["9efb08a1.Todo.2", { tag: "open" }],
    ]);
    // The count line drops the item the word settled, as the pane does.
    expect(state.counts).toBe("📌 Outstanding: 👉 1");
  });

  test("queues a Todo item on a word, and not on a word on a line that asks a question, as Submit sends it", () => {
    const state = refreshed([turnOf("9efb08a1", "go", { replies: [LISTED] })]);
    const [token] = state.raised.items;

    expect(token && paneStateOf(token, "9efb08a1.Todo.1: done\n")).toBe("queued");
    expect(token && paneStateOf(token, "9efb08a1.Todo.1: done? or later\n")).toBe("open");
    expect(token && paneStateOf(token, "9efb08a1.Todo.1: done\n9efb08a1.Todo.1: skip, or is it done?\n")).toBe(
      "queued",
    );
  });
});
