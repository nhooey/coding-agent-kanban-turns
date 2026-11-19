import { expect, test } from "claude-code/testing";
import type { On } from "claude-code";

const PLUGIN = "coding-agent-kanban-turns";
const TOOL = "mcp__coding-agent-kanban-turns__kanban_options";

const ITEMS = [
  {
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
  },
  {
    turn: "9efb08a1",
    list: "Decide",
    number: 2,
    summary: "Cleanups to start",
    kind: "checkbox",
    ref: "9efb08a1.Decide.2",
    options: [
      { letter: "A", name: "Matchers" },
      { letter: "B", name: "Dead code" },
      { letter: "C", name: "Stale render" },
    ],
  },
  {
    turn: "9efb08a1",
    list: "Decide",
    number: 3,
    summary: "Ship tonight?",
    kind: "binary",
    ref: "9efb08a1.Decide.3",
    options: [
      { letter: "Y", name: "Ship" },
      { letter: "N", name: "Hold" },
    ],
  },
] as const;

// An item a later reply raises.
const LATER = {
  ...ITEMS[0],
  turn: "b2c3d4e5",
  ref: "b2c3d4e5.Decide.1",
  summary: "Which loader to keep",
} as const;

// The settings the tests draw with: defaults/config.jsonc's values.
const DEFAULTS = JSON.stringify({
  outstanding: {
    script: "~/.claude/skills/coding-agent-kanban-turn-responses/scripts/outstanding.py",
    python: "python3",
    "timeout-ms": 20000,
  },
  keys: { dismiss: "q" },
  colors: {
    border: "promptBorder",
    title: "claude",
    code: "permission",
    chosen: "diffAddedWord",
    hover: "suggestion",
    expand: "claude",
  },
});

