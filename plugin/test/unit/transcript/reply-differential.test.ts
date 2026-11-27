// Reading a reply's text once into blocks gives what the readers that each
// scanned its lines again gave, test/oracle/reply-text.ts: `sectionsOf`,
// `itemsOfText`, `decideItemsOfText`, `decideListCut`, `linkedQuestions` and
// `isKanbanReply`, over the golden cases' replies, the spec's fragments'
// example replies, seeded random replies built from the protocol's pieces,
// and replies joined from both.
//
// Where the old readers read the same text differently from each other, the
// new ones read it one way. Each such difference is classed below, under
// "where the readers part", as a fix, with the old reading beside the new,
// or as behaviour kept, which the random replies hold the new readers to. A
// strict random reply, test/fixtures/replies.ts, leaves out the shapes the
// fixes read differently:
//
// - code holding anything but inert lines, a blank line in a Decide item's
//   code, a code block outside a list without a blank line above it, a
//   line of code at the line's start, a fence less indented than its item's
//   text, or one of another length or character than the one it closes
//   (fixes: code);
// - an item 1 to 3 spaces in, or a numbered line under an item (fix: indent);
// - an item numbered `1)` (fix: numbering);
// - a number alone on its line, its bold summary beneath (fix: number alone);
// - a topic header with no blank line above it (fix: topic title);
// - a line opening on an older roll-up header bare with more after it (fix:
//   older roll-up);
// - an option written without its glyph, or a summary line holding two bold
//   spans (fix: one grammar);
// - a separator anywhere but between two items (fix: separator);
// - a line ending on `\r` (fix: CRLF).
//
// `sectionsOf` gives, for the same reply, the old sections cut where the 📌
// roll-up starts (fix: roll-up ends a section). A loose random reply writes
// the shapes `itemsOfText` read alike before and after, and the others
// above it reads alike too.
//
// Temporary: deleted with the oracle once `reply-text-parse-once` has
// merged into `master`.

import { describe, test } from "node:test";
import { expect } from "expect";
import fc from "fast-check";
import { readFileSync, readdirSync } from "node:fs";

import { itemsOf } from "../../../src/items/items.ts";
import {
  decideItemsOfText,
  itemsOfText,
} from "../../../src/items/outstanding.ts";
import { isKanbanReply } from "../../../src/lint/reply.ts";
import { decideListCut, linkedQuestions } from "../../../src/pane/links.ts";
import { FRAGMENTS } from "../../../src/protocol/fragments.ts";
import { filled, placeholderValues } from "../../../src/protocol/prose.ts";
import { SPEC } from "../../../src/protocol/spec.ts";
import { parseReply } from "../../../src/transcript/reply.ts";
import type { BlockKind } from "../../../src/transcript/reply.ts";
import { sectionsOf } from "../../fixtures/sections.ts";
import { CASES_DIR, CASE_SCHEMA_FILE, caseOf } from "../../../tools/spec/cases.ts";
import type { DecideItem } from "../../../types/index.d.ts";
import * as oracle from "../../oracle/reply-text.ts";
import {
  decideItemsArb,
  replyArb,
  replyWithItemsArb,
} from "../../fixtures/replies.ts";

const RUNS = 600;
const SEED = 0x7265706c;

const read = (path: string): string =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

/** A reply's items without the body a Todo item keeps for the pane, which the old scanners never read: listed.test.ts holds it. */
const withoutBodies = (
  items: ReturnType<typeof itemsOfText>,
): readonly Omit<ReturnType<typeof itemsOfText>[number], "body">[] =>
  items.map(({ body: _body, ...item }) => item);

/** Each golden case's replies, with the Decide items each reply's turn raised. */
const GOLDEN: readonly Readonly<{ text: string; items: readonly DecideItem[] }>[] =
  readdirSync(new URL(`../../../${CASES_DIR}`, import.meta.url))
    .filter((name) => name.endsWith(".yaml") && `${CASES_DIR}/${name}` !== CASE_SCHEMA_FILE)
    .toSorted()
    .flatMap((name) => {
      const result = caseOf(name, read(`${CASES_DIR}/${name}`), read(CASE_SCHEMA_FILE));

      return "case" in result ? result.case.turns : [];
    })
    .flatMap((turn) => {
      const items = itemsOf({
        items: (turn.decide ?? []).map((item) => ({ ...item, turn: turn.id })),
      });

      return turn.replies.map((reply) => ({ text: reply.text, items }));
    });

