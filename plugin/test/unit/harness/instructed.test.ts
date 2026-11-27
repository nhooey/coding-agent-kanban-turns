import { describe, test } from "node:test";
import { expect } from "expect";

import {
  carries,
  commandNameOf,
  conversationKey,
  conversationKeyOf,
  conversationOf,
  instructing,
  isBoundary,
  isSkillCommand,
  loadsSkill,
  reattaches,
} from "../../../src/harness/instructed.ts";
import {
  BLOCK,
  INSTRUCTIONS,
  PLUGIN_SKILL,
} from "../../../src/protocol/instructions.ts";
import { SPEC } from "../../../src/protocol/spec.ts";
import type { TranscriptRecord } from "../../../src/harness/claude-code.ts";

const PATH = "/home/neil/.claude/projects/-work/session-1.jsonl";

// Records as Claude Code writes them, trimmed to the fields read here.
const prompt = (text: string): TranscriptRecord => ({
  type: "user",
  isSidechain: false,
  message: { role: "user", content: text },
});
const reply = (text: string): TranscriptRecord => ({
  type: "assistant",
  isSidechain: false,
  message: { role: "assistant", content: [{ type: "text", text }] },
});
/** The context `prompt.context` sent, as the transcript keeps it. */
const contextSections = (
  sections: readonly Readonly<{ name: string; text: string }>[],
): TranscriptRecord => ({
  type: "attachment",
  isSidechain: false,
  attachment: { type: "context_sections", sections },
});
/** A prompt's context from `prompt.submit` hooks, as the transcript keeps it. */
const submitContext = (content: readonly string[]): TranscriptRecord => ({
  type: "attachment",
  isSidechain: false,
  attachment: {
    type: "hook_additional_context",
    content,
    hookName: "prompt.submit",
    hookEvent: "UserPromptSubmit",
  },
});
const compaction: TranscriptRecord = {
  type: "system",
  subtype: "compact_boundary",
  isSidechain: false,
  content: "Conversation compacted",
};
const clear: TranscriptRecord = prompt(
  "<command-name>/clear</command-name>\n            <command-message>clear</command-message>\n            <command-args></command-args>",
);

/** An assistant record's `Skill` tool use, loading `skill`, its id `id`. */
const skillUse = (skill: string, id: string = "toolu_skill"): TranscriptRecord => ({
  type: "assistant",
  isSidechain: false,
  message: {
    role: "assistant",
    content: [
      { type: "tool_use", id, name: "Skill", input: { skill }, caller: { type: "direct" } },
    ],
  },
});
/** The tool result a `Skill` tool use with id `id` got, as an error where `isError`. */
const skillResult = (
  id: string = "toolu_skill",
  isError: boolean = false,
): TranscriptRecord => ({
  type: "user",
  isSidechain: false,
  message: {
    role: "user",
    content: [
      isError
        ? {
            type: "tool_result",
            content: "<tool_use_error>Unknown skill</tool_use_error>",
            is_error: true,
            tool_use_id: id,
          }
        : { type: "tool_result", tool_use_id: id, content: `Launching skill: ${PLUGIN_SKILL}` },
    ],
  },
});
/** The attachment Claude Code writes after a compaction, putting back the skills loaded before it, by name. */
const invokedSkills = (names: readonly string[]): TranscriptRecord => ({
  type: "attachment",
  isSidechain: false,
  attachment: {
    type: "invoked_skills",
    skills: names.map((name) => ({
      name,
      path: `plugin:${name}`,
      content: "Base directory for this skill: /nix/store/skill",
    })),
  },
});
/** The command record a user's slash command for `skill` leaves, `args` after it. */
const skillCommand = (skill: string, args: string = ""): TranscriptRecord =>
  prompt(
    `<command-message>${skill}</command-message>\n<command-name>/${skill}</command-name>\n<command-args>${args}</command-args>`,
  );

const jsonl = (records: readonly TranscriptRecord[]): string =>
  records.map((record) => `${JSON.stringify(record)}\n`).join("");

