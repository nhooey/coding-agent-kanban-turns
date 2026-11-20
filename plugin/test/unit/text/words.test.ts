import { describe, test } from "node:test";
import { expect } from "expect";

import { capitalized, inWords } from "../../../src/text/words.ts";

describe("capitalized", () => {
  test("makes a word's first letter a capital and keeps the rest", () => {
    expect(capitalized("reassess")).toBe("Reassess");
    expect(capitalized("Done")).toBe("Done");
    expect(capitalized("")).toBe("");
  });
});

describe("inWords", () => {
  test("joins the last two by the conjunction and the rest by commas", () => {
    expect(inWords(["a", "b", "c"])).toBe("a, b and c");
    expect(inWords(["a", "b"], "or")).toBe("a or b");
    expect(inWords(["a"])).toBe("a");
    expect(inWords([])).toBe("");
  });
});
