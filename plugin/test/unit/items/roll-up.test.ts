// What the `kanban_outstanding` tool gives: the roll-up's draft with each
// item's 🔖 tag, the count line and the open Decide items; the kanban
// skill's `outstanding.py render` and `decide --json` tests, on neutral
// turns built directly.

import { describe, test } from "node:test";
import { expect } from "expect";

import { keyOf } from "../../../src/items/outstanding.ts";
import { itemsOf } from "../../../src/items/items.ts";
import {
  MERGES_UNKNOWN,
  bodyOf,
  cutTo,
  outstandingText,
  raisedAt,
  rollUpDraft,
  runsOf,
  tagOf,
  unreadText,
} from "../../../src/items/roll-up.ts";
import { lintReply } from "../../../src/lint/reply.ts";
import type { Turn } from "../../../types/index.d.ts";
import { turnOf } from "../../fixtures/turns.ts";

const BR = "  ";
const RULE = "━".repeat(35);
const ROLL_UP_HEADER = `📌 **Outstanding from previous turns:**${BR}`;
const IDS = ["9efb08a1", "b2c3d4e5", "c3d4e5f6", "d4e5f6a7"] as const;

/** The user's turns, by their place, each holding the one reply given. */
const turnsOf = (...replies: readonly string[]): readonly Turn[] =>
  replies.map((reply, n) => turnOf(IDS[n] ?? "", "go", { replies: [reply] }));

/** What `kanban_outstanding` reads over in these tests: the default window and width, every merge known. */
const OVER = {
  window: 20,
  width: 100,
  merged: new Set<string>(),
  isMergeKnown: true,
} as const;

const pending = (body: string): string =>
  `🚧 **Pending:**${BR}\n1. **Rework the loader**${body}\n`;

describe("keyOf", () => {
  test("is an item's list and its summary's subject key", () => {
    expect(keyOf({ list: "pending", line: "**Rework the loader** again" })).toBe(
      "pending\trework loader",
    );
  });
});

describe("bodyOf", () => {
  test("is the text after the bold summary", () => {
    expect(bodyOf("**Rework the loader** It reads twice.")).toBe(" It reads twice.");
  });

  test("is the whole line where there's no bold summary", () => {
    expect(bodyOf("Rework the loader")).toBe("Rework the loader");
  });
});

describe("raisedAt", () => {
  const occurrences = (turns: readonly Turn[]) =>
    turns.flatMap((turn, at) =>
      turn.replies.map((reply) => ({
        list: "pending" as const,
        at,
        number: 1,
        isPinned: reply.startsWith("📌"),
        line: reply,
      })),
    );

  test("is the turn that first printed an item restated unchanged", () => {
    const turns = turnsOf("**A** same", "**A** same", "**A** same");

    expect(raisedAt(turns, occurrences(turns))).toBe(0);
  });

  test("moves to the restatement whose substance changed, its reworded summary alone no change", () => {
    const turns = turnsOf("**A** old", "**A** new", "**A reworded** new");

    expect(raisedAt(turns, occurrences(turns))).toBe(1);
  });

  test("is the turn a 📌 roll-up's tag names, where only roll-ups restate it", () => {
    const turns = turnsOf("prose", "prose", "📌");
    const pinned = [
      { list: "pending" as const, at: 2, number: undefined, isPinned: true, line: "**A**", tagged: IDS[1] },
    ];

    expect(raisedAt(turns, pinned)).toBe(1);
  });

  test("is its own list's restatement over a 📌 roll-up's tag, where it has both", () => {
    const turns = turnsOf("**A** old", "**A** new", "📌", "**A** new");
    const both = [
      ...occurrences(turns).filter((item) => !item.isPinned),
      { list: "pending" as const, at: 2, number: undefined, isPinned: true, line: "**A**", tagged: IDS[0] },
    ].toSorted((a, b) => a.at - b.at);

    expect(raisedAt(turns, both)).toBe(1);
  });

  test("is the earliest occurrence's turn where the tag names no turn read", () => {
    const turns = turnsOf("prose", "📌", "📌");
    const pinned = [1, 2].map((at) => ({
      list: "pending" as const,
      at,
      number: undefined,
      isPinned: true,
      line: "**A**",
      tagged: "ffffffff",
    }));

    expect(raisedAt(turns, pinned)).toBe(1);
  });
});

