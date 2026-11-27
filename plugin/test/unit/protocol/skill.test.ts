// The derived skill, tools/skill/render.ts: its SKILL.md, assembled from the
// prose fragments and filled in from the spec, and its worked examples,
// rendered from the golden cases that keep every rule.

import { describe, test } from "node:test";
import { expect } from "expect";
import { parse } from "yaml";

import { USAGE } from "../../../cli/run.ts";
import { lintReply } from "../../../src/harness/reply-lint.ts";
import { FRAGMENTS } from "../../../src/protocol/fragments.ts";
import {
  INSTRUCTIONS,
  INSTRUCTION_FRAGMENTS,
  OUTSTANDING_CALLED,
  PLUGIN,
  PLUGIN_SKILL,
} from "../../../src/protocol/instructions.ts";
import { filled, placeholderValues, unusedFragments } from "../../../src/protocol/prose.ts";
import { SPEC } from "../../../src/protocol/spec.ts";
import { LINT_TOOL, OPTIONS_TOOL, OUTSTANDING_TOOL } from "../../../src/protocol/tools.ts";
import { SKILL_COMMANDS } from "../../../src/harness/turns.ts";
import {
  SKILL_DESCRIPTION,
  SKILL_FILE,
  SKILL_FRAGMENTS,
  SKILL_NAME,
  SKILL_OWN,
  exampleFile,
  exampleText,
  examplesOf,
  fenced,
  frontmatterOf,
  skillFiles,
} from "../../../tools/skill/render.ts";
import type { NamedCase } from "../../../tools/skill/render.ts";
import type { GoldenCase } from "../../../tools/spec/cases.ts";
import { goldenCases } from "../../fixtures/cli.ts";

const CASES: readonly NamedCase[] = goldenCases();
const VALUES = placeholderValues(SPEC, SKILL_OWN);

/** The files the skill is made of. */
const FILES: Readonly<Record<string, string>> = skillFiles(CASES);
const SKILL = FILES[SKILL_FILE] ?? "";