const ABOVE_PROMPT = {
  plugin: PLUGIN,
  component: "AbovePrompt",
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const;

const PANE = {
  plugin: PLUGIN,
  component: "Pane",
  requestId: "kanban-turns",
  props: {
    title: "🧠 Decide",
    isFocused: false,
    bodyColumns: 100,
    placement: "dock",
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const;

const ANSWERS = {
  command: "answers",
  args: "",
  origin: { kind: "composer" },
  presentation: { isFullscreen: true, columns: 100 },
} as const;

// The skill's count line, as `outstanding.py render --counts` prints it.
const COUNTS = "📌 Outstanding: 🚧 2 · 🤔 2 · 🔍 2 · 👉 2 · 🧠 3";

/**
 * The engine beneath the plugin: a prompt box held in `box`, the script's
 * Decide items from `open` and its count line from `counts`, the prompts
 * the plugin submits in `sent`, and each pane open with whether it asked
 * for the keyboard in `opens`. The kit has no layout to scroll a pane by,
 * so `$.ui.scroll` is refused here, as on a pane not drawn yet.
 */
const engine = (
  on: On,
  open: () => readonly unknown[],
  counts: () => string = () => `${COUNTS}\n`,
) => {
  const state = {
    box: "",
    sent: [] as string[],
    isPaneOpen: false,
    opens: [] as boolean[],
  };
  on("ui.open", (_, e) => {
    state.isPaneOpen = true;
    state.opens.push(e.focus === true);

    return { value: { isPlaced: true } };
  });
  on("ui.panes", () => ({
    value: state.isPaneOpen
      ? [
          {
            id: "kanban-turns",
            title: "🧠 Decide",
            isShown: true,
            isPlaced: true,
            isFocused: false,
          },
        ]
      : [],
  }));
  on("ui.close", () => {
    state.isPaneOpen = false;

    return { value: undefined };
  });
  on("session.id", () => ({ value: "session-1" }));
  on("session.cwd", () => ({ value: "/work" }));
  on("session.start", (_, e) => ({ cwd: e.cwd }));
  on("env.get", () => ({ value: "/home/neil" }));
  // The script is there; no user settings file is, so the shipped defaults
  // are what's in effect.
  on("fs.exists", (_, e) => ({
    value: !e.path.endsWith("/coding-agent-kanban-turns/config.jsonc"),
  }));
  // A test has no files, so the defaults file reads as this; the Node tests
  // (test/config.test.ts) hold the real one to the shape.
  on("fs.read", () => ({ value: DEFAULTS }));
  on("process.run", (_, e) => ({
    value: {
      exitCode: 0,
      stdout: e.argv.includes("--counts")
        ? counts()
        : JSON.stringify({ items: open() }),
      stderr: "",
      isStdoutTruncated: false,
      isStderrTruncated: false,
    },
  }));
  on("prompt.read", () => ({
    value: { text: state.box, cursor: state.box.length },
  }));
  on("prompt.fill", (_, e) => {
    state.box = e.text;

    return { isFilled: true };
  });
  on("prompt.submit", (_, e) => {
    state.sent.push(e.text);

    return { text: e.text };
  });
  on("turn.complete", (_, e) => ({ text: e.answer }));
  on("command.register", (_, e) => ({ value: { command: e.name } }));
  on("tool.register", (_, e) => ({
    value: { tool: `mcp__${PLUGIN}__${e.name}` },
  }));

  return state;
};

/** A reply of the main loop finishing, which refreshes the open items. */
const replyDone = (turnId: string) =>
  ({
    turnId,
    reason: "answer",
    answer: "reply",
    durationMs: 1000,
    isAborted: false,
  }) as const;

type Drawing = {
  findAll: (q: {
    type: string;
    text: RegExp;
  }) => Promise<readonly { text: string }[]>;
};

/** The items' titles, in the order drawn: a title's Text holds a Text per code span, which matches too, so each shows once. */
const titles = async (ui: Drawing) =>
  (await ui.findAll({ type: "Text", text: /^🧠 Decide\./ }))
    .map((found) => found.text)
    .filter((text, n, all) => text !== all[n - 1]);

for (const surface of ["terminal", "desktop"] as const) {
  test(`the pane lists every item and its options build the draft, on ${surface}`, async ($, on) => {
    const state = engine(on, () => ITEMS);
    await $.command.run(ANSWERS);
    const ui = await $.ui.mount({ ...PANE, surface });

    expect(await titles(ui)).toEqual([
      "🧠 Decide.1 · Which cache to keep",
      "🧠 Decide.2 · Cleanups to start",
      "🧠 Decide.3 · Ship tonight?",
    ]);

    // A radio option writes its reference on a line of its own.
    await ui.press({ key: "9efb08a1.Decide.1.B" });
    expect(state.box).toBe("9efb08a1.Decide.1.B\n");

    // A checkbox item takes several letters, in option order.
    await ui.press({ key: "9efb08a1.Decide.2.C" });
    await ui.press({ key: "9efb08a1.Decide.2.A" });
    expect(state.box).toBe("9efb08a1.Decide.1.B\n9efb08a1.Decide.2.A,C\n");

    // Another option replaces the item's reference.
    await ui.press({ key: "9efb08a1.Decide.1.A" });
    expect(state.box).toBe("9efb08a1.Decide.1.A\n9efb08a1.Decide.2.A,C\n");

    // No click sent anything.
    expect(state.sent).toEqual([]);
    await ui.unmount();
  });
}

test("/answers opens the pane with the keyboard, and ❌ closes it", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  expect(state.isPaneOpen).toBe(true);
  expect(state.opens).toEqual([true]);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press({ key: "dismiss" });
  expect(state.isPaneOpen).toBe(false);
  await ui.unmount();
});

test("/answers-config lists each setting in effect and its file", async ($, on) => {
  engine(on, () => ITEMS);
  const shown = await $.command.run({ ...ANSWERS, command: "answers-config" });
  expect(JSON.stringify(shown)).toContain('keys.dismiss = \\"q\\"  # defaults: ');
});

test("the pane keeps every item raised, newest at the bottom, a settled one dimmed and dead", async ($, on) => {
  const open: unknown[] = [...ITEMS];
  const state = engine(on, () => open);
  await $.tool.call({ tool: TOOL, items: ITEMS } as never);
  await $.turn.complete(replyDone("t1"));
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  // A later reply raises one more, and item 1 is answered meanwhile.
  open.splice(0, 1);
  open.push(LATER);
  await $.tool.call({ tool: TOOL, items: [LATER] } as never);
  await $.turn.complete(replyDone("t2"));

  expect(await titles(ui)).toEqual([
    "🧠 Decide.1 · Which cache to keep (settled)",
    "🧠 Decide.2 · Cleanups to start",
    "🧠 Decide.3 · Ship tonight?",
    "🧠 Decide.1 · Which loader to keep",
  ]);
  await ui.press({ key: "9efb08a1.Decide.1.A" });
  expect(state.box).toBe("");
  await ui.press({ key: "b2c3d4e5.Decide.1.B" });
  expect(state.box).toBe("b2c3d4e5.Decide.1.B\n");
  await ui.unmount();
});

test("a reply that raises a new item opens the pane without the keyboard, at its end", async ($, on) => {
  const open: unknown[] = [...ITEMS];
  const state = engine(on, () => open);
  await $.turn.complete(replyDone("t1"));
  expect(state.opens).toEqual([false]);

  // The pane stays open while the next prompt runs.
  await $.prompt.submit({
    text: "go on",
    wait: false,
    origin: { kind: "composer" },
  });
  expect(state.isPaneOpen).toBe(true);

  // Closed by the person, it opens again only for an item it hasn't shown.
  state.isPaneOpen = false;
  await $.turn.complete(replyDone("t2"));
  expect(state.isPaneOpen).toBe(false);
  open.push(LATER);
  await $.turn.complete(replyDone("t3"));
  expect(state.isPaneOpen).toBe(true);
  expect(state.opens).toEqual([false, false]);
});

test("an agent's turn doesn't open the pane", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.turn.complete({ ...replyDone("t1"), agentId: "agent-1" } as never);
  expect(state.isPaneOpen).toBe(false);
});

test("the session's start opens the pane without the keyboard when items are open", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.session.start({
    cwd: "/work",
    surface: "terminal",
    isInteractive: true,
  });
  // The refresh runs after the start returns: wait on the engine meanwhile,
  // with an agent's turn, which the mod passes by.
  for (let n = 0; n < 100 && !state.isPaneOpen; n += 1) {
    await $.turn.complete({ ...replyDone(`w${n}`), agentId: "agent-1" } as never);
  }
  expect(state.opens).toEqual([false]);
});

