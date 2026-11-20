// The Claude Code adapter: the session's JSONL records read into neutral
// turns, each prompt's owner, the names a report goes by, the Decide items a
// tool call raised, and where the transcript lies; the kanban skill's
// test_reply_turns.py and its merge_repeats test, on records shaped like the
// ones Claude Code writes.

import { describe, test } from "node:test";
import { expect } from "expect";

import {
  decideOf,
  isPrompt,
  messageOf,
  projectSlug,
  promptOwnerOf,
  queuedOf,
  recordsOf,
  reportNames,
  transcriptPathFor,
  turnsOf,
  turnsOfText,
} from "../src/claude-code-transcript.ts";
import { PLUGIN } from "../src/instructions.ts";
import { itemsOf } from "../src/items.ts";
import { openDecideItems, settlementsOf } from "../src/outstanding.ts";
import { reassessStart } from "../src/transcript.ts";
import {
  assistant,
  commandOutput,
  compactSummary,
  engineRow,
  human,
  jsonl,
  notification,
  otherPluginPrompt,
  peer,
  pluginPrompt,
  pluginRow,
  queued,
  sdkPrompt,
  skillBody,
  submitted,
  toolResult,
} from "./records.ts";

const FIRST = "aaaa1111";
const SECOND = "bbbb2222";
const THIRD = "aaaa1199";

const call = (turn: string) => ({
  items: [
    {
      turn,
      number: 1,
      summary: "Which cache",
      kind: "radio",
      options: [{ letter: "A", name: "Disk" }],
    },
  ],
});

const RECORDS = [
  assistant("before any prompt"),
  human(FIRST, "first prompt\nsecond line"),
  assistant("one"),
  toolResult(),
  assistant("two", [call(FIRST)]),
  assistant("sidechain", [], { isSidechain: true }),
  { ...human(SECOND, "a sidechain prompt"), isSidechain: true },
  compactSummary(SECOND),
  peer(SECOND, '<agent-message from="a48bb">\nPushed.\n</agent-message>'),
  assistant("   "),
  assistant("three"),
  notification(THIRD, "<task-notification>\n<task-id>b8</task-id>\n</task-notification>"),
];

