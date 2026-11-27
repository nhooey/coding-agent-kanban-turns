// What the plugin tells the agent: the whole turn-response format, and its
// own tool, when to call it, what its input holds and what a click does.
// The text is the prose fragments of spec/fragments/, assembled by
// prose.ts and filled in from the spec, so a session with the plugin and
// no skill learns the format; the derived skill assembles the same
// fragments.

import { FRAGMENTS } from "./fragments.ts";
import type { FragmentName } from "./fragments.ts";
import { lettersInWords } from "./kinds.ts";
import { assembled, placeholderValues } from "./prose.ts";
import { DECIDE, DEFAULT_KIND, DONE } from "./rules.ts";
import { SPEC } from "./spec.ts";
import {
  LINT_TOOL,
  OPTIONS_TOOL,
  OUTSTANDING_TOOL,
  calledAs,
} from "./tools.ts";
import type { DecideKind } from "../../types/index.d.ts";

/** The plugin's name, which the engine puts in its tools' names. */
export const PLUGIN = "coding-agent-kanban-turns";
/** The tool's name as the plugin registers it. */
export const TOOL = OPTIONS_TOOL;
/** The tool's name as the agent sees and calls it. */
export const TOOL_CALLED = calledAs(PLUGIN, TOOL);
/** The other tools as the agent calls them. */
export const OUTSTANDING_CALLED = calledAs(PLUGIN, OUTSTANDING_TOOL);
export const LINT_CALLED = calledAs(PLUGIN, LINT_TOOL);
/** The context block the instructions go in, keyed by the plugin's own name. */
export const BLOCK = "kanbanTurns";
/**
 * The skill the plugin carries, as Claude Code names a plugin's skill: the
 * plugin's name, a colon and the spec's skill name. Its Skill tool use or
 * slash command loads the same format the instructions hold.
 */
export const PLUGIN_SKILL = `${PLUGIN}:${SPEC.skill.name}`;

/**
 * The item kinds the tool takes, in the spec's order: every kind it reads,
 * a kind the instructions no longer teach among them, so the schema
 * describes what the plugin reads and the instructions what it teaches.
 */
export const KINDS = Object.keys(SPEC.options.kinds) as readonly DecideKind[];

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
      description: `The item number in the ${DECIDE.header} list.`,
    },
    summary: { type: "string", description: "The item's bold summary." },
    kind: {
      type: "string",
      enum: KINDS,
      description: `From the item's option glyphs; ${DEFAULT_KIND} when left out.`,
    },
    ref: {
      type: "string",
      description: `\`<turn>.${DECIDE.header}.<number>\`; filled in when left out.`,
    },
    frees: {
      type: "array",
      items: { type: "string" },
      description: `The references the item's \`${SPEC.frees.label}:\` line names, each \`<turn>.<List>.<n>\`.`,
    },
    supersedes: {
      type: "array",
      items: { type: "string" },
      description: `The earlier ${DECIDE.header} items this one restates and replaces, a list, \`["<turn>.${DECIDE.header}.<n>"]\`; left out, or naming no item, an earlier item on the same subject is the one replaced, and \`[]\` replaces none.`,
    },
    options: {
      type: "array",
      items: {
        type: "object",
        required: ["letter", "name"],
        properties: {
          letter: {
            type: "string",
            description: `The capital letter, ${lettersInWords(SPEC.options.kinds, SPEC.reference.letters.first)}.`,
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
  `Draws clickable buttons for this turn's ${DECIDE.header} items in the transcript, just under the final response, and lists them in the plugin's pane, beside every other list's items.`,
  `Call it once, right before writing the final response, with every ${DECIDE.header} item that response will hold, in its order: each item's turn id, number, summary, kind, frees and supersedes, and each option's letter, name, consequence, pros and cons.`,
  `An item that restates an earlier turn's ${DECIDE.header} item names it in supersedes, \`<turn>.${DECIDE.header}.<n>\`, which moves the earlier one to ${DONE.header}.`,
  `\`${OUTSTANDING_TOOL}\` gives earlier turns' open ${DECIDE.header} items in this shape.`,
  "A click writes the item's reference into the user's prompt draft; nothing is sent.",
].join(" ");

/**
 * The fragments the instructions hold, in their order: the line naming the
 * plugin's skill as the block's content, so the agent needn't load it, then
 * the title, the format, then the plugin's buttons' tool and its other two.
 * The derived skill holds the title and the format too, with its scripts in
 * place of the tools, and its description names the block's line.
 */
export const INSTRUCTION_FRAGMENTS: readonly FragmentName[] = [
  "block",
  "title",
  "overview",
  "progress-updates",
  "lists",
  "shape",
  "decide-items",
  "frees",
  "answers",
  "roll-up",
  "commands",
  "around",
  "tool",
  "tools",
];

/**
 * The instructions, for the buttons' tool the agent calls as `tool` and
 * the other two as `outstanding` and `lint`: the format's fragments and the
 * tools', filled in from the spec.
 */
export const instructionsFor = (
  tool: string,
  outstanding: string = OUTSTANDING_CALLED,
  lint: string = LINT_CALLED,
): string =>
  assembled(
    FRAGMENTS,
    INSTRUCTION_FRAGMENTS,
    placeholderValues(SPEC, {
      plugin: PLUGIN,
      tool,
      "outstanding-tool": outstanding,
      "lint-tool": lint,
      "roll-up-drafter": `The tool \`${outstanding}\` drafts`,
    }),
  );

/** The instructions for the tools the plugin registers. */
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
