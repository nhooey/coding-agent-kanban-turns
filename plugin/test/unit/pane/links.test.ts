// A reply's Decide list cut out of its text, for the item boxes to stand in
// its place, and only when the list is found intact: the one cut every list
// takes, read here for the list whose items carry options.

import { describe, test } from "node:test";
import { expect } from "expect";

import {
  ITEM_LINK,
  linkedSummaries,
  listCut,
} from "../../../src/pane/links.ts";
import { SPEC } from "../../../src/protocol/spec.ts";
import type { DecideItem } from "../../../types/index.d.ts";

/** The reply cut round its Decide list. */
const decideListCut = (text: string, items: readonly DecideItem[]) =>
  listCut(text, SPEC.lists.decide, items);

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
const ship: DecideItem = {
  ...item(2, "Ship `tonight`?"),
  options: [
    { letter: "Y", name: "Ship" },
    { letter: "N", name: "Hold" },
  ],
};

const DECIDE = [
  "🧠 **Decide:**  ",
  "▔▔▔▔▔▔▔▔▔▔",
  "1. **Which cache to keep**  ",
  "   Both are built.",
  "   🔘 A. **Disk**: it survives restarts.",
  "      ➕ Faster cold starts.",
  "      ➖ Disk use.",
  "   🔘 B. **Memory**",
  "   ⠀",
  "2. **Ship `tonight`?**  ",
  "   🔘 Y. **Ship**",
  "   🔘 N. **Hold**",
];
const reply = (decide: readonly string[]) =>
  [
    "Some work.",
    "",
    "🚧 **Pending:**  ",
    "▔▔▔▔▔▔▔▔▔▔▔",
    "1. **Rework the loader**",
    "",
    ...decide,
    "",
    "📌 Outstanding: 🚧 1 · 🧠 2",
  ].join("\n");

describe("a reply's Decide list cut out", () => {
  test("parts the text round the list, its header and every item's lines", () => {
    expect(decideListCut(reply(DECIDE), [cache, ship])).toEqual({
      before: "Some work.\n\n🚧 **Pending:**  \n▔▔▔▔▔▔▔▔▔▔▔\n1. **Rework the loader**",
      after: "📌 Outstanding: 🚧 1 · 🧠 2",
    });
  });

  test("leaves either side empty when the list opens or ends the reply", () => {
    expect(decideListCut(DECIDE.join("\n"), [cache, ship])).toEqual({ before: "", after: "" });
  });

  test("ends the list at the next list's header, with no blank line between", () => {
    const text = [...DECIDE, "👉 **Todo:**  ", "1. **Rotate the key**"].join("\n");
    expect(decideListCut(text, [cache, ship])?.after).toBe("👉 **Todo:**  \n1. **Rotate the key**");
  });

  test("leaves out the 📌 roll-up's Decide group, which is no list of this reply's", () => {
    const text = [
      ...DECIDE,
      "",
      "📌 **Outstanding from previous turns:**  ",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "🧠 **Decide:**  ",
      "- **An older decision** 🔖 0000aaaa₋₃",
    ].join("\n");
    expect(decideListCut(text, [cache, ship])?.after).toMatch(/^📌 \*\*Outstanding/);
  });

  test("is none when an item the reply names is missing from the list, or one it lists isn't raised", () => {
    expect(decideListCut(reply(DECIDE), [cache])).toBeUndefined();
    expect(decideListCut(reply(DECIDE), [cache, ship, item(3, "Another")])).toBeUndefined();
  });

  test("is none when the list's items are in another order than the boxes'", () => {
    expect(decideListCut(reply(DECIDE), [ship, cache])).toBeUndefined();
  });

  test("is none with no Decide list, or with two", () => {
    expect(decideListCut("Some work.\n\n1. **Which cache to keep**", [cache])).toBeUndefined();
    expect(decideListCut([...DECIDE, "", ...DECIDE].join("\n"), [cache, ship])).toBeUndefined();
  });

  test("is none with no items to stand in its place", () => {
    expect(decideListCut(reply(DECIDE), [])).toBeUndefined();
  });

  test("is none for an earlier reply's list when the item, restated, has other options", () => {
    const restated = { ...cache, options: [{ letter: "A", name: "Disk" }, { letter: "B", name: "Redis" }] };
    expect(decideListCut(reply(DECIDE), [restated, ship])).toBeUndefined();
  });

  test("cuts no list headed by a name the spec doesn't give the Decide list", () => {
    for (const name of ["Choices", "Backlog"]) {
      const decide = [`🧠 **${name}:**  `, ...DECIDE.slice(1)];
      expect(decideListCut(reply(decide), [cache, ship])).toBeUndefined();
    }
  });

  test("ends the list at a topic header, the line above a ═ rule", () => {
    const text = [...DECIDE, "The loader", "══════════", "1. **Rework it**"].join("\n");
    expect(decideListCut(text, [cache, ship])?.after).toBe("The loader\n══════════\n1. **Rework it**");
  });

  test("keeps a numbered bold line indented under an option as the option's", () => {
    const decide = [...DECIDE.slice(0, 5), "      1. **First step**", ...DECIDE.slice(5)];
    expect(decideListCut(reply(decide), [cache, ship])?.after).toBe("📌 Outstanding: 🚧 1 · 🧠 2");
  });

  test("ends the list at prose straight after it, with no blank line between", () => {
    const text = [...DECIDE, "Back to the loader."].join("\n");
    expect(decideListCut(text, [cache, ship])?.after).toBe("Back to the loader.");
  });
});

