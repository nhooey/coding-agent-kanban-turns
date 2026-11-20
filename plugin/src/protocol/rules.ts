// What the core derives from the protocol's spec in more than one place:
// the pieces of the reference grammar as patterns, a list's names, an
// item's label. The spec itself is src/protocol/spec.ts, generated from
// spec/kanban.yaml; this module only reads it.

import { SPEC } from "./spec.ts";

/** Text as a regular expression, `u` flag or not, matches it literally. */
export const escaped = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Characters as a character class, `[…]`, `u` flag or not, holds each of them and nothing more. */
export const classOf = (chars: string): string =>
  `[${chars.replace(/[\\\]^-]/g, "\\$&")}]`;

/** The Decide list, whose items the plugin draws. */
export const DECIDE = SPEC.lists.decide;

/** The Done list, whose name the pane gives the items settled. */
export const DONE = SPEC.lists.done;

/** The command a draft's last line names to work the open items out afresh. */
export const REASSESS = "reassess" satisfies keyof typeof SPEC.commands.names;

/** The kind an item is when its kind isn't given: one option chosen. */
export const DEFAULT_KIND = "radio" satisfies keyof typeof SPEC.options.kinds;

/** A list's names: its header, then the aliases older replies carry. */
export const namesOf = (
  list: Readonly<{ header: string; aliases: readonly string[] }>,
): readonly string[] => [list.header, ...list.aliases];

/** A Decide item's label, its list's glyph and its reference without the turn: `🧠 Decide.2`. */
export const itemLabel = (number: number): string =>
  `${DECIDE.glyph} ${DECIDE.header}.${number}`;

const TURN = SPEC.reference["turn-id"];

/** A pattern for one character of a turn id. */
export const TURN_ID_CHAR = classOf(TURN.alphabet);

/** A pattern for a whole turn id: `[0-9a-f]{8}`. */
export const TURN_ID = `${TURN_ID_CHAR}{${TURN.length}}`;

/** A pattern for a turn id or a prefix long enough to name it: `[0-9a-f]{6,8}`. */
export const TURN_ID_PREFIX = `${TURN_ID_CHAR}{${TURN.shortest},${TURN.length}}`;

/** A pattern for one option letter: `[A-Z]`. */
export const LETTER = `[${SPEC.reference.letters.first}-${SPEC.reference.letters.last}]`;

/** A pattern for one character of a 🔖 tag's subscript index. */
export const SUBSCRIPT_CHAR = classOf(SPEC.tag.digits + SPEC.tag.minus);

/** Whether a line is `char` repeated alone, as an underline or a topic header's rule is. */
export const isLineOf = (char: string, line: string): boolean =>
  line.trim() !== "" && [...line.trim()].every((c) => c === char);
