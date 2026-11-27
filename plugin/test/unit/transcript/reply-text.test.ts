// How each reader of a reply's text reads the shapes where code, indents,
// numbering, separators, topics and line ends meet: `sectionsOf`,
// `itemsOfText`, `decideItemsOfText`, the Decide list's cut,
// `linkedSummaries` and `isKanbanReply`, each reading the blocks
// `parseReply` reads; and the shapes the seeded random replies,
// test/fixtures/replies.ts, reach, which reply.test.ts and
// reply-readers.test.ts hold the readers to.

import { describe, test } from "node:test";
import { expect } from "expect";
import fc from "fast-check";

import {
  decideItemsOfText,
  itemsOfText,
} from "../../../src/items/outstanding.ts";
import { isKanbanReply } from "../../../src/lint/reply.ts";
import { linkedSummaries, listCut } from "../../../src/pane/links.ts";
import { SPEC } from "../../../src/protocol/spec.ts";
import { parseReply } from "../../../src/transcript/reply.ts";
import type { BlockKind } from "../../../src/transcript/reply.ts";
import { sectionsOf } from "../../fixtures/sections.ts";
import type { DecideItem } from "../../../types/index.d.ts";
import { replyArb } from "../../fixtures/replies.ts";

const SEED = 0x7265706c;

