// What the mod tells the agent about its own tool: when to call it, what its
// input holds and what a click does. The turn-response format itself is the
// kanban skill's to teach.

/** The plugin's name, which the engine puts in its tools' names. */
export const PLUGIN = "coding-agent-kanban-answers";
/** The tool's name as the mod registers it. */
export const TOOL = "kanban_options";
/** The tool's name as the agent sees and calls it. */
export const TOOL_CALLED = `mcp__${PLUGIN}__${TOOL}`;
/** The context block the instructions go in, keyed by the mod's own name. */
export const BLOCK = "kanbanAnswers";

/** The instructions for the tool the agent calls as `tool`. */
export const instructionsFor = (tool: string): string =>
  [
    `The coding-agent-kanban-answers mod draws clickable buttons for a final response's Decide items, through the tool \`${tool}\`.`,
    "",
    `- When: call \`${tool}\` once, right before writing a final response that holds Decide items, so their buttons sit just above the reply. Don't call it for a response without Decide items.`,
    '- Input: `{"items": [...]}`, one entry per Decide item of that response, in its order, each with:',
    "  - `turn`: the turn id, the first 8 characters of the latest prompt's promptId;",
    "  - `number` and `summary`: the item's number in the Decide list and its bold summary;",
    "  - `kind`: `radio`, `checkbox` or `binary`, from the item's option glyphs (🔘, 🔲, or 👍 and 👎);",
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
