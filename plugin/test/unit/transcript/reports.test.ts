// Whether a report names a Waiting item, and the pseudo-XML reader the
// Claude Code adapter reads reports' names with.

import { describe, test } from "node:test";
import { expect } from "expect";

import {
  branchSpans,
  elements,
  namesWord,
  reportNamesItem,
} from "../../../src/transcript/reports.ts";

describe("elements", () => {
  test("each element with its attributes and its own text, no child's", () => {
    expect(
      elements('<task-notification>\n<task-id>b8</task-id>\n<summary>A "x" ran</summary>\n</task-notification>'),
    ).toEqual([
      { tag: "task-notification", attrs: {}, text: "" },
      { tag: "task-id", attrs: {}, text: "b8" },
      { tag: "summary", attrs: {}, text: 'A "x" ran' },
    ]);
  });

  test("attribute names lowercased, values unquoted and unescaped", () => {
    expect(elements("<A From='x &amp; y' bare=z>t</A>")).toEqual([
      { tag: "a", attrs: { from: "x & y", bare: "z" }, text: "t" },
    ]);
  });

  test("nested elements keep their own text apart, an unclosed one closed by its parent", () => {
    expect(elements("<a>1<b>2<c>3</b>4</a>5<d/>")).toEqual([
      { tag: "a", attrs: {}, text: "14" },
      { tag: "b", attrs: {}, text: "2" },
      { tag: "c", attrs: {}, text: "3" },
      { tag: "d", attrs: {}, text: "" },
    ]);
    expect(elements("</x>text<y>")).toEqual([{ tag: "y", attrs: {}, text: "" }]);
  });

  test("a text of many tags parses in time linear in them", () => {
    const count = 50_000;
    const started = performance.now();
    const found = elements(`<task-notification>${"<summary>x</summary>".repeat(count)}</task-notification>`);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(found).toHaveLength(count + 1);
    expect(found.at(-1)).toEqual({ tag: "summary", attrs: {}, text: "x" });
  });

  test("a bare `&` or `<` is text", () => {
    expect(elements("<summary>a < b & c &lt; d</summary>")).toEqual([
      { tag: "summary", attrs: {}, text: "a < b & c < d" },
    ]);
  });
});

describe("reportNamesItem", () => {
  test("the item's summary holds one of the report's names, as a whole word", () => {
    expect(reportNamesItem("Watcher (`b8a83gfv0`)", ["b8a83gfv0"], "")).toBe(true);
    expect(reportNamesItem("GitHub-Config: the fixes", ["github-config"], "")).toBe(true);
    expect(reportNamesItem("github-config-2: the fixes", ["github-config"], "")).toBe(false);
    expect(reportNamesItem("Watcher", ["watch"], "")).toBe(false);
  });

  test("the report holds a branch-shaped code span of the summary", () => {
    expect(
      reportNamesItem("The implementer, on `outstanding-settled-items`", [], "Pushed outstanding-settled-items."),
    ).toBe(true);
    expect(reportNamesItem("The README, `README.md`", [], "README.md done")).toBe(false);
  });

  test("an empty name names nothing", () => {
    expect(namesWord("  ", "anything")).toBe(false);
  });
});

describe("branchSpans", () => {
  test("the code spans shaped like a branch name, in order", () => {
    expect(
      branchSpans("merge `core-shared-helpers`, then `pane-state` and `x`"),
    ).toEqual(["core-shared-helpers", "pane-state"]);
  });

  test("none for spans with no hyphen, capitals, or other characters", () => {
    expect(
      branchSpans("`main` `Core-Helpers` `a_b-c` `-a` `a-` `a--b` plain-text"),
    ).toEqual([]);
  });

  test("the same twice in a row, the pattern holding no state between calls", () => {
    const text = "`a-b` and `c-d`";

    expect(branchSpans(text)).toEqual(["a-b", "c-d"]);
    expect(branchSpans(text)).toEqual(["a-b", "c-d"]);
  });
});