const VALUES = placeholderValues(SPEC, {
  plugin: "the-plugin",
  tool: "the_tool",
  "outstanding-tool": "the_outstanding",
  "lint-tool": "the_lint",
  "roll-up-drafter": "The drafter drafts",
});

/** Every example reply in the spec's fragments: each ```text block, filled. */
const EXAMPLES: readonly string[] = Object.values(FRAGMENTS).flatMap((fragment) =>
  filled(fragment, VALUES)
    .split("```text\n")
    .slice(1)
    .map((block) => block.split("\n```")[0] ?? ""),
);

const SEEDS: readonly string[] = [...GOLDEN.map((reply) => reply.text), ...EXAMPLES];

/** A reply: a seed, a strict random reply, or a seed and a random reply joined. */
const strictArb = fc.oneof(
  fc.constantFrom(...SEEDS),
  replyArb("strict"),
  fc
    .tuple(fc.constantFrom(...SEEDS), replyArb("strict"), fc.boolean())
    .map(([seed, random, isFirst]) =>
      isFirst ? `${seed}\n\n${random}` : `${random}\n\n${seed}`,
    ),
);

/** Decide items with a reply: a golden reply and its turn's items, any reply and random items, or a reply printing the items. */
const withItemsArb = fc.oneof(
  fc.constantFrom(...GOLDEN),
  fc.record({ text: strictArb, items: decideItemsArb }),
  replyWithItemsArb,
);

/** The old section's text cut where the 📌 roll-up starts: the new reading of it. */
const cutAtRollUp = (text: string): string => {
  const lines = text.split("\n");
  const at = lines.findIndex((line) => oracle.PIN.test(line));

  return (at < 0 ? lines : lines.slice(0, at)).join("\n").trimEnd();
};

const property = <T>(arb: fc.Arbitrary<T>, check: (value: T) => void): void =>
  fc.assert(fc.property(arb, check), { seed: SEED, numRuns: RUNS });

describe("the readers of a reply against the old scanners", () => {
  test("there are seeds: the golden replies and the fragments' examples", () => {
    expect(GOLDEN.length).toBeGreaterThan(20);
    expect(EXAMPLES.length).toBeGreaterThan(3);
  });

  test("sectionsOf: the same sections, each cut where the roll-up starts", () => {
    property(strictArb, (text) => {
      expect(sectionsOf(text)).toEqual(
        oracle
          .sectionsOf(text)
          .map((section) => ({ ...section, text: cutAtRollUp(section.text) })),
      );
    });
  });

  test("itemsOfText: the same items, strict replies and loose", () => {
    property(fc.oneof(strictArb, replyArb("loose")), (text) => {
      expect(withoutBodies(itemsOfText(text))).toEqual(oracle.itemsOfText(text));
    });
  });

  test("decideItemsOfText: the same Decide items", () => {
    property(strictArb, (text) => {
      expect(decideItemsOfText(text)).toEqual(oracle.decideItemsOfText(text));
    });
  });

  test("decideListCut: the same cut, or none", () => {
    property(withItemsArb, ({ text, items }) => {
      expect(decideListCut(text, items)).toEqual(oracle.decideListCut(text, items));
    });
  });

  test("decideListCut: the replies printing their items are cut, often", () => {
    const cut = fc
      .sample(replyWithItemsArb, { seed: SEED, numRuns: 200 })
      .filter(({ text, items }) => decideListCut(text, items) !== undefined);

    expect(cut.length).toBeGreaterThan(50);
  });

  test("linkedQuestions: the same text and links", () => {
    property(withItemsArb, ({ text, items }) => {
      expect(linkedQuestions(text, items)).toEqual(oracle.linkedQuestions(text, items));
    });
  });

  test("isKanbanReply: the same answer", () => {
    property(strictArb, (text) => {
      expect(isKanbanReply(text)).toBe(oracle.isKanbanReply(text));
    });
  });
});

