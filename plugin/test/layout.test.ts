// The cells a line's lead takes, for the lines it wraps to to start under
// its text.

import { describe, test } from "node:test";
import { expect } from "expect";

import { cellWidth } from "../src/layout.ts";

describe("the cells text takes", () => {
  test("a letter, a digit or a space is 1", () => {
    expect(cellWidth("A. ")).toBe(3);
    expect(cellWidth("")).toBe(0);
  });

  test("an emoji is 2, presented so by default or by U+FE0F", () => {
    expect(cellWidth("🔘 A. ")).toBe(6);
    expect(cellWidth("✅")).toBe(2);
    expect(cellWidth("☑️")).toBe(2);
    expect(cellWidth("✏️ ")).toBe(3);
    expect(cellWidth("➕ ")).toBe(3);
    expect(cellWidth(" 🧠 Decide.12 ")).toBe(14);
  });

  test("an emoji joined into one, or given a skin tone, is still 2", () => {
    expect(cellWidth("👩‍💻")).toBe(2);
    expect(cellWidth("👍🏽")).toBe(2);
  });

  test("a wide character is 2, and a combining mark 0", () => {
    expect(cellWidth("漢字")).toBe(4);
    expect(cellWidth("é")).toBe(1);
  });
});
