// A reply's text read once into blocks: the blocks of a reply, what each
// holds, its sections, its lines outside code, and the reading being total,
// its blocks' lines joined giving back the text.

import { describe, test } from "node:test";
import { expect } from "expect";
import fc from "fast-check";

import {
  isCountLine,
  isTopicRule,
  parseReply,
  proseLines,
  sectionsIn,
} from "../../../src/harness/reply.ts";
import type { Block } from "../../../src/harness/reply.ts";
import { replyArb } from "../../fixtures/replies.ts";

const SEED = 0x626c6f63;
const BR = "  ";
const SEP = "⠀";

const REPLY = [
  "Some work.",
  "",
  `🧠 **Decide:**${BR}`,
  "▔▔▔▔▔▔▔▔▔▔",
  `1. **Which cache to keep**${BR}`,
  "   🔘 A. **Disk**",
  "   ```text",
  "",
  "   🧠 **Decide:**",
  "   ```",
  `   ${SEP}`,
  "- **A bullet**",
  "Prose at the line's start.",
  "",
  "**The loader**",
  "═══════════",
  `📌 **Outstanding from previous turns:**${BR}`,
  "━━━━━━━━━━",
  "📌 Outstanding: 🧠 1",
].join("\n");

/** Each block's kind and the place of its first line. */
const shapes = (blocks: readonly Block[]) =>
  blocks.map((block) => [block.kind, block.at] as const);

