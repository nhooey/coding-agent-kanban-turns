import { expect, test } from "claude-code/testing";
import type { Engine } from "claude-code/testing";
import type { On } from "claude-code";

// The tools that do what the kanban skill's scripts did, kanban_outstanding
// and kanban_lint, and the reply lint the turn's end runs, driven through
// the engine. The test kit loads this file alone, so it builds its own
// transcript and engine, as pane.test.tsx does for the pane.

type TranscriptRecord = Readonly<Record<string, unknown>>;

const PLUGIN = "coding-agent-kanban-turns";
const OPTIONS = `mcp__${PLUGIN}__kanban_options`;
const OUTSTANDING = `mcp__${PLUGIN}__kanban_outstanding`;
const LINT = `mcp__${PLUGIN}__kanban_lint`;
const TRANSCRIPT = "/home/neil/.claude/projects/-work/session-1.jsonl";
const USER_FOLDER = "/home/neil/coding-agent-kanban-turns/";
const BR = "  ";

/** A prompt the user typed, its turn's id `id`. */
const human = (id: string, text: string): TranscriptRecord => ({
  isSidechain: false,
  type: "user",
  promptId: `${id}-0000-4000-8000-000000000000`,
  turnOrigin: "human",
  origin: { kind: "human" },
  message: { role: "user", content: text },
});

/** A reply: its text, and a `kanban_options` call for each of `calls`. */
const assistant = (text: string, calls: readonly unknown[] = []): TranscriptRecord => ({
  isSidechain: false,
  type: "assistant",
  message: {
    role: "assistant",
    content: [
      { type: "text", text },
      ...calls.map((input) => ({
        type: "tool_use",
        id: "toolu_1",
        name: OPTIONS,
        input,
      })),
    ],
  },
});

const ITEM = {
  turn: "9efb08a1",
  list: "Decide",
  number: 1,
  summary: "Which cache to keep",
  kind: "radio",
  ref: "9efb08a1.Decide.1",
  options: [
    { letter: "A", name: "Disk" },
    { letter: "B", name: "Memory" },
  ],
} as const;

// A reply in the protocol's shape: a Pending item, a Review item naming a
// pull request with its repository, and a Decide item with its options.
const REPLY = [
  "Some work.",
  "",
  `🚧 **Pending:**${BR}`,
  "▔▔▔▔▔▔▔▔▔▔▔",
  "1. **Rework the loader**",
  "",
  `🔍 **Review:**${BR}`,
  "▔▔▔▔▔▔▔▔▔▔",
  "1. **nhooey/kanban#21 The loader's rework**",
  "",
  `🧠 **Decide:**${BR}`,
  "▔▔▔▔▔▔▔▔▔▔",
  `1. **Which cache to keep**${BR}`,
  "   🔘 A. **Disk**: it survives restarts.",
  "   🔘 B. **Memory**: simpler.",
  "",
].join("\n");

// The same reply with a header's underline one column short, on line 4.
const SHORT_UNDERLINE = REPLY.replace("▔▔▔▔▔▔▔▔▔▔▔\n1. **Rework", "▔▔▔▔▔▔▔▔▔▔\n1. **Rework");

const DEFAULTS = JSON.stringify({
  counts: { turns: 20, "gh-timeout-ms": 20000 },
  keys: { dismiss: "q", next: "j", previous: "k", submit: "s", reassess: "r", help: "h" },
  pane: { "close-when-all-submitted": true },
  notes: { rows: 3 },
  marks: { sent: "☑️" },
  colors: {
    border: "promptBorder",
    "title-label": "inverseText",
    "title-background": "claude",
    code: "permission",
    hover: "suggestion",
    settled: "ide",
    close: "error",
    kanban: "claude",
  },
  "roll-up": { "summary-width": 100 },
  lint: { "turn-end": true },
});

const base64Of = (bytes: Uint8Array): string =>
  btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));

/** What the engine beneath the plugin does otherwise than by default. */
type Options = Readonly<{
  /** What `gh` prints; it fails, as a `gh` not installed does, where this is undefined. */
  gh?: () => string | undefined;
  /** The defaults file's text, in place of `DEFAULTS`. */
  defaults?: string;
  /** The user's own settings file, where there is one. */
  user?: string;
}>;

/**
 * The engine beneath the plugin: a transcript whose one turn writes `REPLY`
 * and raises `ITEM`, its records in `records`, which a test may add to, or
 * gone where `isTranscriptGone`; the tools the plugin registers in `tools`,
 * each sent prompt's context in `contexts`, each `gh` call in `runs`, what
 * the engine answers the next prompt with in `submitAnswer`, a `drop` to
 * refuse it, and the session's ids in `sessions`, each asked for taking the
 * first off until one is left, as a `/clear` moves the session on.
 */
