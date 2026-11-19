import { describe, test } from "node:test";
import { expect } from "expect";

import {
  BLOCK,
  INPUT_SCHEMA,
  INSTRUCTIONS,
  ITEM_SCHEMA,
  KINDS,
  PLUGIN,
  TOOL,
  TOOL_CALLED,
  TOOL_DESCRIPTION,
  instructionsFor,
  withInstructions,
} from "../src/instructions.ts";
import { itemsOf } from "../src/items.ts";

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

const option = {
  letter: "A",
  name: "Keep it",
  consequence: "nothing moves",
  pros: ["cheap"],
  cons: ["slow"],
};

const item = {
  turn: "0f311c94",
  list: "Decide",
  number: 2,
  summary: "Which cache to keep",
  kind: "radio",
  ref: "0f311c94.Decide.2",
  options: [option],
};

const without = (
  record: Readonly<Record<string, unknown>>,
  field: string,
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(Object.entries(record).filter(([key]) => key !== field));

const accepts = (candidate: unknown): boolean =>
  itemsOf({ items: [candidate] }).length === 1;

describe("the tool's schema", () => {
  test("covers every field of the example item and its option", () => {
    expect(Object.keys(ITEM_SCHEMA.properties).sort()).toEqual(
      Object.keys(item).sort(),
    );
    expect(
      Object.keys(ITEM_SCHEMA.properties.options.items.properties).sort(),
    ).toEqual(Object.keys(option).sort());
  });

  test("requires exactly the item fields itemsOf won't do without", () => {
    expect(
      Object.keys(ITEM_SCHEMA.properties).filter(
        (field) => !accepts(without(item, field)),
      ),
    ).toEqual([...ITEM_SCHEMA.required]);
  });

  test("requires exactly the option fields itemsOf won't do without", () => {
    const options = ITEM_SCHEMA.properties.options.items;

    expect(
      Object.keys(options.properties).filter(
        (field) => !accepts({ ...item, options: [without(option, field)] }),
      ),
    ).toEqual([...options.required]);
  });

  test("offers the kinds the instructions name", () => {
    expect(ITEM_SCHEMA.properties.kind.enum).toEqual(KINDS);
    expect(INSTRUCTIONS).toContain("`radio`, `checkbox` or `binary`");
  });

  test("is the items array of the tool's input", () => {
    expect(INPUT_SCHEMA.required).toEqual(["items"]);
    expect(INPUT_SCHEMA.properties.items.items).toBe(ITEM_SCHEMA);
  });

  test("names in the instructions every field the agent fills in", () => {
    [
      ...ITEM_SCHEMA.required,
      "kind",
      ...Object.keys(ITEM_SCHEMA.properties.options.items.properties),
    ].forEach((field) => expect(INSTRUCTIONS).toContain(`\`${field}\``));
  });
});

describe("the tool's description", () => {
  test("says where the buttons go, when to call it and that a click sends nothing", () => {
    [
      "just under the final response",
      "Decide pane",
      "right before writing the final response",
      "nothing is sent",
    ].forEach((phrase) => expect(TOOL_DESCRIPTION).toContain(phrase));
  });
});
