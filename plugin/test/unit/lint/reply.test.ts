// The reply lint's own tests: what the golden cases' replies don't show,
// spec/cases/lint-*.yaml holding a reply that breaks each rule.

import { describe, test } from "node:test";
import { expect } from "expect";
import { readFileSync } from "node:fs";

import { parseYaml } from "../../../src/config/config.ts";
import {
  RULES,
  RULE_NAMES,
  draftLintText,
  findingLine,
  indentOf,
  isKanbanReply,
  lintReply,
  replyLintText,
} from "../../../src/lint/reply.ts";
import { cellWidth } from "../../../src/text/cells.ts";
import { CASE_SCHEMA_FILE } from "../../../tools/spec/cases.ts";

const lines = (...text: readonly string[]): string => `${text.join("\n")}\n`;

const DONE = ["✅ **Done:**  ", "▔▔▔▔▔▔▔▔"] as const;

describe("lintReply", () => {
  test("finds nothing in a reply that keeps every rule", () => {
    expect(
      lintReply(
        lines(
          "The rerun passed.",
          "",
          ...DONE,
          "1. **Test suite rerun after the fix**  ",
          "   412 passed and 0 failed.",
          "   ⠀",
          "2. **Tokenizer fix in commit `a1b2c3d`**",
          "",
          "🧠 **Decide:**  ",
          "▔▔▔▔▔▔▔▔▔▔",
          "1. **Which cache to keep**  ",
          "   🔘 A. **Disk**: it survives restarts.",
          "      ➕ Faster cold starts.",
          "   🔘 B. **Memory**: simpler.",
          "",
          "| Step | Minutes |",
          "| ---- | ------- |",
          "| Lock | 6       |",
          "",
          "📌 Outstanding: 🧠 1",
        ),
      ),
    ).toEqual([]);
  });

  test("finds nothing in a plain reply", () => {
    expect(lintReply("Done: the tests pass.")).toEqual([]);
  });

  test("reads nothing inside a fence", () => {
    expect(
      lintReply(
        lines(...DONE, "1. **One**", "", "```text", "1. **Two** after", "▔▔", "```"),
      ),
    ).toEqual([]);
  });

  test("lets a list under a topic header number on from the topics before", () => {
    expect(
      lintReply(
        lines(
          "**The loader**  ",
          "══════════",
          ...DONE,
          "1. **One**",
          "",
          "**The cache**  ",
          "═════════",
          ...DONE,
          "2. **Two**",
        ),
      ),
    ).toEqual([]);
  });

  test("reads a numbered list's own numbers alone where no topic header is", () => {
    expect(lintReply(lines(...DONE, "1. **One**", "", ...DONE, "1. **Two**"))).toEqual([]);
  });

  test("counts an emoji 2 columns and bold markers none in a header's width", () => {
    expect(lintReply(lines("📌 **Outstanding from previous turns:**  ", "━".repeat(35)))).toEqual([]);
    expect(lintReply(lines("📌 **Outstanding from previous turns:**  ", "━".repeat(34)))).toEqual([
      {
        line: 2,
        rule: "underline-width",
        detail: "it is 34 columns wide; the header is 35",
      },
    ]);
  });

  test("finds a separator outside any list item", () => {
    expect(lintReply(lines("Some prose.", "⠀"))).toEqual([
      {
        line: 2,
        rule: "separator-indent",
        detail: "it is at column 0, outside any list item",
      },
    ]);
  });

  test("finds a separator right under a header's underline", () => {
    expect(lintReply(lines(...DONE, "⠀", "1. **One**"))).toEqual([
      { line: 3, rule: "stray-separator" },
    ]);
  });

  test("finds a blank line under a separator where the list goes on, not where it ends", () => {
    expect(
      lintReply(lines(...DONE, "1. **One**  ", "   It ran.", "   ⠀", "", "2. **Two**")),
    ).toEqual([{ line: 6, rule: "blank-beside-separator" }]);
    expect(
      lintReply(lines(...DONE, "1. **One**  ", "   It ran.", "   ⠀", "", "Prose.")),
    ).toEqual([]);
  });

  test("gives its findings in line order", () => {
    expect(
      lintReply(
        lines(...DONE, "1. **One** text", "2. **Two**", "   It ran.", "Prose."),
      ),
    ).toEqual([
      { line: 3, rule: "text-after-summary" },
      {
        line: 4,
        rule: "no-separator",
        detail: "this item is multi-line",
      },
      { line: 4, rule: "no-hard-break" },
      { line: 6, rule: "list-not-ended" },
    ]);
  });

  test("says where a separator's list's items start, and which item is multi-line", () => {
    expect(
      lintReply(
        lines(...DONE, "1. **One**  ", "   It ran.", "  ⠀", "2. **Two**"),
      ),
    ).toEqual([
      {
        line: 5,
        rule: "separator-indent",
        detail: "it is at column 2; its list's items, from line 3, start at column 3",
      },
    ]);
    expect(
      lintReply(lines(...DONE, "1. **One**  ", "   It ran.", "2. **Two**")),
    ).toEqual([
      {
        line: 5,
        rule: "no-separator",
        detail: "the item at line 3 is multi-line",
      },
    ]);
  });

  test("says where a list under a topic header should start", () => {
    expect(
      lintReply(
        lines(
          "**The loader**  ",
          "══════════",
          ...DONE,
          "1. **One**",
          "",
          "**The cache**  ",
          "═════════",
          ...DONE,
          "1. **Two**",
        ),
      ),
    ).toEqual([
      {
        line: 11,
        rule: "list-renumbered",
        detail: "this Done list starts at 2, not 1",
      },
    ]);
  });

  test("finds nothing in an option's letters, any of the reference grammar's, Y and N among them", () => {
    const DECIDE = ["🧠 **Decide:**  ", "▔▔▔▔▔▔▔▔▔▔", "1. **Ship tonight?**  "];

    expect(
      lintReply(lines(...DECIDE, "   🔘 Y. **Ship it**: it goes out.", "   🔘 N. **Hold it**: it waits.")),
    ).toEqual([]);
    expect(
      lintReply(lines(...DECIDE, "   🔘 A. **Ship it**: it goes out.", "   🔘 B. **Hold it**: it waits.")),
    ).toEqual([]);
  });
});