describe("a conversation's boundaries", () => {
  test("are a compaction and /clear, not a prompt or a sidechain's compaction", () => {
    expect(isBoundary(compaction)).toBe(true);
    expect(isBoundary(clear)).toBe(true);
    expect(isBoundary(prompt("clear the cache"))).toBe(false);
    expect(isBoundary(prompt("/clear"))).toBe(false);
    expect(isBoundary({ ...compaction, isSidechain: true })).toBe(false);
  });

  test("leave the records after the last one", () => {
    const records = [prompt("a"), compaction, prompt("b"), clear, prompt("c")];

    expect(conversationOf(records)).toEqual([prompt("c")]);
    expect(conversationOf([prompt("a"), reply("b")])).toEqual([
      prompt("a"),
      reply("b"),
    ]);
  });

  test("count into the conversation's key, with the transcript's path", () => {
    expect(conversationKey(PATH, [prompt("a")])).toBe(`${PATH}#0`);
    expect(conversationKey(PATH, [prompt("a"), compaction, clear])).toBe(
      `${PATH}#2`,
    );
  });

  test("give the key of a transcript's text, none for a transcript not there yet", () => {
    expect(conversationKeyOf(PATH, jsonl([prompt("a"), compaction, prompt("b")]))).toBe(
      `${PATH}#1`,
    );
    expect(conversationKeyOf(PATH, "")).toBe(`${PATH}#0`);
  });
});

describe("a record carries the instructions", () => {
  test("as the context's section named for the plugin, its text the same", () => {
    expect(
      carries(
        contextSections([
          { name: "claudeMd", text: "files" },
          { name: BLOCK, text: INSTRUCTIONS },
        ]),
        INSTRUCTIONS,
      ),
    ).toBe(true);
    expect(
      carries(contextSections([{ name: BLOCK, text: "older words" }]), INSTRUCTIONS),
    ).toBe(false);
    expect(
      carries(contextSections([{ name: "other", text: INSTRUCTIONS }]), INSTRUCTIONS),
    ).toBe(false);
  });

  test("as one of a prompt's context entries, beside other plugins'", () => {
    expect(
      carries(submitContext(["The terminal is 80 columns wide.", INSTRUCTIONS]), INSTRUCTIONS),
    ).toBe(true);
    expect(carries(submitContext(["something else"]), INSTRUCTIONS)).toBe(false);
  });

  test("not in a prompt, a reply or a sidechain's attachment", () => {
    expect(carries(prompt(INSTRUCTIONS), INSTRUCTIONS)).toBe(false);
    expect(carries(reply(INSTRUCTIONS), INSTRUCTIONS)).toBe(false);
    expect(
      carries({ ...submitContext([INSTRUCTIONS]), isSidechain: true }, INSTRUCTIONS),
    ).toBe(false);
  });
});

describe("the instructions are owed", () => {
  test("to a conversation with no block yet, or no transcript yet", () => {
    expect(instructing(PATH, jsonl([prompt("go"), reply("done")]), "")).toEqual({
      key: `${PATH}#0`,
      isOwed: true,
    });
    expect(instructing(PATH, "", "")).toEqual({ key: `${PATH}#0`, isOwed: true });
  });

  test("not where the block is already there, by either route", () => {
    expect(
      instructing(
        PATH,
        jsonl([contextSections([{ name: BLOCK, text: INSTRUCTIONS }]), prompt("go")]),
        "",
      ).isOwed,
    ).toBe(false);
    expect(
      instructing(PATH, jsonl([prompt("go"), submitContext([INSTRUCTIONS])]), "")
        .isOwed,
    ).toBe(false);
  });

  test("again where the block came only before a compaction", () => {
    expect(
      instructing(
        PATH,
        jsonl([prompt("go"), submitContext([INSTRUCTIONS]), compaction, prompt("on")]),
        `${PATH}#0`,
      ),
    ).toEqual({ key: `${PATH}#1`, isOwed: true });
  });

  test("again after /clear, in its own transcript or in the same one", () => {
    expect(
      instructing(`${PATH}-cleared`, jsonl([clear]), `${PATH}#0`).isOwed,
    ).toBe(true);
    expect(
      instructing(
        PATH,
        jsonl([prompt("go"), submitContext([INSTRUCTIONS]), clear, prompt("on")]),
        `${PATH}#0`,
      ),
    ).toEqual({ key: `${PATH}#1`, isOwed: true });
  });

  test("not where a hook added them in this conversation before the transcript shows it", () => {
    expect(instructing(PATH, jsonl([prompt("go")]), `${PATH}#0`).isOwed).toBe(
      false,
    );
  });
});

