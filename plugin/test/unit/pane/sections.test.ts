// The pane's groups: three branches, Open, Queued and Done, an item's
// branch read from its state and the draft; in each, one group per turn,
// newest first, each turn's header a toggle naming its index and its count;
// each branch's own toggle; which toggles are open, which no move of an
// item changes; where the ring goes after a pick; and the stops j and k
// move between.

import { describe, test } from "node:test";
import { expect } from "expect";
import fc from "fast-check";

import { choose } from "../../../src/items/answers.ts";
import {
  BRANCHES,
  NO_FOLDS,
  boxToggle,
  branchHeader,
  branchOf,
  branchToggle,
  countOf,
  countedLabel,
  doneLine,
  firstUnansweredIn,
  heldAfterFocus,
  heldAfterPick,
  isOpen,
  lineKey,
  paneGroups,
  paneStateOf,
  paneStops,
  relativeIndex,
  ringAfterMove,
  steppedStop,
  subscriptOf,
  toggledKey,
  togglesShown,
  turnHeader,
  turnKey,
  turnLabel,
  turnToggle,
  withItemShown,
  withKeys,
  withOpened,
  withToggled,
} from "../../../src/pane/sections.ts";
import type { Folds, DecideItem, RaisedItem } from "../../../types/index.d.ts";
import { SETTINGS } from "../../fixtures/settings.ts";

