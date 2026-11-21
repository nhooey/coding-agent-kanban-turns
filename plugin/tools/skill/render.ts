// The skill the plugin carries, derived from it: its SKILL.md, the prose
// fragments that teach the format assembled and filled in from the spec,
// as the instructions are, with the CLI's scripts in place of the plugin's
// tools; and its worked examples, one per golden case that keeps every
// rule. Pure: tools/skill/build.ts reads the cases and writes the files,
// and the flake puts the CLI's builds beside them, under scripts/.
//
// A worked example draws only the option kinds the instructions teach: a
// case that draws another, such as the binary kind's 👍 and 👎, breaks a
// rule the lint checks, so it is marked `example: false`, and the build
// refuses an example that isn't.

import { stringify } from "yaml";

import { USAGE } from "../../cli/run.ts";
import type { Command } from "../../cli/run.ts";
import { lintReply } from "../../src/lint/reply.ts";
import { FRAGMENTS } from "../../src/protocol/fragments.ts";
import type { FragmentName } from "../../src/protocol/fragments.ts";
import { PLUGIN, TOOL_CALLED } from "../../src/protocol/instructions.ts";
import { taughtKinds } from "../../src/protocol/kinds.ts";
import { filled, placeholderValues } from "../../src/protocol/prose.ts";
import type { OwnValues } from "../../src/protocol/prose.ts";
import { SPEC } from "../../src/protocol/spec.ts";
import type { Owner } from "../../types/index.d.ts";
import { CASES_DIR } from "../spec/cases.ts";
import type { CaseTurn, GoldenCase } from "../spec/cases.ts";

/** The skill's name, its folder's and its frontmatter's, as the spec gives it. */
export const SKILL_NAME: string = SPEC.skill.name;

/** The skill's own file, and the folder its worked examples go in, in the skill's folder. */
export const SKILL_FILE = "SKILL.md";
export const EXAMPLES_DIR = "examples";

/** The script the skill runs the core with, by its path in the skill's folder. */
export const SCRIPT = "scripts/kanban.js";

/** The script's commands that draft the roll-up: its count line and the full roll-up. */
const ROLL_UP_COMMANDS: readonly Command[] = ["count", "rollup"];

/**
 * The fragments SKILL.md holds, in their order: the title and the format,
 * as the instructions hold them, with the skill's preferences files loaded
 * after the overview, then the skill's scripts and its worked examples.
 * The block's line and the plugin's tools stay out: the skill is no block,
 * and it runs the scripts where the plugin has its tools. The preferences
 * stay out of the instructions: nothing in the plugin reads those files.
 */
export const SKILL_FRAGMENTS: readonly FragmentName[] = [
  "title",
  "overview",
  "preferences",
  "progress-updates",
  "lists",
  "shape",
  "decide-items",
  "frees",
  "answers",
  "roll-up",
  "commands",
  "around",
  "scripts",
  "examples",
];

/** The fragment the skill's description, in its frontmatter, is. */
export const SKILL_DESCRIPTION: FragmentName = "skill-description";

/** The plugin's own values, for the skill: its script in place of the tools that read and check final responses. */
export const SKILL_OWN: OwnValues = {
  plugin: PLUGIN,
  tool: TOOL_CALLED,
  "outstanding-tool": SCRIPT,
  "lint-tool": SCRIPT,
  "roll-up-drafter": `The commands ${ROLL_UP_COMMANDS.map((command) => `\`${command}\``).join(" and ")} of \`${SCRIPT}\` draft`,
};

const VALUES = placeholderValues(SPEC, SKILL_OWN);

/** A golden case and its file's name, `every-list.yaml`. */
export type NamedCase = Readonly<{ name: string; golden: GoldenCase }>;

/** What skillFiles gives: each file's text by its path in the skill's folder, or why the skill can't be built. */
export type Built = Readonly<
  { files: Readonly<Record<string, string>> } | { problems: readonly string[] }
