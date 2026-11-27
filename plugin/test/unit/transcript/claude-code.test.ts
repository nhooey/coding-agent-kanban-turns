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
  projectsFolder,
  sessionTranscriptPath,
  transcriptPathFor,
  turnsOf,
  turnsOfText,
} from "../../../src/transcript/claude-code.ts";
import type { TranscriptRecord } from "../../../src/transcript/claude-code.ts";
import { PLUGIN } from "../../../src/protocol/instructions.ts";
import { itemsOf } from "../../../src/items/items.ts";
import { openDecideItems, settlementsOf } from "../../../src/items/outstanding.ts";
import { reassessStart } from "../../../src/transcript/turns.ts";
import {
  apiError,
  assistant,
  commandOutput,
  compactBoundary,
  compactSummary,
  engineRow,
  human,
  interrupted,
  jsonl,
  notification,
  otherPluginPrompt,
  peer,
  pluginPrompt,
  pluginRow,
  queued,
  scheduled,
  sdkPrompt,
  skillBody,
  stoppedFor,
  submitted,
  toolRejected,
  toolResult,
} from "../../fixtures/records.ts";

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
  test("a prompt's owner: the user, this plugin, another plugin, a peer, a notification or a schedule", () => {
    expect(
      [
        human(FIRST, "go"),
        pluginPrompt(FIRST, "go"),
        submitted(FIRST, "go"),
        otherPluginPrompt(FIRST, "go"),
        submitted(FIRST, "go", "other-mod"),
        peer(FIRST, "go"),
        notification(FIRST, "go"),
        scheduled(FIRST, "go"),
        scheduled(FIRST, "go", "loop_wakeup"),
      ].map(promptOwnerOf),
    ).toEqual([
      "user",
      "this-plugin",
      "this-plugin",
      "other-plugin",
      "other-plugin",
      "peer",
      "notification",
      "scheduled",
      "scheduled",
    ]);
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
      { ...scheduled(FIRST, "go"), isSidechain: true },
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

  test("a turn whose last response answers has a final response: end_turn, stop_sequence or max_tokens", () => {
    const turns = turnsOf(
      ["end_turn", "stop_sequence", "max_tokens"].flatMap((reason) => [
        human(FIRST, "go"),
        stoppedFor("tool_use", assistant("on the way")),
        stoppedFor(reason, assistant("done")),
      ]),
    );

    expect(turns.map((t) => "unanswered" in t)).toEqual([false]);
    expect(
      ["end_turn", "stop_sequence", "max_tokens"].map(
        (reason) => turnsOf([human(FIRST, "go"), stoppedFor(reason, assistant("done"))])[0]?.unanswered,
      ),
    ).toEqual([undefined, undefined, undefined]);
  });

  test("a turn whose last response stopped to call a tool is unanswered, text written on the way included", () => {
    const turns = turnsOf([
      human(FIRST, "go"),
      stoppedFor("end_turn", assistant("done")),
      human(SECOND, "again"),
      stoppedFor("tool_use", assistant("on the way")),
    ]);

    expect(turns.map((t) => t.unanswered)).toEqual([undefined, true]);
    expect(turns[1]?.replies).toEqual(["on the way"]);
  });

  test("a response cut off mid-stream, its record saying no stop reason, then interrupted by the user, leaves its turn unanswered", () => {
    const turns = turnsOf([
      human(FIRST, "go"),
      stoppedFor("tool_use", assistant("on the way")),
      toolResult(),
      assistant("half a sent"),
      interrupted(),
      human(SECOND, "again"),
      stoppedFor("end_turn", assistant("done")),
    ]);

    expect(turns.map((t) => [t.id, t.unanswered])).toEqual([
      [FIRST, true],
      [SECOND, undefined],
    ]);
  });

  test("an Escape while a tool ran leaves its turn unanswered, its last record the tool call", () => {
    const turns = turnsOf([
      human(FIRST, "go"),
      stoppedFor("tool_use", assistant("running it")),
      toolRejected(),
      interrupted(true),
    ]);

    expect(turns.map((t) => [t.replies, t.unanswered])).toEqual([[["running it"], true]]);
  });

  test("an API error, the engine's own synthetic record, leaves its turn unanswered, though its stop reason is stop_sequence", () => {
    const turns = turnsOf([
      human(FIRST, "go"),
      stoppedFor("tool_use", assistant("on the way")),
      toolResult(),
      apiError("API Error: Connection lost mid-response."),
    ]);

    expect(turns.map((t) => t.unanswered)).toEqual([true]);
  });

  test("a refusal, or no assistant record yet, leaves a turn unanswered", () => {
    expect(
      turnsOf([
        human(FIRST, "go"),
        stoppedFor("refusal", assistant("no")),
        human(SECOND, "again"),
      ]).map((t) => t.unanswered),
    ).toEqual([true, true]);
  });

  test("a repeated prompt is answered as its last repeat with an assistant record is", () => {
    expect(
      turnsOf([
        human(FIRST, "go"),
        stoppedFor("tool_use", assistant("on the way")),
        human(FIRST, "go"),
        stoppedFor("end_turn", assistant("done")),
      ]).map((t) => [t.replies, t.unanswered]),
    ).toEqual([[["on the way", "done"], undefined]]);
    expect(
      turnsOf([
        human(FIRST, "go"),
        stoppedFor("end_turn", assistant("done")),
        human(FIRST, "go"),
        stoppedFor("tool_use", assistant("on the way")),
      ]).map((t) => t.unanswered),
    ).toEqual([true]);
  });

  test("a prompt id repeated after a compaction, with no assistant record yet, leaves the turn answered as it was", () => {
    const turns = turnsOf([
      human(FIRST, "go"),
      stoppedFor("end_turn", assistant("done")),
      compactBoundary(),
      compactSummary(FIRST),
      human(FIRST, "go"),
    ]);

    expect(turns.map((t) => [t.id, t.replies, t.unanswered])).toEqual([[FIRST, ["done"], undefined]]);
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

  test("a scheduled prompt opens a turn with its stored text, which ends the turn before; a headless one opens none", () => {
    const turns = turnsOf([
      human(FIRST, "go"),
      assistant("one"),
      scheduled(SECOND, "check the deploy"),
      assistant("two", [call(SECOND)]),
      sdkPrompt(THIRD, "a headless prompt"),
      assistant("three"),
      scheduled(THIRD, "check again", "loop_wakeup"),
      assistant("four"),
    ]);
    expect(turns.map((t) => [t.id, t.prompt.owner, t.prompt.text, t.replies, t.decide])).toEqual([
      [FIRST, "user", "go", ["one"], []],
      [SECOND, "scheduled", "check the deploy", ["two", "three"], itemsOf(call(SECOND))],
      [THIRD, "scheduled", "check again", ["four"], []],
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

  test("a scheduled turn's replies raise Decide items, which are listed", () => {
    expect(
      openDecideItems(turnsOf([scheduled(FIRST, "check the deploy"), decided(FIRST)])).map((item) => item.ref),
    ).toEqual([`${FIRST}.Decide.1`, `${FIRST}.Decide.2`]);
  });

  test("a scheduled prompt's text answers nothing, though it reads as answers, nor reassesses", () => {
    for (const text of [`${FIRST}.Decide.1.A`, "1. A / 2. A", "Decide.1: A", `${FIRST}.Decide.1.A\nreassess`]) {
      const turns = turnsOf([human(FIRST, "go"), decided(FIRST), scheduled(SECOND, text)]);
      expect(settlementsOf(turns)).toEqual([]);
      expect(openDecideItems(turns).map((item) => item.ref)).toEqual([`${FIRST}.Decide.1`, `${FIRST}.Decide.2`]);
      expect(reassessStart(turns)).toBe(0);
    }
  });

  test("a bare answer after a scheduled turn means the scheduled turn's reply, not the one before", () => {
    const turns = turnsOf([
      human(FIRST, "go"),
      decided(FIRST),
      scheduled(SECOND, "check the deploy"),
      assistant("Checked."),
      human(THIRD, "Decide.1.A"),
    ]);
    expect(settlementsOf(turns)).toEqual([]);
    expect(openDecideItems(turns).map((item) => item.ref)).toEqual([`${FIRST}.Decide.1`, `${FIRST}.Decide.2`]);
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

  test("lies in the projects folder under the home's .claude, or under CLAUDE_CONFIG_DIR where it's set", () => {
    expect(projectsFolder("/home/a")).toBe("/home/a/.claude/projects");
    expect(projectsFolder("/home/a", "")).toBe("/home/a/.claude/projects");
    expect(projectsFolder("/home/a", "/config/claude")).toBe("/config/claude/projects");
  });

  test("of a session lies in the working directory's project where it holds it, else in the one project that does", () => {
    const projects = "/config/claude/projects";

    expect(sessionTranscriptPath(projects, "/Users/a/repo", "s-1", ["-Users-a-repo", "-Users-a-other"])).toBe(
      "/config/claude/projects/-Users-a-repo/s-1.jsonl",
    );
    expect(sessionTranscriptPath(projects, "/Users/a/repo/.worktrees/b", "s-1", ["-Users-a-other"])).toBe(
      "/config/claude/projects/-Users-a-other/s-1.jsonl",
    );
  });

  test("of a session no project holds, or more than one but the working directory's, is the working directory's, to be found missing", () => {
    const projects = "/home/a/.claude/projects";
    const own = "/home/a/.claude/projects/-Users-a-repo/s-1.jsonl";

    expect(sessionTranscriptPath(projects, "/Users/a/repo", "s-1", [])).toBe(own);
    expect(sessionTranscriptPath(projects, "/Users/a/repo", "s-1", ["-x", "-y"])).toBe(own);
  });
});

describe("each turn's times", () => {
  const at = (time: string, record: TranscriptRecord): TranscriptRecord => ({ ...record, timestamp: time });

  test("are its prompt's and its last response's, as the records give them", () => {
    const turns = turnsOf([
      at("2026-11-16T20:00:00.000Z", human(FIRST, "go")),
      at("2026-11-16T20:00:10.000Z", stoppedFor("tool_use", assistant("on the way"))),
      at("2026-11-16T20:00:20.000Z", stoppedFor("end_turn", assistant("done"))),
      at("2026-11-16T20:01:00.000Z", human(SECOND, "more")),
    ]);

    expect(turns.map((t) => [t.id, t.promptedAt, t.answeredAt])).toEqual([
      [FIRST, "2026-11-16T20:00:00.000Z", "2026-11-16T20:00:20.000Z"],
      [SECOND, "2026-11-16T20:01:00.000Z", undefined],
    ]);
  });

  test("are unknown, and left out, where a record gives no time or one that isn't text", () => {
    const { timestamp: _prompt, ...untimed } = human(FIRST, "go");
    const turns = turnsOf([
      untimed,
      at("", stoppedFor("end_turn", assistant("done"))),
      { ...human(SECOND, "more"), timestamp: 7 },
    ]);

    expect(turns.map((t) => Object.hasOwn(t, "promptedAt") || Object.hasOwn(t, "answeredAt"))).toEqual([false, false]);
  });

  test("of a repeated prompt are the first's prompt time and the last answer's", () => {
    const turns = turnsOf([
      at("2026-11-16T20:00:00.000Z", human(FIRST, "go")),
      at("2026-11-16T20:00:20.000Z", stoppedFor("end_turn", assistant("done"))),
      at("2026-11-16T20:05:00.000Z", human(FIRST, "go")),
      at("2026-11-16T20:05:20.000Z", stoppedFor("end_turn", assistant("again"))),
    ]);

    expect(turns.map((t) => [t.promptedAt, t.answeredAt])).toEqual([
      ["2026-11-16T20:00:00.000Z", "2026-11-16T20:05:20.000Z"],
    ]);
  });
});