const item = (turn: string, number: number, summary: string): DecideItem => ({
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
const older1 = item("9efb08a1", 1, "Which cache to keep");
const older2 = item("9efb08a1", 2, "Which loader to keep");
const older3 = item("9efb08a1", 3, "Which port");
const newer1 = item("b2c3d4e5", 1, "Ship tonight?");
const newer2 = item("b2c3d4e5", 2, "Tag it?");
const boxes = { ...item("9efb08a1", 4, "Cleanups"), kind: "checkbox" } as const;
const TURNS = ["0000aaaa", "9efb08a1", "1111bbbb", "b2c3d4e5"];
/** Each of `items` raised, settled when it's one of `done`, else open. */
const raisedOf = (
  items: readonly DecideItem[],
  done: readonly DecideItem[] = [],
): readonly RaisedItem[] =>
  items.map((each) => ({
    item: each,
    state: done.includes(each) ? { tag: "settled" } : { tag: "open" },
  }));
const turnsOf = (groups: readonly { turn: string }[]) => groups.map((g) => g.turn);
const groupsOf = (items: readonly DecideItem[], done: readonly DecideItem[] = [], draft = "") =>
  paneGroups(raisedOf(items, done), draft, TURNS);

describe("a turn's relative index", () => {
  test("counts back from the latest turn, which is 0", () => {
    expect(relativeIndex(TURNS, "b2c3d4e5")).toBe(0);
    expect(relativeIndex(TURNS, "9efb08a1")).toBe(-2);
  });

  test("matches a turn id by a prefix either way, and is none for a turn not read", () => {
    expect(relativeIndex(TURNS, "9efb08")).toBe(-2);
    expect(relativeIndex(["9efb08a1"], "9efb08a1ff")).toBe(0);
    expect(relativeIndex(TURNS, "cafecafe")).toBeUndefined();
  });

  test("prints in Unicode subscript, as the kanban skill's 🔖 tag does", () => {
    expect(subscriptOf(0)).toBe("₀");
    expect(subscriptOf(-3)).toBe("₋₃");
    expect(subscriptOf(-17)).toBe("₋₁₇");
  });
});

describe("the headers", () => {
  test("a turn's names it by its id and its index, or its id alone when it wasn't read", () => {
    expect(turnLabel("9efb08a1", -3)).toBe("9efb08a1 ₋₃");
    expect(turnLabel("9efb08a1", 0)).toBe("9efb08a1 ₀");
    expect(turnLabel("9efb08a1", undefined)).toBe("9efb08a1");
  });

  test("a turn's is a toggle: its mark, then its label and count between rules", () => {
    expect(turnHeader("9efb08a1 ₋₃", 2, true, SETTINGS.marks)).toBe("▾ ── 9efb08a1 ₋₃ (2) ──");
    expect(turnHeader("9efb08a1 ₋₃", 2, false, SETTINGS.marks)).toBe("▸ ── 9efb08a1 ₋₃ (2) ──");
  });

  test("a branch's is a toggle naming the branch, Done as the spec names the list, and its count", () => {
    expect(branchHeader("open", 3, true, SETTINGS.marks)).toBe("▾ Open (3)");
    expect(branchHeader("queued", 1, false, SETTINGS.marks)).toBe("▸ Queued (1)");
    expect(branchHeader("done", 2, false, SETTINGS.marks)).toBe("▸ Done (2)");
  });

  test("pad their mark to the wider of the two, so the text after it stays put", () => {
    const marks = { collapsed: "+", expanded: "[-]" };
    expect(turnHeader("9efb08a1", 1, false, marks)).toBe("+   ── 9efb08a1 (1) ──");
    expect(turnHeader("9efb08a1", 1, true, marks)).toBe("[-] ── 9efb08a1 (1) ──");
    expect(branchHeader("done", 1, false, marks)).toBe("+   Done (1)");
    expect(branchHeader("done", 1, false, { collapsed: "▶️", expanded: "v" })).toBe("▶️ Done (1)");
    expect(branchHeader("done", 1, true, { collapsed: "▶️", expanded: "v" })).toBe("v  Done (1)");
  });

  test("a toggle's label is a name and its count", () => {
    expect(countedLabel("Done", 3)).toBe("Done (3)");
  });

  test("a Done item's line is its label, then its summary and what made it Done", () => {
    expect(doneLine(older1, "Answered in 4a2206b0: A")).toEqual({
      label: "🧠 Decide.1",
      text: "Which cache to keep · Answered in 4a2206b0: A",
    });
  });
});

describe("an item's state in the pane", () => {
  const [open] = raisedOf([older1]);
  const [settled] = raisedOf([older1], [older1]);
  const picked = choose("", older1, "A");

  test("is Open while the draft doesn't answer it", () => {
    expect(open && paneStateOf(open, "")).toBe("open");
    expect(open && paneStateOf(open, choose("", older2, "A"))).toBe("open");
  });

  test("is Queued while the draft picks one of its options or gives it a note", () => {
    expect(open && paneStateOf(open, picked)).toBe("queued");
    expect(open && paneStateOf(open, "9efb08a1.Decide.1: keep both")).toBe("queued");
  });

  test("is Open while the draft's line for it only asks a question, or asks one beside a pick, which Submit sends without settling it", () => {
    expect(open && paneStateOf(open, "9efb08a1.Decide.1: how would B work?")).toBe("open");
    expect(open && paneStateOf(open, "9efb08a1.Decide.1.A: but how?")).toBe("open");
  });

  test("is Open again once its last pick is undone", () => {
    expect(open && paneStateOf(open, choose(picked, older1, "A"))).toBe("open");
  });

  test("is Done once settled, whatever the draft says", () => {
    expect(settled && paneStateOf(settled, "")).toBe("done");
    expect(settled && paneStateOf(settled, picked)).toBe("done");
  });

  test("is Open while held there, though the draft answers it", () => {
    expect(open && paneStateOf(open, picked, older1.ref)).toBe("open");
    expect(open && paneStateOf(open, picked, older2.ref)).toBe("queued");
  });
});

describe("the item held in Open", () => {
  test("is a checkbox item picked in Open, which takes more than one pick", () => {
    expect(heldAfterPick(boxes, "open")).toBe(boxes.ref);
  });

  test("is none for an item of one pick, or a checkbox item picked elsewhere", () => {
    expect(heldAfterPick(older1, "open")).toBe("");
    expect(heldAfterPick(boxes, "queued")).toBe("");
    expect(heldAfterPick(boxes, undefined)).toBe("");
  });

  test("stays while the ring is on one of its elements, and goes once it leaves", () => {
    expect(heldAfterFocus(boxes.ref, `${boxes.ref}.B`)).toBe(boxes.ref);
    expect(heldAfterFocus(boxes.ref, `${boxes.ref}.notes`)).toBe(boxes.ref);
    expect(heldAfterFocus(boxes.ref, "9efb08a1.Decide.1.A")).toBe("");
    expect(heldAfterFocus("", "9efb08a1.Decide.1.A")).toBe("");
  });
});

describe("the pane's groups", () => {
  test("are Open, Queued and Done, each one group per turn, newest first", () => {
    const got = groupsOf([older1, older2, newer1, newer2], [older1], choose("", newer2, "B"));
    expect(turnsOf(got.open)).toEqual(["b2c3d4e5", "9efb08a1"]);
    expect(got.open.map((g) => g.items)).toEqual([[newer1], [older2]]);
    expect(turnsOf(got.queued)).toEqual(["b2c3d4e5"]);
    expect(got.queued.map((g) => g.items)).toEqual([[newer2]]);
    expect(turnsOf(got.done)).toEqual(["9efb08a1"]);
    expect(got.done.map((g) => g.items)).toEqual([[older1]]);
  });

  test("hold a turn in each branch it has an item in, keyed apart", () => {
    const got = groupsOf([older1, older2, older3], [older1], choose("", older3, "A"));
    expect(got.open.map((g) => g.key)).toEqual(["open.9efb08a1"]);
    expect(got.queued.map((g) => g.key)).toEqual(["queued.9efb08a1"]);
    expect(got.done.map((g) => g.key)).toEqual(["done.9efb08a1"]);
    expect(got.queued[0]?.label).toBe("9efb08a1 ₋₂");
  });

  test("leave a turn out of a branch it has no item in", () => {
    const got = groupsOf([older1, newer1], [older1]);
    expect(turnsOf(got.open)).toEqual(["b2c3d4e5"]);
    expect(got.queued).toEqual([]);
    expect(turnsOf(got.done)).toEqual(["9efb08a1"]);
  });

  test("put a turn the transcript hasn't read yet first, the latest raised first", () => {
    const later = item("cafecafe", 1, "Which port");
    const latest = item("deadbeef", 1, "Which host");
    const got = groupsOf([older1, later, latest], [later]);
    expect(turnsOf(got.open)).toEqual(["deadbeef", "9efb08a1"]);
    expect(turnsOf(got.done)).toEqual(["cafecafe"]);
    expect(got.done[0]?.label).toBe("cafecafe");
  });

  test("keep each turn's items in the order they were raised", () => {
    expect(groupsOf([older3, older1, older2], [older3, older1]).done[0]?.items).toEqual([older3, older1]);
  });

  test("are none without items", () => {
    expect(paneGroups([], "", TURNS)).toEqual({ open: [], queued: [], done: [] });
  });

  test("count a branch's items across its turns", () => {
    const got = groupsOf([older1, older2, newer1, newer2], [older1, older2, newer1]);
    expect(countOf(got.done)).toBe(3);
    expect(countOf(got.open)).toBe(1);
    expect(countOf([])).toBe(0);
  });

  test("say which branch holds an item, by its ref", () => {
    const got = groupsOf([older1, older2], [older1], choose("", older2, "B"));
    expect(branchOf(got, older1)).toBe("done");
    expect(branchOf(got, { ...older2 })).toBe("queued");
    expect(branchOf(got, newer1)).toBeUndefined();
  });

  test("hold every raised item in exactly one branch, under its own turn", () => {
    const items = [older1, older2, older3, newer1, newer2, boxes];
    fc.assert(
      fc.property(
        fc.subarray(items),
        fc.subarray(items),
        fc.constantFrom("", boxes.ref, older1.ref),
        (done, picked, held) => {
          const draft = picked.reduce((text, each) => choose(text, each, "A"), "");
          const got = paneGroups(raisedOf(items, done), draft, TURNS, held);
          const places = BRANCHES.flatMap((branch) =>
            got[branch].flatMap((group) =>
              group.items.map((each) => ({ ref: each.ref, isOwnTurn: each.turn === group.turn })),
            ),
          );

          expect(places.map((place) => place.ref).toSorted()).toEqual(items.map((each) => each.ref).toSorted());
          expect(places.every((place) => place.isOwnTurn)).toBe(true);
        },
      ),
    );
  });
});

describe("where /answers scrolls", () => {
  const groups = groupsOf([older1, older2, newer1], [older1]);

  test("to the first open item the draft doesn't answer, newest turn first, as the pane draws them", () => {
    expect(firstUnansweredIn(groups, "")).toBe(newer1);
    expect(firstUnansweredIn(groups, "b2c3d4e5.Decide.1.A")).toBe(older2);
  });

  test("to none when the draft answers every open item, a Done one never counted", () => {
    expect(firstUnansweredIn(groups, "b2c3d4e5.Decide.1.A\n9efb08a1.Decide.2.B")).toBeUndefined();
  });
});

describe("the toggles", () => {
  test("are keyed by branch, by a turn in each branch apart, and by a Done item's line", () => {
    expect(branchToggle("open")).toEqual({ key: "open", startsOpen: true });
    expect(branchToggle("queued")).toEqual({ key: "queued", startsOpen: true });
    expect(branchToggle("done")).toEqual({ key: "done", startsOpen: false });
    expect(turnKey("queued", "9efb08a1")).toBe("queued.9efb08a1");
    expect(turnToggle({ key: "done.9efb08a1" })).toEqual({ key: "done.9efb08a1", startsOpen: true });
    expect(boxToggle(older1)).toEqual({ key: "9efb08a1.Decide.1", startsOpen: false });
    expect(lineKey(older1)).toBe("9efb08a1.Decide.1.line");
  });

  test("start as they're made: Open, Queued and every turn expanded, Done and every box collapsed", () => {
    expect(isOpen(NO_FOLDS, branchToggle("open"))).toBe(true);
    expect(isOpen(NO_FOLDS, branchToggle("queued"))).toBe(true);
    expect(isOpen(NO_FOLDS, branchToggle("done"))).toBe(false);
    expect(isOpen(NO_FOLDS, turnToggle({ key: "done.9efb08a1" }))).toBe(true);
    expect(isOpen(NO_FOLDS, boxToggle(older1))).toBe(false);
  });

  test("flip on a click, and back on a second", () => {
    for (const toggle of [branchToggle("open"), branchToggle("done"), turnToggle({ key: "open.9efb08a1" }), boxToggle(older1)]) {
      expect(isOpen(withToggled(NO_FOLDS, toggle), toggle)).toBe(!isOpen(NO_FOLDS, toggle));
      expect(withToggled(withToggled(NO_FOLDS, toggle), toggle)).toEqual(NO_FOLDS);
    }
  });

  test("fold a turn in its own branch alone", () => {
    const underOpen = withToggled(NO_FOLDS, turnToggle({ key: "open.9efb08a1" }));
    expect(isOpen(underOpen, turnToggle({ key: "open.9efb08a1" }))).toBe(false);
    expect(isOpen(underOpen, turnToggle({ key: "queued.9efb08a1" }))).toBe(true);
    expect(isOpen(underOpen, turnToggle({ key: "done.9efb08a1" }))).toBe(true);
  });

  test("opened, are each expanded, once", () => {
    const folded: Folds = { expanded: ["done"], collapsed: ["open", "open.9efb08a1"] };
    expect(withOpened(folded, [branchToggle("done"), branchToggle("open"), boxToggle(older1)])).toEqual({
      expanded: ["done", "9efb08a1.Decide.1"],
      collapsed: ["open.9efb08a1"],
    });
  });

  test("showing a Done item opens the Done branch, its turn there and its box, and leaves the other branches as they were", () => {
    const folded: Folds = { expanded: [], collapsed: ["done.9efb08a1", "open.9efb08a1", "queued"] };
    expect(withItemShown(folded, older1, "done")).toEqual({
      expanded: ["done", "9efb08a1.Decide.1"],
      collapsed: ["open.9efb08a1", "queued"],
    });
  });

  test("showing an open or queued item opens its branch and its turn there alone", () => {
    const folded: Folds = { expanded: [], collapsed: ["open", "open.9efb08a1", "queued", "queued.9efb08a1"] };
    expect(withItemShown(folded, older2, "open")).toEqual({
      expanded: [],
      collapsed: ["queued", "queued.9efb08a1"],
    });
    expect(withItemShown(folded, older2, "queued")).toEqual({
      expanded: [],
      collapsed: ["open", "open.9efb08a1"],
    });
  });

  test("a set of keys toggles a key, and takes added keys once", () => {
    expect(toggledKey([], "a")).toEqual(["a"]);
    expect(toggledKey(["a", "b"], "a")).toEqual(["b"]);
    expect(withKeys(["a"], ["b", "a"])).toEqual(["a", "b"]);
  });

  test("stay as they are when items move between branches: a toggle drawn before and after keeps its state, a new one starts as it's made", () => {
    const items = [older1, older2, older3, newer1, newer2, boxes];
    const keys = ["open", "queued", "done", ...BRANCHES.flatMap((b) => ["9efb08a1", "b2c3d4e5"].map((t) => turnKey(b, t)))];
    const raisedArb = fc.subarray(items);
    const draftArb = fc.subarray(items).map((picked) => picked.reduce((text, each) => choose(text, each, "A"), ""));
    fc.assert(
      fc.property(
        raisedArb,
        raisedArb,
        draftArb,
        draftArb,
        fc.subarray(keys),
        fc.subarray(keys),
        (doneBefore, doneAfter, draftBefore, draftAfter, expanded, collapsed) => {
          const folds: Folds = { expanded, collapsed };
          const before = togglesShown(paneGroups(raisedOf(items, doneBefore), draftBefore, TURNS), folds);
          const after = togglesShown(paneGroups(raisedOf(items, doneAfter), draftAfter, TURNS), folds);
          const startsOpen = (key: string) => key !== "done";

          for (const [key, shown] of after) {
            expect(shown).toBe(before.get(key) ?? (isOpen(folds, { key, startsOpen: startsOpen(key) })));
          }
        },
      ),
    );
  });
});

describe("the stops j and k move between", () => {
  const groups = groupsOf([older1, older2, newer1], [older1]);
  const keysOf = (folded: Folds, of = groups) => paneStops(of, folded).map((s) => s.key);

  test("are each branch's header, its turns' headers and their items' first option, then the Done branch's header, in the pane's order", () => {
    expect(keysOf(NO_FOLDS)).toEqual([
      "open",
      "open.b2c3d4e5",
      "b2c3d4e5.Decide.1.A",
      "open.9efb08a1",
      "9efb08a1.Decide.2.A",
      "done",
    ]);
  });

  test("take in Queued between Open and Done, its items' first option a stop", () => {
    expect(keysOf(NO_FOLDS, groupsOf([older1, older2, newer1], [older1], choose("", older2, "B")))).toEqual([
      "open",
      "open.b2c3d4e5",
      "b2c3d4e5.Decide.1.A",
      "queued",
      "queued.9efb08a1",
      "9efb08a1.Decide.2.A",
      "done",
    ]);
  });

  test("take in an expanded Done branch's turn headers and their lines", () => {
    expect(keysOf(withToggled(NO_FOLDS, branchToggle("done"))).slice(-3)).toEqual([
      "done",
      "done.9efb08a1",
      "9efb08a1.Decide.1.line",
    ]);
  });

  test("leave out a collapsed branch's turns, and a collapsed turn's items, the header kept", () => {
    expect(keysOf(withToggled(NO_FOLDS, branchToggle("open")))).toEqual(["open", "done"]);
    expect(keysOf(withToggled(NO_FOLDS, turnToggle({ key: "open.9efb08a1" })))).toEqual([
      "open",
      "open.b2c3d4e5",
      "b2c3d4e5.Decide.1.A",
      "open.9efb08a1",
      "done",
    ]);
  });

  test("have no header for a branch with no item", () => {
    expect(keysOf(NO_FOLDS, groupsOf([newer1]))).toEqual(["open", "open.b2c3d4e5", "b2c3d4e5.Decide.1.A"]);
  });

  test("step from the item the ring is on, whichever of its elements holds it", () => {
    const stops = paneStops(groups, NO_FOLDS);
    expect(steppedStop(stops, "b2c3d4e5.Decide.1.B", 1)).toBe("open.9efb08a1");
    expect(steppedStop(stops, "9efb08a1.Decide.2.notes", -1)).toBe("open.9efb08a1");
    expect(steppedStop(stops, "done", -1)).toBe("9efb08a1.Decide.2.A");
  });

  test("step from a toggle by its own key, though another toggle's key starts it", () => {
    const stops = paneStops(groups, withToggled(NO_FOLDS, branchToggle("done")));
    expect(steppedStop(stops, "done.9efb08a1", 1)).toBe("9efb08a1.Decide.1.line");
    expect(steppedStop(stops, "done.9efb08a1", -1)).toBe("done");
    expect(steppedStop(stops, "done", 1)).toBe("done.9efb08a1");
  });

  test("step from an element under nested groups by the innermost group", () => {
    const stops = [
      { key: "done", group: "done" },
      { key: "done.9efb08a1", group: "done.9efb08a1" },
      { key: "next", group: "next" },
    ];
    expect(steppedStop(stops, "done.9efb08a1.Decide", 1)).toBe("next");
    expect(steppedStop(stops, "done.cafecafe", 1)).toBe("done.9efb08a1");
  });

  test("start at the first or the last when the ring is on no stop", () => {
    const stops = paneStops(groups, NO_FOLDS);
    expect(steppedStop(stops, "", 1)).toBe("open");
    expect(steppedStop(stops, "submit", -1)).toBe("done");
  });

  test("go nowhere past either end, or with no stops", () => {
    const stops = paneStops(groups, NO_FOLDS);
    expect(steppedStop(stops, "open", -1)).toBeUndefined();
    expect(steppedStop(stops, "done", 1)).toBeUndefined();
    expect(steppedStop([], "", 1)).toBeUndefined();
  });

  test("are an open item's notes field when it has no options", () => {
    const words = { ...item("9efb08a1", 4, "What to call it"), options: [] };
    expect(keysOf(NO_FOLDS, groupsOf([words]))).toEqual(["open", "open.9efb08a1", "9efb08a1.Decide.4.notes"]);
  });

  test("don't take an item whose number only starts with another's", () => {
    const ten = item("9efb08a1", 10, "Tenth");
    const stops = paneStops(groupsOf([older1, ten]), NO_FOLDS);
    expect(steppedStop(stops, "9efb08a1.Decide.10.B", -1)).toBe("9efb08a1.Decide.1.A");
  });
});

describe("where the ring goes after a pick", () => {
  const items = [older1, older2, older3, newer1];
  const before = groupsOf(items);
  const after = (draft: string) => groupsOf(items, [], draft);

  test("to the next open item the pane shows, its first option, once the pick moves the ring's item to Queued", () => {
    expect(ringAfterMove(before, after(choose("", newer1, "A")), NO_FOLDS, newer1, "b2c3d4e5.Decide.1.A")).toBe(
      "9efb08a1.Decide.1.A",
    );
    expect(ringAfterMove(before, after(choose("", older1, "B")), NO_FOLDS, older1, "9efb08a1.Decide.1.B")).toBe(
      "9efb08a1.Decide.2.A",
    );
  });

  test("past an open item in a folded turn, which shows none", () => {
    const folded = withToggled(NO_FOLDS, turnToggle({ key: "open.9efb08a1" }));
    const mid = groupsOf([newer1, older1, item("0000aaaa", 1, "Oldest")]);
    const moved = paneGroups(raisedOf([newer1, older1, item("0000aaaa", 1, "Oldest")]), choose("", newer1, "A"), TURNS);
    expect(ringAfterMove(mid, moved, folded, newer1, "b2c3d4e5.Decide.1.A")).toBe("0000aaaa.Decide.1.A");
  });

  test("to the last open item before it, when none is after", () => {
    expect(ringAfterMove(before, after(choose("", older3, "A")), NO_FOLDS, older3, "9efb08a1.Decide.3.A")).toBe(
      "9efb08a1.Decide.2.A",
    );
  });

  test("to the item itself in Queued, when no open item is left", () => {
    const one = groupsOf([newer1]);
    expect(ringAfterMove(one, groupsOf([newer1], [], choose("", newer1, "A")), NO_FOLDS, newer1, "b2c3d4e5.Decide.1.A")).toBe(
      "b2c3d4e5.Decide.1.A",
    );
  });

  test("nowhere while the ring is on another element, or the item stays in Open", () => {
    expect(ringAfterMove(before, after(choose("", newer1, "A")), NO_FOLDS, newer1, "submit")).toBeUndefined();
    expect(ringAfterMove(before, before, NO_FOLDS, newer1, "b2c3d4e5.Decide.1.A")).toBeUndefined();
  });

  test("nowhere for an item picked outside Open", () => {
    const queued = after(choose("", newer1, "A"));
    expect(ringAfterMove(queued, after(choose("", newer1, "B")), NO_FOLDS, newer1, "b2c3d4e5.Decide.1.B")).toBeUndefined();
  });
});
