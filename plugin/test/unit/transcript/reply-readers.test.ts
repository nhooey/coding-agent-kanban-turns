// What the readers of a reply read, stated line by line apart from the
// parser and held over seeded random replies, loose ones among them:
//
// - every item decideItemsOfText reads is a numbered item line at most 2
//   spaces in, or a number alone with its bold summary on the next line
//   not blank, in a Decide list's section, outside code, with an option
//   outside code before the next such line; and it reads every such item;
// - every line linkedSummaries links is a numbered item line at most 2
//   spaces in, in a Decide list's section, outside code, the bold summary
//   it opens on naming an item, and no topic's title; it links every such
//   line, and changes no other.

import { describe, test } from "node:test";
import { expect } from "expect";
import fc from "fast-check";

import { refOf } from "../../../src/items/items.ts";
import { decideItemsOfText } from "../../../src/items/outstanding.ts";
import { ITEM_LINK, linkedSummaries } from "../../../src/pane/links.ts";
import { optionGlyphs } from "../../../src/protocol/kinds.ts";
import {
  DECIDE,
  LETTER,
  SECTION_NAMES,
  isLineOf,
} from "../../../src/protocol/rules.ts";
import { SPEC } from "../../../src/protocol/spec.ts";
import { escaped } from "../../../src/text/patterns.ts";
import { SUMMARIES, decideItemsArb, replyArb } from "../../fixtures/replies.ts";

const RUNS = 600;
const SEED = 0x72656164;

const ROLL_UP = SPEC["roll-up"];
const HEADER = new RegExp(String.raw`^\s*\S+\s+\*\*(${SECTION_NAMES.map(escaped).join("|")}):\*\*`);
const PIN = new RegExp(
  String.raw`^\s*${escaped(ROLL_UP.glyph)}\s+\*\*${escaped(ROLL_UP.header)}:\*\*`,
  "u",
);
const OPTION = new RegExp(
  String.raw`^\s*(?:${optionGlyphs(SPEC.options.kinds).map(escaped).join("|")})\s+${LETTER}\.\s+\*\*.+?\*\*`,
  "u",
);
const MARKER = /^ {0,2}(?:[-*]|\d+[.)])\s+/;
const HEAD = /^ {0,2}(\d+)[.)]\s+\*\*(.+?)\*\*/;
const BARE = /^ {0,2}(\d+)[.)]\s*$/;
const BOLD = /^\s*\*\*(.+?)\*\*/;

const isRule = (line: string): boolean => isLineOf(SPEC.characters["topic-underline"], line);

