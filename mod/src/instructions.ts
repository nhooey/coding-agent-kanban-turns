// What the mod tells the agent about its own tool: when to call it, what its
// input holds and what a click does. The turn-response format itself is the
// kanban skill's to teach.

/** The plugin's name, which the engine puts in its tools' names. */
export const PLUGIN = "coding-agent-kanban-turns";
/** The tool's name as the mod registers it. */
export const TOOL = "kanban_options";
/** The tool's name as the agent sees and calls it. */
export const TOOL_CALLED = `mcp__${PLUGIN}__${TOOL}`;
/** The context block the instructions go in, keyed by the mod's own name. */
export const BLOCK = "kanbanTurns";

/** The item kinds, in the order the instructions and the schema name them. */
export const KINDS = ["radio", "checkbox", "binary"] as const;

/** The kinds as the instructions write them: `radio`, `checkbox` or `binary`. */
const kindsInWords = [
  KINDS.slice(0, -1)
    .map((kind) => `\`${kind}\``)
    .join(", "),
  `\`${KINDS[KINDS.length - 1]}\``,
].join(" or ");

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
      description:
        "The turn id, the first 8 characters of this turn's promptId.",
    },
    list: { type: "string", enum: ["Decide"] },
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
      description: "`<turn>.Decide.<number>`; filled in when left out.",
    },
    options: {
      type: "array",
      items: {
        type: "object",
        required: ["letter", "name"],
        properties: {
          letter: {
            type: "string",
            description: "The capital letter, A, B, C, or Y and N.",
          },
          name: { type: "string", description: "The option's bold name." },
          consequence: {
            type: "string",
            description: "What follows the name after its colon.",
          },
          pros: {
            type: "array",
            items: { type: "string" },
            description: "The option's ➕ lines, without the ➕.",
          },
          cons: {
            type: "array",
            items: { type: "string" },
            description: "The option's ➖ lines, without the ➖.",
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
  "Draws clickable buttons for this turn's Decide items in the transcript, just under the final response, and lists them in the mod's Decide pane.",
  "Call it once, right before writing the final response, with every Decide item that response will hold, in the shape `outstanding.py decide --json` prints.",
  "A click writes the item's reference into the user's prompt draft; nothing is sent.",
].join(" ");

/** The instructions for the tool the agent calls as `tool`. */
export const instructionsFor = (tool: string): string =>
  [
    `The coding-agent-kanban-turns mod draws clickable buttons for a final response's Decide items, through the tool \`${tool}\`.`,
    "",
    `- When: call \`${tool}\` once, right before writing a final response that holds Decide items, so their buttons sit just under the reply and in the Decide pane. Don't call it for a response without Decide items.`,
    '- Input: `{"items": [...]}`, one entry per Decide item of that response, in its order, each with:',
    "  - `turn`: the turn id, the first 8 characters of the latest prompt's promptId;",
    "  - `number` and `summary`: the item's number in the Decide list and its bold summary;",
    `  - \`kind\`: ${kindsInWords}, from the item's option glyphs (🔘, 🔲, or 👍 and 👎);`,
    "  - `options`: each option's `letter`, `name` and `consequence`, and its ➕ and ➖ lines, without the glyph, as `pros` and `cons`.",
    "- A click on a button writes the answer's reference, such as `0f311c94.Decide.2.B`, into the user's prompt draft and sends nothing.",
    "- Write the final response exactly as you would without the tool: the buttons add to it and replace nothing.",
  ].join("\n");

/** The instructions for the tool the mod registers. */
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
