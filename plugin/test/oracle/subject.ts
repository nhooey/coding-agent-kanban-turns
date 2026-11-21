// The differential tests' oracle for an item's subject key and a report's
// names: `subjectKey`, and the readers `reportNamesItem` reads a report's
// names and a summary's branch spans with, as they stood at 4074f13, before
// their stop words, key words, backlog entry and branch shape moved into
// spec/kanban.yaml's `subject`. test/unit/items/subject-differential.test.ts
// compares the core against them.
//
// Temporary: the oracle and its test are deleted once `spec-subject-key`
// has merged into `master`.

// src/transcript/reports.ts

/** Text as a regular expression, `u` flag or not, matches it literally. */
const escaped = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether `text` holds `name` as a whole word, ignoring case; a word may hold hyphens, as a branch name does. */
export const namesWord = (name: string, text: string): boolean =>
  name.trim() !== "" &&
  new RegExp(
    String.raw`(?<![\p{L}\p{N}_-])${escaped(name)}(?![\p{L}\p{N}_-])`,
    "iu",
  ).test(text);

const SPAN = /`([^`]+)`/g;
const BRANCH = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;

/** The text's code spans shaped like a branch name, lowercase words joined by hyphens, in order. */
export const branchSpans = (text: string): readonly string[] =>
  [...text.matchAll(SPAN)]
    .map((m) => m[1] ?? "")
    .filter((span) => BRANCH.test(span));

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
  branchSpans(summary).some((branch) => namesWord(branch, report));

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
  const branch = branchSpans(summary)[0];
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