>;

/** A worked example's file, by its case's file name: `examples/every-list.md`. */
export const exampleFile = (name: string): string =>
  `${EXAMPLES_DIR}/${name.replace(/\.yaml$/, "")}.md`;

/** The cases a worked example is made from: those not marked `example: false`, in their order. */
export const examplesOf = (cases: readonly NamedCase[]): readonly NamedCase[] =>
  cases.filter(({ golden }) => golden.example !== false);

/** The longest run of backticks in `text`; 0 for none. */
const longestTicks = (text: string): number =>
  Math.max(0, ...[...text.matchAll(/`+/g)].map((run) => run[0].length));

/** `text` in a fenced block with `info` as its info string, its fence one backtick longer than any run in the text, and 3 at least. */
export const fenced = (text: string, info: string = "text"): string => {
  const fence = "`".repeat(Math.max(3, longestTicks(text) + 1));

  return `${fence}${info}\n${text}\n${fence}`;
};

/** Skill frontmatter: each field as YAML, every value on one line, between `---` lines. */
export const frontmatterOf = (fields: Readonly<Record<string, string>>): string =>
  `---\n${stringify(fields, { lineWidth: 0 })}---\n`;

const TAUGHT = taughtKinds(SPEC.options.kinds);

/** Where a case draws an option kind the instructions don't teach: an item of that kind, or a reply's option line drawn with it. */
export const untaughtUses = (golden: GoldenCase): readonly string[] =>
  golden.turns.flatMap((turn, at) => [
    ...(turn.decide ?? []).flatMap((item, n) =>
      Object.hasOwn(TAUGHT, item.kind)
        ? []
        : [`turns[${at}].decide[${n}] is a ${item.kind} item, a kind the instructions don't teach`],
    ),
    ...turn.replies.flatMap((reply, n) =>
      lintReply(reply.text)
        .filter((finding) => finding.rule === "untaught-option")
        .map(
          (finding) =>
            `turns[${at}].replies[${n}] line ${finding.line} draws an option of a kind the instructions don't teach`,
        ),
    ),
  ]);

/** Each worked example's untaught kinds, naming its file, and how to make it no example. */
export const exampleProblems = (cases: readonly NamedCase[]): readonly string[] =>
  examplesOf(cases).flatMap(({ name, golden }) =>
    untaughtUses(golden).map(
      (use) => `${CASES_DIR}/${name}: ${use}; mark the case example: false`,
    ),
  );

/** Who wrote a prompt or a message, as an example names them. */
const WRITERS: Readonly<Record<Owner, string>> = {
  user: "the user",
  "this-plugin": `the user, through the ${PLUGIN} pane`,
  "other-plugin": "another plugin",
  peer: "a peer, an agent or another session",
  notification: "a task's notification",
  scheduled: "a schedule",
};

/** What a report names, where it names anything: `, naming `b8a83gfv0` as the work it reports on`. */
const reporting = (names: readonly string[] | undefined): string =>
  names === undefined
    ? ""
    : `, naming ${names.map((name) => `\`${name}\``).join(", ")} as the work it reports on`;

/** A reply's label: a response on the way, or the turn's final response, its last. */
const replyLabel = (n: number, count: number): string =>
  n === count - 1 ? "The final response:" : `Response ${n + 1} of ${count}, on the way:`;

/** One turn of an example: its id, its prompt and who wrote it, the command it runs, its responses and the messages sent while it ran. */
const turnText = (turn: CaseTurn, at: number): string =>
  [
    `## Turn ${at + 1}, \`${turn.id}\``,
    `The prompt, from ${WRITERS[turn.owner ?? "user"]}${reporting(turn["report-names"])}:`,
    fenced(turn.prompt),
    ...(turn.runs === undefined ? [] : [`This prompt runs \`${turn.runs}\`.`]),
    ...turn.replies.flatMap((reply, n) => [
      replyLabel(n, turn.replies.length),
      fenced(reply.text.trimEnd()),
    ]),
    ...(turn.messages ?? []).flatMap((message) => [
      `Sent while the turn ran, from ${WRITERS[message.owner]}${reporting(message["report-names"])}:`,
      fenced(message.text),
    ]),
  ].join("\n\n");