describe("tagOf", () => {
  test("is the turn's id and its index back from the latest turn, in subscript", () => {
    const turns = turnsOf("a", "b", "c", "d");

    expect(tagOf(turns, 0)).toBe("🔖 9efb08a1₋₃");
    expect(tagOf(turns, 3)).toBe("🔖 d4e5f6a7₀");
  });
});

describe("rollUpDraft", () => {
  test("is the roll-up's header and rule, then each list's items under its header, each with its tag", () => {
    const turns = turnsOf(
      pending(`${BR}\n   It reads twice.`),
      `⏳ **Waiting:**${BR}\n- **The \`atomic-reload\` CI run**\n`,
      "Nothing new.",
    );

    expect(rollUpDraft(turns, 20)).toBe(
      [
        ROLL_UP_HEADER,
        RULE,
        `🚧 **Pending:**${BR}`,
        "- **Rework the loader** 🔖 9efb08a1₋₂",
        "",
        `⏳ **Waiting:**${BR}`,
        "- **The `atomic-reload` CI run** 🔖 b2c3d4e5₋₁",
      ].join("\n"),
    );
  });

  test("keeps every rule the reply lint checks", () => {
    const turns = turnsOf(
      pending(""),
      `👉 **Todo:**${BR}\n- **Paste the prompt**\n\n🧠 **Decide:**${BR}\n1. **Which cache**\n`,
    );

    expect(lintReply(rollUpDraft(turns, 20))).toEqual([]);
  });

  test("leaves out what is settled: a Review item whose pull request merged", () => {
    const turns = turnsOf(`🔍 **Review:**${BR}\n- **nhooey/infra#212 Nightly snapshots**\n`);

    expect(rollUpDraft(turns, 20)).not.toBe("");
    expect(rollUpDraft(turns, 20, new Set(["nhooey/infra#212"]))).toBe("");
  });

  test("is empty when nothing is outstanding", () => {
    expect(rollUpDraft(turnsOf("Just prose."), 20)).toBe("");
  });

  test("cuts a summary to the width it's given", () => {
    const turns = turnsOf(`🚧 **Pending:**${BR}\n1. **Rework the loader's cache**\n`);

    expect(rollUpDraft(turns, 20, new Set(), 10)).toContain(
      "- **Rework th…** 🔖 9efb08a1₀",
    );
  });

  test("tags an item restated in its own list and in a 📌 roll-up by its own restatement", () => {
    const turns = turnsOf(
      pending(`${BR}\n   It reads twice.`),
      pending(`${BR}\n   It reads three times.`),
      `${ROLL_UP_HEADER}\n${RULE}\n🚧 **Pending:**${BR}\n- **Rework the loader** 🔖 9efb08a1₋₂\n`,
    );

    expect(rollUpDraft(turns, 20)).toContain("- **Rework the loader** 🔖 b2c3d4e5₋₁");
  });
});

describe("runsOf", () => {
  test("parts a summary into plain text and links, a link's brackets nested", () => {
    expect(runsOf("See [a [b] c](https://x/(y)) now")).toEqual([
      { opening: "", shown: "See ", closing: "" },
      { opening: "[", shown: "a [b] c", closing: "](https://x/(y))" },
      { opening: "", shown: " now", closing: "" },
    ]);
  });

  test("reads an unclosed bracket as plain text", () => {
    expect(runsOf("[a](b")).toEqual([{ opening: "", shown: "[a](b", closing: "" }]);
  });

  test("closes a bracket at its own close, not at a later one", () => {
    expect(runsOf("[a](b) [c](d)")).toEqual([
      { opening: "[", shown: "a", closing: "](b)" },
      { opening: "", shown: " ", closing: "" },
      { opening: "[", shown: "c", closing: "](d)" },
    ]);
    expect(runsOf("[a [b](c)")).toEqual([
      { opening: "", shown: "[a ", closing: "" },
      { opening: "[", shown: "b", closing: "](c)" },
    ]);
  });
});

