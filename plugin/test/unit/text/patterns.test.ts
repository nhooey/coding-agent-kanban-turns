import { describe, test } from "node:test";
import { expect } from "expect";
import fc from "fast-check";

import { escaped } from "../../../src/text/patterns.ts";

/** Seeded random text rich in the characters a pattern treats specially. */
const textArb = fc
  .array(
    fc.oneof(
      fc.constantFrom(..."\\^$.*+?()[]{}|/-`"),
      fc.string({ unit: "grapheme", minLength: 1, maxLength: 1 }),
    ),
    { maxLength: 40 },
  )
  .map((chars) => chars.join(""));

/** Random text and a near miss of it: one character changed, dropped or doubled, or the text as a pattern would read it, `.` any character and `*` none. */
const nearMissArb = textArb
  .filter((text) => text.length > 0)
  .chain((text) =>
    fc
      .tuple(
        fc.integer({ min: 0, max: [...text].length - 1 }),
        fc.constantFrom("change", "drop", "double", "wild"),
        fc.constantFrom("x", ".", "\\", "a"),
      )
      .map(([at, how, by]) => {
        const chars = [...text];
        const other =
          how === "change"
            ? chars.map((char, n) => (n === at ? by : char))
            : how === "drop"
              ? chars.filter((_, n) => n !== at)
              : how === "double"
                ? chars.flatMap((char, n) => (n === at ? [char, char] : [char]))
                : chars.map((char) => (char === "." ? "x" : char === "*" ? "" : char));

        return { text, other: other.join("") };
      }),
  );

describe("escaped", () => {
  test("a pattern matching any text literally, and no other text, near misses among them", () => {
    fc.assert(
      fc.property(fc.oneof(nearMissArb, fc.record({ text: textArb, other: textArb })), ({ text, other }) => {
        expect(new RegExp(`^${escaped(text)}$`, "u").test(text)).toBe(true);
        expect(new RegExp(`^${escaped(text)}$`, "u").test(other)).toBe(text === other);
      }),
      { seed: 0x5eed, numRuns: 2000 },
    );
  });

  test("the near misses differ from their text in most draws", () => {
    const drawn = fc.sample(nearMissArb, { seed: 0x5eed, numRuns: 1000 });

    expect(drawn.filter(({ text, other }) => text !== other).length).toBeGreaterThan(600);
  });

  test("a pattern matching the text literally, u flag or not", () => {
    const text = String.raw`a.b*c+d?e^f${"$"}g{h}i(j)k|l[m]n\o`;

    expect(new RegExp(`^${escaped(text)}$`).test(text)).toBe(true);
    expect(new RegExp(`^${escaped(text)}$`, "u").test(text)).toBe(true);
    expect(new RegExp(`^${escaped("a.b*(c)")}$`, "u").test("a.b*(c)")).toBe(true);
    expect(new RegExp(`^${escaped("a.b")}$`, "u").test("axb")).toBe(false);
  });

  test("text without special characters as it is", () => {
    expect(escaped("coding-agent-kanban-turns")).toBe(
      "coding-agent-kanban-turns",
    );
  });
});