describe("a command record's name", () => {
  test("is the text in its command-name tags, trimmed", () => {
    expect(commandNameOf(`<command-message>x</command-message>\n<command-name> /${PLUGIN_SKILL} </command-name>`)).toBe(
      `/${PLUGIN_SKILL}`,
    );
    expect(commandNameOf("<command-name>/clear</command-name>")).toBe("/clear");
  });

  test("is none where the tags aren't there or aren't closed", () => {
    expect(commandNameOf("go")).toBeUndefined();
    expect(commandNameOf("<command-name>/clear")).toBeUndefined();
  });

  test("is none where the tags are in the middle of a prompt, not where it opens", () => {
    const quoted = `the record reads <command-name>/clear</command-name>, and <command-name>/${PLUGIN_SKILL}</command-name>`;

    expect(commandNameOf(quoted)).toBeUndefined();
    expect(isBoundary(prompt(quoted))).toBe(false);
    expect(isSkillCommand(prompt(`see <command-message>x</command-message><command-name>/${PLUGIN_SKILL}</command-name>`), PLUGIN_SKILL)).toBe(false);
  });

  test("is read after space before the record's first tag", () => {
    expect(commandNameOf("\n  <command-name>/clear</command-name>")).toBe("/clear");
  });
});

describe("a compaction's invoked_skills attachment loads the plugin's skill", () => {
  test("where one of its skills is the plugin's", () => {
    expect(reattaches(invokedSkills([PLUGIN_SKILL, "claude-api"]), PLUGIN_SKILL)).toBe(true);
    expect(loadsSkill([invokedSkills([PLUGIN_SKILL])], PLUGIN_SKILL)).toBe(true);
  });

  test("not where its skills are others, the bare name among them, or it is a sidechain's", () => {
    expect(reattaches(invokedSkills([SPEC.skill.name, "claude-api"]), PLUGIN_SKILL)).toBe(false);
    expect(reattaches(invokedSkills([]), PLUGIN_SKILL)).toBe(false);
    expect(
      reattaches({ ...invokedSkills([PLUGIN_SKILL]), isSidechain: true }, PLUGIN_SKILL),
    ).toBe(false);
    expect(loadsSkill([invokedSkills([SPEC.skill.name])], PLUGIN_SKILL)).toBe(false);
  });
});

describe("a slash command record loads the plugin's skill", () => {
  test("where it names the plugin's skill, with or without a command after it", () => {
    expect(isSkillCommand(skillCommand(PLUGIN_SKILL), PLUGIN_SKILL)).toBe(true);
    expect(isSkillCommand(skillCommand(PLUGIN_SKILL, "reassess"), PLUGIN_SKILL)).toBe(true);
  });

  test("not where it names another skill, the bare name among them, or is typed as a prompt's words", () => {
    expect(isSkillCommand(skillCommand(SPEC.skill.name), PLUGIN_SKILL)).toBe(false);
    expect(isSkillCommand(skillCommand("plugin-authoring"), PLUGIN_SKILL)).toBe(false);
    expect(isSkillCommand(prompt(`/${PLUGIN_SKILL}`), PLUGIN_SKILL)).toBe(false);
    expect(isSkillCommand(clear, PLUGIN_SKILL)).toBe(false);
  });

  test("not in a sidechain", () => {
    expect(
      isSkillCommand({ ...skillCommand(PLUGIN_SKILL), isSidechain: true }, PLUGIN_SKILL),
    ).toBe(false);
  });
});

