// What the hooks draw: the commands' and the tool's text, an item's title,
// and when the tool's row draws nothing.

import { describe, test } from "node:test";
import { expect } from "expect";

import { emptyRaised } from "../src/raised.ts";
import {
  answersText,
  configText,
  drewText,
  gutterStyle,
  isPlainToolRow,
  itemTitle,
  noItemsText,
  noteRows,
  submittedText,
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
  test("is a label of its list and number, padded for its background, then its summary, marked when settled", () => {
    expect(itemTitle(radio, false)).toEqual({
      label: " 🧠 Decide.1 ",
      summary: "Which cache to keep",
    });
    expect(itemTitle(radio, true)).toEqual({
      label: " 🧠 Decide.1 ",
      summary: "Which cache to keep (settled)",
    });
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

describe("the pane's Submit", () => {
  test("sends the draft as it is", () => {
    expect(submittedText("9efb08a1.Decide.1.A\n")).toBe("9efb08a1.Decide.1.A\n");
  });

  test("sends nothing for an empty or blank draft", () => {
    expect(submittedText("")).toBeUndefined();
    expect(submittedText("  \n\t")).toBeUndefined();
  });
});

describe("the notes field's rows", () => {
  test("are the setting's whole number, at least 1", () => {
    expect(noteRows(3)).toBe(3);
    expect(noteRows(2.7)).toBe(2);
    expect(noteRows(0)).toBe(1);
    expect(noteRows(-4)).toBe(1);
    expect(noteRows(Number.NaN)).toBe(1);
  });
});

describe("the column left of an option", () => {
  const colors = { hover: "suggestion", settled: "ide" };

  test("lights in the hover colour under the pointer while the item is open", () => {
    expect(gutterStyle(false, "9efb08a1.Decide.1.A", colors)).toEqual({
      hover: { scope: "9efb08a1.Decide.1.A", backgroundColor: "suggestion" },
    });
  });

  test("stays lit in the settled colour, and never hovers, once the item is settled", () => {
    expect(gutterStyle(true, "9efb08a1.Decide.1.A", colors)).toEqual({
      backgroundColor: "ide",
    });
  });
});