test("above the prompt: the count line and 🪟 ↗, each opening the pane with the keyboard", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.turn.complete(replyDone("t1"));
  state.isPaneOpen = false;
  const line = await $.ui.mount({ ...ABOVE_PROMPT, surface: "terminal" });

  expect((await line.find({ type: "Button", key: "counts" }))?.text).toBe(
    COUNTS,
  );
  const drawn = JSON.stringify(await line.drawn());
  expect(drawn).toContain("🪟");
  expect(drawn).toContain("↗");
  expect(drawn).not.toContain("Which cache to keep");

  await line.press({ key: "open-pane" });
  expect(state.isPaneOpen).toBe(true);
  state.isPaneOpen = false;
  await line.press({ key: "counts" });
  expect(state.isPaneOpen).toBe(true);
  expect(state.opens).toEqual([false, true, true]);
  await line.unmount();
});

test("without a count line nothing is drawn above the prompt", async ($, on) => {
  engine(on, () => ITEMS, () => "");
  await $.turn.complete(replyDone("t1"));
  const line = await $.ui.mount({ ...ABOVE_PROMPT, surface: "terminal" });

  expect(await line.find({ type: "Button", key: "counts" })).toBeUndefined();
  expect(await line.find({ type: "Button", key: "open-pane" })).toBeUndefined();
  await line.unmount();
});