describe("indentOf", () => {
  test("counts leading spaces alone, as the skill's lint does", () => {
    expect(indentOf("   It ran.")).toBe(3);
    expect(indentOf("  It ran.")).toBe(0);
    expect(indentOf("  It ran.")).toBe(1);
    expect(indentOf("\tIt ran.")).toBe(0);
  });

  test("leaves a line indented by U+00A0 a line of the list's own prose, no indented one", () => {
    expect(
      lintReply(
        lines(...DONE, "1. **One**  ", "   It ran.", "   ⠀", "2. **Two**  ", "   It ran."),
      ),
    ).toEqual([{ line: 7, rule: "list-not-ended" }]);
  });

  test("reads a line of U+00A0 alone as a line of whitespace", () => {
    expect(
      lintReply(lines(...DONE, "1. **One**  ", "   It ran.", "   ", "2. **Two**")),
    ).toEqual([
      { line: 5, rule: "whitespace-line" },
      {
        line: 6,
        rule: "no-separator",
        detail: "the item at line 3 is multi-line",
      },
    ]);
  });
});

describe("a header's width, beside the skill's", () => {
  // The skill's `_width` counts code points: U+FE0F none, a wide one 2.
  // `cellWidth` counts graphemes, as the terminal draws them. These pin
  // where the two part.
  test("counts an emoji with U+FE0F after it 2, where the skill counts 1", () => {
    expect(cellWidth("🖥️")).toBe(2);
  });

  test("counts a ZWJ sequence and a skin-tone modifier 2 each, where the skill counts each wide part", () => {
    expect(cellWidth("👨‍👩‍👧")).toBe(2);
    expect(cellWidth("👍🏽")).toBe(2);
  });

  test("agrees with the skill on a plain emoji and bold markers", () => {
    expect(cellWidth("✅ Done:")).toBe(8);
  });
});