describe("a reply's Decide list cut out, as parseReply reads the reply", () => {
  test("cuts an item's code block whole, a blank line inside it", () => {
    const decide = [...DECIDE, "   ```text", "   one", "", "   two", "   ```"];
    expect(decideListCut(reply(decide), [cache, ship])?.after).toBe("📌 Outstanding: 🚧 1 · 🧠 2");
  });

  test("reads an item 1 or 2 spaces in, or numbered `1)`, as one of the list's items", () => {
    const decide = DECIDE.map((line) =>
      line.startsWith("2. ") ? `  2) ${line.slice(3)}` : line,
    );
    expect(decideListCut(reply(decide), [cache, ship])?.after).toBe("📌 Outstanding: 🚧 1 · 🧠 2");
  });

  test("ends the list at a fence at the line's start, its code after the cut", () => {
    const text = [...DECIDE, "```", "a column-0 block", "```"].join("\n");
    expect(decideListCut(text, [cache, ship])?.after).toBe("```\na column-0 block\n```");
  });

  test("keeps a fence as indented as an item's text, and the code under it, in the list", () => {
    const text = [...DECIDE, "   ```", "code", "```", "After."].join("\n");
    expect(decideListCut(text, [cache, ship])?.after).toBe("After.");
  });

  test("reads an option only with its glyph, as a Decide item's is read", () => {
    const glyphless = DECIDE.map((line) => line.replace(/[🔘🔲] /u, ""));
    expect(decideListCut(reply(glyphless), [cache, ship])).toBeUndefined();
  });

  test("links a summary line by the bold summary its text opens on, alone on its line or not, not one holding two bold spans", () => {
    const two = { ...cache, summary: "a** and **b" };
    const header = "🧠 **Decide:**\n";
    expect(linkedSummaries(`${header}1. **a** and **b**`, [two]).hrefs).toEqual([]);
    expect(linkedSummaries(`${header}1. **${cache.summary}**  \r`, [cache]).text).toBe(
      `${header}1. **[${cache.summary}](${ITEM_LINK}${cache.ref})**  \r`,
    );
    expect(linkedSummaries(`${header}1. **${cache.summary}**, pick one`, [cache]).text).toBe(
      `${header}1. **[${cache.summary}](${ITEM_LINK}${cache.ref})**, pick one`,
    );
  });

  test("cuts a CRLF reply's list as its LF form's", () => {
    expect(decideListCut(reply(DECIDE).replaceAll("\n", "\r\n"), [cache, ship])).toBeDefined();
  });

  test("finds no Decide list inside a code block", () => {
    const text = ["```", ...DECIDE, "```"].join("\n");
    expect(decideListCut(text, [cache, ship])).toBeUndefined();
  });
});