const engine = (on: On, options: Options = {}) => {
  const { gh = () => "{}", defaults = DEFAULTS, user } = options;
  const state = {
    records: [human("9efb08a1", "go"), assistant(REPLY, [{ items: [ITEM] }])] as TranscriptRecord[],
    isTranscriptGone: false,
    tools: [] as Readonly<{ name: string; description: string }>[],
    contexts: [] as (readonly string[])[],
    runs: [] as (readonly string[])[],
    submitAnswer: undefined as { drop: string } | undefined,
    sessions: ["session-1"],
    answers: [] as string[],
  };
  const transcript = () =>
    new TextEncoder().encode(
      state.records.map((record) => `${JSON.stringify(record)}\n`).join(""),
    );
  on("tool.register", (_, e) => {
    state.tools.push({ name: e.name, description: e.description ?? "" });

    return { value: { tool: `mcp__${PLUGIN}__${e.name}` } };
  });
  on("command.register", (_, e) => ({ value: { command: e.name } }));
  on("process.run", (_, e) => {
    state.runs.push(e.argv);
    const stdout = gh();

    if (stdout === undefined) {
      throw new Error("gh: not found");
    }

    return {
      value: {
        exitCode: 0,
        stdout,
        stderr: "",
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    };
  });
  on("ui.open", () => ({ value: { isPlaced: true } }));
  on("ui.panes", () => ({ value: [] }));
  on("session.id", () => ({
    value: (state.sessions.length > 1 ? state.sessions.shift() : state.sessions[0]) ?? "",
  }));
  on("session.cwd", () => ({ value: "/work" }));
  on("session.start", (_, e) => ({ cwd: e.cwd }));
  on("session.end", (_, e) => ({ sessionId: e.sessionId }));
  on("session.info", () => ({ value: { transcriptPath: TRANSCRIPT } }));
  on("env.get", () => ({ value: "/home/neil" }));
  on("fs.exists", (_, e) => ({
    value: !e.path.startsWith(USER_FOLDER) || user !== undefined,
  }));
  on("fs.read", (_, e) => {
    if (e.path.startsWith(USER_FOLDER)) {
      return { value: user ?? "" };
    }
    if (e.path !== TRANSCRIPT) {
      return { value: defaults };
    }
    const offset = e.offset ?? 0;

    return {
      value: {
        base64: base64Of(transcript().slice(offset, offset + (e.length ?? Infinity))),
      },
    };
  });
  on("fs.stat", (_, e) => {
    if (e.path === TRANSCRIPT && state.isTranscriptGone) {
      throw new Error(`no such file: ${TRANSCRIPT}`);
    }

    return {
      value: { kind: "file", size: transcript().length, mtimeMs: 0, isLink: false },
    };
  });
  on("prompt.submit", (_, e) => {
    state.contexts.push(e.context ?? []);
    const answer = state.submitAnswer;
    state.submitAnswer = undefined;

    return answer ?? { text: e.text };
  });
  on("turn.start", (_, e) => ({ turnId: e.turnId }));
  on("turn.complete", (_, e) => {
    state.answers.push(e.answer);

    return { text: e.answer };
  });

  return state;
};

/** A main-loop answer ending its turn. */
const answered = (turnId: string, answer: string) =>
  ({
    turnId,
    reason: "answer",
    answer,
    durationMs: 1000,
    isAborted: false,
  }) as const;

const GO = { text: "go", wait: false, origin: { kind: "composer" } } as const;

/** What a tool call answered, as text. */
const resultOf = (answer: Readonly<{ result?: unknown }>): string =>
  typeof answer.result === "string" ? answer.result : "";

test("the session's start registers kanban_outstanding and kanban_lint beside kanban_options", async ($, on) => {
  const state = engine(on);
  await $.session.start({ cwd: "/work", surface: "terminal", isInteractive: true });

  expect(state.tools.map((tool) => tool.name)).toEqual([
    "kanban_options",
    "kanban_outstanding",
    "kanban_lint",
  ]);
  expect(state.tools[0]?.description).toContain("`kanban_outstanding`");
  expect(state.tools[0]?.description).not.toContain("outstanding.py");
});

test("kanban_outstanding gives the count line, the roll-up's draft and the open Decide items", async ($, on) => {
  engine(on);
  const text = resultOf(await $.tool.call({ tool: OUTSTANDING } as never));

  expect(text).toContain("📌 Outstanding: 🚧 1 · 🔍 1 · 🧠 1");
  expect(text).toContain(
    [
      `📌 **Outstanding from previous turns:**${BR}`,
      "━".repeat(35),
      `🚧 **Pending:**${BR}`,
      "- **Rework the loader** 🔖 9efb08a1₀",
    ].join("\n"),
  );
  expect(text).toContain(`"ref":"9efb08a1.Decide.1"`);
});

test("kanban_outstanding asks gh which pull requests merged, and leaves a merged one's Review item out", async ($, on) => {
  const state = engine(on, {
    gh: () => JSON.stringify({ data: { pr0: { pullRequest: { state: "MERGED" } } } }),
  });
  const text = resultOf(await $.tool.call({ tool: OUTSTANDING } as never));

  expect(state.runs.map((argv) => argv.slice(0, 3))).toEqual([["gh", "api", "graphql"]]);
  expect(text).toContain("📌 Outstanding: 🚧 1 · 🧠 1");
  expect(text).not.toContain("🔍 **Review:**");
  expect(text).not.toContain("merged is unknown");
});

test("kanban_outstanding says the merges are unknown where gh fails, and keeps the Review item", async ($, on) => {
  engine(on, { gh: () => undefined });
  const text = resultOf(await $.tool.call({ tool: OUTSTANDING } as never));

  expect(text).toMatch(/^Which pull requests merged is unknown: `gh` didn't answer/);
  expect(text).toContain("📌 Outstanding: 🚧 1 · 🔍 1 · 🧠 1");
});

test("kanban_outstanding says why, where the transcript can't be read", async ($, on) => {
  const state = engine(on);
  state.isTranscriptGone = true;
  const text = resultOf(await $.tool.call({ tool: OUTSTANDING } as never));

  // The engine reports the failed read in its own words.
  expect(text).toMatch(/^What earlier turns leave open could not be read: .*fs\.stat/);
  expect(text).not.toContain("Count line");
});

test("kanban_outstanding says why, where the settings can't be used", async ($, on) => {
  engine(on, { defaults: "counts: [" });
  const text = resultOf(await $.tool.call({ tool: OUTSTANDING } as never));

  expect(text).toMatch(/^What earlier turns leave open could not be read: /);
  expect(text).toContain("config.yaml");
});

test("kanban_lint gives each finding in a draft, by its line and rule", async ($, on) => {
  engine(on);
  const text = resultOf(await $.tool.call({ tool: LINT, text: SHORT_UNDERLINE } as never));

  expect(text).toContain("The lint finds 1 finding");
  expect(text).toContain("4: [underline-width]");
});

test("kanban_lint says a draft that keeps every rule does", async ($, on) => {
  engine(on);

  expect(resultOf(await $.tool.call({ tool: LINT, text: REPLY } as never))).toBe(
    "The lint finds nothing: the draft keeps every rule it checks.",
  );
});

test("kanban_lint says no draft was given, where its call holds none", async ($, on) => {
  engine(on);

  expect(resultOf(await $.tool.call({ tool: LINT } as never))).toContain("No draft was given");
});

test("the turn's end lints its answer, shows the findings beneath it and hands them to the agent with the next prompt, once", async ($, on) => {
  const state = engine(on);
  on("prompt.context", (_, e) => ({ blocks: e.blocks }));
  // The instructions reach the conversation's context, so the prompts'
  // contexts carry the lint's findings alone.
  await $.prompt.context({ blocks: [] });
  const done = await $.turn.complete(answered("t1", SHORT_UNDERLINE));

  expect(done.text).toContain("The reply lint finds 1 finding in the last final response");
  expect(done.text).toContain("4: [underline-width]");

  await $.prompt.submit(GO);
  await $.prompt.submit(GO);
  expect(state.contexts).toHaveLength(2);
  expect(state.contexts[0]).toEqual([done.text]);
  expect(state.contexts[1]).toEqual([]);
});

test("the turn's end passes the answer down as written, its lists and Decide items whole, so the stored reply keeps them", async ($, on) => {
  const state = engine(on);
  on("prompt.context", (_, e) => ({ blocks: e.blocks }));
  await $.prompt.context({ blocks: [] });

  // A clean answer and one the lint finds something in: neither is rewritten,
  // the findings going beneath the answer, never into it.
  await $.turn.complete(answered("t1", REPLY));
  const found = await $.turn.complete(answered("t2", SHORT_UNDERLINE));
  expect(state.answers).toEqual([REPLY, SHORT_UNDERLINE]);
  expect(found.text).not.toContain("🧠 **Decide:**");
});

test("a clean answer, or one in no list's shape, shows nothing beneath it and clears what waits", async ($, on) => {
  const state = engine(on);
  on("prompt.context", (_, e) => ({ blocks: e.blocks }));
  await $.prompt.context({ blocks: [] });

  await $.turn.complete(answered("t1", SHORT_UNDERLINE));
  expect((await $.turn.complete(answered("t2", REPLY))).text).toBe(REPLY);
  const prose = "The build took 9 minutes:\n| Step |\n| ---- |\n";
  expect((await $.turn.complete(answered("t3", prose))).text).toBe(prose);

  await $.prompt.submit(GO);
  expect(state.contexts).toEqual([[]]);
});

test("an agent's answer is not linted", async ($, on) => {
  engine(on);
  const done = await $.turn.complete({
    ...answered("t1", SHORT_UNDERLINE),
    agentId: "agent-1",
  } as never);

  expect(done.text).toBe(SHORT_UNDERLINE);
});

/** The engine, its instructions already in the conversation's context, so the prompts' contexts carry the lint's findings alone. */
const instructedEngine = async (
  $: Engine,
  on: On,
  options: Options = {},
) => {
  const state = engine(on, options);
  on("prompt.context", (_, e) => ({ blocks: e.blocks }));
  await $.prompt.context({ blocks: [] });

  return state;
};

test("a subagent's answer leaves the findings waiting", async ($, on) => {
  const state = await instructedEngine($, on);
  const done = await $.turn.complete(answered("t1", SHORT_UNDERLINE));
  await $.turn.complete({ ...answered("t2", REPLY), agentId: "agent-1" } as never);

  await $.prompt.submit(GO);
  expect(state.contexts).toEqual([[done.text]]);
});

test("a prompt the engine refuses leaves the findings for the next one", async ($, on) => {
  const state = await instructedEngine($, on);
  const done = await $.turn.complete(answered("t1", SHORT_UNDERLINE));
  state.submitAnswer = { drop: "a hook refused it" };

  await $.prompt.submit(GO);
  await $.prompt.submit(GO);
  await $.prompt.submit(GO);
  expect(state.contexts).toEqual([[done.text], [done.text], []]);
});

test("the session starting again in the same conversation, as at a /reload-plugins, keeps the findings", async ($, on) => {
  const state = await instructedEngine($, on);
  const done = await $.turn.complete(answered("t1", SHORT_UNDERLINE));
  await $.session.start({ cwd: "/work", surface: "terminal", isInteractive: true });

  await $.prompt.submit(GO);
  expect(state.contexts).toEqual([[done.text]]);
});

test("a /clear landing while the turn's end runs keeps the old conversation's findings from the next prompt", async ($, on) => {
  const state = await instructedEngine($, on);
  state.sessions = ["session-1", "session-2"];
  const done = await $.turn.complete(answered("t1", SHORT_UNDERLINE));

  expect(done.text).toContain("The reply lint finds");
  await $.prompt.submit(GO);
  expect(state.contexts).toEqual([[]]);
});

test("a /clear ends the conversation, and the next prompt carries none of its findings", async ($, on) => {
  const state = await instructedEngine($, on);
  await $.turn.complete(answered("t1", SHORT_UNDERLINE));
  await $.session.end({ reason: "clear", sessionId: "session-1", resume: { id: "session-1" } });

  await $.prompt.submit(GO);
  expect(state.contexts).toEqual([[]]);
});

test("a prompt in another conversation, after a compaction, carries none of the findings", async ($, on) => {
  const state = await instructedEngine($, on);
  const done = await $.turn.complete(answered("t1", SHORT_UNDERLINE));
  state.records.push({ isSidechain: false, type: "system", subtype: "compact_boundary" });

  await $.prompt.submit(GO);
  expect(done.text).toContain("The reply lint finds");
  expect(state.contexts).toHaveLength(1);
  expect(state.contexts[0]?.includes(done.text ?? "")).toBe(false);
});

test("with lint.turn-end off, the turn's end lints nothing", async ($, on) => {
  const state = await instructedEngine($, on, { user: "lint:\n  turn-end: false\n" });
  const done = await $.turn.complete(answered("t1", SHORT_UNDERLINE));

  expect(done.text).toBe(SHORT_UNDERLINE);
  await $.prompt.submit(GO);
  expect(state.contexts).toEqual([[]]);
  expect(resultOf(await $.tool.call({ tool: LINT, text: SHORT_UNDERLINE } as never))).toContain(
    "4: [underline-width]",
  );
});

test("the instructions name the tools, as the agent calls them", async ($, on) => {
  engine(on);
  on("prompt.context", (_, e) => ({ blocks: e.blocks }));
  const { blocks } = await $.prompt.context({ blocks: [] });
  const text = blocks.at(-1)?.text ?? "";

  expect(text).toContain(`\`${OUTSTANDING}\``);
  expect(text).toContain(`\`${LINT}\``);
});
