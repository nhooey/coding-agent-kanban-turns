// A reply's Decide list cut out of its text, for the item boxes to stand in
// its place, and only when the list is found intact.

import { describe, test } from "node:test";
import { expect } from "expect";

import { decideListCut } from "../src/links.ts";
import type { DecideItem } from "../types/index.d.ts";

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
const ship = item(2, "Ship `tonight`?");

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
  "   👍 Y. **Ship**",
  "   👎 N. **Hold**",
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
});