/** The cut every list takes, read for the Decide list. */
const decideListCut = (text: string, items: readonly DecideItem[]) =>
  listCut(text, SPEC.lists.decide, items);

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

  test("every list's header, the roll-up's, a titled topic, each underline and each separator", () => {
    const lines = blocks.flatMap((block) => block.lines);
    const names = new Set(blocks.flatMap((block) => (block.kind === "header" ? [block.name] : [])));
    const rollUp = SPEC["roll-up"];

    expect(Object.values(SPEC.lists).map((list) => list.header).filter((name) => !names.has(name))).toEqual([]);
    expect(lines.some((line) => line.startsWith(`${rollUp.glyph} **${rollUp.header}:**`))).toBe(true);
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
const DECIDE_HEADER = `🧠 **Decide:**${BR}`;
const lines = (...all: readonly string[]): string => all.join("\n");

describe("the readers of a reply's text", () => {
  test("the 📌 roll-up's header closes the section above it", () => {
    const text = lines(DECIDE_HEADER, ...CACHE, "", `📌 **Outstanding from previous turns:**${BR}`, RULE);

    expect(sectionsOf(text)[0]?.text).toBe(lines(DECIDE_HEADER, ...CACHE));
  });

  test("a number alone on its line is no summary line to link, the bold line under it", () => {
    const split = lines(DECIDE_HEADER, "1.", "**Which cache to keep**", "   🔘 A. **Disk**");

    expect(linkedSummaries(split, [cache]).hrefs).toEqual([]);
  });

  test("an option the Decide list's cut reads is written with its glyph, as a Decide item's is", () => {
    const glyphless = lines(DECIDE_HEADER, `1. **Which cache to keep**${BR}`, "   A. **Disk**", "   B. **Memory**");

    expect(decideListCut(glyphless, [cache])).toBeUndefined();
    expect(decideItemsOfText(glyphless)).toEqual([]);
  });

  test("a summary line's bold summary ends at its first closing `**`, as a Decide item's does", () => {
    const two = item(1, "a** and **b");
    const spans = lines(DECIDE_HEADER, "1. **a** and **b**", "   🔘 A. **Disk**", "   🔘 B. **Memory**");

    expect(linkedSummaries(spans, [two]).hrefs).toEqual([]);
    expect(decideItemsOfText(spans).map((found) => found.summary)).toEqual(["a"]);
  });

  test("a fence less indented than an item's text ends the item, and is no line beneath its summary", () => {
    const shallow = lines("👉 **Todo:**", ` 2) **Run it**${BR}`, "   ```text", "   ```");

    expect(itemsOfText(shallow)[0]?.line).toBe("**Run it**");
  });

  test("a fence closes on its own character alone, at least as long, and a backtick fence holds no backtick", () => {
    const tilde = lines("Some work.", "", "~~~", "```", DECIDE_HEADER, ...CACHE, "~~~");
    const longer = lines("Some work.", "", "````", "```", DECIDE_HEADER, ...CACHE, "````");
    const span = lines("👉 **Todo:**", "1. **Run it**", "   ```x```", "👉 **Todo:**", "2. **Then this**");
    const opened = lines("Some work.", "", "1. ```bash", DECIDE_HEADER, ...CACHE, "```");

    expect(isKanbanReply(tilde)).toBe(false);
    expect(decideItemsOfText(longer)).toEqual([]);
    expect(itemsOfText(span).map((found) => found.number)).toEqual([1, 2]);
    expect(decideItemsOfText(opened)).toEqual([]);
  });

  test("a header, a roll-up, an item or a count line inside a code block is none, for every reader", () => {
    const fenced = lines("Some work.", "", "```text", DECIDE_HEADER, ...CACHE, "📌 Outstanding: 🧠 1", "```");
    const underDone = lines("✅ **Done:**", "1. **Fixed it**", "   ```text", "📌 **Outstanding from previous turns:**", "   ```", "👉 **Todo:**", "1. **Run it**");

    expect(sectionsOf(fenced)).toEqual([]);
    expect(decideItemsOfText(fenced)).toEqual([]);
    expect(itemsOfText(fenced)).toEqual([]);
    expect(linkedSummaries(fenced, [cache]).hrefs).toEqual([]);
    expect(isKanbanReply(fenced)).toBe(false);
    expect(itemsOfText(underDone)[0]?.isPinned).toBe(false);
  });

  test("a blank line inside an item's code block doesn't end the Decide list, and an option inside one is none", () => {
    const blank = lines(DECIDE_HEADER, ...CACHE, "   ```text", "   one", "", "   two", "   ```", "", "After.");
    const optionInCode = lines(DECIDE_HEADER, `1. **Which cache to keep**${BR}`, "   ```", "   🔘 A. **Disk**", "   ```");

    expect(decideListCut(blank, [cache])?.after).toBe("After.");
    expect(decideItemsOfText(optionInCode)).toEqual([]);
  });

  test("an item is at most 2 spaces in, for every reader", () => {
    const nested = lines(DECIDE_HEADER, ...CACHE, "   1. **Ship it**", "      🔘 A. **Disk**");
    const indented = lines(DECIDE_HEADER, ...CACHE, `  2. **Ship it**${BR}`, "   🔘 A. **Disk**", "   🔘 B. **Memory**");

    expect(decideItemsOfText(nested).map((found) => found.summary)).toEqual(["Which cache to keep"]);
    expect(linkedSummaries(nested, [ship]).hrefs).toEqual([]);
    expect(decideListCut(indented, [cache, ship])).toEqual({ before: "", after: "" });
  });

  test("an item numbered `1)` is a summary line to link and to cut, as it is a Decide item", () => {
    const paren = lines(DECIDE_HEADER, `1) **Which cache to keep**${BR}`, "   🔘 A. **Disk**", "   🔘 B. **Memory**");

    expect(decideItemsOfText(paren).length).toBe(1);
    expect(linkedSummaries(paren, [cache]).hrefs.length).toBe(1);
    expect(decideListCut(paren, [cache])).toEqual({ before: "", after: "" });
  });

  test("the line above a topic's rule ends the item above it, and is no item", () => {
    const titled = lines("👉 **Todo:**", `1. **Run the benchmark**${BR}`, "The loader", "═══════════", "👉 **Todo:**", "2. **Then this**", "════");

    expect(itemsOfText(titled).map((found) => found.line)).toEqual(["**Run the benchmark**"]);
  });

  test("a line after a separator isn't joined to the summary alone above it", () => {
    const parted = lines("👉 **Todo:**", `1. **Run it**${BR}`, `   ${SEP}`, "   Its sentence.");

    expect(itemsOfText(parted)[0]?.line).toBe("**Run it**");
  });

  test("a reply with CRLF line ends reads as its LF form", () => {
    const lf = lines("👉 **Todo:**", "1. **Run it**", "", DECIDE_HEADER, ...CACHE, "");
    const crlf = lf.replaceAll("\n", "\r\n");
    const linked = linkedSummaries(lf, [cache]);

    expect(itemsOfText(crlf)).toEqual(itemsOfText(lf));
    expect(decideListCut(crlf, [cache])?.before).toBe("👉 **Todo:**\r\n1. **Run it**");
    expect(linkedSummaries(crlf, [cache])).toEqual({
      text: linked.text.replaceAll("\n", "\r\n"),
      hrefs: linked.hrefs,
    });
  });

  test("a fence at the line's start under the last Decide item ends the list, its code after the cut", () => {
    const code = lines(DECIDE_HEADER, ...CACHE, "```", "a column-0 block", "```");

    expect(decideListCut(code, [cache])).toEqual({ before: "", after: "```\na column-0 block\n```" });
  });

  test("a Decide item's options are read up to the next item, across blank lines, bullets and a number alone, as the kanban skill reads them", () => {
    const apart = lines(DECIDE_HEADER, `1. **Which cache to keep**${BR}`, "", "   🔘 A. **Disk**");
    const bullet = lines(DECIDE_HEADER, `1. **Which cache to keep**${BR}`, "- **A bullet**", "   🔘 A. **Disk**");
    const split = lines(DECIDE_HEADER, "1.", "", "**Which cache to keep**", "   🔘 A. **Disk**");

    for (const text of [apart, bullet, split]) {
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

  test("a question's summary line links only under its list's header, run on or alone; itemsOfText reads only a list's that rolls up", () => {
    const bare = lines(...CACHE);
    const runOn = lines(DECIDE_HEADER, "1. **Which cache to keep**, pick one", "   🔘 A. **Disk**");

    expect(linkedSummaries(bare, [cache]).hrefs).toEqual([]);
    expect(linkedSummaries(lines(DECIDE_HEADER, ...CACHE), [cache]).hrefs.length).toBe(1);
    expect(linkedSummaries(lines("✅ **Done:**", ...CACHE), [cache]).hrefs).toEqual([]);
    expect(linkedSummaries(runOn, [cache]).hrefs.length).toBe(1);
    expect(itemsOfText(bare)).toEqual([]);
  });
});
