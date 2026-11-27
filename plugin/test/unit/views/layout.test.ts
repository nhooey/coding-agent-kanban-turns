// The pane's fixed layout: the spacing and the characters that structure
// its lines, each the value the pane was drawn with before they were named.

import { describe, test } from "node:test";
import { expect } from "expect";

import { LAYOUT, codeSpans } from "../../../src/views/layout.ts";

describe("the pane's layout", () => {
  test("holds the spacing and characters the pane was drawn with", () => {
    expect(LAYOUT).toEqual({
      indent: 3,
      gutter: 1,
      gutterGap: 1,
      titleGap: 1,
      labelGap: 2,
      boxPadding: 1,
      border: "round",
      blockGap: 1,
      controlGap: 2,
      fewestNoteRows: 1,
      divider: " · ",
      rule: "──",
    });
  });

  test("leaves an option's gutter and the gap after it inside its indent, so its text stays put", () => {
    expect(LAYOUT.indent - LAYOUT.gutter - LAYOUT.gutterGap).toBeGreaterThanOrEqual(0);
  });

  test("leaves a blank cell between the gutter and an option's mark", () => {
    expect(LAYOUT.gutterGap).toBe(1);
  });
});

describe("a line's code spans", () => {
  test("are the parts between backticks, without bold marks or empty parts", () => {
    expect(codeSpans("use `x` **now**")).toEqual([
      { text: "use ", isCode: false },
      { text: "x", isCode: true },
      { text: " now", isCode: false },
    ]);
  });
});
