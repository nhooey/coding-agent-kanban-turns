// An item's subject key and a report's names read as they did before the
// spec's `subject` held their rule: `subjectKey`, `branchSpans`,
// `namesWord` and `reportNamesItem` against their copies at 4074f13,
// test/oracle/subject.ts. A summary is built of pieces that each touch one
// part of the rule: stop words, other words, backlog entries and near
// misses, code spans shaped like a branch name or nearly, and punctuation,
// each piece in any case. The generator's words and letters are its own,
// written out here, never read from the spec, so a spec that drops a stop
// word, an entry's word or a letter or digit of the alphabet is caught.

import { describe, test } from "node:test";
import { expect } from "expect";
import fc from "fast-check";

import { subjectKey } from "../../../src/items/outstanding.ts";
import {
  branchSpans,
  namesWord,
  reportNamesItem,
} from "../../../src/transcript/reports.ts";
import * as oracle from "../../oracle/subject.ts";

const SEED = 0x5b1ec7;
const RUNS = 3000;

/** The stop words at 4074f13, and words that look like them. */
const STOP_LIKE = [
  ..."a an and at by for from in is its of on the to with".split(" "),
  "as",
  "into",
  "then",
  "it",
  "an't",
];

/** A piece of a summary: its text, and the name inside it where it is a code span. */
type Piece = Readonly<{ text: string; name?: string }>;

/** The text in one of the cases a summary writes a word in. */
const casedArb = (text: string): fc.Arbitrary<string> =>
  fc.constantFrom(
    text,
    text.toUpperCase(),
    `${text.charAt(0).toUpperCase()}${text.slice(1)}`,
  );

/** The letters and digits a word was made of at 4074f13, written out. */
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

const plainWordArb = fc.string({
  unit: fc.constantFrom(...ALPHABET),
  minLength: 1,
  maxLength: 5,
});
const wordArb: fc.Arbitrary<Piece> = fc
  .oneof(fc.constantFrom(...STOP_LIKE), plainWordArb)
  .chain(casedArb)
  .map((text) => ({ text }));

/** A backlog entry, or a near miss: another word, no space, too few or too many digits, a letter after. */
const entryArb: fc.Arbitrary<Piece> = fc
  .record({
    word: fc.constantFrom("entry", "entries", "entr", "entrys", "sentry", "entryies").chain(casedArb),
    space: fc.constantFrom(" ", "  ", "\t", "\n", "", "-", " "),
    digits: fc.string({ unit: fc.constantFrom(..."0123456789"), minLength: 2, maxLength: 5 }),
    after: fc.constantFrom("", "", " ", "a", "_", ".", "5"),
  })
  .map(({ word, space, digits, after }) => ({ text: `${word}${space}${digits}${after}` }));

/** A code span shaped like a branch name, or nearly: one word, another joiner, a capital, an empty word. */
const spanArb: fc.Arbitrary<Piece> = fc
  .record({
    words: fc.array(plainWordArb, { minLength: 1, maxLength: 3 }),
    joiner: fc.constantFrom("-", "-", "-", "_", "--", ".", "/"),
    cased: fc.constantFrom("lower", "lower", "lower", "upper", "edge"),
  })
  .map(({ words, joiner, cased }) => {
    const joined = words.join(joiner);
    const name =
      cased === "upper"
        ? joined.toUpperCase()
        : cased === "edge"
          ? `${joiner}${joined}`
          : joined;

    return { text: `\`${name}\``, name };
  });

const punctuationArb: fc.Arbitrary<Piece> = fc
  // The long s, U+017F, and the Kelvin sign, U+212A, fold to ASCII letters
  // under a `u` flag's case folding.
  .array(fc.constantFrom(..." ,.;:!?-_`*()'\"/é𝟏İſKßç"), { minLength: 1, maxLength: 4 })
  .map((chars) => ({ text: chars.join("") }));

const piecesArb = fc.array(
  fc.oneof(
    { arbitrary: wordArb, weight: 5 },
    { arbitrary: entryArb, weight: 2 },
    { arbitrary: spanArb, weight: 2 },
    { arbitrary: punctuationArb, weight: 3 },
  ),
  { maxLength: 10 },
);

/** Pieces joined by spaces, or by nothing. */
const joinedArb = (pieces: readonly Piece[]): fc.Arbitrary<string> =>
  fc
    .array(fc.constantFrom(" ", " ", ""), {
      minLength: pieces.length,
      maxLength: pieces.length,
    })
    .map((gaps) => pieces.map((piece, n) => `${piece.text}${gaps[n]}`).join(""));

/** A summary, the names its report goes by, and a report line naming some of its spans. */
const caseArb = piecesArb.chain((pieces) =>
  fc.record({
    summary: joinedArb(pieces),
    names: fc.array(fc.oneof(plainWordArb, fc.constantFrom("entry", "the")), {
      maxLength: 2,
    }),
    report: fc
      .tuple(
        fc.subarray(
          pieces.flatMap((piece) => (piece.name === undefined ? [] : [piece.name])),
        ),
        fc.constantFrom("done", "Merged:", "x-", "_"),
      )
      .chain(([named, tail]) =>
        fc
          .array(fc.constantFrom(" ", ", ", "-", "`"), {
            minLength: named.length + 1,
            maxLength: named.length + 1,
          })
          .map((gaps) =>
            [...named, tail].map((part, n) => `${part}${gaps[n]}`).join(""),
          ),
      ),
  }),
);

describe("the subject key and a report's names against their copies at 4074f13", () => {
  test("a summary keeps the same subject key", () => {
    fc.assert(
      fc.property(caseArb, ({ summary }) => {
        expect(subjectKey(summary)).toBe(oracle.subjectKey(summary));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  test("a summary holds the same branch spans", () => {
    fc.assert(
      fc.property(caseArb, ({ summary, report }) => {
        expect(branchSpans(summary)).toEqual(oracle.branchSpans(summary));
        expect(branchSpans(report)).toEqual(oracle.branchSpans(report));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  test("a report names the same items, and a word is named alike", () => {
    fc.assert(
      fc.property(caseArb, ({ summary, names, report }) => {
        expect(reportNamesItem(summary, names, report)).toBe(
          oracle.reportNamesItem(summary, names, report),
        );
        expect(namesWord(summary, report)).toBe(oracle.namesWord(summary, report));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  test("the draws reach every way a key is made", (t) => {
    const draws = fc
      .sample(caseArb, { seed: SEED, numRuns: RUNS })
      .map(({ summary }) => ({ summary, key: oracle.subjectKey(summary) }));
    const share = (isIt: (draw: (typeof draws)[number]) => boolean): number =>
      draws.filter(isIt).length / draws.length;
    const isWordKey = ({ summary, key }: (typeof draws)[number]): boolean =>
      !/^(entry|branch) /.test(key) && /[a-z0-9]/.test(summary.toLowerCase());
    const shares = {
      entry: share(({ key }) => key.startsWith("entry ")),
      branch: share(({ key }) => key.startsWith("branch ")),
      words: share(isWordKey),
      "several words": share((draw) => isWordKey(draw) && draw.key.includes(" ")),
      normal: share(
        (draw) => !/^(entry|branch) /.test(draw.key) && !isWordKey(draw),
      ),
    };

    t.diagnostic(
      Object.entries(shares)
        .map(([way, part]) => `${way} ${(part * 100).toFixed(1)}%`)
        .join(", "),
    );
    Object.values(shares).forEach((part) => expect(part).toBeGreaterThan(0.05));
  });
});
