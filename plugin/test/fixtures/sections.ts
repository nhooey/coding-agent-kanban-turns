// A test helper: a reply's sections as text, each a list's name and its
// lines joined, trailing blank lines trimmed, as sectionsIn reads them from
// the reply's blocks. The tests of sections and the golden cases compare
// sections as text; the core reads their blocks.

import { parseReply, sectionsIn } from "../../src/transcript/reply.ts";

/** One section of a reply: its list's name as the header writes it, and its text, the header first. */
export type Section = Readonly<{ name: string; text: string }>;

/** Each section of one reply text, in order, as text. */
export const sectionsOf = (text: string): readonly Section[] =>
  sectionsIn(parseReply(text)).map(({ name, blocks }) => ({
    name,
    text: blocks
      .flatMap((block) => block.lines)
      .join("\n")
      .trimEnd(),
  }));
