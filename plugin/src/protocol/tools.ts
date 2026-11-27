// The plugin's tools by name, and the two beside `kanban_options` that do
// what the kanban skill's scripts did: `kanban_outstanding`, its
// `outstanding.py`, and `kanban_lint`, its `lint_reply.py`. Their names,
// what the engine lists each as and their input schemas; what the agent's
// instructions say of them is spec/fragments/tools.md's. What each gives
// back is src/items/roll-up.ts's and src/lint/reply.ts's.

import { DECIDE } from "./rules.ts";
import { SPEC } from "./spec.ts";
import { field } from "../json/fields.ts";

/** The tools' names as the plugin registers them: the buttons', and the other two. */
export const OPTIONS_TOOL = "kanban_options";
export const OUTSTANDING_TOOL = "kanban_outstanding";
export const LINT_TOOL = "kanban_lint";

/** A tool's name as the agent sees and calls it: `mcp__<plugin>__<tool>`. */
export const calledAs = <P extends string, T extends string>(
  plugin: P,
  tool: T,
): `mcp__${P}__${T}` => `mcp__${plugin}__${tool}`;

const ROLL_UP = SPEC["roll-up"];

/** What `kanban_outstanding` does, as the engine lists it to the agent. */
export const OUTSTANDING_DESCRIPTION = [
  `Gives what earlier turns of this session leave open: the ${ROLL_UP.glyph} count line, a draft of the full roll-up with each item's ${SPEC.tag.glyph} tag, and the open ${DECIDE.header} items as the ${OPTIONS_TOOL} tool takes them.`,
  `Those ${DECIDE.header} items are only the ones raised through ${OPTIONS_TOOL}; an item a reply printed without calling it is in the count line and the roll-up alone.`,
  "Call it before writing a final response that closes on the roll-up or its count line, or that prints open items again.",
].join(" ");

/** What `kanban_lint` does, as the engine lists it to the agent. */
export const LINT_DESCRIPTION = [
  `Lints a draft final response against the turn-response format: its separator lines, its numbered items' summary lines, its ${DECIDE.header} options, its header underlines and where its tables go.`,
  "Call it with the draft before sending it, and fix every line it reports.",
].join(" ");

/** `kanban_outstanding` takes nothing. */
export const OUTSTANDING_SCHEMA = { type: "object", properties: {} } as const;

/** `kanban_lint` takes the draft. */
export const LINT_SCHEMA = {
  type: "object",
  required: ["text"],
  properties: {
    text: {
      type: "string",
      description: "The draft final response, whole, as it would be sent.",
    },
  },
} as const;

/** The draft a `kanban_lint` call hands over; none where its input holds no text, or text of whitespace alone. */
export const draftOf = (input: unknown): string | undefined => {
  const text = field(input, "text");

  return typeof text === "string" && text.trim() !== "" ? text : undefined;
};

/** What `kanban_lint` says to a call that hands over no draft. */
export const NO_DRAFT = `No draft was given, so there is nothing to lint: call ${LINT_TOOL} with the draft final response, whole, as {"text": "..."}.`;