describe("parseReply", () => {
  test("reads each block of a reply, in order, at its first line", () => {
    expect(shapes(parseReply(REPLY))).toEqual([
      ["text", 0],
      ["blank", 1],
      ["header", 2],
      ["underline", 3],
      ["item", 4],
      ["separator", 10],
      ["item", 11],
      ["blank", 13],
      ["topic", 14],
      ["roll-up", 16],
      ["underline", 17],
      ["text", 18],
    ]);
  });

  test("reads a header's name, an underline's character and whether a title opens a topic", () => {
    const blocks = parseReply(REPLY);

    expect(blocks[2]).toMatchObject({ kind: "header", name: "Decide" });
    expect(blocks[3]).toMatchObject({ kind: "underline", char: "▔" });
    expect(blocks[10]).toMatchObject({ kind: "underline", char: "━" });
    expect(blocks[8]).toMatchObject({ kind: "topic", isTitled: true, lines: ["**The loader**", "═══════════"] });
    expect(parseReply("═══")[0]).toMatchObject({ kind: "topic", isTitled: false });
  });

  test("reads an item's own line and the lines under it, the code among them marked", () => {
    const item = parseReply(REPLY)[4];

    expect(item).toMatchObject({
      kind: "item",
      head: { lead: "1. ", number: 1, delimiter: ".", text: `**Which cache to keep**${BR}` },
      body: [
        { line: "   🔘 A. **Disk**", isCode: false },
        { line: "   ```text", isCode: true },
        { line: "", isCode: true },
        { line: "   🧠 **Decide:**", isCode: true },
        { line: "   ```", isCode: true },
      ],
    });
    expect(parseReply(REPLY)[6]).toMatchObject({
      head: { number: undefined, delimiter: undefined },
      body: [{ line: "Prose at the line's start.", isCode: false }],
    });
  });

  test("reads an item at most 2 spaces in, numbered with `.` or `)`; a line 3 spaces in is under the item above", () => {
    expect(parseReply("  2) x")[0]).toMatchObject({ kind: "item", head: { lead: "  2) ", number: 2, delimiter: ")" } });
    expect(parseReply("   - x")[0]?.kind).toBe("text");
    expect(parseReply("- x\n   1. y").map((block) => block.kind)).toEqual(["item"]);
  });

  test("reads the roll-up's start by its header alone, with its glyph, in bold with a colon", () => {
    expect(parseReply("📌 **Outstanding from previous turns:**")[0]?.kind).toBe("roll-up");
    expect(parseReply("Outstanding from previous turns")[0]?.kind).toBe("text");
  });

  test("reads a header the spec doesn't name, bold or bare, as prose that ends no section", () => {
    for (const line of ["📌 **Left from before:**", "Left from before", "Left from before:"]) {
      expect(parseReply(line)[0]?.kind).toBe("text");
    }
    const reply = "🧠 **Decide:**\n1. **Ship it**\nLeft from before\n2. **Hold it**";
    expect(sectionsIn(parseReply(reply)).map((section) => section.blocks.length)).toEqual([3]);
  });

  test("reads code outside a list as one block, every line of it code", () => {
    expect(shapes(parseReply("```\n🧠 **Decide:**\n1. **x**\n\n```\nAfter."))).toEqual([
      ["code", 0],
      ["text", 5],
    ]);
  });

  test("closes a fence only on a line of its character alone, at least as long", () => {
    const kinds = (text: string) => parseReply(text).map((block) => block.kind);

    expect(kinds("~~~\n```\n🧠 **Decide:**\n~~~\nAfter.")).toEqual(["code", "text"]);
    expect(kinds("````\n```\n🧠 **Decide:**\n````\nAfter.")).toEqual(["code", "text"]);
    expect(kinds("```\n🧠 **Decide:**\n`````\nAfter.")).toEqual(["code", "text"]);
    expect(kinds("```\n``` x\n🧠 **Decide:**\n```  \nAfter.")).toEqual(["code", "text"]);
    expect(kinds("```\n``\n🧠 **Decide:**")).toEqual(["code"]);
  });

  test("opens no fence on backticks with a backtick after them, `x` in code spans", () => {
    expect(parseReply("```x```\n🧠 **Decide:**").map((block) => block.kind)).toEqual(["text", "header"]);
    expect(parseReply("~~~x~~~\n🧠 **Decide:**")).toHaveLength(1);
  });

  test("opens a fence on an item's text, its lines under the item and code", () => {
    const blocks = parseReply("1. ```bash\n🧠 **Decide:**\n```\n2. **y**");

    expect(blocks.map((block) => block.kind)).toEqual(["item", "item"]);
    expect(blocks[0]).toMatchObject({
      body: [
        { line: "🧠 **Decide:**", isCode: true },
        { line: "```", isCode: true },
      ],
    });
  });

  test("ends an item on a fence less indented than its text; one as indented is the item's", () => {
    expect(parseReply("1. **x**\n```\ncode\n```").map((block) => block.kind)).toEqual(["item", "code"]);
    expect(parseReply("1. **x**\n  ```\ncode\n  ```").map((block) => block.kind)).toEqual(["item", "code"]);
    expect(parseReply("1. **x**\n   ```\ncode\n```").map((block) => block.kind)).toEqual(["item"]);
    expect(parseReply("- x\n  ```\ncode\n```").map((block) => block.kind)).toEqual(["item"]);
  });

  test("reads a CRLF reply's lines as its LF form's, each as written", () => {
    const blocks = parseReply("🧠 **Decide:**\r\n1. **x**\r\n   y\r\n");

    expect(blocks.map((block) => block.kind)).toEqual(["header", "item", "blank"]);
    expect(blocks[1]).toMatchObject({ head: { text: "**x**" }, lines: ["1. **x**\r", "   y\r"] });
  });

  test("is total, and its blocks' lines, joined, are the text", () => {
    const lineArb = fc.oneof(
      fc.string({ unit: "grapheme", maxLength: 12 }),
      fc.constantFrom("```", "~~~", "═══", "▔▔", "━━", SEP, "   ", "- x", "1. **x**", "🧠 **Decide:**", "📌 **Outstanding from previous turns:**", "\r"),
    );
    const textArb = fc.oneof(
      fc.array(lineArb, { maxLength: 12 }).map((lines) => lines.join("\n")),
      replyArb("strict"),
      replyArb("loose"),
    );

    fc.assert(
      fc.property(textArb, (text) => {
        const blocks = parseReply(text);

        expect(blocks.flatMap((block) => block.lines).join("\n")).toBe(text);
        expect(blocks.map((block) => block.at)).toEqual(
          blocks.map((_, n) => blocks.slice(0, n).reduce((sum, block) => sum + block.lines.length, 0)),
        );
      }),
      { seed: SEED, numRuns: 1000 },
    );
  });
});

