// What the plugin tells the agent about its own tool: when to call it, what its
// input holds and what a click does. The turn-response format itself is the
// kanban skill's to teach.

import { DECIDE } from "./rules.ts";
import { SPEC } from "./spec.ts";
import type { DecideKind } from "../../types/index.d.ts";

/** The plugin's name, which the engine puts in its tools' names. */
export const PLUGIN = "coding-agent-kanban-turns";
/** The tool's name as the plugin registers it. */
export const TOOL = "kanban_options";
/** The tool's name as the agent sees and calls it. */
export const TOOL_CALLED = `mcp__${PLUGIN}__${TOOL}`;
/** The context block the instructions go in, keyed by the plugin's own name. */
export const BLOCK = "kanbanTurns";

/** The item kinds, in the order the instructions and the schema name them. */
export const KINDS = Object.keys(SPEC.options.kinds) as readonly DecideKind[];

/** The kinds as the instructions write them: `radio`, `checkbox` or `binary`. */
const kindsInWords = [
  KINDS.slice(0, -1)
    .map((kind) => `\`${kind}\``)
    .join(", "),
  `\`${KINDS[KINDS.length - 1]}\``,
].join(" or ");

/** The glyphs of a kind's options: its letters' own, joined by "and", else its one glyph. */
const kindGlyphs = (kind: DecideKind): string => {
  const lettered: readonly string[] = Object.values<string>(
    SPEC.options.kinds[kind].letters,
  );

  return lettered.length > 0
    ? lettered.join(" and ")
    : SPEC.options.kinds[kind].glyph;
};

/** Each kind's glyphs as the instructions write them: `🔘, 🔲, or 👍 and 👎`. */
export const glyphsInWords = (kinds: readonly DecideKind[]): string => {
  const glyphs = kinds.map(kindGlyphs);

  return glyphs.length > 1
    ? `${glyphs.slice(0, -1).join(", ")}, or ${glyphs.at(-1) ?? ""}`
    : glyphs.join("");
};

/** The letters an option takes, as the schema describes them: `A, B, C, or Y and N`. */
const lettersInWords = (): string => {
  const first = SPEC.reference.letters.first.charCodeAt(0);
  const binary: readonly string[] = Object.keys(SPEC.options.kinds.binary.letters);

  return `${[0, 1, 2].map((n) => String.fromCharCode(first + n)).join(", ")}, or ${binary.join(" and ")}`;
};

const { pro: PRO, con: CON } = SPEC.options;

/** Where a turn id comes from, for a turn id `length` characters long: `the first 8 characters`. */
export const turnIdSource = (length: number): string =>
  `the first ${length} characters`;

/** Where a turn id comes from, by the spec's length. */
const TURN_ID_SOURCE = turnIdSource(SPEC.reference["turn-id"].length);

/**
 * One Decide item of the tool's input. Its required fields are the ones
 * itemsOf won't do without; it fills in `list`, `ref` and a missing `kind`.
 */
export const ITEM_SCHEMA = {
  type: "object",
  required: ["turn", "number", "summary", "options"],
  properties: {
    turn: {
      type: "string",
      description: `The turn id, ${TURN_ID_SOURCE} of this turn's promptId.`,
    },
    list: { type: "string", enum: [DECIDE.header] },
    number: {
      type: "integer",
      description: "The item number in the Decide list.",
    },
    summary: { type: "string", description: "The item's bold summary." },
    kind: {
      type: "string",
      enum: KINDS,
      description: "From the item's option glyphs; radio when left out.",
    },
    ref: {
      type: "string",
      description: `\`<turn>.${DECIDE.header}.<number>\`; filled in when left out.`,
    },
    options: {
      type: "array",
      items: {
        type: "object",
        required: ["letter", "name"],
        properties: {
          letter: {
            type: "string",
            description: `The capital letter, ${lettersInWords()}.`,
          },
          name: { type: "string", description: "The option's bold name." },
          consequence: {
            type: "string",
            description: "What follows the name after its colon.",
          },
          pros: {
            type: "array",
            items: { type: "string" },
            description: `The option's ${PRO} lines, without the ${PRO}.`,
          },
          cons: {
            type: "array",
            items: { type: "string" },
            description: `The option's ${CON} lines, without the ${CON}.`,
          },
        },
      },
    },
  },
} as const;

/** The tool's whole input: the Decide items of the reply it comes before. */
export const INPUT_SCHEMA = {
  type: "object",
  required: ["items"],
  properties: { items: { type: "array", items: ITEM_SCHEMA } },
} as const;

/** What the tool does, as the engine lists it to the agent. */
export const TOOL_DESCRIPTION = [
  "Draws clickable buttons for this turn's Decide items in the transcript, just under the final response, and lists them in the plugin's Decide pane.",
  "Call it once, right before writing the final response, with every Decide item that response will hold, in the shape `outstanding.py decide --json` prints.",
  "A click writes the item's reference into the user's prompt draft; nothing is sent.",
].join(" ");

/** The instructions for the tool the agent calls as `tool`. */
export const instructionsFor = (tool: string): string =>
  [
    `The coding-agent-kanban-turns plugin draws clickable buttons for a final response's Decide items, through the tool \`${tool}\`.`,
    "",
    `- When: call \`${tool}\` once, right before writing a final response that holds Decide items, so their buttons sit just under the reply and in the Decide pane. Don't call it for a response without Decide items.`,
    '- Input: `{"items": [...]}`, one entry per Decide item of that response, in its order, each with:',
    `  - \`turn\`: the turn id, ${TURN_ID_SOURCE} of the latest prompt's promptId;`,
    "  - `number` and `summary`: the item's number in the Decide list and its bold summary;",
    `  - \`kind\`: ${kindsInWords}, from the item's option glyphs (${glyphsInWords(KINDS)});`,
    `  - \`options\`: each option's \`letter\`, \`name\` and \`consequence\`, and its ${PRO} and ${CON} lines, without the glyph, as \`pros\` and \`cons\`.`,
    `- A click on a button writes the answer's reference, such as \`0f311c94.${DECIDE.header}.2.B\`, into the user's prompt draft and sends nothing.`,
    "- Write the final response exactly as you would without the tool: the buttons add to it and replace nothing.",
  ].join("\n");

/** The instructions for the tool the plugin registers. */
export const INSTRUCTIONS = instructionsFor(TOOL_CALLED);

type Block = Readonly<{ name: string; text: string }>;

/** The context with the instructions as its last block, its other blocks kept as they were. */
export const withInstructions = <
  C extends Readonly<{ blocks: readonly Block[] }>,
>(
  context: C,
): C => ({
  ...context,
  blocks: [
    ...context.blocks.filter((block) => block.name !== BLOCK),
    { name: BLOCK, text: INSTRUCTIONS },
  ],
});
