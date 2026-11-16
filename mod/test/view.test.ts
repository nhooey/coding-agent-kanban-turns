// What the hooks draw: the band's view, the commands' and the tool's text,
// and when the tool's row is drawn as its buttons alone.

import { describe, test } from "node:test";
import { expect } from "expect";

import { emptyBand } from "../src/band.ts";
import {
  answersText,
  bandView,
  configText,
  drewText,
  foldedLabel,
  isPlainToolRow,
  noItemsText,
  toolRowTitle,
} from "../src/view.ts";
import type { Band, DecideItem } from "../types/index.d.ts";

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
const band: Band = { ...emptyBand, items: [radio, binary] };
const clear = {
  fits: true,
  paneShown: false,
  hasSurvey: false,
  hasSettings: true,
} as const;

describe("the band's view", () => {
  test("an item that fits, with nothing over it, shows in full", () => {
    expect(bandView(band, clear)).toBe("full");
  });

  test("a survey, unread settings or no items show no band", () => {
    expect(bandView(band, { ...clear, hasSurvey: true })).toBe("none");
    expect(bandView(band, { ...clear, hasSettings: false })).toBe("none");
    expect(bandView(emptyBand, clear)).toBe("none");
  });

  test("a dismissed or away band, or one under the pane, folds", () => {
    expect(bandView({ ...band, isDismissed: true }, clear)).toBe("folded");
    expect(bandView({ ...band, isAway: true }, clear)).toBe("folded");
    expect(bandView(band, { ...clear, paneShown: true })).toBe("folded");
  });

  test("items too tall fold with the pane's button, whatever else holds", () => {
    expect(bandView(band, { ...clear, fits: false })).toBe("folded-tall");
    expect(bandView({ ...band, isAway: true }, { ...clear, fits: false })).toBe(
      "folded-tall",
    );
  });
});

describe("the folded band's label", () => {
  test("counts the decisions, singular for one", () => {
    expect(foldedLabel(1, true)).toBe(" 1 open decision");
    expect(foldedLabel(3, true)).toBe(" 3 open decisions");
  });

  test("says when they're too tall for the band", () => {
    expect(foldedLabel(2, false)).toBe(" 2 open decisions, too tall for here ");
  });
});

describe("the text with no open items", () => {
  test("says why when the reason is known", () => {
    expect(noItemsText("")).toBe("No open Decide items.");
    expect(noItemsText("no script")).toBe("No open Decide items: no script.");
  });
});

describe("/answers's reply", () => {
  test("counts the items the pane opened over", () => {
    expect(answersText(band)).toBe("Decide pane opened: 2 open Decide items.");
  });

  test("says there are none, and why", () => {
    expect(answersText({ ...emptyBand, problem: "it broke" })).toBe(
      "No open Decide items: it broke.",
    );
  });
});

describe("/answers-config's reply", () => {
  test("lists the settings in effect, then what wasn't used", () => {
    expect(configText(["keys.prev = p", "keys.next = n"], ["bad.jsonc: parse error"])).toBe(
      "keys.prev = p\nkeys.next = n\nNot used: bad.jsonc: parse error",
    );
  });

  test("is empty with nothing to list", () => {
    expect(configText([], [])).toBe("");
  });
});

describe("the tool's result", () => {
  test("names each item drawn by its reference, filling a missing one", () => {
    expect(drewText([radio, binary])).toBe(
      "Drew buttons for 2 Decide items above the final response: 9efb08a1.Decide.1, 9efb08a1.Decide.2.",
    );
  });
});

describe("the tool row's title", () => {
  test("is the item's number and summary, marked when settled", () => {
    expect(toolRowTitle(radio, false)).toBe("🧠 Decide.1 · Which cache to keep");
    expect(toolRowTitle(radio, true)).toBe("🧠 Decide.1 · Which cache to keep (settled)");
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
