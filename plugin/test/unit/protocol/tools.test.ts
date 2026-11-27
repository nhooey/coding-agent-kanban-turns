import { describe, test } from "node:test";
import { expect } from "expect";

import {
  INSTRUCTIONS,
  LINT_CALLED,
  OUTSTANDING_CALLED,
  PLUGIN,
  TOOL,
  TOOL_CALLED,
  TOOL_DESCRIPTION,
  instructionsFor,
} from "../../../src/protocol/instructions.ts";
import {
  LINT_DESCRIPTION,
  LINT_SCHEMA,
  LINT_TOOL,
  NO_DRAFT,
  OPTIONS_TOOL,
  OUTSTANDING_DESCRIPTION,
  OUTSTANDING_SCHEMA,
  OUTSTANDING_TOOL,
  calledAs,
  draftOf,
} from "../../../src/protocol/tools.ts";
import { draftLintText, lintToolText } from "../../../src/harness/reply-lint.ts";

describe("calledAs", () => {
  test("is a tool's name as the agent calls it", () => {
    expect(calledAs("a-plugin", "a_tool")).toBe("mcp__a-plugin__a_tool");
    expect(OUTSTANDING_CALLED).toBe(`mcp__${PLUGIN}__${OUTSTANDING_TOOL}`);
    expect(LINT_CALLED).toBe(`mcp__${PLUGIN}__${LINT_TOOL}`);
  });

  test("gives the buttons' tool its name, as the plugin registers it", () => {
    expect(TOOL).toBe(OPTIONS_TOOL);
    expect(TOOL_CALLED).toBe(calledAs(PLUGIN, OPTIONS_TOOL));
  });
});

describe("draftOf", () => {
  test("is the draft a kanban_lint call hands over", () => {
    expect(draftOf({ text: "A draft." })).toBe("A draft.");
  });

  test("is none where the input holds no draft", () => {
    for (const input of [{}, { text: 3 }, { text: "" }, { text: " \n" }, null, "A draft."]) {
      expect(draftOf(input)).toBeUndefined();
    }
  });
});

describe("lintToolText", () => {
  test("says that no draft was given, where none was", () => {
    expect(lintToolText({})).toBe(NO_DRAFT);
    expect(NO_DRAFT).toContain(`No draft was given`);
    expect(NO_DRAFT).toContain(LINT_TOOL);
  });

  test("lints the draft it was given", () => {
    expect(lintToolText({ text: "The tests pass." })).toBe(draftLintText([]));
  });
});

describe("the tools' descriptions and schemas", () => {
  test("say what each gives and when to call it", () => {
    expect(OUTSTANDING_DESCRIPTION).toContain("📌 count line");
    expect(OUTSTANDING_DESCRIPTION).toContain("🔖 tag");
    expect(OUTSTANDING_DESCRIPTION).toContain("open Decide items");
    expect(LINT_DESCRIPTION).toContain("its Decide options");
    expect(LINT_DESCRIPTION).toContain("before sending it");
  });

  test("say the open Decide items are only those raised through the buttons' tool", () => {
    expect(OUTSTANDING_DESCRIPTION).toContain(
      `Those Decide items are only the ones raised through ${OPTIONS_TOOL}`,
    );
  });

  test("take nothing, and the draft's text", () => {
    expect(OUTSTANDING_SCHEMA).toEqual({ type: "object", properties: {} });
    expect(LINT_SCHEMA.required).toEqual(["text"]);
    expect(LINT_SCHEMA.properties.text.type).toBe("string");
  });
});

describe("the instructions on the other tools", () => {
  const text = instructionsFor("the_options", "the_outstanding", "the_lint");

  test("name each tool as they are given it, and when to call it", () => {
    expect(text).toContain("`the_outstanding`: call it before writing a final response");
    expect(text).toContain(
      '`the_lint`: call it with a draft final response, `{"text": "..."}`, before sending it',
    );
    expect(text).toContain("raised through `the_options`");
    expect(text).toContain("as its turn ends");
  });

  test("point the roll-up at the tool that drafts it", () => {
    expect(text).toContain("The tool `the_outstanding` drafts both");
  });

  test("are in the agent's instructions, with the tools as the agent calls them", () => {
    expect(INSTRUCTIONS).toContain(`\`${OUTSTANDING_CALLED}\`: call it`);
    expect(INSTRUCTIONS).toContain(`\`${LINT_CALLED}\`: call it`);
  });
});

describe("the buttons' tool's description", () => {
  test("names the plugin's tool for the open items' shape, not the skill's script", () => {
    expect(TOOL_DESCRIPTION).toContain(`\`${OUTSTANDING_TOOL}\``);
    expect(TOOL_DESCRIPTION).not.toContain("outstanding.py");
  });
});