describe("cutTo", () => {
  test("leaves a summary that fits as it is, a link counting its label alone", () => {
    expect(cutTo("Fix [#12](https://github.com/o/r/pull/12)", 8)).toBe(
      "Fix [#12](https://github.com/o/r/pull/12)",
    );
  });

  test("cuts plain text, ending on …", () => {
    expect(cutTo("abcdefghij", 5)).toBe("abcd…");
  });

  test("keeps a summary whole for a width of 0 or less", () => {
    expect(cutTo("abcdefghij", 0)).toBe("abcdefghij");
    expect(cutTo("abcdefghij", -3)).toBe("abcdefghij");
  });

  test("counts code points, an emoji one", () => {
    expect(cutTo("🔖🔖🔖🔖🔖🔖", 4)).toBe("🔖🔖🔖…");
  });

  test("shortens a link's label where the cut falls in it, the link kept whole", () => {
    expect(cutTo("Fix [the loader](https://x/1) today", 8)).toBe(
      "Fix [the…](https://x/1)",
    );
  });

  test("puts the … after a link where the cut falls right after it", () => {
    expect(cutTo("[abcd](https://x/1) and more", 5)).toBe("[abcd](https://x/1)…");
  });
});

describe("outstandingText", () => {
  const ITEM = {
    turn: IDS[0],
    number: 1,
    summary: "Which cache to keep",
    kind: "radio",
    options: [
      { letter: "A", name: "Disk" },
      { letter: "B", name: "Memory" },
    ],
  };
  const reply = `🧠 **Decide:**${BR}\n1. **Which cache to keep**${BR}\n   🔘 A. **Disk**\n   🔘 B. **Memory**\n`;

  test("gives the count line, the roll-up's draft and the open Decide items as kanban_options takes them", () => {
    const turns = [
      turnOf(IDS[0], "go", { replies: [reply], decide: itemsOf({ items: [ITEM] }) }),
    ];
    const text = outstandingText(turns, OVER);

    expect(text).toContain("📌 Outstanding: 🧠 1");
    expect(text).toContain(`${ROLL_UP_HEADER}\n${RULE}\n🧠 **Decide:**${BR}\n- **Which cache to keep** 🔖 9efb08a1₀`);
    expect(text).toContain("`mcp__coding-agent-kanban-turns__kanban_options`");
    expect(text).toContain(JSON.stringify({ items: itemsOf({ items: [ITEM] }) }));
  });

  test("says when nothing is outstanding, and gives no Decide items", () => {
    const text = outstandingText(turnsOf("Just prose."), OVER);

    expect(text).toContain("Count line: none");
    expect(text).toContain("Roll-up: none");
    expect(text).toContain('{"items":[]}');
    expect(text).not.toContain(MERGES_UNKNOWN);
  });

  test("says first that the merges are unknown, where GitHub didn't answer", () => {
    const turns = turnsOf(`🔍 **Review:**${BR}\n- **nhooey/infra#212 Nightly snapshots**\n`);
    const text = outstandingText(turns, { ...OVER, isMergeKnown: false });

    expect(text.startsWith(MERGES_UNKNOWN)).toBe(true);
    expect(MERGES_UNKNOWN).toContain("Review item");
    expect(text).toContain("📌 Outstanding: 🔍 1");
  });

  test("an answered item is open no more", () => {
    const turns = [
      turnOf(IDS[0], "go", { replies: [reply], decide: itemsOf({ items: [ITEM] }) }),
      turnOf(IDS[1], `${IDS[0]}.Decide.1.A`),
    ];

    expect(outstandingText(turns, OVER)).toContain('{"items":[]}');
  });
});

describe("unreadText", () => {
  test("says why, where it's known", () => {
    expect(unreadText("the transcript is gone")).toBe(
      "What earlier turns leave open could not be read: the transcript is gone.",
    );
    expect(unreadText("")).toBe("What earlier turns leave open could not be read.");
  });
});