describe("sectionsIn", () => {
  test("gives each header and the blocks after it up to the next header, the roll-up's start or a topic", () => {
    const sections = sectionsIn(parseReply(REPLY));

    expect(sections.map((section) => [section.name, shapes(section.blocks)])).toEqual([
      ["Decide", [["header", 2], ["underline", 3], ["item", 4], ["separator", 10], ["item", 11], ["blank", 13]]],
    ]);
  });
});

describe("proseLines", () => {
  test("gives every line outside code", () => {
    const lines = proseLines(parseReply(REPLY));

    expect(lines).toContain("   🔘 A. **Disk**");
    expect(lines).not.toContain("   ```text");
    expect(lines).not.toContain("   🧠 **Decide:**");
    expect(lines.length).toBe(REPLY.split("\n").length - 4);
  });
});

describe("the small readers", () => {
  test("isCountLine: the count line, its indent aside", () => {
    expect(isCountLine("  📌 Outstanding: 🧠 1")).toBe(true);
    expect(isCountLine("📌 **Outstanding from previous turns:**")).toBe(false);
  });

  test("isTopicRule: a line of ═ alone", () => {
    expect(isTopicRule(" ═══ ")).toBe(true);
    expect(isTopicRule("═ ═")).toBe(false);
  });
});

describe("an item's head", () => {
  const headOf = (line: string) => {
    const block = parseReply(line)[0];

    return block?.kind === "item" ? block.head : undefined;
  };

  test("reads the bold summary its text opens on, and whether it's alone on the line", () => {
    expect(headOf("1. **Which cache**  \t")).toMatchObject({ summary: "Which cache", isAlone: true });
    expect(headOf("1. **Which cache**: why")).toMatchObject({ summary: "Which cache", isAlone: false });
    expect(headOf("1. **a** and **b**")).toMatchObject({ summary: "a", isAlone: false });
    expect(headOf("1. Plain **bold**")).toMatchObject({ summary: undefined, isAlone: false });
    expect(headOf("1. ****")).toMatchObject({ summary: undefined, isAlone: false });
    expect(headOf("1. **x**\r")).toMatchObject({ text: "**x**", isAlone: true });
  });
});

describe("a line's facts", () => {
  const factsOf = (line: string) => {
    const block = parseReply(line)[0];

    return block?.kind === "text" ? block : undefined;
  };

  test("reads an option by any option glyph, its letter and its bold name", () => {
    expect(factsOf("   🔘 A. **Disk**: why")?.option).toEqual({ glyph: "🔘", letter: "A", name: "Disk" });
    expect(factsOf("   🔲 N. **No**")?.option).toMatchObject({ glyph: "🔲", letter: "N" });
    expect(factsOf("   ⭕ N. **No**")?.option).toBeUndefined();
    expect(factsOf("   A. **Disk**")?.option).toBeUndefined();
    expect(factsOf("   🔘 a. **Disk**")?.option).toBeUndefined();
  });

  test("reads the bold text a line opens on, its indent aside, and a number alone", () => {
    expect(factsOf("   **Which cache**")?.bold).toBe("Which cache");
    expect(factsOf("1.")).toMatchObject({ bare: 1 });
    expect(factsOf("  2)")).toMatchObject({ bare: 2 });
    expect(factsOf("   3.")).toMatchObject({ bare: undefined });
    expect(parseReply("1. ")[0]).toMatchObject({ kind: "item", head: { number: 1, text: "" } });
  });

  test("marks an item's code lines and reads its other lines' facts", () => {
    const block = parseReply("1. **x**\n   🔘 A. **Disk**\n   ```\n   🔘 B. **Cloud**\n   ```")[0];

    expect(block?.kind === "item" ? block.body.map((under) => under.option?.letter) : []).toEqual([
      "A",
      undefined,
      undefined,
      undefined,
    ]);
  });
});
