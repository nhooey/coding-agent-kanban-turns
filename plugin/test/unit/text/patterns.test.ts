import { describe, test } from "node:test";
import { expect } from "expect";

import { escaped } from "../../../src/text/patterns.ts";

describe("escaped", () => {
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
