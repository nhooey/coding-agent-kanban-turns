import { describe, test } from "node:test";
import { expect } from "expect";

import {
  DECIDE,
  DEFAULT_KIND,
  DONE,
  LETTER,
  REASSESS,
  SUBSCRIPT_CHAR,
  TURN_ID,
  TURN_ID_CHAR,
  TURN_ID_PREFIX,
  classOf,
  isLineOf,
  isOptionLetter,
  isTurnId,
  itemLabel,
  namesOf,
} from "../../../src/protocol/rules.ts";
import { SPEC } from "../../../src/protocol/spec.ts";

const whole = (pattern: string): RegExp => new RegExp(`^${pattern}$`, "u");

describe("the protocol's patterns", () => {
  test("match a whole turn id", () => {
    expect(whole(TURN_ID).test("9efb08a1")).toBe(true);
    expect(whole(TURN_ID).test("9efb08a")).toBe(false);
    expect(whole(TURN_ID).test("9EFB08A1")).toBe(false);
  });

  test("match a turn id or a prefix of it, as an answer may name the turn", () => {
    expect(whole(TURN_ID_PREFIX).test("9efb08")).toBe(true);
    expect(whole(TURN_ID_PREFIX).test("9efb08a1")).toBe(true);
    expect(whole(TURN_ID_PREFIX).test("9efb0")).toBe(false);
    expect(whole(TURN_ID_CHAR).test("g")).toBe(false);
  });

  test("match one option letter", () => {
    expect(whole(LETTER).test("B")).toBe(true);
    expect(whole(LETTER).test("b")).toBe(false);
  });

  test("match a subscript digit or minus", () => {
    expect(whole(`${SUBSCRIPT_CHAR}+`).test("₋₃")).toBe(true);
    expect(whole(SUBSCRIPT_CHAR).test("3")).toBe(false);
  });
});

describe("isTurnId", () => {
  test("holds for the spec's length in its alphabet, and nothing else", () => {
    expect(isTurnId("9efb08a1")).toBe(true);
    expect(isTurnId("9efb08a")).toBe(false);
    expect(isTurnId("9efb08a12")).toBe(false);
    expect(isTurnId("9EFB08A1")).toBe(false);
    expect(isTurnId("")).toBe(false);
  });
});

describe("isOptionLetter", () => {
  test("holds for one letter from the grammar's first to its last", () => {
    expect(isOptionLetter(SPEC.reference.letters.first)).toBe(true);
    expect(isOptionLetter(SPEC.reference.letters.last)).toBe(true);
    expect(isOptionLetter("a")).toBe(false);
    expect(isOptionLetter("AB")).toBe(false);
    expect(isOptionLetter("")).toBe(false);
  });
});

describe("classOf", () => {
  test("holds each character, a minus, caret, bracket or backslash among them, and nothing more", () => {
    const chars = "a-c^]\\";
    const pattern = new RegExp(`^${classOf(chars)}+$`, "u");

    expect(pattern.test(chars)).toBe(true);
    expect(pattern.test("b")).toBe(false);
    expect(new RegExp(`^${classOf("₀-")}$`).test("-")).toBe(true);
  });
});

describe("namesOf", () => {
  test("gives a list's header, then its aliases", () => {
    expect(namesOf(SPEC.lists.decide)).toEqual(["Decide", "Decisions", "Blocked"]);
  });
});

describe("itemLabel", () => {
  test("is the Decide list's glyph and the item's reference without its turn", () => {
    expect(itemLabel(2)).toBe("🧠 Decide.2");
    expect(DECIDE.header).toBe("Decide");
  });
});

describe("REASSESS", () => {
  test("is a command the spec names", () => {
    expect(Object.keys(SPEC.commands.names)).toContain(REASSESS);
  });
});

describe("DONE", () => {
  test("is the spec's Done list", () => {
    expect(DONE).toBe(SPEC.lists.done);
    expect(DONE.header).toBe("Done");
  });
});

describe("DEFAULT_KIND", () => {
  test("is a kind the spec names, one the instructions teach", () => {
    expect(SPEC.options.kinds[DEFAULT_KIND].taught).toBe(true);
    expect(SPEC.options.kinds[DEFAULT_KIND].picks).toBe("one");
  });
});

describe("isLineOf", () => {
  test("is true for a line of the character alone, spaces either side", () => {
    expect(isLineOf("═", "  ═══ ")).toBe(true);
    expect(isLineOf("═", "══ x")).toBe(false);
    expect(isLineOf("═", "   ")).toBe(false);
  });
});
