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
  glyphsInWords,
  instructionsFor,
  turnIdSource,
  withInstructions,
} from "../src/instructions.ts";
import { SPEC } from "../src/spec.ts";
import { itemsOf } from "../src/items.ts";

const engineBlocks: readonly Readonly<{ name: string; text: string }>[] = [
  { name: "claudeMd", text: "the instruction files" },
  { name: "currentDate", text: "Today's date is 2026-11-17." },
];

describe("the instructions", () => {
  test("name the tool as the agent calls it, the one the plugin registers", () => {
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
      "from the item's option glyphs (🔘, 🔲, or 👍 and 👎)",
      "`letter`, `name` and `consequence`",
      "its ➕ and ➖ lines",
      "`pros` and `cons`",
      "such as `0f311c94.Decide.2.B`",
      "sends nothing",
      "exactly as you would without the tool",
    ].forEach((phrase) => expect(INSTRUCTIONS).toContain(phrase));
  });
});

describe("turnIdSource", () => {
  test("follows the turn id's length", () => {
    expect(turnIdSource(8)).toBe("the first 8 characters");
    expect(turnIdSource(6)).toBe("the first 6 characters");
  });

  test("is how the instructions and the schema say where the turn id comes from, by the spec's length", () => {
    const source = turnIdSource(SPEC.reference["turn-id"].length);

    expect(INSTRUCTIONS).toContain(`the turn id, ${source} of the latest prompt's promptId`);
    expect(ITEM_SCHEMA.properties.turn.description).toBe(
      `The turn id, ${source} of this turn's promptId.`,
    );
  });
});

describe("glyphsInWords", () => {
  test("names each kind's glyphs, a kind with lettered glyphs by each", () => {
    expect(glyphsInWords(["radio", "binary"])).toBe("🔘, or 👍 and 👎");
    expect(glyphsInWords(["checkbox"])).toBe("🔲");
  });
});

describe("the tool's input schema", () => {
  test("describes an option's letters, list and lines from the spec", () => {
    const option = ITEM_SCHEMA.properties.options.items.properties;

    expect(option.letter.description).toBe(
      "The capital letter, A, B, C, or Y and N.",
    );
    expect(option.pros.description).toBe("The option's ➕ lines, without the ➕.");
    expect(option.cons.description).toBe("The option's ➖ lines, without the ➖.");
    expect(ITEM_SCHEMA.properties.list.enum).toEqual(["Decide"]);
    expect(ITEM_SCHEMA.properties.ref.description).toBe(
      "`<turn>.Decide.<number>`; filled in when left out.",
    );
  });
});

describe("adding the instructions to the context", () => {
  test("appends them as the plugin's block and keeps the others in order", () => {
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
