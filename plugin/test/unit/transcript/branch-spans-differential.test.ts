// The two readers of a summary's branch-shaped code spans give what they
// gave before `branchSpans` replaced their own copies: `reportNamesItem` and
// `namesWord` against src/transcript/reports.ts at fc64639, and `subjectKey`
// against src/items/outstanding.ts, test/oracle/helpers.ts. A summary is
// built of code spans, words of `[a-z0-9]{1,4}` joined by `-`, mixed with
// free text, so a draw holds none, one or several branch spans; a report
// names some of the summary's spans, so the later spans count too.

import { describe, test } from "node:test";
import { expect } from "expect";
import fc from "fast-check";

import { subjectKey } from "../../../src/items/outstanding.ts";
import {
  branchSpans,
  namesWord,
  reportNamesItem,
} from "../../../src/transcript/reports.ts";
import * as oracle from "../../oracle/helpers.ts";

const SEED = 0x5eed;
const RUNS = 2000;

/** A piece of a summary: its text, and the name inside it where it is a code span. */
type Piece = Readonly<{ text: string; name?: string }>;

const wordArb = fc.string({
  unit: fc.constantFrom(..."abcxyz0189"),
  minLength: 1,
  maxLength: 4,
});
const spanArb: fc.Arbitrary<Piece> = fc
  .array(wordArb, { minLength: 1, maxLength: 3 })
  .map((words) => words.join("-"))
  .map((name) => ({ text: `\`${name}\``, name }));
const freeArb: fc.Arbitrary<Piece> = fc
  .array(fc.constantFrom(..."aZ9 -_.`*(?é"), { maxLength: 6 })
  .map((chars) => ({ text: chars.join("") }));
const piecesArb = fc.array(
  fc.oneof({ arbitrary: spanArb, weight: 2 }, { arbitrary: freeArb, weight: 3 }),
  { maxLength: 8 },
);

/** A summary, the names its report goes by, and a report naming some of its spans. */
const caseArb = piecesArb.chain((pieces) =>
  fc.record({
    summary: fc.constant(pieces.map((piece) => piece.text).join("")),
    names: fc.array(wordArb, { maxLength: 2 }),
    report: fc
      .subarray(pieces.flatMap((piece) => (piece.name === undefined ? [] : [piece.name])))
      .map((named) => [...named, "done"].join(" ")),
  }),
);

describe("the readers of branch spans against their old copies", () => {
  test("a report names the same items", () => {
    fc.assert(
      fc.property(caseArb, ({ summary, names, report }) => {
        expect(reportNamesItem(summary, names, report)).toBe(
          oracle.reportNamesItem(summary, names, report),
        );
        expect(reportNamesItem(summary, [], report)).toBe(
          oracle.reportNamesItem(summary, [], report),
        );
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  test("a whole word is named alike", () => {
    fc.assert(
      fc.property(caseArb, ({ summary, report }) => {
        expect(namesWord(summary, report)).toBe(oracle.namesWord(summary, report));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  test("a summary keeps the same subject key", () => {
    fc.assert(
      fc.property(caseArb, ({ summary }) => {
        expect(subjectKey(summary)).toBe(oracle.subjectKey(summary));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  test("a fair share of the draws holds several branch spans", (t) => {
    const counts = fc
      .sample(caseArb, { seed: SEED, numRuns: RUNS })
      .map(({ summary }) => branchSpans(summary).length);
    const share = (least: number): number =>
      counts.filter((count) => count >= least).length / counts.length;

    const percent = (part: number): string => `${(part * 100).toFixed(1)}%`;

    t.diagnostic(
      `branch spans: none ${percent(1 - share(1))}, one ${percent(share(1) - share(2))}, two or more ${percent(share(2))}`,
    );
    expect(share(2)).toBeGreaterThan(0.2);
    expect(share(1) - share(2)).toBeGreaterThan(0.1);
    expect(1 - share(1)).toBeGreaterThan(0.1);
  });
});
