// Whether a report names a Waiting item, and the pseudo-XML reader the
// Claude Code adapter reads reports' names with.

import { describe, test } from "node:test";
import { expect } from "expect";
import fc from "fast-check";

import { subjectKey } from "../../../src/items/outstanding.ts";
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

describe("namesWord", () => {
  test("a word holds the separator a branch name joins its words with, so no part of a branch name is named", () => {
    expect(namesWord("atomic", "merged atomic-reload")).toBe(false);
    expect(namesWord("reload", "merged atomic-reload")).toBe(false);
    expect(namesWord("atomic-reload", "merged atomic-reload-two")).toBe(false);
    expect(namesWord("atomic-reload", "merged ATOMIC-RELOAD")).toBe(true);
  });

  test("a name before a sentence's full stop, or beside a path's slash, is named", () => {
    expect(namesWord("atomic-reload", "Merged atomic-reload.")).toBe(true);
    expect(namesWord("atomic-reload", "see origin/atomic-reload/notes")).toBe(true);
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

/** A piece of a summary: its text, and the name inside it where it is a code span. */
type Piece = Readonly<{ text: string; name?: string }>;

const wordArb = fc.string({ unit: fc.constantFrom(..."abcxyz0189"), minLength: 1, maxLength: 4 });
const spanArb: fc.Arbitrary<Piece> = fc
  .array(wordArb, { minLength: 1, maxLength: 3 })
  .map((words) => words.join("-"))
  .map((name) => ({ text: `\`${name}\``, name }));
const freeArb: fc.Arbitrary<Piece> = fc
  .array(fc.constantFrom(..."aZ9 -_.*(?é"), { maxLength: 6 })
  .map((chars) => ({ text: chars.join("") }));

/** A summary of code spans, one to three words joined by `-`, among free text holding no backtick, and a report naming some of its spans. */
const caseArb = fc
  .array(fc.oneof({ arbitrary: spanArb, weight: 2 }, { arbitrary: freeArb, weight: 3 }), { maxLength: 8 })
  .chain((pieces) => {
    const names = pieces.flatMap((piece) => (piece.name === undefined ? [] : [piece.name]));

    return fc.subarray(names).map((named) => ({
      summary: pieces.map((piece) => piece.text).join(""),
      names,
      named,
    }));
  });

const isBranch = (name: string): boolean => name.includes("-");

describe("a summary's branch spans, over random summaries", () => {
  test("are its code spans of two words or more, in order", () => {
    fc.assert(
      fc.property(caseArb, ({ summary, names }) => {
        expect(branchSpans(summary)).toEqual(names.filter(isBranch));
      }),
      { seed: 0x5eed, numRuns: 2000 },
    );
  });

  test("name the item to a report exactly when it names one of them", () => {
    fc.assert(
      fc.property(caseArb, ({ summary, named }) => {
        expect(reportNamesItem(summary, [], [...named, "done"].join(" "))).toBe(named.some(isBranch));
      }),
      { seed: 0x5eed, numRuns: 2000 },
    );
  });

  test("give the summary's subject key by the first of them", () => {
    fc.assert(
      fc.property(caseArb, ({ summary, names }) => {
        const first = names.find(isBranch);

        if (first !== undefined) {
          expect(subjectKey(summary)).toBe(`branch ${first}`);
        }
      }),
      { seed: 0x5eed, numRuns: 2000 },
    );
  });

  test("hold none, one, or several in a fair share of the draws", () => {
    const counts = fc
      .sample(caseArb, { seed: 0x5eed, numRuns: 2000 })
      .map(({ summary }) => branchSpans(summary).length);
    const share = (isIt: (count: number) => boolean): number => counts.filter(isIt).length / counts.length;

    expect(share((count) => count === 0)).toBeGreaterThan(0.1);
    expect(share((count) => count === 1)).toBeGreaterThan(0.1);
    expect(share((count) => count >= 2)).toBeGreaterThan(0.2);
  });
});
