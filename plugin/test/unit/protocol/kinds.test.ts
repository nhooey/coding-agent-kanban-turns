import { describe, test } from "node:test";
import { expect } from "expect";

import { firstLetters, glyphsInWords, lettersInWords, optionGlyphs } from "../../../src/protocol/kinds.ts";
import { SPEC } from "../../../src/protocol/spec.ts";

const KINDS = SPEC.options.kinds;
const { radio } = KINDS;

describe("optionGlyphs", () => {
  test("holds each kind's glyph, once each", () => {
    expect(optionGlyphs(KINDS)).toEqual(["🔘", "🔲"]);
    expect(optionGlyphs({ radio, again: radio })).toEqual(["🔘"]);
  });
});

describe("firstLetters", () => {
  test("counts on from the first letter, 3 unless told", () => {
    expect(firstLetters("A")).toEqual(["A", "B", "C"]);
    expect(firstLetters("X", 2)).toEqual(["X", "Y"]);
  });
});

describe("lettersInWords", () => {
  test("names the first few letters, parted by commas", () => {
    expect(lettersInWords("A")).toBe("A, B, C");
  });

  test("marks each letter as it is told", () => {
    expect(lettersInWords("A", (letter) => `\`${letter}\``)).toBe("`A`, `B`, `C`");
  });
});

describe("glyphsInWords", () => {
  test("joins the kinds' glyphs by `or`, once each", () => {
    expect(glyphsInWords(KINDS)).toBe("🔘 or 🔲");
    expect(glyphsInWords({ radio, again: radio })).toBe("🔘");
    expect(glyphsInWords({})).toBe("");
  });
});