describe("the lint's rules", () => {
  test("are the rules the golden cases' schema names, in its order", () => {
    const schema = parseYaml(
      readFileSync(new URL(`../../../${CASE_SCHEMA_FILE}`, import.meta.url), "utf8"),
    );
    const rules =
      "value" in schema
        ? (
            schema.value as {
              definitions: { finding: { properties: { rule: { enum: string[] } } } };
            }
          ).definitions.finding.properties.rule.enum
        : [];

    expect(RULE_NAMES).toEqual(rules);
  });

  test("each say what to do", () => {
    expect(RULE_NAMES.filter((rule) => RULES[rule].length === 0)).toEqual([]);
  });

  test("name the separator by its code point", () => {
    expect(RULES["whitespace-line"]).toContain("U+2800");
  });
});

describe("findingLine", () => {
  test("gives the line, the rule and what to do", () => {
    expect(findingLine({ line: 5, rule: "no-separator" })).toBe(
      `5: [no-separator] ${RULES["no-separator"]}`,
    );
  });

  test("gives what the finding found there after what to do", () => {
    expect(
      findingLine({ line: 2, rule: "underline-width", detail: "it is 6 columns wide; the header is 8" }),
    ).toBe(`2: [underline-width] ${RULES["underline-width"]}; it is 6 columns wide; the header is 8`);
  });
});

const FOUND = [
  { line: 2, rule: "underline-width" },
  { line: 5, rule: "no-separator" },
] as const;

describe("draftLintText", () => {
  test("says the draft keeps every rule, where there's nothing", () => {
    expect(draftLintText([])).toBe("The lint finds nothing: the draft keeps every rule it checks.");
  });

  test("gives how many findings, then each on its line", () => {
    expect(draftLintText(FOUND)).toBe(
      [
        "The lint finds 2 findings; fix each before sending the response:",
        ...FOUND.map(findingLine),
      ].join("\n"),
    );
    expect(draftLintText(FOUND.slice(0, 1))).toContain("finds 1 finding;");
  });
});

describe("replyLintText", () => {
  test("is empty where there's nothing", () => {
    expect(replyLintText([])).toBe("");
  });

  test("names the last final response, then each finding on its line", () => {
    expect(replyLintText(FOUND)).toBe(
      [
        "The reply lint finds 2 findings in the last final response; keep these rules in the next one:",
        ...FOUND.map(findingLine),
      ].join("\n"),
    );
  });
});

describe("isKanbanReply", () => {
  test("is a reply with a list's header, the 📌 roll-up or the count line", () => {
    expect(isKanbanReply("Prose.\n\n✅ **Done:**  \n▔▔▔▔▔▔▔▔\n1. **One**\n")).toBe(true);
    expect(isKanbanReply("🔍 **Review:**  \n- **The README**\n")).toBe(true);
    expect(isKanbanReply("📌 **Outstanding from previous turns:**  \n")).toBe(true);
    expect(isKanbanReply("Prose.\n\n📌 Outstanding: 🧠 1\n")).toBe(true);
  });

  test("isn't a reply of prose alone", () => {
    expect(isKanbanReply("The tests pass.\n\n| A | B |\n| - | - |\n")).toBe(false);
    expect(isKanbanReply("A **bold:** word.")).toBe(false);
    expect(isKanbanReply("📋 **Backlog:**  \n- **The README**\n")).toBe(false);
  });

  test("isn't a reply whose header, roll-up or count line is inside a code block", () => {
    expect(isKanbanReply("Like this:\n\n```\n✅ **Done:**\n📌 Outstanding: 🧠 1\n```\n")).toBe(false);
  });
});
