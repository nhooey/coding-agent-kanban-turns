// What the hooks draw: the commands' and the tool's text, an item's title,
// and when the tool's row draws nothing.

import { describe, test } from "node:test";
import { expect } from "expect";

import { emptyRaised } from "../src/raised.ts";
import {
  answersText,
  configText,
  drewText,
  isPlainToolRow,
  itemTitle,
  noItemsText,
} from "../src/view.ts";
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
const binary: DecideItem = {
  ...radio,
  number: 2,
  kind: "binary",
  ref: "",
  options: [
    { letter: "Y", name: "Ship" },
    { letter: "N", name: "Hold" },
  ],
};
const raised: Raised = { ...emptyRaised, items: [radio, binary] };

describe("the text with no open items", () => {
  test("says why when the reason is known", () => {
    expect(noItemsText("")).toBe("No open Decide items.");
    expect(noItemsText("no script")).toBe("No open Decide items: no script.");
  });
});

describe("/answers's reply", () => {
  test("counts the open items the pane opened over, the settled left out", () => {
    expect(answersText(raised)).toBe("Decide pane opened: 2 open Decide items.");
    expect(answersText({ ...raised, settledRefs: ["9efb08a1.Decide.1"] })).toBe(
      "Decide pane opened: 1 open Decide items.",
    );
  });

  test("says there are none, and why", () => {
    expect(answersText({ ...emptyRaised, problem: "it broke" })).toBe(
      "No open Decide items: it broke.",
    );
    expect(
      answersText({ ...raised, settledRefs: ["9efb08a1.Decide.1", "9efb08a1.Decide.2"] }),
    ).toBe("No open Decide items.");
  });
});

describe("/answers-config's reply", () => {
  test("lists the settings in effect, then what wasn't used", () => {
    expect(configText(["keys.dismiss = q", "colors.title = claude"], ["bad.jsonc: parse error"])).toBe(
      "keys.dismiss = q\ncolors.title = claude\nNot used: bad.jsonc: parse error",
    );
  });

  test("is empty with nothing to list", () => {
    expect(configText([], [])).toBe("");
  });
});

describe("the tool's result", () => {
  test("names each item drawn by its reference, filling a missing one", () => {
    expect(drewText([radio, binary])).toBe(
      "Drew buttons for 2 Decide items under the final response and in the Decide pane: 9efb08a1.Decide.1, 9efb08a1.Decide.2.",
    );
  });
});

describe("an item's title", () => {
  test("is the item's number and summary, marked when settled", () => {
    expect(itemTitle(radio, false)).toBe("🧠 Decide.1 · Which cache to keep");
    expect(itemTitle(radio, true)).toBe("🧠 Decide.1 · Which cache to keep (settled)");
  });
});

describe("a plain tool row", () => {
  const plain = { isExpanded: false, isErrored: false, isInterrupted: false, itemCount: 2 };

  test("is a row that drew items with nothing more to say", () => {
    expect(isPlainToolRow(plain)).toBe(true);
  });

  test("is not one under ctrl+o, errored, interrupted or with no items", () => {
    expect(isPlainToolRow({ ...plain, isExpanded: true })).toBe(false);
    expect(isPlainToolRow({ ...plain, isErrored: true })).toBe(false);
    expect(isPlainToolRow({ ...plain, isInterrupted: true })).toBe(false);
    expect(isPlainToolRow({ ...plain, itemCount: 0 })).toBe(false);
  });

  test("a result line, without an interruption or a count, is plain unless expanded or errored", () => {
    expect(isPlainToolRow({ isExpanded: false, isErrored: false })).toBe(true);
    expect(isPlainToolRow({ isExpanded: true, isErrored: false })).toBe(false);
    expect(isPlainToolRow({ isExpanded: false, isErrored: true })).toBe(false);
  });
});