describe("the random replies reach", () => {
  const samples = (mode: "strict" | "loose") =>
    fc.sample(replyArb(mode), { seed: SEED, numRuns: 300 }).map(parseReply);
  const strict = samples("strict");
  const blocks = [...strict, ...samples("loose")].flat();

  test("every kind of block", () => {
    const kinds: readonly BlockKind[] = [
      "header",
      "roll-up",
      "stop",
      "topic",
      "underline",
      "separator",
      "blank",
      "code",
      "text",
      "item",
    ];

    expect(kinds.filter((kind) => !blocks.some((block) => block.kind === kind))).toEqual([]);
  });

  test("every shape of item and the lines under it", () => {
    const items = blocks.flatMap((block) => (block.kind === "item" ? [block] : []));
    const shapes = {
      numbered: items.some((item) => item.head.number !== undefined),
      bulleted: items.some((item) => item.head.number === undefined),
      "numbered 1)": items.some((item) => item.head.delimiter === ")"),
      indented: items.some((item) => item.head.lead.startsWith(" ")),
      "summary alone": items.some((item) => /^\*\*[^*]+\*\* *$/.test(item.head.text)),
      "code under it": items.some((item) => item.body.some((under) => under.isCode)),
      "a blank line in its code": items.some((item) =>
        item.body.some((under) => under.isCode && under.line === ""),
      ),
      "a Frees: line": items.some((item) =>
        item.body.some((under) => under.line.trim().startsWith(`${SPEC.frees.label}:`)),
      ),
      "prose at the line's start under it": items.some((item) =>
        item.body.some((under) => !under.isCode && /^\S/.test(under.line)),
      ),
    };

    expect(Object.entries(shapes).filter(([, isReached]) => !isReached)).toEqual([]);
  });

  test("every name a header writes, the roll-up's both, a titled topic, each underline and each separator", () => {
    const lines = blocks.flatMap((block) => block.lines);
    const names = new Set(blocks.flatMap((block) => (block.kind === "header" ? [block.name] : [])));
    const rollUp = SPEC["roll-up"];

    expect(
      Object.values(SPEC.lists)
        .flatMap((list) => [list.header, ...list.aliases])
        .filter((name) => !names.has(name)),
    ).toEqual([]);
    expect(
      [rollUp.header, ...rollUp.aliases].filter(
        (name) => !lines.some((line) => line.startsWith(`${rollUp.glyph} **${name}:**`)),
      ),
    ).toEqual([]);
    expect(blocks.some((block) => block.kind === "topic" && block.isTitled)).toBe(true);
    expect(
      [SPEC.characters["header-underline"], SPEC.characters["roll-up-underline"]].filter(
        (char) => !blocks.some((block) => block.kind === "underline" && block.char === char),
      ),
    ).toEqual([]);
    expect(
      ["   ⠀", "⠀"].filter((line) => !blocks.some((block) => block.kind === "separator" && block.lines[0] === line)),
    ).toEqual([]);
    expect(lines.some((line) => line.startsWith(`${rollUp.glyph} ${rollUp["count-label"]}:`))).toBe(true);
  });
});

// --- where the readers part ------------------------------------------------

const BR = "  ";
const SEP = "⠀";
const RULE = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

const item = (number: number, summary: string): DecideItem => ({
  turn: "9efb08a1",
  list: "Decide",
  number,
  summary,
  kind: "radio",
  ref: `9efb08a1.Decide.${number}`,
  options: [
    { letter: "A", name: "Disk" },
    { letter: "B", name: "Memory" },
  ],
});
const cache = item(1, "Which cache to keep");
const ship = item(2, "Ship it");
const CACHE = [`1. **Which cache to keep**${BR}`, "   🔘 A. **Disk**", "   🔘 B. **Memory**"];
const SHIP = [`2. **Ship it**${BR}`, "   🔘 A. **Disk**", "   🔘 B. **Memory**"];
const DECIDE_HEADER = `🧠 **Decide:**${BR}`;
const lines = (...all: readonly string[]): string => all.join("\n");

