// The pane's sections: one per turn, newest first, each with its open items
// and its Done items under a header, the turn's header naming its index;
// the stops j and k move between, and the keys a click expands.

import { describe, test } from "node:test";
import { expect } from "expect";

import {
  doneHeader,
  doneKey,
  doneLine,
  firstUnansweredIn,
  lineKey,
  paneStops,
  relativeIndex,
  steppedStop,
  subscriptOf,
  toggledKey,
  turnHeader,
  turnSections,
  withKeys,
} from "../../../src/pane/sections.ts";
import type { DecideItem } from "../../../types/index.d.ts";

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
const newer1 = item("b2c3d4e5", 1, "Ship tonight?");
const TURNS = ["0000aaaa", "9efb08a1", "1111bbbb", "b2c3d4e5"];

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

describe("a turn's header", () => {
  test("is the turn id and its index, between rules", () => {
    expect(turnHeader("9efb08a1", -3)).toBe("── 9efb08a1 ₋₃ ──");
    expect(turnHeader("9efb08a1", 0)).toBe("── 9efb08a1 ₀ ──");
  });

  test("leaves the index out when the turn wasn't read", () => {
    expect(turnHeader("9efb08a1", undefined)).toBe("── 9efb08a1 ──");
  });
});

describe("the pane's sections", () => {
  const isDone = (done: readonly DecideItem[]) => (i: DecideItem) => done.includes(i);

  test("are one per turn, newest first, each with its open items, then its Done ones", () => {
    const got = turnSections([older1, older2, newer1], isDone([older1]), TURNS);
    expect(got.map((s) => s.turn)).toEqual(["b2c3d4e5", "9efb08a1"]);
    expect(got.map((s) => s.header)).toEqual(["── b2c3d4e5 ₀ ──", "── 9efb08a1 ₋₂ ──"]);
    expect(got[0]?.open).toEqual([newer1]);
    expect(got[1]?.open).toEqual([older2]);
    expect(got[1]?.done).toEqual([older1]);
  });

  test("put a turn the transcript hasn't read yet first, the latest raised first", () => {
    const later = item("cafecafe", 1, "Which port");
    const latest = item("deadbeef", 1, "Which host");
    expect(turnSections([older1, later, latest], isDone([]), TURNS).map((s) => s.turn)).toEqual([
      "deadbeef",
      "cafecafe",
      "9efb08a1",
    ]);
  });

  test("are none without items", () => {
    expect(turnSections([], isDone([]), TURNS)).toEqual([]);
  });
});

describe("where /answers scrolls", () => {
  const sections = turnSections([older1, older2, newer1], (i) => i === older1, TURNS);

  test("to the first open item the draft doesn't answer, newest turn first, as the pane draws them", () => {
    expect(firstUnansweredIn(sections, "")).toBe(newer1);
    expect(firstUnansweredIn(sections, "b2c3d4e5.Decide.1.A")).toBe(older2);
  });

  test("to none when the draft answers every open item, a Done one never counted", () => {
    expect(firstUnansweredIn(sections, "b2c3d4e5.Decide.1.A\n9efb08a1.Decide.2.B")).toBeUndefined();
  });
});

describe("the Done section and its lines", () => {
  test("the header is a toggle naming the count, its glyph saying whether it's open", () => {
    expect(doneHeader(2, false)).toBe("▸ Done (2)");
    expect(doneHeader(2, true)).toBe("▾ Done (2)");
  });

  test("a Done item's line is its label, then its summary and what made it Done", () => {
    expect(doneLine(older1, "Answered in 4a2206b0: A")).toEqual({
      label: "🧠 Decide.1",
      text: "Which cache to keep · Answered in 4a2206b0: A",
    });
  });

  test("keys name the turn's section and the item's line", () => {
    expect(doneKey("9efb08a1")).toBe("9efb08a1.done");
    expect(lineKey(older1)).toBe("9efb08a1.Decide.1.line");
  });

  test("a click toggles a key in the expanded set", () => {
    expect(toggledKey([], "a")).toEqual(["a"]);
    expect(toggledKey(["a", "b"], "a")).toEqual(["b"]);
  });

  test("showing a Done item adds its section's key and its own, each once", () => {
    expect(withKeys(["a"], ["9efb08a1.done", "a"])).toEqual(["a", "9efb08a1.done"]);
  });
});

describe("the stops j and k move between", () => {
  const sections = turnSections([older1, older2, newer1], (i) => i === older1, TURNS);

  test("are each open item's first option and each turn's Done header, in the pane's order", () => {
    expect(paneStops(sections, []).map((s) => s.key)).toEqual([
      "b2c3d4e5.Decide.1.A",
      "9efb08a1.Decide.2.A",
      "9efb08a1.done",
    ]);
  });

  test("take in an expanded Done section's lines", () => {
    expect(paneStops(sections, ["9efb08a1.done"]).map((s) => s.key)).toEqual([
      "b2c3d4e5.Decide.1.A",
      "9efb08a1.Decide.2.A",
      "9efb08a1.done",
      "9efb08a1.Decide.1.line",
    ]);
  });

  test("step from the item the ring is on, whichever of its elements holds it", () => {
    const stops = paneStops(sections, []);
    expect(steppedStop(stops, "b2c3d4e5.Decide.1.B", 1)).toBe("9efb08a1.Decide.2.A");
    expect(steppedStop(stops, "9efb08a1.Decide.2.notes", -1)).toBe("b2c3d4e5.Decide.1.A");
    expect(steppedStop(stops, "9efb08a1.done", -1)).toBe("9efb08a1.Decide.2.A");
  });

  test("start at the first or the last when the ring is on no item", () => {
    const stops = paneStops(sections, []);
    expect(steppedStop(stops, "", 1)).toBe("b2c3d4e5.Decide.1.A");
    expect(steppedStop(stops, "submit", -1)).toBe("9efb08a1.done");
  });

  test("go nowhere past either end, or with no stops", () => {
    const stops = paneStops(sections, []);
    expect(steppedStop(stops, "b2c3d4e5.Decide.1.A", -1)).toBeUndefined();
    expect(steppedStop(stops, "9efb08a1.done", 1)).toBeUndefined();
    expect(steppedStop([], "", 1)).toBeUndefined();
  });

  test("are an open item's notes field when it has no options", () => {
    const words = { ...item("9efb08a1", 4, "What to call it"), options: [] };
    expect(paneStops(turnSections([words], () => false, TURNS), []).map((s) => s.key)).toEqual([
      "9efb08a1.Decide.4.notes",
    ]);
  });

  test("don't take an item whose number only starts with another's", () => {
    const ten = item("9efb08a1", 10, "Tenth");
    const stops = paneStops(turnSections([older1, ten], () => false, TURNS), []);
    expect(steppedStop(stops, "9efb08a1.Decide.10.B", -1)).toBe("9efb08a1.Decide.1.A");
  });
});
