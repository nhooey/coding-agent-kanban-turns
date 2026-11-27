// The cells text takes in a terminal: a line's lead, for the lines it
// wraps to to start under its text, and a header, for its underline.

import { describe, test } from "node:test";
import { expect } from "expect";

import { cellWidth, padToCells, widestCells } from "../../../src/text/cells.ts";

describe("text padded to a number of cells", () => {
  test("takes spaces after it until it takes that many cells", () => {
    expect(padToCells("C", 2)).toBe("C ");
    expect(padToCells("[x]", 5)).toBe("[x]  ");
    expect(padToCells("", 2)).toBe("  ");
  });

  test("is as it is where it already takes that many or more", () => {
    expect(padToCells("✅", 2)).toBe("✅");
    expect(padToCells("[x]", 2)).toBe("[x]");
  });
});

describe("the widest of several texts", () => {
  test("is the most cells any takes, an emoji counting 2", () => {
    expect(widestCells(["C", "✅", "[x]"])).toBe(3);
    expect(widestCells(["C", "🔘"])).toBe(2);
  });

  test("is 0 for none", () => {
    expect(widestCells([])).toBe(0);
  });
});

describe("the cells text takes", () => {
  test("a letter, a digit or a space is 1", () => {
    expect(cellWidth("A. ")).toBe(3);
    expect(cellWidth("")).toBe(0);
  });

  test("an emoji is 2, presented so by default or by U+FE0F", () => {
    expect(cellWidth("🔘 A. ")).toBe(6);
    expect(cellWidth("✅")).toBe(2);
    expect(cellWidth("\u{2611}\u{FE0F}")).toBe(2);
    expect(cellWidth("\u{270F}\u{FE0F} ")).toBe(3);
    expect(cellWidth("➕ ")).toBe(3);
    expect(cellWidth(" 🧠 Decide.12 ")).toBe(14);
  });

  test("an emoji joined into one, or given a skin tone, is still 2", () => {
    expect(cellWidth("\u{1F469}\u{200D}\u{1F4BB}")).toBe(2);
    expect(cellWidth("\u{1F44D}\u{1F3FD}")).toBe(2);
  });

  test("a wide character is 2, and a combining mark 0, alone or on a letter", () => {
    expect(cellWidth("漢字")).toBe(4);
    expect(cellWidth("e\u{0301}")).toBe(1);
    expect(cellWidth("\u{0301}")).toBe(0);
  });

  test("a keycap and a flag are 2, a regional indicator alone 1", () => {
    expect(cellWidth("1\u{FE0F}\u{20E3}")).toBe(2);
    expect(cellWidth("\u{1F1EF}\u{1F1F5}")).toBe(2);
    expect(cellWidth("\u{1F1EF}")).toBe(1);
  });

  test("U+FE0E asks for text, 1; U+FE0F makes an emoji 2 only of what can be one", () => {
    expect(cellWidth("\u{263A}\u{FE0E}")).toBe(1);
    expect(cellWidth("\u{263A}\u{FE0F}")).toBe(2);
    expect(cellWidth("a\u{FE0F}")).toBe(1);
  });

  test("half-width is 1 and full-width 2", () => {
    expect(cellWidth("\u{FF71}")).toBe(1);
    expect(cellWidth("\u{FF21}")).toBe(2);
  });

  test("a wide character that isn't an emoji is 2, written without U+FE0F", () => {
    for (const wide of [0x2329, 0x232a, 0xac00, 0xa960, 0xfe10, 0xfe50, 0x1b000, 0x1f202, 0x1f210]) {
      expect(cellWidth(String.fromCodePoint(wide))).toBe(2);
    }
  });
});
