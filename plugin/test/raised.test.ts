// The Decide items raised this session: merged in by ref, settled by a
// refresh, and announced once, so the pane opens by itself for a new one.

import { describe, test } from "node:test";
import { expect } from "expect";

import {
  emptyRaised,
  firstUnanswered,
  forSession,
  isSettled,
  problemsOf,
  refreshed,
  seen,
  settlementOf,
  stillOpen,
  unread,
  unseen,
  withItems,
} from "../src/raised.ts";
import type { DecideItem, Raised } from "../types/index.d.ts";

const radio: DecideItem = {
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
const checkbox: DecideItem = {
  ...radio,
  number: 2,
  summary: "Cleanups to start",
  kind: "checkbox",
  ref: "9efb08a1.Decide.2",
  options: [
    { letter: "A", name: "Matchers" },
    { letter: "B", name: "Dead code" },
  ],
};
const binary: DecideItem = {
  ...radio,
  number: 3,
  summary: "Ship tonight?",
  kind: "binary",
  ref: "9efb08a1.Decide.3",
  options: [
    { letter: "Y", name: "Ship" },
    { letter: "N", name: "Hold" },
  ],
};
const raised: Raised = { ...emptyRaised, session: "s1", items: [radio, checkbox] };
const refs = (r: Raised) => r.items.map((item) => item.ref);

describe("the session the items belong to", () => {
  test("the same session keeps its items", () => {
    expect(forSession(raised, "s1")).toBe(raised);
  });

  test("another session starts with none", () => {
    expect(forSession(raised, "s2")).toEqual({ ...emptyRaised, session: "s2" });
  });
});

describe("merging items in", () => {
  test("a new item goes at the end, newest last", () => {
    expect(refs(withItems(raised, [binary]))).toEqual([
      "9efb08a1.Decide.1",
      "9efb08a1.Decide.2",
      "9efb08a1.Decide.3",
    ]);
  });

  test("an item raised before keeps its place and takes the newer content", () => {
    const told = { ...radio, note: ["Both are built."] };
    const merged = withItems(raised, [binary, told]);
    expect(refs(merged)).toEqual([
      "9efb08a1.Decide.1",
      "9efb08a1.Decide.2",
      "9efb08a1.Decide.3",
    ]);
    expect(merged.items[0]?.note).toEqual(["Both are built."]);
  });

  test("an item handed over twice at once is raised once", () => {
    expect(refs(withItems(emptyRaised, [binary, binary]))).toEqual([
      "9efb08a1.Decide.3",
    ]);
  });
});

describe("a refresh", () => {
  test("merges in the open items and settles every raised item not among them", () => {
    const after = refreshed(raised, [checkbox, binary], [], []);
    expect(refs(after)).toEqual([
      "9efb08a1.Decide.1",
      "9efb08a1.Decide.2",
      "9efb08a1.Decide.3",
    ]);
    expect(after.settledRefs).toEqual(["9efb08a1.Decide.1"]);
    expect(isSettled(after, radio)).toBe(true);
    expect(isSettled(after, checkbox)).toBe(false);
  });

  test("an item open again is no longer settled", () => {
    const settled = refreshed(raised, [checkbox], [], []);
    expect(refreshed(settled, [radio, checkbox], [], []).settledRefs).toEqual([]);
  });

  test("keeps the settings' warnings, and clears an earlier read's problem", () => {
    const after = refreshed(unread(raised, "no file", []), [checkbox], [], ["bad key"]);
    expect(after.warnings).toEqual(["bad key"]);
    expect(after.problem).toBe("");
  });

  test("keeps how each item it settled settled, and none for an open one", () => {
    const answered = {
      ref: "9efb08a1.Decide.1",
      how: "answered",
      turn: "b2c3d4e5",
      letters: ["B"],
      note: "only the loader",
    } as const;
    const restated = { ref: "9efb08a1.Decide.2", how: "restated" } as const;
    const after = refreshed(raised, [checkbox], [answered, restated], []);
    expect(after.settlements).toEqual([answered]);
    expect(settlementOf(after, radio)).toEqual(answered);
    expect(settlementOf(after, checkbox)).toBeUndefined();
  });

  test("that couldn't read the transcript settles nothing and reopens nothing", () => {
    const before = refreshed(raised, [checkbox], [], []);
    const after = unread(before, "Error: no file", ["bad key"]);
    expect(after.items).toEqual(before.items);
    expect(after.settledRefs).toEqual(before.settledRefs);
    expect(after.problem).toBe("Error: no file");
    expect(after.warnings).toEqual(["bad key"]);
  });

  test("says the settings' warnings, then the read's problem, in one line", () => {
    expect(problemsOf(unread(raised, "Error: no file", ["bad key", "worse key"]))).toBe(
      "bad key; worse key; Error: no file",
    );
    expect(problemsOf(refreshed(raised, [], [], []))).toBe("");
  });

  test("the items still open are the raised ones not settled, in order", () => {
    expect(stillOpen(refreshed(raised, [checkbox, binary], [], []))).toEqual([
      checkbox,
      binary,
    ]);
  });
});

describe("announcing new items", () => {
  test("open items not yet seen are unseen, settled ones never", () => {
    const after = refreshed(raised, [checkbox], [], []);
    expect(unseen(after)).toEqual([checkbox]);
  });

  test("once seen, only an item raised after is unseen", () => {
    const looked = seen(raised);
    expect(unseen(looked)).toEqual([]);
    expect(unseen(withItems(looked, [binary]))).toEqual([binary]);
  });
});

describe("where /answers scrolls", () => {
  test("to the first open item the draft doesn't answer", () => {
    expect(firstUnanswered(raised, "9efb08a1.Decide.1.A")).toBe(checkbox);
  });

  test("to none when the draft answers every open item", () => {
    const after = refreshed(raised, [checkbox], [], []);
    expect(firstUnanswered(after, "9efb08a1.Decide.2.A")).toBeUndefined();
  });
});
