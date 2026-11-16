import { describe, test } from "node:test";
import { expect } from "expect";

import {
  BLOCK,
  INSTRUCTIONS,
  PLUGIN,
  TOOL,
  TOOL_CALLED,
  instructionsFor,
  withInstructions,
} from "../src/instructions.ts";

const engineBlocks: readonly Readonly<{ name: string; text: string }>[] = [
  { name: "claudeMd", text: "the instruction files" },
  { name: "currentDate", text: "Today's date is 2026-11-17." },
];

describe("the instructions", () => {
  test("name the tool as the agent calls it, the one the mod registers", () => {
    expect(TOOL_CALLED).toBe(`mcp__${PLUGIN}__${TOOL}`);
    expect(INSTRUCTIONS).toContain(`\`${TOOL_CALLED}\``);
  });

  test("are written around whatever tool name they are given", () => {
    expect(instructionsFor("some_tool")).toContain("`some_tool`");
    expect(instructionsFor("some_tool")).not.toContain(TOOL);
  });

  test("say when to call it, what its input holds and what a click does", () => {
    [
      "once, right before writing a final response that holds Decide items",
      '`{"items": [...]}`',
      "`turn`",
      "`number` and `summary`",
      "`radio`, `checkbox` or `binary`",
      "`letter`, `name` and `consequence`",
      "`pros` and `cons`",
      "sends nothing",
      "exactly as you would without the tool",
    ].forEach((phrase) => expect(INSTRUCTIONS).toContain(phrase));
  });
});

describe("adding the instructions to the context", () => {
  test("appends them as the mod's block and keeps the others in order", () => {
    expect(withInstructions({ blocks: engineBlocks }).blocks).toEqual([
      ...engineBlocks,
      { name: BLOCK, text: INSTRUCTIONS },
    ]);
  });

  test("keeps the context's other fields", () => {
    const files = [{ path: "/work/AGENTS.md" }];

    expect(
      withInstructions({ blocks: engineBlocks, instructionFiles: files })
        .instructionFiles,
    ).toBe(files);
  });

  test("holds one copy however often it runs", () => {
    const twice = withInstructions(withInstructions({ blocks: engineBlocks }));

    expect(twice.blocks.filter((block) => block.name === BLOCK)).toHaveLength(
      1,
    );
  });
});