test("another drawing above the prompt still shows, after the count line", async ($, on) => {
  engine(on, () => ITEMS);
  on("ui.render", ($, e) => {
    const { Text } = $.ui.resolve(e);

    return <Text>agents tree</Text>;
  });
  const line = await $.ui.mount({ ...ABOVE_PROMPT, surface: "terminal" });
  await $.turn.complete(replyDone("t1"));
  // Where `text` first shows in the tree as drawn, -1 when it doesn't.
  const at = async (text: string) =>
    JSON.stringify(await line.drawn()).indexOf(text);

  // The hook calls no next(e): the engine stacks the other drawing itself.
  expect(await at(COUNTS)).toBeGreaterThan(-1);
  expect(await at("agents tree")).toBeGreaterThan(await at(COUNTS));
  await line.unmount();
});

test("an option's pros and cons pick it too", async ($, on) => {
  const state = engine(on, () => [
    {
      ...ITEMS[0],
      options: [
        {
          letter: "A",
          name: "Disk",
          pros: ["Survives restarts."],
          cons: ["Disk use."],
        },
        {
          letter: "B",
          name: "Memory",
          pros: ["Less code."],
          cons: ["Slow cold starts."],
        },
      ],
    },
  ]);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  await ui.press({ key: "9efb08a1.Decide.1.B-con-0" });
  expect(state.box).toBe("9efb08a1.Decide.1.B\n");
  await ui.press({ key: "9efb08a1.Decide.1.A-pro-0" });
  expect(state.box).toBe("9efb08a1.Decide.1.A\n");

  // Under the pointer an option lights the gutter left of each of its
  // lines, in the hover colour, and no longer inverts its text.
  const drawn = JSON.stringify(await ui.drawn());
  expect(drawn).toContain(
    '"scope":"9efb08a1.Decide.1.A","backgroundColor":"suggestion"',
  );
  expect(drawn).not.toContain('"inverse":true');
  await ui.unmount();
});

test("the notes field writes a note into the draft", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  await ui.press({ key: "9efb08a1.Decide.1.B" });
  await ui.input({ key: "9efb08a1.Decide.1.notes", text: "only for the loader" });
  expect(state.box).toBe("9efb08a1.Decide.1.B: only for the loader\n");
  expect(state.sent).toEqual([]);
  await ui.unmount();
});

const REPLY = {
  plugin: PLUGIN,
  component: "AssistantMessage",
  surface: "terminal",
  props: {
    text: "Some work.\n\n1. **Which cache to keep**  \n   Or wait.\n3. **Ship tonight?**  ",
    isFirstOfReply: true,
  },
} as const;

test("a reply draws its items under its text, a settled one dimmed", async ($, on) => {
  const open: unknown[] = [...ITEMS];
  const state = engine(on, () => open);
  await $.tool.call({ tool: TOOL, items: ITEMS } as never);
  await $.turn.complete(replyDone("t0"));
  const reply = await $.ui.mount(REPLY);

  // The reply's text first, then its two items, in its order.
  const drawn = JSON.stringify(await reply.drawn());
  expect(drawn.indexOf("Some work.")).toBeGreaterThan(-1);
  expect(drawn.indexOf("🧠 Decide.1 · Which cache to keep")).toBeGreaterThan(
    drawn.indexOf("Some work."),
  );
  expect(await titles(reply)).toEqual([
    "🧠 Decide.1 · Which cache to keep",
    "🧠 Decide.3 · Ship tonight?",
  ]);
  await reply.press({ key: "9efb08a1.Decide.3.N" });
  expect(state.box).toBe("9efb08a1.Decide.3.N\n");

  // Item 1 is answered elsewhere: the next refresh no longer lists it.
  open.splice(0, 1);
  await $.turn.complete(replyDone("t1"));
  expect(await titles(reply)).toEqual([
    "🧠 Decide.1 · Which cache to keep (settled)",
    "🧠 Decide.3 · Ship tonight?",
  ]);
  await reply.press({ key: "9efb08a1.Decide.1.A" });
  expect(state.box).toBe("9efb08a1.Decide.3.N\n");
  await reply.unmount();
});