describe("a conversation loads the plugin's skill", () => {
  test("by a Skill tool use naming it whose result isn't an error", () => {
    expect(loadsSkill([skillUse(PLUGIN_SKILL), skillResult()], PLUGIN_SKILL)).toBe(true);
  });

  test("not by a failed load, a load with no result yet, or one for another skill", () => {
    expect(loadsSkill([skillUse(PLUGIN_SKILL), skillResult("toolu_skill", true)], PLUGIN_SKILL)).toBe(
      false,
    );
    expect(loadsSkill([skillUse(PLUGIN_SKILL)], PLUGIN_SKILL)).toBe(false);
    expect(loadsSkill([skillUse(SPEC.skill.name), skillResult()], PLUGIN_SKILL)).toBe(false);
    expect(loadsSkill([skillUse("plugin-authoring"), skillResult()], PLUGIN_SKILL)).toBe(false);
  });

  test("not by another tool use's result", () => {
    expect(
      loadsSkill([skillUse(PLUGIN_SKILL, "toolu_a"), skillResult("toolu_b")], PLUGIN_SKILL),
    ).toBe(false);
  });

  test("not by a sidechain's load", () => {
    expect(
      loadsSkill(
        [{ ...skillUse(PLUGIN_SKILL), isSidechain: true }, { ...skillResult(), isSidechain: true }],
        PLUGIN_SKILL,
      ),
    ).toBe(false);
  });

  test("by the command record a user's slash command for it leaves", () => {
    expect(loadsSkill([skillCommand(PLUGIN_SKILL)], PLUGIN_SKILL)).toBe(true);
    expect(loadsSkill([skillCommand("plugin-authoring")], PLUGIN_SKILL)).toBe(false);
  });
});

describe("the instructions are owed where the plugin's skill", () => {
  test("loaded by the Skill tool: not after a successful load", () => {
    expect(
      instructing(PATH, jsonl([prompt("go"), skillUse(PLUGIN_SKILL), skillResult(), reply("done")]), "")
        .isOwed,
    ).toBe(false);
  });

  test("loaded by the Skill tool: still after a failed load, or a load of another skill", () => {
    expect(
      instructing(PATH, jsonl([prompt("go"), skillUse(PLUGIN_SKILL), skillResult("toolu_skill", true)]), "")
        .isOwed,
    ).toBe(true);
    expect(
      instructing(PATH, jsonl([prompt("go"), skillUse(SPEC.skill.name), skillResult()]), "").isOwed,
    ).toBe(true);
  });

  test("loaded by the Skill tool: again after a compaction or /clear that follows the load", () => {
    const loaded = [prompt("go"), skillUse(PLUGIN_SKILL), skillResult()];

    expect(instructing(PATH, jsonl([...loaded, compaction, prompt("on")]), `${PATH}#0`)).toEqual({
      key: `${PATH}#1`,
      isOwed: true,
    });
    expect(instructing(PATH, jsonl([...loaded, clear, prompt("on")]), `${PATH}#0`)).toEqual({
      key: `${PATH}#1`,
      isOwed: true,
    });
  });

  test("put back by a compaction's invoked_skills attachment: not owed after it, owed where it names other skills", () => {
    const loaded = [prompt("go"), skillUse(PLUGIN_SKILL), skillResult()];

    expect(
      instructing(
        PATH,
        jsonl([...loaded, compaction, invokedSkills([PLUGIN_SKILL, "claude-api"]), prompt("on")]),
        `${PATH}#0`,
      ),
    ).toEqual({ key: `${PATH}#1`, isOwed: false });
    expect(
      instructing(
        PATH,
        jsonl([...loaded, compaction, invokedSkills([SPEC.skill.name, "claude-api"]), prompt("on")]),
        `${PATH}#0`,
      ),
    ).toEqual({ key: `${PATH}#1`, isOwed: true });
  });

  test("loaded by its slash command: not after the command, owed again after a boundary that follows it", () => {
    expect(instructing(PATH, jsonl([skillCommand(PLUGIN_SKILL, "reassess")]), "").isOwed).toBe(false);
    expect(instructing(PATH, jsonl([skillCommand("plugin-authoring")]), "").isOwed).toBe(true);
    expect(
      instructing(PATH, jsonl([skillCommand(PLUGIN_SKILL), compaction, prompt("on")]), `${PATH}#0`)
        .isOwed,
    ).toBe(true);
    expect(
      instructing(PATH, jsonl([skillCommand(PLUGIN_SKILL), clear, prompt("on")]), `${PATH}#0`).isOwed,
    ).toBe(true);
  });
});
