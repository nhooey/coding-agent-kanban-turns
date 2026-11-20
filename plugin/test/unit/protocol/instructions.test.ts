import { describe, test } from "node:test";
import { expect } from "expect";

import {
  BLOCK,
  INPUT_SCHEMA,
  INSTRUCTIONS,
  INSTRUCTION_FRAGMENTS,
  ITEM_SCHEMA,
  KINDS,
  PLUGIN,
  TOOL,
  TOOL_CALLED,
  TOOL_DESCRIPTION,
  instructionsFor,
  turnIdSource,
  withInstructions,
} from "../../../src/protocol/instructions.ts";
import { FRAGMENTS } from "../../../src/protocol/fragments.ts";
import {
  filled,
  fragmentProblems,
  placeholderValues,
  unusedFragments,
} from "../../../src/protocol/prose.ts";
import { SPEC } from "../../../src/protocol/spec.ts";
import { itemsOf } from "../../../src/items/items.ts";

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
      "`radio` or `checkbox`",
      "from the item's option glyphs (🔘 or 🔲)",
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

const values = placeholderValues(SPEC, { plugin: PLUGIN, tool: TOOL_CALLED });

describe("the instructions' fragments", () => {
  test("are every fragment, each used", () => {
    expect(unusedFragments(Object.keys(FRAGMENTS), [INSTRUCTION_FRAGMENTS])).toEqual([]);
  });

  test("each find a value in the spec for every placeholder", () => {
    expect(fragmentProblems(FRAGMENTS, values)).toEqual([]);
  });

  test("are each in the instructions, filled from the spec, in their order", () => {
    const at = INSTRUCTION_FRAGMENTS.map((name) =>
      INSTRUCTIONS.indexOf(filled(FRAGMENTS[name], values)),
    );

    expect(at.every((n) => n >= 0)).toBe(true);
    expect(at).toEqual(at.toSorted((a, b) => a - b));
    expect(INSTRUCTIONS).not.toContain("{{");
  });
});

describe("the instructions teach the whole format", () => {
  test("hold every list's header, as a final response writes it", () => {
    Object.values(SPEC.lists).forEach((list) =>
      expect(INSTRUCTIONS).toContain(`${list.glyph} **${list.header}:**`),
    );
  });

  test("hold the roll-up's header, its count line and the 🔖 tag", () => {
    expect(INSTRUCTIONS).toContain(`${SPEC["roll-up"].glyph} **${SPEC["roll-up"].header}:**`);
    expect(INSTRUCTIONS).toContain(`${SPEC["roll-up"].glyph} ${SPEC["roll-up"]["count-label"]}: `);
    expect(INSTRUCTIONS).toContain(SPEC.tag.glyph);
  });

  test("name every command and its synonyms", () => {
    Object.entries(SPEC.commands.names).forEach(([name, command]) =>
      [name, ...command.synonyms].forEach((word) =>
        expect(INSTRUCTIONS).toContain(`\`${word}\``),
      ),
    );
  });

  test("give the rules a parser can't check", () => {
    [
      "A progress update is any text the agent writes between tool calls",
      "names its subject, never its category",
      "a ➕ line for what it gains and a ➖ line for what it costs",
      "A question is never a choice.",
      "The roll-up interval.",
      "otherwise the final response closes on one count line",
    ].forEach((phrase) => expect(INSTRUCTIONS).toContain(phrase));
  });
});

describe("the tool's input schema", () => {
  test("describes an option's letters, list and lines from the spec", () => {
    const option = ITEM_SCHEMA.properties.options.items.properties;

    expect(ITEM_SCHEMA.properties.number.description).toBe(
      "The item number in the Decide list.",
    );
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

  test("takes every kind the spec reads, and the instructions teach only the taught ones", () => {
    const kinds = Object.entries(SPEC.options.kinds);

    expect(ITEM_SCHEMA.properties.kind.enum).toEqual(KINDS);
    expect(KINDS).toEqual(kinds.map(([name]) => name));
    kinds
      .filter(([, kind]) => kind.taught)
      .forEach(([name, kind]) => {
        expect(INSTRUCTIONS).toContain(`\`${name}\``);
        expect(INSTRUCTIONS).toContain(kind.glyph);
      });
    expect(INSTRUCTIONS).not.toContain("`binary`");
    expect(INSTRUCTIONS).not.toContain("👍 Y.");
  });

  test("gives the kind an item takes when it names none, the one itemsOf fills in", () => {
    const [read] = itemsOf({ items: [without(item, "kind")] });

    expect(ITEM_SCHEMA.properties.kind.description).toBe(
      `From the item's option glyphs; ${read?.kind ?? ""} when left out.`,
    );
    expect(read?.kind).toBe("radio");
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

  test("describes the input's shape itself, naming no script that prints it", () => {
    ["turn id", "number", "summary", "kind", "letter", "name", "consequence", "pros", "cons"].forEach(
      (field) => expect(TOOL_DESCRIPTION).toContain(field),
    );
    expect(TOOL_DESCRIPTION).not.toContain("outstanding.py");
  });
});