/** References as a line of code spans, or `none`. */
const refs = (list: readonly string[]): string =>
  list.length === 0 ? "none" : list.map((ref) => `\`${ref}\``).join(", ");

/** What each item frees, a line per item, under its label; nothing where none frees anything. */
const freesLines = (label: string, frees: Readonly<Record<string, readonly string[]>> | undefined): readonly string[] =>
  Object.entries(frees ?? {}).map(([ref, freed]) => `- **${label} \`${ref}\`:** ${refs(freed)}`);

const ROLL_UP = SPEC["roll-up"];

/**
 * What the plugin's core gives for the whole transcript, after its last
 * turn, of what a reply alone settles: what is outstanding, the count line
 * and what each item's line frees. The open Decide items, and what they
 * free, are read from the calls to the plugin's buttons, which the skill
 * doesn't teach, so they stay out.
 */
const outcomeText = (golden: GoldenCase): string => {
  const outcome = golden.expect;

  return [
    "## What the plugin's core gives",
    [
      outcome.outstanding.length === 0
        ? `- **Outstanding under ${ROLL_UP.glyph}:** none`
        : [
            `- **Outstanding under ${ROLL_UP.glyph}:**`,
            ...outcome.outstanding.map((item) => `  - ${item}`),
          ].join("\n"),
      outcome.counts === ""
        ? "- **The count line:** none, since nothing is outstanding"
        : `- **The count line:** \`${outcome.counts}\``,
      ...freesLines("What frees", outcome.frees),
    ].join("\n"),
  ].join("\n\n");
};

/** A worked example: the case's name and title, each turn, then what the core gives for them. */
export const exampleText = ({ name, golden }: NamedCase): string =>
  `${[
    `# ${name.replace(/\.yaml$/, "")}`,
    golden.title.trim(),
    ...golden.turns.map(turnText),
    outcomeText(golden),
  ].join("\n\n")}\n`;

/** The worked examples' list, a link and the title of each. */
const examplesList = (cases: readonly NamedCase[]): string =>
  examplesOf(cases)
    .map(({ name, golden }) => `- [${exampleFile(name)}](${exampleFile(name)}): ${golden.title.trim()}`)
    .join("\n");

/** What follows a fragment in SKILL.md, by its name: the CLI's usage after the scripts, the examples' list after their fragment. */
const appendices = (cases: readonly NamedCase[]): Readonly<Partial<Record<FragmentName, string>>> => ({
  scripts: fenced(USAGE),
  examples: examplesList(cases),
});

/** SKILL.md: its frontmatter, then each of its fragments, filled from the spec, with what follows it. */
export const skillText = (cases: readonly NamedCase[]): string => {
  const after = appendices(cases);

  return `${frontmatterOf({
    name: SKILL_NAME,
    description: filled(FRAGMENTS[SKILL_DESCRIPTION], VALUES).trim(),
  })}\n${SKILL_FRAGMENTS.map((name) =>
    [filled(FRAGMENTS[name], VALUES).trimEnd(), ...(after[name] === undefined ? [] : [after[name]])].join("\n\n"),
  ).join("\n\n")}\n`;
};

/** The skill's text files, SKILL.md and each worked example, by their paths in its folder; or, where a worked example draws an untaught kind, each such use. */
export const skillFiles = (cases: readonly NamedCase[]): Built => {
  const problems = exampleProblems(cases);

  return problems.length > 0
    ? { problems }
    : {
        files: Object.fromEntries([
          [SKILL_FILE, skillText(cases)],
          ...examplesOf(cases).map((named) => [exampleFile(named.name), exampleText(named)] as const),
        ]),
      };
};
