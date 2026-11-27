import { describe, test } from "node:test";
import { expect } from "expect";

import {
  firstLetters,
  glyphsInWords,
  kindGlyphs,
  kindLetters,
  lettersInWords,
  optionGlyphs,
  taughtKinds,
} from "../../../src/protocol/kinds.ts";
import { SPEC } from "../../../src/protocol/spec.ts";

const KINDS = SPEC.options.kinds;
const { radio, checkbox, binary } = KINDS;

describe("taughtKinds", () => {
  test("keeps the kinds marked taught, in the spec's order", () => {
    expect(Object.keys(taughtKinds(KINDS))).toEqual(["radio", "checkbox"]);
    expect(taughtKinds({ binary })).toEqual({});
    expect(taughtKinds({ binary: { ...binary, taught: true } })).toEqual({
      binary: { ...binary, taught: true },
    });
  });
});

describe("kindGlyphs", () => {
  test("gives a lettered kind its letters' glyphs, and another its one glyph", () => {
    expect(kindGlyphs(binary)).toEqual(["👍", "👎"]);
    expect(kindGlyphs(radio)).toEqual(["🔘"]);
  });
});

describe("optionGlyphs", () => {
  test("holds each kind's glyph and its letters', once each", () => {
    expect(optionGlyphs(KINDS)).toEqual(["🔘", "🔲", "👍", "👎"]);
    expect(optionGlyphs({ radio, again: radio })).toEqual(["🔘"]);
  });
});

describe("firstLetters", () => {
  test("counts on from the first letter, 3 unless told", () => {
    expect(firstLetters("A")).toEqual(["A", "B", "C"]);
    expect(firstLetters("X", 2)).toEqual(["X", "Y"]);
  });
});

describe("kindLetters", () => {
  test("gives a lettered kind its own letters, and another the first few", () => {
    expect(kindLetters(binary, "A")).toEqual(["Y", "N"]);
    expect(kindLetters(checkbox, "A")).toEqual(["A", "B", "C"]);
  });
});

describe("lettersInWords", () => {
  test("names each kind's letters once, the sets parted by `, or `", () => {
    expect(lettersInWords(KINDS, "A")).toBe("A, B, C, or Y and N");
    expect(lettersInWords({ radio, checkbox }, "A")).toBe("A, B, C");
  });

  test("marks each letter as it is told", () => {
    expect(lettersInWords({ binary }, "A", (letter) => `\`${letter}\``)).toBe("`Y` and `N`");
  });
});

describe("glyphsInWords", () => {
  test("joins the kinds' glyphs by `or`, with a comma before it where a kind's own take `and`", () => {
    expect(glyphsInWords({ radio, checkbox })).toBe("🔘 or 🔲");
    expect(glyphsInWords(KINDS)).toBe("🔘, 🔲, or 👍 and 👎");
    expect(glyphsInWords({ binary })).toBe("👍 and 👎");
    expect(glyphsInWords({})).toBe("");
  });
});
