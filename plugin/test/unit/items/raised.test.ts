// The Decide items raised this session: merged in by ref, settled by a
// refresh, and announced once, so the pane opens by itself for a new one.

import { describe, test } from "node:test";
import { expect } from "expect";

import {
  answeredCount,
  closesOnSubmit,
  emptyRaised,
  forSession,
  heldNow,
  isSettled,
  problemsOf,
  refreshed,
  released,
  seen,
  sentOf,
  settlementOf,
  stillOpen,
  supersedesOf,
  unread,
  unseen,
  withHeld,
  withItems,
  withSent,
  withoutRead,
} from "../../../src/items/raised.ts";
import type { DecideItem, ItemState, Raised, Settlement } from "../../../types/index.d.ts";
import { openItems, optionItemsOf, settledRefsOf } from "../../fixtures/raised.ts";

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
const raised: Raised = { ...emptyRaised, session: "s1", items: openItems([radio, checkbox]) };
const refs = (r: Raised) => optionItemsOf(r).map((item) => item.ref);
const states = (r: Raised) => r.items.map((each) => each.state);
/** Settled as `settled` says, as an item holds it: without its ref. */
const settledAs = ({ ref: _ref, ...how }: Settlement): ItemState => ({ tag: "settled", settlement: how });

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
    expect(optionItemsOf(merged)[0]?.note).toEqual(["Both are built."]);
  });

  test("an item handed over twice at once is raised once, holding the later content", () => {
    const told = { ...binary, note: ["Tonight's build is green."] };
    expect(optionItemsOf(withItems(emptyRaised, [binary, told]))).toEqual([told]);
  });

  test("a new item is open, and an item raised before keeps where it stands", () => {
    const settled = refreshed(raised, [checkbox], [], []);
    expect(states(withItems(settled, [{ ...radio, note: ["Again."] }, binary]))).toEqual([
      { tag: "settled" },
      { tag: "open" },
      { tag: "open" },
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
    expect(settledRefsOf(after)).toEqual(["9efb08a1.Decide.1"]);
    expect(isSettled(after, radio)).toBe(true);
    expect(isSettled(after, checkbox)).toBe(false);
    expect(isSettled(after, { ...binary, ref: "cafecafe.Decide.9" })).toBe(false);
  });

  test("an item open again is no longer settled, and holds no settlement", () => {
    const answered = { ref: "9efb08a1.Decide.1", how: "answered", turn: "b2c3d4e5", letters: ["A"], note: "" } as const;
    const settled = refreshed(raised, [checkbox], [answered], []);
    const reopened = refreshed(settled, [radio, checkbox], [answered], []);
    expect(settledRefsOf(reopened)).toEqual([]);
    expect(states(reopened)).toEqual([{ tag: "open" }, { tag: "open" }]);
    expect(settlementOf(reopened, radio)).toBeUndefined();
  });

  test("keeps the settings' problems, and clears an earlier read's problem", () => {
    const after = refreshed(unread(raised, "no file", []), [checkbox], [], ["bad key"]);
    expect(after.settingsProblems).toEqual(["bad key"]);
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
    const superseded = { ref: "9efb08a1.Decide.2", how: "superseded", by: "b2c3d4e5.Decide.1" } as const;
    const after = refreshed(raised, [checkbox], [answered, superseded], []);
    expect(states(after)).toEqual([
      { tag: "settled", settlement: { how: "answered", turn: "b2c3d4e5", letters: ["B"], note: "only the loader" } },
      { tag: "open" },
    ]);
    expect(settlementOf(after, radio)).toEqual(answered);
    expect(settlementOf(after, checkbox)).toBeUndefined();
  });

  test("keeps a settlement without a ref of its own, so it can't name another item than the one it settles", () => {
    const answered = { how: "answered", turn: "b2c3d4e5", letters: ["B"], note: "" } as const;
    // @ts-expect-error a stored settlement holds no ref to disagree with its item's.
    const mismatched: ItemState = { tag: "settled", settlement: { ...answered, ref: "cafecafe.Decide.9" } };
    const after = refreshed(raised, [checkbox], [{ ...answered, ref: "9efb08a1.Decide.1" }], []);
    expect(mismatched.tag).toBe("settled");
    expect(after.items[0]?.state).toEqual({ tag: "settled", settlement: answered });
    expect(settlementOf(after, radio)?.ref).toBe("9efb08a1.Decide.1");
  });

  test("keeps one settlement for an item, the last said of it, and none for an item not raised", () => {
    const first = { ref: "9efb08a1.Decide.1", how: "superseded", by: "b2c3d4e5.Decide.1" } as const;
    const last = { ref: "9efb08a1.Decide.1", how: "reassessed" } as const;
    const stray = { ref: "cafecafe.Decide.9", how: "superseded", by: "9efb08a1.Decide.1" } as const;
    const after = refreshed(raised, [checkbox], [first, stray, last], []);
    expect(states(after)).toEqual([settledAs(last), { tag: "open" }]);
    expect(settlementOf(after, { ...binary, ref: "cafecafe.Decide.9" })).toBeUndefined();
  });

  test("settles an item the transcript doesn't say how, with no settlement", () => {
    const after = refreshed(raised, [checkbox], [], []);
    expect(states(after)).toEqual([{ tag: "settled" }, { tag: "open" }]);
    expect(settlementOf(after, radio)).toBeUndefined();
  });

  test("keeps the ids of the turns it read, in order, for the pane's turn headers", () => {
    expect(refreshed(raised, [], [], [], ["9efb08a1", "b2c3d4e5"]).turns).toEqual(["9efb08a1", "b2c3d4e5"]);
    expect(unread(refreshed(raised, [], [], [], ["9efb08a1"]), "gone", []).turns).toEqual(["9efb08a1"]);
  });

  test("that couldn't read the transcript settles nothing and reopens nothing", () => {
    const before = refreshed(raised, [checkbox], [], []);
    const after = unread(before, "Error: no file", ["bad key"]);
    expect(after.items).toBe(before.items);
    expect(after.problem).toBe("Error: no file");
    expect(after.settingsProblems).toEqual(["bad key"]);
  });

  test("says the settings' problems, then the read's problem, in one line", () => {
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

describe("the items an item supersedes", () => {
  const newer: DecideItem = { ...radio, turn: "b2c3d4e5", ref: "b2c3d4e5.Decide.1", summary: "Which loader to keep" };
  const by = (ref: string, of: string): Settlement => ({ ref, how: "superseded", by: of });
  const all: Raised = { ...emptyRaised, items: openItems([radio, checkbox, binary, newer]) };

  test("are those settled as superseded by it, oldest first: the inverse of each one's by", () => {
    const after = refreshed(
      all,
      [binary, newer],
      [by("9efb08a1.Decide.1", "b2c3d4e5.Decide.1"), by("9efb08a1.Decide.2", "b2c3d4e5.Decide.1")],
      [],
    );
    expect(supersedesOf(after, newer)).toEqual(["9efb08a1.Decide.1", "9efb08a1.Decide.2"]);
    expect(supersedesOf(after, binary)).toEqual([]);
  });

  test("leave out an item superseded by another, one settled any other way, and one open again", () => {
    const answered = { ref: "9efb08a1.Decide.2", how: "answered", turn: "b2c3d4e5", letters: ["A"], note: "" } as const;
    const after = refreshed(
      all,
      [radio, newer],
      [by("9efb08a1.Decide.1", "b2c3d4e5.Decide.1"), answered, by("9efb08a1.Decide.3", "c3d4e5f6.Decide.1")],
      [],
    );
    expect(supersedesOf(after, newer)).toEqual([]);
  });

  test("leave out the item itself, which an earlier raising of it settles by", () => {
    const after = refreshed(
      all,
      [radio],
      [by("9efb08a1.Decide.2", "b2c3d4e5.Decide.1"), by("b2c3d4e5.Decide.1", "b2c3d4e5.Decide.1")],
      [],
    );
    expect(supersedesOf(after, newer)).toEqual(["9efb08a1.Decide.2"]);
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

describe("how many open items the draft answers", () => {
  test("counts the open ones it answers, by letters or in words, and no Done one", () => {
    const after = refreshed(raised, [checkbox], [], []);
    expect(answeredCount(raised, "9efb08a1.Decide.1.A\n9efb08a1.Decide.2: later\n")).toBe(2);
    expect(answeredCount(after, "9efb08a1.Decide.1.A\n")).toBe(0);
    expect(answeredCount(raised, "")).toBe(0);
  });

  test("counts none for a line that only asks about an item", () => {
    expect(answeredCount(raised, "9efb08a1.Decide.1: how would B work?\n9efb08a1.Decide.2.A\n")).toBe(1);
    expect(answeredCount(raised, "9efb08a1.Decide.1: why?\n9efb08a1.Decide.1.A\n")).toBe(1);
  });
});

describe("the answers Submit sent, Done before the turn's end reads them", () => {
  const draft = "coding-agent-kanban-turns:\n9efb08a1.Decide.1.B: only the loader\n9efb08a1.Decide.2.A\nreassess\n";

  test("are the open items the draft answers, with its letters and note", () => {
    expect(sentOf(draft, raised)).toEqual([
      { ref: "9efb08a1.Decide.1", how: "sent", letters: ["B"], note: "only the loader" },
      { ref: "9efb08a1.Decide.2", how: "sent", letters: ["A"], note: "" },
    ]);
  });

  test("leave out an answer that asks a question, which picks nothing and keeps its item open until the reply restates it", () => {
    expect(sentOf("9efb08a1.Decide.1: how would B work?\n", raised)).toEqual([]);
    expect(sentOf("9efb08a1.Decide.1.B: why not C?\n9efb08a1.Decide.2.A\n", raised)).toEqual([
      { ref: "9efb08a1.Decide.2", how: "sent", letters: ["A"], note: "" },
    ]);
  });

  test("take in an item already Done that the draft answers again, and nothing for a draft that answers nothing", () => {
    const after = refreshed(raised, [checkbox], [], []);
    expect(sentOf(draft, after).map((sent) => sent.ref)).toEqual(["9efb08a1.Decide.1", "9efb08a1.Decide.2"]);
    expect(sentOf("reassess\n", raised)).toEqual([]);
  });

  test("make their items Done, saying what was sent, until a refresh says otherwise", () => {
    const sent = sentOf(draft, raised);
    const shown = withSent(raised, sent);
    expect(isSettled(shown, radio)).toBe(true);
    expect(settlementOf(shown, checkbox)).toEqual(sent[1]);
    expect(stillOpen(shown)).toEqual([]);
    expect(withSent(raised, [])).toBe(raised);
  });

  test("stand in place of an earlier answer to an item already Done, the sent one being the later", () => {
    const answered = { ref: "9efb08a1.Decide.1", how: "answered", turn: "b2c3d4e5", letters: ["A"], note: "" } as const;
    const after = refreshed(raised, [checkbox], [answered], []);
    const sent = sentOf(draft, after);
    const shown = withSent(after, sent);
    expect(settlementOf(shown, radio)).toEqual(sent[0]);
    expect(states(shown)).toEqual(sent.map(settledAs));
  });

  test("leave an item they don't answer as it stood, and make Done each item they answer with the last sent for it", () => {
    const first = { ref: "9efb08a1.Decide.1", how: "sent", letters: ["A"], note: "" } as const;
    const last = { ref: "9efb08a1.Decide.1", how: "sent", letters: ["B"], note: "" } as const;
    const shown = withSent(raised, [first, last]);
    expect(states(shown)).toEqual([settledAs(last), { tag: "open" }]);
    expect(shown.items[1]).toBe(raised.items[1]);
  });

  const again = { ref: "9efb08a1.Decide.1", how: "sent", letters: ["A"], note: "" } as const;
  const later = { ref: "9efb08a1.Decide.3", how: "sent", letters: ["Y"], note: "" } as const;

  test("are held under the press that sent them, after any held before, another press's for the same item kept", () => {
    const [first, second] = sentOf(draft, raised);
    const held = withHeld([], 1, [first!, second!]);
    expect(held).toEqual([
      { press: 1, settled: first },
      { press: 1, settled: second },
    ]);
    expect(withHeld(held, 2, [again])).toEqual([...held, { press: 2, settled: again }]);
  });

  test("a press holding an item again takes the place of its own earlier hold, at the end", () => {
    const [first, second] = sentOf(draft, raised);
    expect(withHeld(withHeld([], 1, [first!, second!]), 1, [again])).toEqual([
      { press: 1, settled: second },
      { press: 1, settled: again },
    ]);
  });

  test("a press puts back only its own, leaving a later press's for the same item", () => {
    const [first, second] = sentOf(draft, raised);
    const held = withHeld(withHeld([], 1, [first!, second!]), 2, [again]);
    expect(released(held, 1)).toEqual([{ press: 2, settled: again }]);
    expect(released(held, 2)).toEqual(withHeld([], 1, [first!, second!]));
    expect(released(held, 3)).toEqual(held);
  });

  test("once a refresh read the transcript, lose the holds it began with, by press and item, and keep any held since, one for the same item among them", () => {
    const [first, second] = sentOf(draft, raised);
    const before = withHeld([], 1, [first!, second!]);
    const since = withHeld(withHeld(before, 2, [later]), 3, [again]);
    expect(withoutRead(since, before)).toEqual([
      { press: 2, settled: later },
      { press: 3, settled: again },
    ]);
    expect(withoutRead(before, [])).toEqual(before);
  });

  test("make Done each item's most recently held answer, in the order they were held", () => {
    const [first, second] = sentOf(draft, raised);
    expect(heldNow(withHeld(withHeld([], 1, [first!, second!]), 2, [again]))).toEqual([second, again]);
    expect(heldNow(withHeld(withHeld([], 2, [again]), 1, [first!]))).toEqual([first]);
    expect(heldNow([])).toEqual([]);
  });

  test("make nothing Done for an item not raised", () => {
    const stray = { ref: "cafecafe.Decide.9", how: "sent", letters: ["A"], note: "" } as const;
    expect(settledRefsOf(withSent(raised, [stray]))).toEqual([]);
    expect(withSent(raised, [stray])).toBe(raised);
  });
});

describe("whether a Submit that went through closes the pane", () => {
  const both = sentOf("9efb08a1.Decide.1.A\n9efb08a1.Decide.2.B\n", raised);
  const one = sentOf("9efb08a1.Decide.1.A\n", raised);

  test("closes it once the answers sent leave no item open, while the setting is on", () => {
    expect(closesOnSubmit(raised, both, true)).toBe(true);
    expect(closesOnSubmit(raised, both, false)).toBe(false);
  });

  test("keeps it open while an item is still open", () => {
    expect(closesOnSubmit(raised, one, true)).toBe(false);
    expect(closesOnSubmit(raised, [], true)).toBe(false);
  });

  test("counts an item already Done, and the answers an earlier Submit sent, as not open", () => {
    const after = refreshed(raised, [checkbox], [], []);
    const earlier = sentOf("9efb08a1.Decide.2.B\n", raised);
    expect(closesOnSubmit(after, sentOf("9efb08a1.Decide.2.B\n", after), true)).toBe(true);
    expect(closesOnSubmit(raised, [...earlier, ...one], true)).toBe(true);
  });
});
