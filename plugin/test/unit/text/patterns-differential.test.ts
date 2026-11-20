// `escaped` gives what the copy in src/protocol/rules.ts gave before it
// moved here, test/oracle/helpers.ts, over seeded random strings rich in the
// characters a pattern treats specially.

import { describe, test } from "node:test";
import { expect } from "expect";
import fc from "fast-check";

import { escaped } from "../../../src/text/patterns.ts";
import * as oracle from "../../oracle/helpers.ts";

const SEED = 0x5eed;

const charArb = fc.oneof(
  fc.constantFrom(..."\\^$.*+?()[]{}|/-`"),
  fc.string({ unit: "grapheme", minLength: 1, maxLength: 1 }),
);
const textArb = fc
  .array(charArb, { maxLength: 40 })
  .map((chars) => chars.join(""));

describe("escaped against the old copy", () => {
  test("the same pattern, which matches the text literally", () => {
    fc.assert(
      fc.property(textArb, (text) => {
        expect(escaped(text)).toBe(oracle.escaped(text));
        expect(new RegExp(`^${escaped(text)}$`, "u").test(text)).toBe(true);
      }),
      { seed: SEED, numRuns: 2000 },
    );
  });
});