describe("each record's owner", () => {
  test("a prompt's owner: the user, this plugin, another plugin, a peer or a notification", () => {
    expect(
      [
        human(FIRST, "go"),
        pluginPrompt(FIRST, "go"),
        submitted(FIRST, "go"),
        otherPluginPrompt(FIRST, "go"),
        submitted(FIRST, "go", "other-mod"),
        peer(FIRST, "go"),
        notification(FIRST, "go"),
      ].map(promptOwnerOf),
    ).toEqual(["user", "this-plugin", "this-plugin", "other-plugin", "other-plugin", "peer", "notification"]);
  });

  test("a record that opens no turn has no prompt owner", () => {
    for (const record of [
      compactSummary(FIRST),
      { ...human(FIRST, "go"), isSidechain: true },
      { ...peer(FIRST, "go"), isSidechain: true },
      { ...notification(FIRST, "go"), isSidechain: true },
      { ...submitted(FIRST, "go"), isSidechain: true },
      { ...human(FIRST, "go"), turnOrigin: "system" },
      sdkPrompt(FIRST, "go"),
      { ...human(FIRST, "go"), turnOrigin: "scheduled", origin: undefined },
      { ...pluginPrompt(FIRST, "go"), pluginPrompt: { name: PLUGIN, text: 42 } },
      pluginRow("The terminal is 240 columns wide."),
      engineRow("<system-reminder>x</system-reminder>", { isMeta: true }),
      skillBody(),
      commandOutput(FIRST),
      toolResult(),
      assistant("one"),
      queued("go"),
    ]) {
      expect(promptOwnerOf(record)).toBeUndefined();
      expect(isPrompt(record)).toBe(false);
    }
  });

  test("a message sent while a turn ran: the user's, a peer's or a task's, with a report's names", () => {
    expect(
      [
        queued("a"),
        queued('<agent-message from="a48bb">\nPushed.\n</agent-message>', "peer"),
        queued("c", "task-notification"),
        queued("d", "system"),
        queued("e", "coordinator"),
        { ...queued("f"), isSidechain: true },
        human(FIRST, "g"),
      ].map(queuedOf),
    ).toEqual([
      { owner: "user", text: "a", reportNames: undefined },
      { owner: "peer", text: '<agent-message from="a48bb">\nPushed.\n</agent-message>', reportNames: ["a48bb"] },
      { owner: "notification", text: "c", reportNames: undefined },
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe("reportNames", () => {
  test("another session's message goes by the session's name", () => {
    expect(
      reportNames('<cross-session-message from="uds:/x" from-name="github-config">\nDone.\n</cross-session-message>'),
    ).toEqual(["github-config"]);
  });

  test("an agent's message goes by the agent's id", () => {
    expect(reportNames('<agent-message from="a48bb">\nPushed.\n</agent-message>')).toEqual(["a48bb"]);
  });

  test("a finished task goes by its id and the names its summary quotes", () => {
    for (const status of ["completed", "failed", "killed", "stopped", "cancelled", "Completed"]) {
      expect(
        reportNames(
          `<task-notification>\n<task-id>b8</task-id>\n<status>${status}</status>\n<summary>Agent "x" and "y" ${status}</summary>\n</task-notification>`,
        ),
      ).toEqual(["b8", "x", "y"]);
    }
  });

  test("an expired Monitor is a report", () => {
    expect(
      reportNames(
        "<task-notification>\n<task-id>b8</task-id>\n<event>[Monitor expired after 1h]</event>\n</task-notification>",
      ),
    ).toEqual(["b8"]);
  });

  test("a task still running, a Monitor's event, or plain text is no report", () => {
    for (const text of [
      '<task-notification>\n<task-id>b8</task-id>\n<status>completed</status>\n<summary>Agent "x" is waiting on its own background work</summary>\n</task-notification>',
      "<task-notification>\n<task-id>b8</task-id>\n<event>CHECK ok</event>\n</task-notification>",
      "<task-notification>\n<task-id>b8</task-id>\n<status>running</status>\n</task-notification>",
      "go on",
    ]) {
      expect(reportNames(text)).toBeUndefined();
    }
  });

  test("a message carries its names whoever wrote it, and the core decides whose count", () => {
    const text = '<agent-message from="a48bb">\nPushed.\n</agent-message>';
    expect(messageOf("user", text)).toEqual({ owner: "user", text, reportNames: ["a48bb"] });
  });
});

describe("decideOf", () => {
  test("the Decide items of an assistant record's kanban_options inputs, other tools' left out", () => {
    expect(decideOf(assistant("one", [call(FIRST), call(SECOND)]))).toEqual([
      ...itemsOf(call(FIRST)),
      ...itemsOf(call(SECOND)),
    ]);
    expect(decideOf(assistant("one"))).toEqual([]);
    expect(decideOf(human(FIRST, "go"))).toEqual([]);
  });
});

describe("turnsOf", () => {
  test("a human, peer and task notification prompt each open a turn, its id the prompt id's first 8 characters", () => {
    expect(turnsOf(RECORDS).map((t) => [t.id, t.prompt.owner])).toEqual([
      [FIRST, "user"],
      [SECOND, "peer"],
      [THIRD, "notification"],
    ]);
  });

  test("a reply is its turn's non-sidechain text blocks, blank text and tool results left out", () => {
    const turns = turnsOf(RECORDS);
    expect(turns.map((t) => t.replies)).toEqual([["one", "two"], ["three"], []]);
    expect(turns[0]?.prompt.text).toBe("first prompt\nsecond line");
  });

  test("a turn's Decide items are those its kanban_options calls raised", () => {
    expect(turnsOf(RECORDS).map((t) => t.decide)).toEqual([itemsOf(call(FIRST)), [], []]);
  });

  test("a prompt's report names are read from its text", () => {
    expect(turnsOf(RECORDS)[1]?.prompt.reportNames).toEqual(["a48bb"]);
  });

  test("the messages sent while a turn ran are its messages, in order, whoever sent them", () => {
    const turns = turnsOf([
      human(FIRST, "go"),
      assistant("one"),
      queued("Decide.1.Y"),
      queued("<cross-session-message>x</cross-session-message>", "peer"),
      queued("Decide.2.N"),
      queued("<task-notification>y</task-notification>", "task-notification"),
      queued("/compact", "system"),
    ]);
    expect(turns[0]?.messages.map((m) => [m.owner, m.text])).toEqual([
      ["user", "Decide.1.Y"],
      ["peer", "<cross-session-message>x</cross-session-message>"],
      ["user", "Decide.2.N"],
      ["notification", "<task-notification>y</task-notification>"],
    ]);
  });

  test("a prompt a plugin submitted opens a turn with the text it sent; another system prompt opens none", () => {
    const turns = turnsOf([
      human(FIRST, "go"),
      assistant("one"),
      pluginPrompt(SECOND, "reassess"),
      assistant("two"),
      { ...human(THIRD, "a system prompt"), turnOrigin: "system" },
    ]);
    expect(turns.map((t) => [t.id, t.prompt.owner, t.prompt.text, t.replies])).toEqual([
      [FIRST, "user", "go", ["one"]],
      [SECOND, "this-plugin", "reassess", ["two"]],
    ]);
  });

  test("a draft this plugin's Submit sent as the user opens a turn of its own, with the draft as it is", () => {
    const turns = turnsOf([
      human(FIRST, "go"),
      assistant("one"),
      pluginRow("The terminal is 240 columns wide."),
      submitted(SECOND, "coding-agent-kanban-turns:\n9efb08a1.Decide.1.A\n"),
      assistant("two"),
    ]);
    expect(turns.map((t) => [t.id, t.prompt.owner, t.prompt.text, t.replies])).toEqual([
      [FIRST, "user", "go", ["one"]],
      [SECOND, "this-plugin", "coding-agent-kanban-turns:\n9efb08a1.Decide.1.A\n", ["two"]],
    ]);
  });

  test("another plugin's prompt opens a turn it owns, in its own name or the user's", () => {
    expect(
      turnsOf([otherPluginPrompt(FIRST, "1. A"), submitted(SECOND, "2. B", "other-mod")]).map((t) => [
        t.id,
        t.prompt.owner,
        t.prompt.text,
      ]),
    ).toEqual([
      [FIRST, "other-plugin", "1. A"],
      [SECOND, "other-plugin", "2. B"],
    ]);
  });

  test("a prompt with no promptId opens a turn with no id", () => {
    expect(turnsOf([{ ...human(FIRST, "go"), promptId: undefined }]).map((t) => t.id)).toEqual([""]);
  });

  test("a repeated prompt record folds its replies and Decide items into the first", () => {
    const turns = turnsOf([
      human(FIRST, "go"),
      assistant("one"),
      human(SECOND, "x"),
      assistant("two"),
      human(FIRST, "go"),
      assistant("three", [call(FIRST)]),
    ]);
    expect(turns.map((t) => [t.id, t.replies, t.decide.length])).toEqual([
      [FIRST, ["one", "three"], 1],
      [SECOND, ["two"], 0],
    ]);
  });

  test("a repeated prompt record folds the messages sent while it ran into the first", () => {
    const turns = turnsOf([
      human(FIRST, "go"),
      queued("Decide.1.A"),
      human(SECOND, "x"),
      human(FIRST, "go"),
      queued("Decide.2.B"),
      queued("<task-notification>done</task-notification>", "task-notification"),
    ]);
    expect(turns.map((t) => [t.id, t.messages.map((m) => m.text)])).toEqual([
      [FIRST, ["Decide.1.A", "Decide.2.B", "<task-notification>done</task-notification>"]],
      [SECOND, []],
    ]);
  });

  test("the engine's own user records open no turn", () => {
    const turns = turnsOf([
      human(FIRST, "go"),
      assistant("one"),
      engineRow("<system-reminder>\nThe user named this session.\n</system-reminder>", { isMeta: true }),
      skillBody(),
      engineRow(
        "<local-command-caveat>Caveat: the messages below were generated by the user while running local commands.</local-command-caveat>",
        { isMeta: true },
      ),
      engineRow("<bash-input>ls</bash-input>"),
      commandOutput("cccc3333"),
      { ...commandOutput("cccc4444"), message: { role: "user", content: "<bash-stderr>no such file</bash-stderr>" } },
      engineRow("<command-name>/model</command-name>\n<command-message>model</command-message>\n<command-args></command-args>"),
      engineRow("<local-command-stdout>Set model</local-command-stdout>"),
      engineRow("[Request interrupted by user for tool use]"),
      pluginRow("The terminal is 240 columns wide."),
      assistant("two"),
    ]);
    expect(turns.map((t) => [t.id, t.replies])).toEqual([[FIRST, ["one", "two"]]]);
  });
});

describe("the core on the adapter's turns", () => {
  const decided = (id: string) =>
    assistant("🧠 **Decide:**", [
      {
        items: [1, 2].map((number) => ({
          turn: id,
          number,
          summary: ["Which cache to keep", "Ship the release tonight?"][number - 1],
          kind: "radio",
          options: [{ letter: "A", name: "First" }],
        })),
      },
    ]);

  test("a bare answer after a shell command reaches the reply before the command", () => {
    expect(
      openDecideItems(
        turnsOf([
          human(FIRST, "go"),
          decided(FIRST),
          engineRow("<bash-input>git log</bash-input>"),
          commandOutput(SECOND),
          human(THIRD, "Decide.1.A"),
        ]),
      ).map((item) => item.ref),
    ).toEqual([`${FIRST}.Decide.2`]);
  });

  test("a skill's body, though it reads as answers, answers nothing", () => {
    expect(
      openDecideItems(
        turnsOf([human(FIRST, "go"), decided(FIRST), human(SECOND, "more"), skillBody()]),
      ).map((item) => item.ref),
    ).toEqual([`${FIRST}.Decide.1`, `${FIRST}.Decide.2`]);
  });

  test("a draft this plugin's Submit sent answers the items it names, in a turn of its own", () => {
    const turns = turnsOf([
      human(FIRST, "go"),
      decided(FIRST),
      submitted(SECOND, `coding-agent-kanban-turns:\n${FIRST}.Decide.1.A\n`),
      assistant("On it."),
    ]);
    expect(settlementsOf(turns)).toEqual([
      { ref: `${FIRST}.Decide.1`, how: "answered", turn: SECOND, letters: ["A"], note: "" },
    ]);
  });

  test("a Submit ending on reassess reassesses", () => {
    expect(
      reassessStart(turnsOf([human(FIRST, "go"), decided(FIRST), submitted(SECOND, "reassess")])),
    ).toBe(1);
  });
});

describe("the transcript file", () => {
  test("is one record a line, a blank line or a line cut short skipped", () => {
    const text = `${jsonl([human(FIRST, "go"), assistant("one")])}\n${JSON.stringify(human(SECOND, "more")).slice(0, 40)}`;
    expect(recordsOf(text)).toHaveLength(2);
    expect(turnsOfText(text).map((t) => [t.id, t.replies])).toEqual([[FIRST, ["one"]]]);
  });

  test("a line that is no JSON object is skipped", () => {
    expect(recordsOf('[1]\n"x"\nnull\n{"type":"user"}\n')).toEqual([{ type: "user" }]);
  });

  test("lies under the project of the working directory, a worktree's main checkout", () => {
    expect(projectSlug("/Users/a/repo")).toBe("-Users-a-repo");
    expect(projectSlug("/Users/a/repo/.worktrees/branch")).toBe("-Users-a-repo");
    expect(projectSlug("/Users/a/repo/.claude/worktrees/agent-1")).toBe("-Users-a-repo");
    expect(projectSlug("/Users/a/my.repo")).toBe("-Users-a-my-repo");
    expect(transcriptPathFor("/home/a", "/Users/a/repo", "s-1")).toBe(
      "/home/a/.claude/projects/-Users-a-repo/s-1.jsonl",
    );
  });
});