/** Every fenced block's body in a Markdown text, fences of 3 or more backticks. */
const fencedBlocks = (text: string): readonly string[] =>
  [...text.matchAll(/^(`{3,})[^\n]*\n([\s\S]*?)^\1$/gm)].map((match) => match[2] ?? "");

/** A one-turn case raising a radio Decide item, its one option lettered `A`. */
const caseWith = (example?: boolean): GoldenCase => ({
  title: "One Decide item",
  ...(example === undefined ? {} : { example }),
  turns: [
    {
      id: "9efb08a1",
      prompt: "Pick one.",
      replies: [
        {
          text: [
            "🧠 **Decide:**  ",
            "▔▔▔▔▔▔▔▔▔▔",
            "1. **Ship tonight?**  ",
            "   🔘 A. **Ship it**: it goes out.",
            "      ➕ Users get it.",
            "      ➖ Risk.",
            "",
          ].join("\n"),
          lint: [],
        },
      ],
      decide: [{ number: 1, summary: "Ship tonight?", kind: "radio", options: [{ letter: "A", name: "Ship it" }] }],
    },
  ],
  expect: { open: ["9efb08a1.Decide.1"], outstanding: [], counts: "" },
});

describe("the skill's fragments", () => {
  test("with the instructions', are every fragment, each used", () => {
    expect(
      unusedFragments(Object.keys(FRAGMENTS), [INSTRUCTION_FRAGMENTS, SKILL_FRAGMENTS, [SKILL_DESCRIPTION]]),
    ).toEqual([]);
  });

  test("leave out the block's line and the plugin's tools, which the skill has not", () => {
    expect(SKILL_FRAGMENTS).not.toContain("block");
    expect(SKILL_FRAGMENTS).not.toContain("tool");
    expect(SKILL_FRAGMENTS).not.toContain("tools");
  });

  test("the skill's own stay out of the instructions", () => {
    ["scripts", "examples", "skill-description", "preferences"].forEach((name) =>
      expect(INSTRUCTION_FRAGMENTS).not.toContain(name),
    );
  });
});

describe("skillFiles", () => {
  test("gives SKILL.md and one example per worked example, and nothing else", () => {
    expect(Object.keys(FILES).toSorted()).toEqual(
      [SKILL_FILE, ...examplesOf(CASES).map(({ name }) => exampleFile(name))].toSorted(),
    );
  });
});

describe("SKILL.md", () => {
  test("opens on frontmatter in the form skills take, its name the folder's", () => {
    const front = SKILL.match(/^---\n([\s\S]*?)\n---\n/);

    expect(front).not.toBeNull();
    expect(parse(front?.[1] ?? "")).toEqual({
      name: SKILL_NAME,
      description: filled(FRAGMENTS[SKILL_DESCRIPTION], VALUES).trim(),
    });
  });

  test("is named for a skill whose slash command runs a command after it, bare and after the plugin's name", () => {
    expect(SKILL_COMMANDS).toContain(SKILL_NAME);
    expect(SKILL_COMMANDS).toContain(`${PLUGIN}:${SKILL_NAME}`);
  });

  test("has a description of 1024 characters at most, as skills allow, that never says to load it every turn", () => {
    const description = filled(FRAGMENTS[SKILL_DESCRIPTION], VALUES).trim();

    expect(description.length).toBeLessThanOrEqual(1024);
    expect(description).not.toMatch(/every turn|before the first response/i);
  });

  test("has a description that defers to the hooks: load this skill only where the conversation holds no block opening on the instructions' first line", () => {
    const description = filled(FRAGMENTS[SKILL_DESCRIPTION], VALUES).trim();
    const opening = `This block is the \`${PLUGIN_SKILL}\` skill's format`;

    expect(INSTRUCTIONS.startsWith(opening)).toBe(true);
    expect(description).toContain(opening);
    expect(description).toMatch(/Load this skill only where the conversation holds no block/);
  });

  test("loads both preferences files, the user's beside its folder and the project's, a missing one skipped", () => {
    expect(SKILL).toContain(
      `!\`cat "\${CLAUDE_SKILL_DIR}/../${SKILL_NAME}.preferences.md" "\${CLAUDE_PROJECT_DIR}/.agents/skills/${SKILL_NAME}.preferences.md" 2>/dev/null || true\``,
    );
    expect(SKILL).toContain("## Your preferences");
  });

  test("the preferences stay out of the instructions, since nothing in the plugin reads those files", () => {
    expect(INSTRUCTION_FRAGMENTS).not.toContain("preferences");
    expect(INSTRUCTIONS).not.toContain(".preferences.md");
  });

  test("runs its script by its path in the skill's folder, as Claude Code names the folder", () => {
    expect(SKILL).toContain('node "${CLAUDE_SKILL_DIR}/scripts/kanban.js"');
  });

  test("holds every list's header, as a final response writes it, and the roll-up's", () => {
    Object.values(SPEC.lists).forEach((list) => expect(SKILL).toContain(`${list.glyph} **${list.header}:**`));
    expect(SKILL).toContain(`${SPEC["roll-up"].glyph} **${SPEC["roll-up"].header}:**`);
  });

  test("holds each of its fragments, filled from the spec, in their order, and no placeholder", () => {
    const at = SKILL_FRAGMENTS.map((name) => SKILL.indexOf(filled(FRAGMENTS[name], VALUES).trimEnd()));

    expect(at.filter((n) => n < 0)).toEqual([]);
    expect(at).toEqual(at.toSorted((a, b) => a - b));
    expect(SKILL).not.toContain("{{");
  });

  test("names the script's commands where the instructions name the tool that drafts the roll-up", () => {
    expect(SKILL).toContain("The commands `count` and `rollup` of `scripts/kanban.js` draft both from the session's transcript");
    expect(INSTRUCTIONS).toContain(`The tool \`${OUTSTANDING_CALLED}\` drafts both from the session's transcript`);
  });

  test("names its scripts, not the plugin's tools, in SKILL.md or any worked example", () => {
    expect(SKILL).toContain("`scripts/kanban.js`");
    expect(
      Object.entries(FILES).flatMap(([path, text]) =>
        [OPTIONS_TOOL, OUTSTANDING_TOOL, LINT_TOOL].filter((tool) => text.includes(tool)).map((tool) => `${path}: ${tool}`),
      ),
    ).toEqual([]);
  });

  test("holds the CLI's usage, as --help prints it", () => {
    expect(SKILL).toContain(fenced(USAGE));
  });

  test("links each worked example by its file", () => {
    examplesOf(CASES).forEach(({ name, golden }) => {
      expect(SKILL).toContain(`[${exampleFile(name)}](${exampleFile(name)})`);
      expect(SKILL).toContain(golden.title.trim());
    });
  });

  test("ends on one line break", () => {
    expect(SKILL.endsWith("\n")).toBe(true);
    expect(SKILL.endsWith("\n\n")).toBe(false);
  });
});

