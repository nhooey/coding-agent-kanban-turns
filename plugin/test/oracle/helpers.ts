// The differential tests' oracle for the helpers the core once wrote in
// several modules: the functions that held a copy, as they stood at
// fc64639, before `escaped` moved to src/text/patterns.ts and `branchSpans`
// to src/transcript/reports.ts. test/unit/text/patterns-differential.test.ts
// and test/unit/transcript/branch-spans-differential.test.ts compare the
// core against them.
//
// Temporary: the oracle and its tests are deleted once `core-shared-helpers`
// has merged into `master`.

// src/protocol/rules.ts

/** Text as a regular expression, `u` flag or not, matches it literally. */
export const escaped = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// src/transcript/reports.ts

/** Whether `text` holds `name` as a whole word, ignoring case; a word may hold hyphens, as a branch name does. */
export const namesWord = (name: string, text: string): boolean =>
  name.trim() !== "" &&
  new RegExp(
    String.raw`(?<![\p{L}\p{N}_-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\p{L}\p{N}_-])`,
    "iu",
  ).test(text);

const SPAN = /`([^`]+)`/g;
const BRANCH = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;

/**
 * Whether a report names a Waiting item: the item's summary holds one of the
 * report's names, or the report holds a code span of the summary shaped like
 * a branch name.
 */
export const reportNamesItem = (
  summary: string,
  names: readonly string[],
  report: string,
): boolean =>
  names.some((name) => namesWord(name, summary)) ||
  [...summary.matchAll(SPAN)]
    .map((m) => m[1] ?? "")
    .filter((span) => BRANCH.test(span))
    .some((branch) => namesWord(branch, report));

// src/items/outstanding.ts

const ENTRY = /\bentr(?:y|ies)\s+(\d{3,4})\b/i;
const STOP_WORDS: readonly string[] =
  "a an and at by for from in is its of on the to with".split(" ");
const KEY_WORDS = 3;

/** The text with everything but letters and digits gone, lowercased. */
const normal = (text: string): string =>
  text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * The key that matches an item across rewordings of its summary: `entry 1411`
 * where the summary names a backlog entry, else `branch atomic-reload` for its
 * first code span shaped like a branch name, else its first 3 words that are
 * not articles or prepositions, lowercased.
 */
export const subjectKey = (summary: string): string => {
  const entry = ENTRY.exec(summary)?.[1];
  const branch = [...summary.matchAll(SPAN)]
    .map((m) => m[1] ?? "")
    .find((span) => BRANCH.test(span));
  const words = (summary.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (word) => !STOP_WORDS.includes(word),
  );

  return entry !== undefined
    ? `entry ${entry}`
    : branch !== undefined
      ? `branch ${branch}`
      : words.length > 0
        ? words.slice(0, KEY_WORDS).join(" ")
        : normal(summary);
};