/** The fence a line opens a code block with, its indent and an item's marker aside: its character and length. */
const fenceOf = (line: string): readonly [string, number] | undefined => {
  const body = line.replace(MARKER, "").trimStart();
  const run = /^(`{3,}|~{3,})/.exec(body)?.[1];

  return run === undefined || (run.startsWith("`") && body.slice(run.length).includes("`"))
    ? undefined
    : [run.charAt(0), run.length];
};

/** Whether each line is code: a fence's own lines and every line between them. */
const codeOf = (lines: readonly string[]): readonly boolean[] =>
  lines.reduce<Readonly<{ fence: readonly [string, number] | undefined; code: readonly boolean[] }>>(
    ({ fence, code }, line) => {
      const body = line.trim();

      return fence === undefined
        ? { fence: fenceOf(line), code: [...code, fenceOf(line) !== undefined] }
        : {
            fence:
              body.length >= fence[1] && [...body].every((char) => char === fence[0]) ? undefined : fence,
            code: [...code, true],
          };
    },
    { fence: undefined, code: [] },
  ).code;

/** Whether the line at `n`, outside code, is a topic's title: the line above a rule, unless blank, a header, the roll-up or a rule. */
const isTitle = (lines: readonly string[], code: readonly boolean[], n: number): boolean => {
  const line = lines[n] ?? "";

  return (
    !code[n] &&
    code[n + 1] === false &&
    isRule(lines[n + 1] ?? "") &&
    line.trim() !== "" &&
    !HEADER.test(line) &&
    !PIN.test(line) &&
    !isRule(line)
  );
};

/** Each Decide list's lines after its header, by place, outside code or in it, up to a header, the roll-up or a topic. */
const decideSections = (lines: readonly string[], code: readonly boolean[]): readonly (readonly number[])[] =>
  lines.reduce<Readonly<{ open: boolean; done: readonly (readonly number[])[] }>>(
    ({ open, done }, line, n) => {
      const name = code[n] ? undefined : HEADER.exec(line)?.[1];

      return name !== undefined
        ? { open: name === DECIDE.header, done: name === DECIDE.header ? [...done, []] : done }
        : !code[n] && (PIN.test(line) || isRule(line) || isTitle(lines, code, n))
          ? { open: false, done }
          : open
            ? { open, done: [...done.slice(0, -1), [...(done.at(-1) ?? []), n]] }
            : { open, done };
    },
    { open: false, done: [] },
  ).done;

/** The Decide items a reply prints, read line by line. */
const printedItems = (text: string): readonly Readonly<{ number: number; summary: string }>[] => {
  const lines = text.split("\n").map((line) => line.replace(/\r$/, ""));
  const code = codeOf(lines);

  return decideSections(lines, code).flatMap((places) => {
    const heads = places.flatMap((n, k) => {
      const line = lines[n] ?? "";
      const head = code[n] ? null : HEAD.exec(line);
      const bare = code[n] ? null : BARE.exec(line);
      const next = places.slice(k + 1).find((m) => code[m] || (lines[m] ?? "").trim() !== "");
      const bold = next === undefined || code[next] ? null : BOLD.exec(lines[next] ?? "");

      return head !== null
        ? [{ k, number: Number(head[1]), summary: head[2] ?? "" }]
        : bare !== null && bold !== null
          ? [{ k, number: Number(bare[1]), summary: bold[1] ?? "" }]
          : [];
    });

    return heads
      .filter(({ k }, h) =>
        places
          .slice(k + 1, heads[h + 1]?.k ?? places.length)
          .some((m) => !code[m] && OPTION.test(lines[m] ?? "")),
      )
      .map(({ number, summary }) => ({ number, summary: summary.trim().replace(/:$/, "").trim() }));
  });
};

const plain = (summary: string): string => summary.replaceAll("**", "").replaceAll("`", "").trim();

/** A summary as a line and an item are matched by: plain, a trailing colon aside. */
const summaryKey = (summary: string): string => plain(summary.trim().replace(/:$/, "").trim());

/** Each line a reply's questions link, by place, and the reference of the item it names: a numbered item line in a Decide list's section, opening on its bold summary. */
const linkedLines = (
  text: string,
  refs: ReadonlyMap<string, string>,
): readonly Readonly<{ n: number; ref: string }>[] => {
  const lines = text.split("\n").map((line) => line.replace(/\r$/, ""));
  const code = codeOf(lines);
  const decide = new Set(decideSections(lines, code).flat());

  return lines.flatMap((line, n) => {
    const head = !decide.has(n) || code[n] || isTitle(lines, code, n) ? null : HEAD.exec(line);
    const ref = head === null ? undefined : refs.get(summaryKey(head[2] ?? ""));

    return ref === undefined ? [] : [{ n, ref }];
  });
};

const looseArb = fc.oneof(replyArb("loose"), replyArb("strict"));

const property = <T>(arb: fc.Arbitrary<T>, check: (value: T) => void): void =>
  fc.assert(fc.property(arb, check), { seed: SEED, numRuns: RUNS });

describe("the readers of a reply, line by line", () => {
  test("decideItemsOfText reads each numbered item at most 2 spaces in under a Decide header, outside code, with an option before the next", () => {
    property(looseArb, (text) => {
      expect(decideItemsOfText(text)).toEqual(printedItems(text));
    });
  });

  test("linkedSummaries links each numbered item line at most 2 spaces in, in a Decide list's section, outside code, its bold summary naming an item, and changes no other line", () => {
    property(fc.record({ text: looseArb, items: decideItemsArb }), ({ text, items }) => {
      const refs = new Map(items.map((item) => [summaryKey(item.summary), refOf(item)]));
      const expected = linkedLines(text, refs);
      const { text: linked, hrefs } = linkedSummaries(text, items);
      const before = text.split("\n");
      const after = linked.split("\n");

      expect(hrefs).toEqual(expected.map(({ ref }) => `${ITEM_LINK}${ref}`));
      expect(after.length).toBe(before.length);
      expect(before.flatMap((line, n) => (after[n] === line ? [] : [n]))).toEqual(expected.map(({ n }) => n));
    });
  });

  test("the loose replies print Decide items and link questions, often", () => {
    const texts = fc.sample(replyArb("loose"), { seed: SEED, numRuns: 300 });

    expect(texts.filter((text) => printedItems(text).length > 0).length).toBeGreaterThan(20);
    expect(texts.filter((text) => /^ {0,2}\d+[.)]\s*$/m.test(text) && printedItems(text).length > 0).length).toBeGreaterThan(3);

    const refs = new Map(SUMMARIES.map((summary) => [plain(summary), summary]));

    expect(texts.filter((text) => linkedLines(text, refs).length > 0).length).toBeGreaterThan(30);
  });
});