describe("the worked examples", () => {
  test("hold each prompt and response as written, and what the core gives", () => {
    examplesOf(CASES).forEach(({ name, golden }) => {
      const text = FILES[exampleFile(name)] ?? "";

      golden.turns.forEach((turn) => {
        expect(text).toContain(fenced(turn.prompt));
        turn.replies.forEach((reply) => expect(text).toContain(fenced(reply.text.trimEnd())));
      });
      golden.expect.outstanding.forEach((item) => expect(text).toContain(`  - ${item}`));
      if (golden.expect.counts !== "") {
        expect(text).toContain(`\`${golden.expect.counts}\``);
      }
    });
  });

  test("leave out the open Decide items and what they free, which the calls the skill doesn't teach raise", () => {
    expect(Object.values(FILES).filter((text) => /Open Decide items|What Decide frees/.test(text))).toEqual([]);
  });

  test("give responses the lint finds nothing in", () => {
    expect(
      examplesOf(CASES).flatMap(({ name, golden }) =>
        golden.turns.flatMap((turn) =>
          turn.replies.flatMap((reply) => (lintReply(reply.text).length === 0 ? [] : [name])),
        ),
      ),
    ).toEqual([]);
  });
});

describe("examplesOf", () => {
  test("keeps a case unmarked or marked example: true, and drops one marked false", () => {
    const named = (name: string, example?: boolean): NamedCase => ({
      name,
      golden: caseWith(example),
    });

    expect(examplesOf([named("a.yaml"), named("b.yaml", false), named("c.yaml", true)]).map(({ name }) => name)).toEqual([
      "a.yaml",
      "c.yaml",
    ]);
  });
});

describe("exampleFile", () => {
  test("is the case's name under examples/, as Markdown", () => {
    expect(exampleFile("every-list.yaml")).toBe("examples/every-list.md");
  });
});

describe("fenced", () => {
  test("fences text in 3 backticks, with its info string", () => {
    expect(fenced("a\nb")).toBe("```text\na\nb\n```");
    expect(fenced("a", "markdown")).toBe("```markdown\na\n```");
  });

  test("fences text holding a fence in one backtick more than its longest run", () => {
    expect(fenced("```text\nx\n```")).toBe("````text\n```text\nx\n```\n````");
    expect(fenced("`````")).toBe("``````text\n`````\n``````");
  });
});

describe("frontmatterOf", () => {
  test("writes each field as YAML, a long description on one line, between --- lines", () => {
    const description = `${"word ".repeat(40)}with a colon: and "quotes"`;
    const text = frontmatterOf({ name: "a-skill", description });

    expect(text.startsWith("---\nname: a-skill\ndescription: ")).toBe(true);
    expect(text.endsWith("\n---\n")).toBe(true);
    expect(text.split("\n")).toHaveLength(5);
    expect(parse(text.slice(4, -4))).toEqual({ name: "a-skill", description });
  });
});

describe("exampleText", () => {
  const golden = caseWith();
  const text = exampleText({ name: "one-item.yaml", golden });

  test("opens on the case's name, then its title", () => {
    expect(text.startsWith("# one-item\n\nOne Decide item\n")).toBe(true);
  });

  test("gives each turn its id and who wrote its prompt", () => {
    expect(text).toContain("## Turn 1, `9efb08a1`");
    expect(text).toContain("The prompt, from the user:");
  });

  test("says when nothing is outstanding, and names no open Decide item", () => {
    expect(text).toContain("- **The count line:** none, since nothing is outstanding");
    expect(text).not.toContain("`9efb08a1.Decide.1`");
  });

  test("gives a message sent while a turn ran, who sent it and what it reports on", () => {
    const reported = exampleText({
      name: "m.yaml",
      golden: {
        ...golden,
        turns: golden.turns.map((turn) => ({
          ...turn,
          messages: [{ owner: "notification", text: "<task-notification/>", "report-names": ["b8a83gfv0"] }],
        })),
      },
    });

    expect(reported).toContain(
      "Sent while the turn ran, from a task's notification, naming `b8a83gfv0` as the work it reports on:\n\n```text\n<task-notification/>\n```",
    );
  });

  test("names the command a prompt runs", () => {
    const reassessed = exampleText({
      name: "r.yaml",
      golden: { ...golden, turns: golden.turns.map((turn) => ({ ...turn, prompt: "reassess", runs: "reassess" })) },
    });

    expect(reassessed).toContain("This prompt runs `reassess`.");
  });
});