describe("where the readers part: fixed", () => {
  test("roll-up ends a section: the 📌 roll-up's header closes the section above it", () => {
    const text = lines(DECIDE_HEADER, ...CACHE, "", `📌 **Outstanding from previous turns:**${BR}`, RULE);

    expect(oracle.sectionsOf(text)[0]?.text).toContain("📌");
    expect(sectionsOf(text)[0]?.text).toBe(lines(DECIDE_HEADER, ...CACHE));
  });

  test("older roll-up: a line opening on an older roll-up header's words with more after them is prose, no section's end", () => {
    const prose = lines(DECIDE_HEADER, ...CACHE, "", "Still open from earlier, the loader's question:", "", ...SHIP);

    expect(oracle.sectionsOf(prose)[0]?.text).toBe(lines(DECIDE_HEADER, ...CACHE));
    expect(sectionsOf(prose)[0]?.text).toBe(prose);
    expect(oracle.decideItemsOfText(prose).map((found) => found.number)).toEqual([1]);
    expect(decideItemsOfText(prose).map((found) => found.number)).toEqual([1, 2]);
    expect(withoutBodies(itemsOfText(prose))).toEqual(oracle.itemsOfText(prose));
    expect(isKanbanReply("Still open from earlier, the loader.")).toBe(false);
  });

  test("number alone: a number alone on its line is no summary line to link, the bold line under it", () => {
    const split = lines(DECIDE_HEADER, "1.", "**Which cache to keep**", "   🔘 A. **Disk**");

    expect(oracle.linkedQuestions(split, [cache]).hrefs.length).toBe(1);
    expect(linkedQuestions(split, [cache]).hrefs).toEqual([]);
  });

  test("one grammar: an option the Decide list's cut reads is written with its glyph, as a Decide item's is", () => {
    const glyphless = lines(DECIDE_HEADER, `1. **Which cache to keep**${BR}`, "   A. **Disk**", "   B. **Memory**");

    expect(oracle.decideListCut(glyphless, [cache])).toEqual({ before: "", after: "" });
    expect(decideListCut(glyphless, [cache])).toBeUndefined();
    expect(oracle.decideItemsOfText(glyphless)).toEqual([]);
    expect(decideItemsOfText(glyphless)).toEqual([]);
  });

  test("one grammar: a summary line's bold summary ends at its first closing `**`, as a Decide item's does", () => {
    const two = item(1, "a** and **b");
    const spans = lines(DECIDE_HEADER, "1. **a** and **b**", "   🔘 A. **Disk**", "   🔘 B. **Memory**");

    expect(oracle.linkedQuestions(spans, [two]).hrefs.length).toBe(1);
    expect(linkedQuestions(spans, [two]).hrefs).toEqual([]);
    expect(decideItemsOfText(spans).map((found) => found.summary)).toEqual(["a"]);
  });

  test("code: a fence less indented than an item's text ends the item, and is no line beneath its summary", () => {
    const shallow = lines("👉 **Todo:**", ` 2) **Run it**${BR}`, "   ```text", "   ```");

    expect(oracle.itemsOfText(shallow)[0]?.line).toBe("**Run it** ```text");
    expect(itemsOfText(shallow)[0]?.line).toBe("**Run it**");
  });

  test("code: a fence closes on its own character alone, at least as long, and a backtick fence holds no backtick", () => {
    const tilde = lines("Some work.", "", "~~~", "```", DECIDE_HEADER, ...CACHE, "~~~");

    expect(oracle.isKanbanReply(tilde)).toBe(true);
    expect(isKanbanReply(tilde)).toBe(false);

    const longer = lines("Some work.", "", "````", "```", DECIDE_HEADER, ...CACHE, "````");

    expect(oracle.decideItemsOfText(longer).length).toBe(1);
    expect(decideItemsOfText(longer)).toEqual([]);

    const span = lines("👉 **Todo:**", "1. **Run it**", "   ```x```", "👉 **Todo:**", "2. **Then this**");

    expect(oracle.itemsOfText(span).map((found) => found.number)).toEqual([1]);
    expect(itemsOfText(span).map((found) => found.number)).toEqual([1, 2]);

    const opened = lines("Some work.", "", "1. ```bash", DECIDE_HEADER, ...CACHE, "```");

    expect(oracle.decideItemsOfText(opened).length).toBe(1);
    expect(decideItemsOfText(opened)).toEqual([]);
  });

  test("code: a header, a roll-up, an item or a count line inside a code block is none, for every reader", () => {
    const fenced = lines("Some work.", "", "```text", DECIDE_HEADER, ...CACHE, "📌 Outstanding: 🧠 1", "```");

    expect(oracle.sectionsOf(fenced).length).toBe(1);
    expect(sectionsOf(fenced)).toEqual([]);
    expect(oracle.decideItemsOfText(fenced).length).toBe(1);
    expect(decideItemsOfText(fenced)).toEqual([]);
    expect(oracle.itemsOfText(fenced).length).toBe(1);
    expect(itemsOfText(fenced)).toEqual([]);
    expect(oracle.linkedQuestions(fenced, [cache]).hrefs.length).toBe(1);
    expect(linkedQuestions(fenced, [cache]).hrefs).toEqual([]);
    expect(oracle.isKanbanReply(fenced)).toBe(true);
    expect(isKanbanReply(fenced)).toBe(false);

    // The old itemsOfText kept a fence only in an item it read, one of a
    // list that rolls up, so code under a Done item was read line by line.
    const underDone = lines("✅ **Done:**", "1. **Fixed it**", "   ```text", "📌 **Outstanding from previous turns:**", "   ```", "👉 **Todo:**", "1. **Run it**");

    expect(oracle.itemsOfText(underDone)[0]?.isPinned).toBe(true);
    expect(itemsOfText(underDone)[0]?.isPinned).toBe(false);
  });

  test("code: a blank line inside an item's code block doesn't end the Decide list, and an option inside one is none", () => {
    const blank = lines(DECIDE_HEADER, ...CACHE, "   ```text", "   one", "", "   two", "   ```", "", "After.");

    expect(oracle.decideListCut(blank, [cache])?.after).toMatch(/^two/);
    expect(decideListCut(blank, [cache])?.after).toBe("After.");

    const optionInCode = lines(DECIDE_HEADER, `1. **Which cache to keep**${BR}`, "   ```", "   🔘 A. **Disk**", "   ```");

    expect(oracle.decideItemsOfText(optionInCode).length).toBe(1);
    expect(decideItemsOfText(optionInCode)).toEqual([]);
  });

  test("indent: an item is at most 2 spaces in, for every reader", () => {
    const nested = lines(DECIDE_HEADER, ...CACHE, "   1. **Ship it**", "      🔘 A. **Disk**");

    expect(oracle.decideItemsOfText(nested).map((found) => found.summary)).toEqual(["Which cache to keep", "Ship it"]);
    expect(decideItemsOfText(nested).map((found) => found.summary)).toEqual(["Which cache to keep"]);
    expect(oracle.linkedQuestions(nested, [ship]).hrefs.length).toBe(1);
    expect(linkedQuestions(nested, [ship]).hrefs).toEqual([]);

    const indented = lines(DECIDE_HEADER, ...CACHE, `  2. **Ship it**${BR}`, "   🔘 A. **Disk**", "   🔘 B. **Memory**");

    expect(oracle.decideListCut(indented, [cache, ship])).toBeUndefined();
    expect(decideListCut(indented, [cache, ship])).toEqual({ before: "", after: "" });
  });

  test("numbering: an item numbered `1)` is a summary line to link and to cut, as it is a Decide item", () => {
    const paren = lines(DECIDE_HEADER, `1) **Which cache to keep**${BR}`, "   🔘 A. **Disk**", "   🔘 B. **Memory**");

    expect(oracle.decideItemsOfText(paren).length).toBe(1);
    expect(oracle.linkedQuestions(paren, [cache]).hrefs).toEqual([]);
    expect(linkedQuestions(paren, [cache]).hrefs.length).toBe(1);
    expect(oracle.decideListCut(paren, [cache])).toBeUndefined();
    expect(decideListCut(paren, [cache])).toEqual({ before: "", after: "" });
  });

  test("topic title: the line above a topic's rule ends the item above it, and is no item", () => {
    const titled = lines("👉 **Todo:**", `1. **Run the benchmark**${BR}`, "The loader", "═══════════", "👉 **Todo:**", "2. **Then this**", "════");

    expect(oracle.itemsOfText(titled).map((found) => found.line)).toEqual(["**Run the benchmark** The loader", "**Then this**"]);
    expect(itemsOfText(titled).map((found) => found.line)).toEqual(["**Run the benchmark**"]);
  });

  test("separator: a line after a separator isn't joined to the summary alone above it", () => {
    const parted = lines("👉 **Todo:**", `1. **Run it**${BR}`, `   ${SEP}`, "   Its sentence.");

    expect(oracle.itemsOfText(parted)[0]?.line).toBe("**Run it** Its sentence.");
    expect(itemsOfText(parted)[0]?.line).toBe("**Run it**");
  });

  test("CRLF: a reply with CRLF line ends reads as its LF form", () => {
    const lf = lines("👉 **Todo:**", "1. **Run it**", "", DECIDE_HEADER, ...CACHE, "");
    const crlf = lf.replaceAll("\n", "\r\n");

    expect(oracle.itemsOfText(crlf)).toEqual([]);
    expect(itemsOfText(crlf)).toEqual(itemsOfText(lf));
    expect(oracle.decideListCut(crlf, [cache])).toBeUndefined();
    expect(decideListCut(crlf, [cache])?.before).toBe("👉 **Todo:**\r\n1. **Run it**");
    expect(linkedQuestions(crlf, [cache])).toEqual(oracle.linkedQuestions(crlf, [cache]));
  });
});

