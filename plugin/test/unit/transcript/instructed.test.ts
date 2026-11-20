import { describe, test } from "node:test";
import { expect } from "expect";

import {
  carries,
  conversationKey,
  conversationOf,
  instructing,
  isBoundary,
} from "../../../src/transcript/instructed.ts";
import { BLOCK, INSTRUCTIONS } from "../../../src/protocol/instructions.ts";
import type { TranscriptRecord } from "../../../src/transcript/claude-code.ts";

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