test("a question in a reply opens the pane with the keyboard, though it can't scroll here", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.tool.call({ tool: TOOL, items: ITEMS } as never);
  await $.turn.complete(replyDone("t0"));
  state.isPaneOpen = false;
  const reply = await $.ui.mount(REPLY);

  await reply.press({
    key: "kanban-questions",
    link: { href: "https://kanban-turns.invalid/9efb08a1.Decide.3" },
  });
  expect(state.isPaneOpen).toBe(true);
  expect(state.opens).toEqual([false, true]);
  await reply.unmount();
});

test("a reply without the items' summaries is drawn as the engine draws it", async ($, on) => {
  engine(on, () => ITEMS);
  await $.tool.call({ tool: TOOL, items: ITEMS } as never);
  const reply = await $.ui.mount({
    ...REPLY,
    props: { ...REPLY.props, text: "Nothing to decide." },
  });

  expect(await titles(reply)).toEqual([]);
  await reply.unmount();
});

test("Reassess submits the reassess command and leaves the pane open", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press({ key: "reassess" });

  expect(state.sent).toEqual(["reassess"]);
  expect(state.box).toBe("");
  expect(state.isPaneOpen).toBe(true);
  await ui.unmount();
});

const TOOL_ROW = {
  tool_use_id: "toolu_1",
  tool: TOOL,
  input: { items: ITEMS },
  isRunning: false,
  isErrored: false,
  isInterrupted: false,
};

const TOOL_RESULT = {
  tool_use_id: "toolu_1",
  tool: TOOL,
  output: "Drew buttons for 3 Decide items under the final response",
  isErrored: false,
};

test("the tool's result line shows only in ctrl+o or on an error", async ($, on) => {
  on("ui.render", ($, e) => {
    const { Text } = $.ui.resolve(e);

    return <Text>result line</Text>;
  });
  const result = await $.ui.mount({
    plugin: PLUGIN,
    surface: "terminal",
    component: "ToolResult",
    requestId: "toolu_1",
    props: TOOL_RESULT,
  });

  expect(
    await result.find({ type: "Text", text: /result line/ }),
  ).toBeUndefined();
  await result.redraw({ ...TOOL_RESULT, isExpanded: true });
  expect(
    await result.find({ type: "Text", text: /result line/ }),
  ).toBeDefined();
  await result.redraw({ ...TOOL_RESULT, isErrored: true });
  expect(
    await result.find({ type: "Text", text: /result line/ }),
  ).toBeDefined();
  await result.unmount();
});

test("the tool's row draws nothing, its items going under the reply, but in ctrl+o", async ($, on) => {
  engine(on, () => ITEMS);
  on("ui.render", ($, e) => {
    const { Text } = $.ui.resolve(e);

    return <Text>engine row</Text>;
  });
  await $.tool.call({ tool: TOOL, items: ITEMS } as never);
  const row = await $.ui.mount({
    plugin: PLUGIN,
    surface: "terminal",
    component: "ToolUse",
    requestId: "toolu_1",
    props: TOOL_ROW,
  });

  expect(await row.find({ type: "Text", text: /engine row/ })).toBeUndefined();
  expect(await titles(row)).toEqual([]);
  await row.redraw({ ...TOOL_ROW, isExpanded: true });
  expect(await row.find({ type: "Text", text: /engine row/ })).toBeDefined();
  await row.redraw({ ...TOOL_ROW, isInterrupted: true });
  expect(await row.find({ type: "Text", text: /engine row/ })).toBeDefined();
  await row.unmount();
});

test("the context tells the agent about the mod's tool, and keeps the rest", async ($, on) => {
  engine(on, () => []);
  on("prompt.context", (_, e) => ({ blocks: e.blocks }));
  const engineBlocks = [
    { name: "claudeMd", text: "the instruction files" },
    { name: "currentDate", text: "Today's date is 2026-11-17." },
  ];
  const { blocks } = await $.prompt.context({ blocks: engineBlocks });

  expect(blocks.slice(0, -1)).toEqual(engineBlocks);
  expect(blocks.at(-1)?.name).toBe("kanbanTurns");
  expect(blocks.at(-1)?.text).toContain(`\`${TOOL}\``);
});