describe("where the readers part: kept", () => {
  test("a bare older roll-up header alone on its line ends a section, and pins nothing, ends no cut and makes no reply kanban", () => {
    const older = lines(DECIDE_HEADER, ...CACHE, "", "Still open from earlier", "📋 **To review:**", "- **The README** 🔖 b2c3d4e5₋₁");

    expect(withoutBodies(itemsOfText(older))).toEqual(oracle.itemsOfText(older));
    expect(itemsOfText(older).at(-1)?.isPinned).toBe(false);

    const restated = lines(DECIDE_HEADER, ...CACHE, "", "Still open from earlier:", "🧠 **Decide:**", "- **Which cache to keep** 🔖 b2c3d4e5₋₁");

    expect(decideListCut(restated, [cache])).toEqual(oracle.decideListCut(restated, [cache]));
    expect(decideListCut(restated, [cache])).toBeUndefined();
    expect(isKanbanReply("Still open from earlier")).toBe(false);

    const ended = lines(DECIDE_HEADER, ...CACHE, "Still open from earlier", ...SHIP);

    expect(sectionsOf(ended)).toEqual(oracle.sectionsOf(ended));
    expect(decideItemsOfText(ended)).toEqual(oracle.decideItemsOfText(ended));
    expect(decideItemsOfText(ended).map((found) => found.number)).toEqual([1]);
  });

  test("a fence at the line's start under the last Decide item ends the list, its code after the cut", () => {
    const code = lines(DECIDE_HEADER, ...CACHE, "```", "a column-0 block", "```");

    expect(decideListCut(code, [cache])).toEqual(oracle.decideListCut(code, [cache]));
    expect(decideListCut(code, [cache])?.after).toBe("```\na column-0 block\n```");
  });

  test("a Decide item's options are read up to the next item, across blank lines, bullets and a number alone, as the kanban skill reads them", () => {
    const apart = lines(DECIDE_HEADER, `1. **Which cache to keep**${BR}`, "", "   🔘 A. **Disk**");
    const bullet = lines(DECIDE_HEADER, `1. **Which cache to keep**${BR}`, "- **A bullet**", "   🔘 A. **Disk**");
    const split = lines(DECIDE_HEADER, "1.", "", "**Which cache to keep**", "   🔘 A. **Disk**");

    for (const text of [apart, bullet, split]) {
      expect(decideItemsOfText(text)).toEqual(oracle.decideItemsOfText(text));
      expect(decideItemsOfText(text)).toEqual([{ number: 1, summary: "Which cache to keep" }]);
    }
  });

  test("prose at the line's start under an item ends the Decide list's cut, and is the item's last line to itemsOfText", () => {
    const lazy = lines(DECIDE_HEADER, ...CACHE, "Frees: 9efb08a1.Todo.1");

    expect(decideListCut(lazy, [cache])?.after).toBe("Frees: 9efb08a1.Todo.1");
    expect(itemsOfText(lazy)[0]?.frees).toEqual(["9efb08a1.Todo.1"]);
  });

  test("a blank line ends the Decide list's cut, not a section or itemsOfText's list", () => {
    const gap = lines("👉 **Todo:**", "1. **Run it**", "", "Prose.", "", "2. **Then this**");

    expect(sectionsOf(gap)[0]?.text).toBe(gap);
    expect(itemsOfText(gap).map((found) => found.number)).toEqual([1, 2]);
  });

  test("a question's summary line links wherever it is, a list's or not; itemsOfText reads only a list's that rolls up", () => {
    const bare = lines(...CACHE);

    expect(linkedQuestions(bare, [cache]).hrefs.length).toBe(1);
    expect(itemsOfText(bare)).toEqual([]);
  });
});
