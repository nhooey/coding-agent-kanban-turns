import { expect, test } from "claude-code/testing";
import type { On, Register } from "claude-code";

// The transcript's records, trimmed as test/fixtures/records.ts trims them for the
// Node tests: the engine's test kit loads this file alone.
type TranscriptRecord = Readonly<Record<string, unknown>>;

/** A prompt the user typed, its turn's id `id`. */
const human = (id: string, text: string): TranscriptRecord => ({
  isSidechain: false,
  type: "user",
  promptId: `${id}-0000-4000-8000-000000000000`,
  turnOrigin: "human",
  origin: { kind: "human" },
  message: { role: "user", content: text },
});

/** A draft this plugin's Submit or Reassess sent as the user: the text as it is, the plugin named only in `origin`. */
const submitted = (id: string, text: string): TranscriptRecord => ({
  ...human(id, text),
  turnOrigin: "system",
  promptSource: "system",
  origin: { kind: "plugin", name: "coding-agent-kanban-turns", asUser: true },
});

/** A reply: its text, and a `kanban_options` call for each of `calls`. */
const assistant = (
  text: string,
  calls: readonly unknown[] = [],
): TranscriptRecord => ({
  isSidechain: false,
  type: "assistant",
  message: {
    role: "assistant",
    content: [
      { type: "text", text },
      ...calls.map((input) => ({
        type: "tool_use",
        id: "toolu_1",
        name: "mcp__coding-agent-kanban-turns__kanban_options",
        input,
      })),
    ],
  },
});

/** A message sent while a turn ran: a `queued_command` attachment. */
const queued = (text: string): TranscriptRecord => ({
  isSidechain: false,
  type: "attachment",
  attachment: { type: "queued_command", prompt: text, origin: { kind: "human" } },
});

/** The records as the file holds them, one JSON object a line. */
const jsonl = (records: readonly TranscriptRecord[]): string =>
  records.map((record) => `${JSON.stringify(record)}\n`).join("");

const PLUGIN = "coding-agent-kanban-turns";
// The line a draft the clicks start opens with: the plugin's name, which is
// all of its id the engine gives, and a colon.
const HEADER = `${PLUGIN}:\n`;
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

// The settings the tests draw with: defaults/config.yaml's values, as JSON,
// which YAML reads too.
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

type Item = Readonly<{
  number: number;
  summary: string;
  kind?: string;
  options?: readonly Readonly<{ letter: string; name: string }>[];
}>;

/** An option's glyph, by its item's kind. */
const glyph = (kind: string | undefined, letter: string): string =>
  kind === "checkbox" ? "🔲" : kind === "binary" ? (letter === "N" ? "👎" : "👍") : "🔘";

/** A reply as the kanban skill writes it: a Pending item, then a Decide list of `items`, each by its summary and options. */
const listsText = (items: readonly Item[]): string =>
  [
    "Some work.",
    "",
    "🚧 **Pending:**  ",
    "1. **Rework the loader**",
    "",
    ...(items.length > 0
      ? [
          "🧠 **Decide:**  ",
          ...items.flatMap((i) => [
            `${i.number}. **${i.summary}**`,
            ...(i.options ?? []).map(
              (o) => `   ${glyph(i.kind, o.letter)} ${o.letter}. **${o.name}**`,
            ),
          ]),
        ]
      : []),
    "",
  ].join("\n");

// The count line the plugin works out from listsText(ITEMS).
const COUNTS = "📌 Outstanding: 🚧 1 · 🧠 3";

/** A reply raising `items` with a kanban_options call, as a transcript record. */
const replyRecord = (
  items: readonly unknown[],
  text: string,
): TranscriptRecord => assistant(text, [{ items }]);

// Where the engine says the session's transcript is.
const TRANSCRIPT = "/home/neil/.claude/projects/-work/session-1.jsonl";

// The folder the user's settings file is in, as $XDG_CONFIG_HOME and $HOME,
// which the engine below both answers with /home/neil, lead to.
const USER_FOLDER = "/home/neil/coding-agent-kanban-turns/";

/** The base64 of bytes, as `$.fs.read` gives them. */
const base64Of = (bytes: Uint8Array): string =>
  btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));

/**
 * The engine beneath the plugin: a prompt box held in `box`, a transcript
 * file whose first turn raises the items `open` holds, in a reply `text`
 * writes, then the records `later` holds, the prompts the plugin submits in `sent`,
 * each pane open with whether it asked for the keyboard in `opens`, and
 * each command run in `runs`, `gh` answering with what `gh` gives, or
 * failing to start where it gives undefined. The kit has no layout to
 * scroll a pane by, so `$.ui.scroll` is refused here, as on a pane not
 * drawn yet.
 */
const engine = (
  on: On,
  open: () => readonly unknown[],
  text: (items: readonly Item[]) => string = listsText,
  later: () => readonly TranscriptRecord[] = () => [],
  gh: () => string | undefined | Promise<string | undefined> = () => undefined,
) => {
  const transcript = () =>
    new TextEncoder().encode(
      jsonl([
        human("9efb08a1", "go"),
        replyRecord(open(), text(open() as readonly Item[])),
        ...later(),
      ]),
    );
  const state = {
    box: "",
    sent: [] as string[],
    // Each sent prompt's context, as it reached the engine.
    contexts: [] as (readonly string[])[],
    asUser: [] as boolean[],
    isPaneOpen: false,
    opens: [] as boolean[],
    runs: [] as (readonly string[])[],
    isUnreadable: false,
    isFillRefused: false,
    // What a fill of the box throws, as a box gone from under it would.
    fillError: undefined as Error | undefined,
    // Why a hook beneath the plugin refuses to close the pane; none closes it.
    closeDenial: undefined as string | undefined,
    // The box takes no text added after a draft, as a dialog opening while
    // a submit is pending would leave it.
    isAppendRefused: false,
    submitAnswer: undefined as { drop: string } | Error | undefined,
    // What the person types into the box while a submit is pending.
    typedMeanwhile: "",
    // What the next submit waits on before the engine answers it, once.
    holdSubmit: undefined as (() => Promise<void>) | undefined,
    // What the next read of the transcript waits on before it answers, once.
    holdRead: undefined as (() => Promise<void>) | undefined,
    // What each command registration waits on, as the session starts.
    registering: undefined as (() => Promise<void>) | undefined,
    // The user's settings files, by name, in their folder; none by default.
    userFiles: {} as Record<string, string>,
    // Whether the plugin's own defaults file is gone from its folder.
    isDefaultsMissing: false,
    isRingMovable: false,
    focus: [] as string[],
  };
  /** The user's settings file at `path`, by its name, when `path` is in their folder. */
  const userFile = (path: string): string | undefined =>
    path.startsWith(USER_FOLDER)
      ? state.userFiles[path.slice(USER_FOLDER.length)]
      : undefined;
  // The pane's focus ring as the engine moves it for the person: nothing
  // beneath the plugins answers, unless a test lets it land, keeping each
  // element it lands on.
  on("ui.focus", (_, e, next) => {
    if (!state.isRingMovable) {
      return next(e);
    }
    state.focus.push(e.element ?? "");

    return {};
  });
  on("process.run", async (_, e) => {
    state.runs.push(e.argv);
    const stdout = await gh();

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
    if (state.closeDenial !== undefined) {
      return { deny: state.closeDenial };
    }
    state.isPaneOpen = false;

    return { value: undefined };
  });
  on("session.id", () => ({ value: "session-1" }));
  on("session.cwd", () => ({ value: "/work" }));
  on("session.start", (_, e) => ({ cwd: e.cwd }));
  on("env.get", () => ({ value: "/home/neil" }));
  // A user settings file is there only where `userFiles` holds it, so by
  // default the shipped defaults are what's in effect; the defaults file is
  // there unless `isDefaultsMissing`.
  on("fs.exists", (_, e) => ({
    value: e.path.startsWith(USER_FOLDER)
      ? userFile(e.path) !== undefined
      : !(state.isDefaultsMissing && e.path.endsWith("/defaults/config.yaml")),
  }));
  // A test has no files, so the defaults file reads as this; the Node tests
  // (test/unit/config/) hold the real one to the fixture's shape. The transcript is
  // read as bytes, by the range asked for.
  on("fs.read", async (_, e) => {
    if (e.path !== TRANSCRIPT) {
      return { value: userFile(e.path) ?? DEFAULTS };
    }
    const hold = state.holdRead;
    state.holdRead = undefined;
    await hold?.();
    const offset = e.offset ?? 0;
    const bytes = transcript().slice(offset, offset + (e.length ?? Infinity));

    return { value: { base64: base64Of(bytes) } };
  });
  on("fs.stat", () => {
    return state.isUnreadable
      ? { deny: "the transcript is gone" }
      : {
          value: { kind: "file", size: transcript().length, mtimeMs: 0, isLink: false },
        };
  });
  on("session.info", () => ({ value: { transcriptPath: TRANSCRIPT } }));
  on("prompt.read", () => ({
    value: { text: state.box, cursor: state.box.length },
  }));
  // A box under a dialog takes no text.
  on("prompt.fill", (_, e) => {
    if (state.fillError !== undefined) {
      throw state.fillError;
    }
    if (state.isFillRefused || (state.isAppendRefused && e.mode === "append")) {
      return { isFilled: false };
    }
    state.box = e.mode === "append" ? `${state.box}${e.text}` : e.text;

    return { isFilled: true };
  });
  // The engine takes a prompt, refuses it with a `drop`, or throws.
  on("prompt.submit", async (_, e) => {
    // A tick, as the engine's own submit takes: a second press can land meanwhile.
    await Promise.resolve();
    const hold = state.holdSubmit;
    state.holdSubmit = undefined;
    await hold?.();
    state.box = `${state.box}${state.typedMeanwhile}`;
    const answer = state.submitAnswer;

    if (answer instanceof Error) {
      throw answer;
    }
    if (answer !== undefined) {
      return answer;
    }
    state.sent.push(e.text);
    state.contexts.push(e.context ?? []);
    state.asUser.push(e.origin.kind === "plugin" && e.origin.asUser === true);

    return { text: e.text };
  });
  on("turn.start", (_, e) => ({ turnId: e.turnId }));
  on("turn.complete", (_, e) => ({ text: e.answer }));
  on("command.register", async (_, e) => {
    await state.registering?.();

    return { value: { command: e.name } };
  });
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
  }) => Promise<readonly { text: string; key: string | undefined }[]>;
};

/**
 * The items' title lines, in the order drawn, each as `label · summary`: a
 * title is a Box keyed `<ref>.title-hang` holding the label, then the
 * summary, which wraps under its own start.
 */
const titles = async (ui: Drawing) =>
  (await ui.findAll({ type: "Box", text: /^ 🧠 Decide\.\d+ / }))
    .filter((found) => found.key?.endsWith(".title-hang"))
    .map((found) => found.text.trim().replace(/^(🧠 Decide\.\d+)\s+/, "$1 · "));

type Pressable = Drawing & {
  press: (target: { key: string }) => Promise<unknown>;
};

/** The pane's turn headers, in the order drawn. */
const turnHeaders = async (ui: Drawing) =>
  (await ui.findAll({ type: "Text", text: /^── / })).map((found) => found.text);

/**
 * The Done items' one-line rows, in the order drawn, once their sections
 * are open, each as `label  text`: a Box keyed `<ref>.line-hang` holding
 * the label, then the text, which wraps under its own start.
 */
const doneLines = async (ui: Drawing) =>
  (await ui.findAll({ type: "Box", text: /^🧠 Decide\.\d+/ }))
    .filter((found) => found.key?.endsWith(".line-hang"))
    .map((found) => found.text.replace(/^(🧠 Decide\.\d+)/, "$1  "));

/** What a line's lead says, `🔘 A. ` or `➕ `, by the line's key: the lead is plain text in a Box keyed `<key>-hang-lead`. */
const leadOf = async (
  ui: { find: (q: { type: "Box"; key: string }) => Promise<{ text: string } | undefined> },
  key: string,
) => (await ui.find({ type: "Box", key: `${key}-hang-lead` }))?.text;

/** Opens every Done section of the pane, by the Done headers drawn. */
const openDone = async (ui: Pressable) => {
  for (const found of await ui.findAll({ type: "Button", text: /^▸ Done \(\d+\)$/ })) {
    await ui.press({ key: found.key ?? "" });
  }
};

/** What the pane says about the last Submit that sent nothing, if it says anything. */
const sendProblem = async (ui: Drawing) =>
  (await ui.findAll({ type: "Text", text: /^Not sent/ }))[0]?.text;

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

    // A radio option writes its reference on a line of its own, under a
    // line naming the plugin, since the box was empty.
    await ui.press({ key: "9efb08a1.Decide.1.B" });
    expect(state.box).toBe(`${HEADER}9efb08a1.Decide.1.B\n`);

    // A checkbox item takes several letters, in option order; the line
    // naming the plugin stays first, once.
    await ui.press({ key: "9efb08a1.Decide.2.C" });
    await ui.press({ key: "9efb08a1.Decide.2.A" });
    expect(state.box).toBe(`${HEADER}9efb08a1.Decide.1.B\n9efb08a1.Decide.2.A,C\n`);

    // Another option replaces the item's reference.
    await ui.press({ key: "9efb08a1.Decide.1.A" });
    expect(state.box).toBe(`${HEADER}9efb08a1.Decide.1.A\n9efb08a1.Decide.2.A,C\n`);

    // A chosen option is marked ✅ and underlined, never highlighted.
    const drawn = JSON.stringify(await ui.drawn());
    expect(drawn).toContain("✅");
    expect(drawn).toContain('"underline":true');
    expect(drawn).not.toContain("diffAddedWord");

    // A second click on the chosen option unchooses it.
    await ui.press({ key: "9efb08a1.Decide.1.A" });
    expect(state.box).toBe(`${HEADER}9efb08a1.Decide.2.A,C\n`);

    // Unpicking every answer takes the line naming the plugin out too.
    await ui.press({ key: "9efb08a1.Decide.2.A" });
    await ui.press({ key: "9efb08a1.Decide.2.C" });
    expect(state.box).toBe("");

    // No click sent anything.
    expect(state.sent).toEqual([]);
    await ui.unmount();
  });
}

test("/answers opens the pane with the keyboard, and ✖ Close closes it", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  expect(state.isPaneOpen).toBe(true);
  expect(state.opens).toEqual([true]);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  // `glyph label` as every button is, the ✖ in the close colour, on no
  // background.
  const close = await ui.find({ type: "Button", key: "dismiss" });
  expect(close?.text).toBe("✖ Close");
  expect(close?.props).toMatchObject({ role: "dismiss", hotkey: "q", plain: true, dimColor: false });
  const glyph = await ui.find({ type: "Text", text: /^✖$/ });
  expect(glyph?.props).toMatchObject({ color: "error" });
  expect(glyph?.props).not.toHaveProperty("backgroundColor");
  expect(JSON.stringify(await ui.drawn())).not.toContain("❌");

  await ui.press({ key: "dismiss" });
  expect(state.isPaneOpen).toBe(false);
  await ui.unmount();
});

test("/answers-config lists each setting in effect and its file", async ($, on) => {
  engine(on, () => ITEMS);
  const shown = await $.command.run({ ...ANSWERS, command: "answers-config" });
  expect(JSON.stringify(shown)).toContain('keys.dismiss = \\"q\\"  # defaults: ');
});

test("a user's config.yaml is read", async ($, on) => {
  const state = engine(on, () => ITEMS);
  state.userFiles = { "config.yaml": "keys:\n  dismiss: x # mine\n" };
  const shown = JSON.stringify(
    await $.command.run({ ...ANSWERS, command: "answers-config" }),
  );

  expect(shown).toContain(
    `keys.dismiss = \\"x\\"  # user: ${USER_FOLDER}config.yaml`,
  );
  expect(shown).not.toContain("Not used");
});

test("with no defaults file, no settings are used, and /answers, the pane and /answers-config say it's missing", async ($, on) => {
  const state = engine(on, () => ITEMS);
  state.isDefaultsMissing = true;
  state.userFiles = { "config.yaml": "keys:\n  dismiss: x\n" };
  const missing = "/defaults/config.yaml: is missing";

  const answered = (await $.command.run(ANSWERS)).text ?? "";
  expect(answered).toMatch(/^No open Decide items: .*\/defaults\/config\.yaml: is missing\.$/);
  // The user's sound file gives no problem of its own.
  expect(answered).not.toContain(USER_FOLDER);

  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  const drawn = JSON.stringify(await ui.drawn());
  expect(drawn).toContain(missing);
  expect(drawn).not.toContain(USER_FOLDER);
  await ui.unmount();

  const config = (await $.command.run({ ...ANSWERS, command: "answers-config" })).text ?? "";
  expect(config.split("\n")).toEqual([expect.stringMatching(/^Not used: .*\/defaults\/config\.yaml: is missing$/)]);
});

test("a user's config.jsonc is not read: the defaults are in effect", async ($, on) => {
  const state = engine(on, () => []);
  state.userFiles = { "config.jsonc": '{"keys": {"dismiss": "z"}}' };
  const shown = await $.command.run({ ...ANSWERS, command: "answers-config" });
  const lines = (shown.text ?? "").split("\n");

  expect(lines.find((line) => line.startsWith("keys.dismiss = "))).toMatch(
    /^keys\.dismiss = "q"  # defaults: /,
  );
  expect(lines.filter((line) => line.startsWith("Not used"))).toEqual([]);

  // /answers's line for no open items, and the pane, name no settings problem.
  expect((await $.command.run(ANSWERS)).text).toBe("No open Decide items.");
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  expect(await ui.find({ type: "Text", text: "Nothing open" })).toBeDefined();
  expect(JSON.stringify(await ui.drawn())).not.toContain("config.jsonc");
  await ui.unmount();
});

test("the pane keeps every item raised, newest turn first, a Done one in its turn's collapsed Done section", async ($, on) => {
  const later: TranscriptRecord[] = [];
  const state = engine(on, () => ITEMS, listsText, () => later);
  await $.turn.complete(replyDone("t1"));
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  // A later reply raises one more, and item 1 is answered meanwhile.
  later.push(
    human("b2c3d4e5", "9efb08a1.Decide.1.A"),
    replyRecord([LATER], listsText([LATER])),
  );
  await $.turn.complete(replyDone("t2"));

  // Each turn under a faint header naming its index, the latest ₀; its open
  // items drawn in full.
  expect(await turnHeaders(ui)).toEqual(["── b2c3d4e5 ₀ ──", "── 9efb08a1 ₋₁ ──"]);
  expect((await ui.find({ type: "Text", text: /^── 9efb08a1/ }))?.props).toMatchObject({ dimColor: true });
  expect(await titles(ui)).toEqual([
    "🧠 Decide.1 · Which loader to keep",
    "🧠 Decide.2 · Cleanups to start",
    "🧠 Decide.3 · Ship tonight?",
  ]);

  // The Done section is collapsed: its header alone, none of the item's
  // elements.
  const header = await ui.find({ type: "Button", key: "9efb08a1.done" });
  expect(header?.text).toBe("▸ Done (1)");
  expect(header?.props["dimColor"]).not.toBe(true);
  expect(await ui.find({ type: "Button", key: "9efb08a1.Decide.1.A" })).toBeUndefined();
  expect(await doneLines(ui)).toEqual([]);

  // A click opens it to one dim line per Done item, opened by a ▌ in the
  // settled colour.
  await ui.press({ key: "9efb08a1.done" });
  expect((await ui.find({ type: "Button", key: "9efb08a1.done" }))?.text).toBe("▾ Done (1)");
  expect(await doneLines(ui)).toEqual([
    "🧠 Decide.1  Which cache to keep · Answered in b2c3d4e5: A",
  ]);
  expect((await ui.find({ type: "Button", key: "9efb08a1.Decide.1.line" }))?.props).toMatchObject({
    dimColor: true,
  });
  expect((await ui.find({ type: "Text", text: /^▌$/ }))?.props).toMatchObject({
    color: "ide",
  });
  expect(await ui.find({ type: "Button", key: "9efb08a1.Decide.1.A" })).toBeUndefined();

  // A click on the line opens the item's full box, dimmed but for its
  // options, which pick as an open item's do: a click writes a fresh
  // reference into the draft and marks the option ✅, the sent answer
  // keeping its ☑️, and the item stays in its Done section. A click on its
  // title closes it to its line again.
  await ui.press({ key: "9efb08a1.Decide.1.line" });
  expect(await titles(ui)).toContain("🧠 Decide.1 · Which cache to keep (done)");
  await ui.press({ key: "9efb08a1.Decide.1.B" });
  expect(state.box).toBe(`${HEADER}9efb08a1.Decide.1.B\n`);
  expect(await leadOf(ui, "9efb08a1.Decide.1.B")).toBe("✅ B. ");
  expect(await leadOf(ui, "9efb08a1.Decide.1.A")).toBe("☑️ A. ");
  expect((await ui.find({ type: "Button", key: "9efb08a1.Decide.1.B" }))?.props["dimColor"]).not.toBe(true);
  expect(await titles(ui)).toContain("🧠 Decide.1 · Which cache to keep (done)");
  await ui.press({ key: "9efb08a1.Decide.1.B" });
  expect(state.box).toBe("");
  await ui.press({ key: "9efb08a1.Decide.1.line" });
  expect(await titles(ui)).not.toContain("🧠 Decide.1 · Which cache to keep (done)");
  expect(await doneLines(ui)).toHaveLength(1);

  // A second click on the Done header collapses the section again.
  await ui.press({ key: "9efb08a1.done" });
  expect(await doneLines(ui)).toEqual([]);

  await ui.press({ key: "b2c3d4e5.Decide.1.B" });
  expect(state.box).toBe(`${HEADER}b2c3d4e5.Decide.1.B\n`);
  await ui.unmount();
});

test("the pane's header row: the line above the prompt, then how many open items the draft answers", async ($, on) => {
  engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  // The same text and colours as above the prompt, not pressable here.
  const drawn = JSON.stringify(await ui.drawn());
  expect(drawn.indexOf("Kanban")).toBeLessThan(drawn.indexOf(COUNTS));
  expect(drawn.indexOf(COUNTS)).toBeLessThan(drawn.indexOf("0 of 3 answered"));
  expect((await ui.find({ type: "Text", text: /^Kanban$/ }))?.props).toMatchObject({ color: "claude" });
  expect((await ui.find({ type: "Text", text: /^ · $/ }))?.props).toMatchObject({ dimColor: true });
  expect(await ui.find({ type: "Button", key: "kanban" })).toBeUndefined();
  expect(await ui.find({ type: "Button", key: "counts" })).toBeUndefined();

  await ui.press({ key: "9efb08a1.Decide.1.B" });
  expect(await ui.find({ type: "Text", text: /^1 of 3 answered$/ })).toBeDefined();
  await ui.unmount();
});

test("with nothing raised the pane says Nothing open under its header, and its footer stays", async ($, on) => {
  engine(on, () => []);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  const drawn = JSON.stringify(await ui.drawn());
  expect(drawn.indexOf("Kanban")).toBeLessThan(drawn.indexOf("Nothing open"));
  expect(await ui.find({ type: "Text", text: /answered$/ })).toBeUndefined();
  expect(await ui.find({ type: "Text", text: /^Draft: empty$/ })).toBeDefined();
  expect((await ui.find({ type: "Button", key: "submit" }))?.props).toMatchObject({ dimColor: true });
  await ui.unmount();
});

test("the footer says what Submit will send, beside Reassess and Submit", async ($, on) => {
  engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  const summary = async () => (await ui.find({ type: "Text", text: /^Draft: / }))?.text;

  expect(await summary()).toBe("Draft: empty");
  await ui.press({ key: "9efb08a1.Decide.1.B" });
  await ui.press({ key: "9efb08a1.Decide.2.A" });
  await ui.input({ key: "9efb08a1.Decide.3.notes", text: "after the release" });
  await ui.press({ key: "reassess" });
  expect(await summary()).toBe("Draft: 3 answers · 1 note · reassess");

  // The footer comes after every item, its buttons after its summary.
  const drawn = JSON.stringify(await ui.drawn());
  expect(drawn.indexOf("Ship tonight?")).toBeLessThan(drawn.indexOf("Draft: "));
  expect(drawn.indexOf("Draft: ")).toBeLessThan(drawn.indexOf("Reassess"));
  expect(drawn.indexOf("Reassess")).toBeLessThan(drawn.indexOf("Submit"));
  await ui.unmount();
});

test("every key the pane takes is a setting: each button's hotkey, rebound by the user's file", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  const hotkeys = async () =>
    Object.fromEntries(
      await Promise.all(
        ["previous", "next", "keys", "dismiss", "reassess", "submit"].map(async (key) => [
          key,
          (await ui.find({ type: "Button", key }))?.props["hotkey"],
        ]),
      ),
    );

  expect(await hotkeys()).toEqual({
    previous: "k",
    next: "j",
    keys: "h",
    dismiss: "q",
    reassess: "r",
    submit: "s",
  });
  // Options keep no hotkeys.
  expect((await ui.find({ type: "Button", key: "9efb08a1.Decide.1.A" }))?.props["hotkey"]).toBeUndefined();

  // Each one rebound in the user's file takes effect, and the keys panel
  // lists the rebound key.
  state.userFiles = {
    "config.yaml":
      "keys:\n  dismiss: x\n  next: n\n  previous: p\n  submit: u\n  reassess: e\n  help: o\n",
  };
  await $.command.run(ANSWERS);
  expect(await hotkeys()).toEqual({
    previous: "p",
    next: "n",
    keys: "o",
    dismiss: "x",
    reassess: "e",
    submit: "u",
  });
  await ui.press({ key: "keys" });
  const row = async (n: number) => (await ui.find({ type: "Box", key: `keys-${n}-hang` }))?.text;
  expect(await row(0)).toBe("n↓ Next: the next item, or Done header");
  expect(await row(1)).toBe("p↑ Previous: the item before");
  expect(await row(2)).toBe("u📤 Submit: send the draft");
  expect(await row(3)).toBe("e🔄 Reassess: add or take out the reassess line");
  expect(await row(4)).toBe("o? Keys: open or close this panel");
  expect(await row(5)).toBe("x✖ Close: close the pane");
  await ui.unmount();
});

test("the pane draws no hint row", async ($, on) => {
  engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  const drawn = JSON.stringify(await ui.drawn());
  expect(drawn).not.toContain("j/k item");
  expect(drawn).not.toContain("esc back to the prompt");
  expect(await ui.find({ type: "Box", key: "keys-panel" })).toBeUndefined();
  await ui.unmount();
});

test("? Keys opens a panel under the header listing every key, and a second press closes it", async ($, on) => {
  engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  expect((await ui.find({ type: "Button", key: "keys" }))?.text).toBe("? Keys");
  // Closed, the panel draws nothing.
  expect(await ui.find({ type: "Box", key: "keys-panel" })).toBeUndefined();

  await ui.press({ key: "keys" });
  const panel = await ui.find({ type: "Box", key: "keys-panel" });
  expect(panel?.text).toContain("s📤 Submit: send the draft");
  expect(panel?.text).toContain("h? Keys: open or close this panel");
  expect(panel?.text).toContain("escgive the keyboard back to the prompt");
  // Under the header, above the items.
  const drawn = JSON.stringify(await ui.drawn());
  expect(drawn.indexOf("keys-panel")).toBeGreaterThan(drawn.indexOf("header-controls"));
  expect(drawn.indexOf("keys-panel")).toBeLessThan(drawn.indexOf("9efb08a1.Decide.1"));

  await ui.press({ key: "keys" });
  expect(await ui.find({ type: "Box", key: "keys-panel" })).toBeUndefined();

  // Closing the pane closes the panel too.
  await ui.press({ key: "keys" });
  await ui.press({ key: "dismiss" });
  await ui.unmount();
  const again = await $.ui.mount({ ...PANE, surface: "terminal" });
  expect(await again.find({ type: "Box", key: "keys-panel" })).toBeUndefined();
  await again.unmount();
});

test("↓ Next and ↑ Previous follow the focus ring, dim at either end of the items and the Done header", async ($, on) => {
  const later: TranscriptRecord[] = [];
  const state = engine(on, () => ITEMS, listsText, () => later);
  await $.turn.complete(replyDone("t1"));
  later.push(human("b2c3d4e5", "9efb08a1.Decide.1.A"), assistant("On it."));
  await $.turn.complete(replyDone("t2"));
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  const dim = async (key: string) =>
    (await ui.find({ type: "Button", key }))?.props["dimColor"];
  // The ring landing on an element, as the engine says of a Tab, an arrow
  // or a click. A plugin's own $.ui.focus never reaches the kit's hooks, so
  // a press of ↓ or ↑ moving the ring is left to a live session; the stops
  // it moves between are test/unit/pane/sections.test.ts's.
  state.isRingMovable = true;
  const ringOn = (element: string) =>
    $.ui.focus({
      component: "Pane",
      requestId: "kanban-turns",
      element,
      origin: { kind: "person" },
    });

  // On no item yet, either moves.
  expect(await dim("next")).toBe(false);
  expect(await dim("previous")).toBe(false);

  // On the first item's notes field, the item counts: nothing is before it.
  await ringOn("9efb08a1.Decide.2.notes");
  expect(await dim("previous")).toBe(true);
  expect(await dim("next")).toBe(false);

  // On the Done header, the last stop while its section is closed.
  await ringOn("9efb08a1.done");
  expect(await dim("next")).toBe(true);
  expect(await dim("previous")).toBe(false);

  // A press of ↓ itself, which a hotkey may leave the ring on, keeps the
  // item the ring was on.
  await ringOn("next");
  expect(await dim("next")).toBe(true);
  expect(state.focus).toEqual(["9efb08a1.Decide.2.notes", "9efb08a1.done", "next"]);
  await ui.unmount();
});

test("a reply that raises a new item opens the pane without the keyboard", async ($, on) => {
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
  // with an agent's turn, which the plugin passes by.
  for (let n = 0; n < 100 && !state.isPaneOpen; n += 1) {
    await $.turn.complete({ ...replyDone(`w${n}`), agentId: "agent-1" } as never);
  }
  expect(state.opens).toEqual([false]);
});

test("above the prompt: 🖥️ Kanban, a faint divider and the count line, each opening the pane with the keyboard", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.turn.complete(replyDone("t1"));
  state.isPaneOpen = false;
  const line = await $.ui.mount({ ...ABOVE_PROMPT, surface: "terminal" });

  // The button, the divider and the count line, in that order.
  expect((await line.find({ type: "Button", key: "kanban" }))?.text).toBe(
    "🖥️ Kanban",
  );
  expect((await line.find({ type: "Text", text: /^Kanban$/ }))?.props).toMatchObject({
    color: "claude",
  });
  const divider = await line.find({ type: "Text", text: /^ · $/ });
  expect(divider?.props).toMatchObject({ dimColor: true });
  expect((await line.find({ type: "Button", key: "counts" }))?.text).toBe(
    COUNTS,
  );
  const drawn = JSON.stringify(await line.drawn());
  expect(drawn.indexOf("Kanban")).toBeLessThan(drawn.indexOf(" · "));
  expect(drawn.indexOf(" · ")).toBeLessThan(drawn.indexOf(COUNTS));
  expect(drawn).not.toContain("🪟");
  expect(drawn).not.toContain("↗");
  expect(drawn).not.toContain("Which cache to keep");

  await line.press({ key: "kanban" });
  expect(state.isPaneOpen).toBe(true);
  state.isPaneOpen = false;
  await line.press({ key: "counts" });
  expect(state.isPaneOpen).toBe(true);
  expect(state.opens).toEqual([false, true, true]);
  await line.unmount();
});

type Mounted = {
  find: (q: { type: string; key: string }) => Promise<{ text: string } | undefined>;
  findAll: (q: { type: string }) => Promise<readonly { key?: string; props: Readonly<Record<string, unknown>> }[]>;
};

/** The text of the count line a mounted AbovePrompt draws, or none. */
const countsOn = async (line: Mounted) =>
  (await line.find({ type: "Button", key: "counts" }))?.text;

test("an answer in a later prompt settles its item, in the pane and the count line", async ($, on) => {
  const later: TranscriptRecord[] = [];
  engine(on, () => ITEMS, listsText, () => later);
  await $.turn.complete(replyDone("t1"));
  later.push(human("b2c3d4e5", "9efb08a1.Decide.1.A\n3. B"), assistant("On it."));
  await $.turn.complete(replyDone("t2"));
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  const line = await $.ui.mount({ ...ABOVE_PROMPT, surface: "terminal" });

  expect(await titles(ui)).toEqual(["🧠 Decide.2 · Cleanups to start"]);
  expect(await countsOn(line)).toBe("📌 Outstanding: 🚧 1 · 🧠 1");
  await openDone(ui);
  expect(await doneLines(ui)).toEqual([
    "🧠 Decide.1  Which cache to keep · Answered in b2c3d4e5: A",
    "🧠 Decide.3  Ship tonight? · Answered in b2c3d4e5: B",
  ]);
  await ui.press({ key: "9efb08a1.Decide.1.line" });
  await ui.press({ key: "9efb08a1.Decide.3.line" });

  // Each Done item, opened to its box, says the answer that made it Done,
  // under its title, and marks the option it picked, never underlined; its
  // options, which still pick, are at full strength in the dimmed item.
  for (const drawing of [ui, await $.ui.mount(REPLY)]) {
    expect(
      (await drawing.findAll({ type: "Text", text: /^Answered in / })).map((found) => found.text),
    ).toEqual(["Answered in b2c3d4e5: A", "Answered in b2c3d4e5: B"]);
    expect(await leadOf(drawing, "9efb08a1.Decide.1.A")).toBe("☑️ A. ");
    const sent = await drawing.find({ type: "Button", key: "9efb08a1.Decide.1.A" });
    expect(sent?.text).toBe("Disk");
    expect(sent?.props["dimColor"]).not.toBe(true);
    expect(JSON.stringify(sent?.children)).not.toContain('"underline":true');
    expect((await drawing.find({ type: "Button", key: "9efb08a1.Decide.1.B" }))?.props["dimColor"]).not.toBe(true);
  }
  await line.unmount();
  await ui.unmount();
});

test("an item a reassess made Done says so", async ($, on) => {
  const later: TranscriptRecord[] = [];
  engine(on, () => ITEMS, listsText, () => later);
  await $.turn.complete(replyDone("t1"));
  // A prompt that answers item 1 and ends on reassess: its answer stands,
  // and the reassess makes the rest Done.
  later.push(submitted("b2c3d4e5", `${HEADER}9efb08a1.Decide.1.B\nreassess\n`), assistant("Reassessed."));
  await $.turn.complete(replyDone("t2"));
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await openDone(ui);

  expect(await doneLines(ui)).toEqual([
    "🧠 Decide.1  Which cache to keep · Answered in b2c3d4e5: B",
    "🧠 Decide.2  Cleanups to start · Done: reassessed",
    "🧠 Decide.3  Ship tonight? · Done: reassessed",
  ]);
  expect(JSON.stringify(await ui.drawn())).not.toMatch(/[Ss]ettled/);
  await ui.unmount();
});

test("a message sent while a turn runs settles the item it answers", async ($, on) => {
  const later: TranscriptRecord[] = [];
  engine(on, () => ITEMS, listsText, () => later);
  await $.turn.complete(replyDone("t1"));
  // The next turn has started when the message is sent, and the transcript
  // keeps it as an attachment of that turn.
  later.push(human("b2c3d4e5", "go on"), queued("Decide.2: A, C"));
  await $.turn.complete(replyDone("t2"));
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  const line = await $.ui.mount({ ...ABOVE_PROMPT, surface: "terminal" });

  expect(await titles(ui)).toEqual([
    "🧠 Decide.1 · Which cache to keep",
    "🧠 Decide.3 · Ship tonight?",
  ]);
  expect((await ui.find({ type: "Button", key: "9efb08a1.done" }))?.text).toBe("▸ Done (1)");
  expect(await countsOn(line)).toBe("📌 Outstanding: 🚧 1 · 🧠 2");
  await line.unmount();
  await ui.unmount();
});

test("the Reassess button's prompt replaces every earlier item", async ($, on) => {
  const later: TranscriptRecord[] = [];
  engine(on, () => ITEMS, listsText, () => later);
  await $.turn.complete(replyDone("t1"));
  later.push(
    submitted("b2c3d4e5", "reassess"),
    replyRecord([LATER], listsText([LATER])),
  );
  await $.turn.complete(replyDone("t2"));
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  const line = await $.ui.mount({ ...ABOVE_PROMPT, surface: "terminal" });

  expect(await turnHeaders(ui)).toEqual(["── b2c3d4e5 ₀ ──", "── 9efb08a1 ₋₁ ──"]);
  expect(await titles(ui)).toEqual(["🧠 Decide.1 · Which loader to keep"]);
  expect((await ui.find({ type: "Button", key: "9efb08a1.done" }))?.text).toBe("▸ Done (3)");
  expect(await countsOn(line)).toBe("📌 Outstanding: 🚧 1 · 🧠 1");
  await line.unmount();
  await ui.unmount();
});

/** A reply with a Review list: one pull request named with its repository, and one bare. */
const REVIEW_TEXT = [
  "🔍 **Review:**  ",
  "1. **[#21 Close the pane](https://github.com/nhooey/kanban/pull/21)**",
  "2. **#23 The README**",
  "",
].join("\n");

test("a Review item leaves the count line once gh says its pull request merged", async ($, on) => {
  const response = JSON.stringify({
    data: { pr0: { pullRequest: { state: "MERGED" } } },
  });
  const state = engine(on, () => [], () => REVIEW_TEXT, () => [], () => response);
  await $.turn.complete(replyDone("t1"));
  const line = await $.ui.mount({ ...ABOVE_PROMPT, surface: "terminal" });

  expect(await eventually(() => countsOn(line), "📌 Outstanding: 🔍 1")).toBe(
    "📌 Outstanding: 🔍 1",
  );
  // One call, for the pull request named with its repository alone.
  expect(state.runs.map((argv) => argv.slice(0, 3))).toEqual([
    ["gh", "api", "graphql"],
  ]);
  expect(state.runs[0]?.[4]).toContain(
    'repository(owner: "nhooey", name: "kanban") { pullRequest(number: 21)',
  );
  expect(state.runs[0]?.[4]).not.toContain("number: 23");
  await line.unmount();
});

// The test runtime's timer, which the engine's types leave out.
declare const setTimeout: (callback: () => void, ms: number) => unknown;

/** What `read` gives once it gives `expected`, asked again every few milliseconds for up to two seconds. */
const eventually = async <T,>(read: () => Promise<T>, expected: T): Promise<T> => {
  const deadline = Date.now() + 2000;
  const poll = async (): Promise<T> => {
    const got = await read();

    return got === expected || Date.now() > deadline
      ? got
      : new Promise<void>((resolve) => setTimeout(resolve, 10)).then(poll);
  };

  return poll();
};

test("the count line is drawn before gh answers, and again once it does", async ($, on) => {
  const response = JSON.stringify({
    data: { pr0: { pullRequest: { state: "MERGED" } } },
  });
  const gate = { release: () => {} };
  const released = new Promise<void>((resolve) => {
    gate.release = resolve;
  });
  engine(on, () => [], () => REVIEW_TEXT, () => [], () => released.then(() => response));
  const line = await $.ui.mount({ ...ABOVE_PROMPT, surface: "terminal" });
  const done = $.turn.complete(replyDone("t1"));

  expect(await eventually(() => countsOn(line), "📌 Outstanding: 🔍 2")).toBe(
    "📌 Outstanding: 🔍 2",
  );
  gate.release();
  await done;
  expect(await eventually(() => countsOn(line), "📌 Outstanding: 🔍 1")).toBe(
    "📌 Outstanding: 🔍 1",
  );
  await line.unmount();
});

test("a gh answer that comes after a later refresh leaves that refresh's count line", async ($, on) => {
  const response = JSON.stringify({
    data: { pr0: { pullRequest: { state: "MERGED" } } },
  });
  const gate = { release: () => {} };
  const released = new Promise<void>((resolve) => {
    gate.release = resolve;
  });
  const later: TranscriptRecord[] = [];
  const state = engine(on, () => [], () => REVIEW_TEXT, () => later, () => released.then(() => response));
  const line = await $.ui.mount({ ...ABOVE_PROMPT, surface: "terminal" });
  const first = $.turn.complete(replyDone("t1"));
  expect(await eventually(() => countsOn(line), "📌 Outstanding: 🔍 2")).toBe(
    "📌 Outstanding: 🔍 2",
  );
  // A reassess turn whose lists hold nothing: the next refresh counts nothing.
  later.push(human("b2c3d4e5", "reassess"), assistant("Prose."));
  await $.turn.complete(replyDone("t2"));
  expect(await eventually(() => countsOn(line), undefined)).toBeUndefined();
  gate.release();
  await first;
  await new Promise<void>((resolve) => setTimeout(resolve, 100));

  expect(await countsOn(line)).toBeUndefined();
  expect(state.runs).toHaveLength(1);
  await line.unmount();
});

test("a pull request gh said merged is not asked about again", async ($, on) => {
  const response = JSON.stringify({
    data: { pr0: { pullRequest: { state: "MERGED" } } },
  });
  const state = engine(on, () => [], () => REVIEW_TEXT, () => [], () => response);
  await $.turn.complete(replyDone("t1"));
  await $.turn.complete(replyDone("t2"));
  const line = await $.ui.mount({ ...ABOVE_PROMPT, surface: "terminal" });

  expect(await eventually(() => countsOn(line), "📌 Outstanding: 🔍 1")).toBe(
    "📌 Outstanding: 🔍 1",
  );
  expect(state.runs).toHaveLength(1);
  expect(state.runs[0]?.slice(5)).toEqual(["--hostname", "github.com"]);
  await line.unmount();
});

test("a transcript longer than one read reads whole, a character cut at a range's edge kept", async ($, on) => {
  const CAFE = { ...LATER, summary: "Which café to keep" };
  const READ_BYTES = 4 * 1024 * 1024;
  // Filler that opens no turn, as long as it takes to put the é's two bytes
  // either side of the first range's end.
  const filler = (length: number): TranscriptRecord => ({
    type: "user",
    isMeta: true,
    message: { role: "user", content: "x".repeat(length) },
  });
  const records = (length: number) => [
    filler(length),
    human("b2c3d4e5", "go on"),
    assistant("", [{ items: [CAFE] }]),
  ];
  const head = jsonl([human("9efb08a1", "go"), replyRecord([], "")]);
  const firstCut = (length: number) => {
    const bytes = new TextEncoder().encode(head + jsonl(records(length)));

    return bytes.findIndex((byte, n) => byte === 0xc3 && bytes[n + 1] === 0xa9);
  };
  const later = records(READ_BYTES - 1 - firstCut(0));
  engine(on, () => [], () => "", () => later);
  await $.turn.complete(replyDone("t1"));
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  expect(firstCut(READ_BYTES - 1 - firstCut(0))).toBe(READ_BYTES - 1);
  expect(await titles(ui)).toEqual(["🧠 Decide.1 · Which café to keep"]);
  await ui.unmount();
});

test("a transcript that can't be read settles nothing, and the pane says why", async ($, on) => {
  const later: TranscriptRecord[] = [];
  const state = engine(on, () => ITEMS, listsText, () => later);
  await $.turn.complete(replyDone("t1"));
  later.push(human("b2c3d4e5", "9efb08a1.Decide.1.A"), assistant("On it."));
  await $.turn.complete(replyDone("t2"));
  state.isUnreadable = true;
  await $.turn.complete(replyDone("t3"));
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  const line = await $.ui.mount({ ...ABOVE_PROMPT, surface: "terminal" });

  expect(await titles(ui)).toEqual([
    "🧠 Decide.2 · Cleanups to start",
    "🧠 Decide.3 · Ship tonight?",
  ]);
  expect((await ui.find({ type: "Button", key: "9efb08a1.done" }))?.text).toBe("▸ Done (1)");
  expect(await ui.find({ type: "Text", text: /the transcript is gone/ })).toBeDefined();
  expect(await countsOn(line)).toBe("📌 Outstanding: 🚧 1 · 🧠 2");
  await line.unmount();
  await ui.unmount();
});

for (const [why, gh] of [
  ["is missing", () => undefined],
  ["fails", () => ""],
] as const) {
  test(`a gh that ${why} keeps every Review item`, async ($, on) => {
    engine(on, () => [], () => REVIEW_TEXT, () => [], gh);
    await $.turn.complete(replyDone("t1"));
    const line = await $.ui.mount({ ...ABOVE_PROMPT, surface: "terminal" });

    expect(await countsOn(line)).toBe("📌 Outstanding: 🔍 2");
    await line.unmount();
  });
}

test("without a count line 🖥️ Kanban is drawn above the prompt alone, and still opens the pane", async ($, on) => {
  const state = engine(on, () => ITEMS, () => "");
  await $.turn.complete(replyDone("t1"));
  const line = await $.ui.mount({ ...ABOVE_PROMPT, surface: "terminal" });

  expect(await line.find({ type: "Button", key: "counts" })).toBeUndefined();
  expect(await line.find({ type: "Text", text: /^ · $/ })).toBeUndefined();
  expect((await line.find({ type: "Button", key: "kanban" }))?.text).toBe(
    "🖥️ Kanban",
  );
  state.isPaneOpen = false;
  await line.press({ key: "kanban" });
  expect(state.isPaneOpen).toBe(true);
  await line.unmount();
});

test("with a survey up nothing is drawn above the prompt", async ($, on) => {
  engine(on, () => ITEMS);
  await $.turn.complete(replyDone("t1"));
  const line = await $.ui.mount({
    ...ABOVE_PROMPT,
    props: { ...ABOVE_PROMPT.props, hasSurvey: true },
    surface: "terminal",
  });

  expect(await line.find({ type: "Button", key: "kanban" })).toBeUndefined();
  expect(await line.find({ type: "Button", key: "counts" })).toBeUndefined();
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

test("a long option, its ➕ line, a title and a Done line wrap under their text, not their lead", async ($, on) => {
  const long = {
    ...ITEMS[0],
    summary: "Where the protocol's data lives, and what reads it when the plugin builds",
    options: [
      {
        letter: "A",
        name: "YAML compiled at build time",
        consequence:
          "plugin/spec/kanban.yaml, read strictly against a schema by a build step that writes a typed TypeScript module, plus a JSON copy",
        pros: ["One source, checked at build time, that every reader shares without parsing YAML at run time."],
      },
      { letter: "B", name: "JSON alone" },
    ],
  };
  const open: unknown[] = [long, ITEMS[2]];
  engine(on, () => open);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await $.tool.call({ tool: TOOL, items: [long] } as never);
  const reply = await $.ui.mount({
    ...REPLY,
    props: { ...REPLY.props, text: `Some work.\n\n1. **${long.summary}**  ` },
  });

  // Each line's lead is a Box as wide as its cells, an emoji counting 2,
  // that never shrinks; the text beside it takes the rest of the row and
  // wraps there, so its rows start under the text: the engine lays it out.
  const box = async (drawing: Pick<typeof ui | typeof reply, "find">, key: string) =>
    (await drawing.find({ type: "Box", key }))?.props;
  for (const drawing of [ui, reply]) {
    expect(await box(drawing, "9efb08a1.Decide.1.A-hang-lead")).toMatchObject({ width: 6, flexShrink: 0 });
    expect(await box(drawing, "9efb08a1.Decide.1.A-hang-text")).toMatchObject({ flexGrow: 1, flexShrink: 1 });
    expect(await box(drawing, "9efb08a1.Decide.1.A-pro-0-hang-lead")).toMatchObject({ width: 3, flexShrink: 0 });
    expect(await box(drawing, "9efb08a1.Decide.1.title-hang-lead")).toMatchObject({ width: 14, flexShrink: 0 });
    expect(await leadOf(drawing, "9efb08a1.Decide.1.A")).toBe("🔘 A. ");
    expect(await leadOf(drawing, "9efb08a1.Decide.1.A-pro-0")).toBe("➕ ");
    // One button per line: the lead is plain text, the line's text the one
    // focus stop that picks.
    expect(await drawing.find({ type: "Button", key: "9efb08a1.Decide.1.A-mark" })).toBeUndefined();
  }

  // A Done line's label is its lead, the summary and what made it Done
  // wrapping under the summary's start.
  open.splice(0, 1);
  await $.turn.complete(replyDone("t1"));
  await openDone(ui);
  expect(await box(ui, "9efb08a1.Decide.1.line-hang-lead")).toMatchObject({ width: 13, flexShrink: 0 });
  expect((await ui.find({ type: "Button", key: "9efb08a1.Decide.1.line" }))?.text).toBe(
    `${long.summary} · Done`,
  );
  await reply.unmount();
  await ui.unmount();
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
  expect(state.box).toBe(`${HEADER}9efb08a1.Decide.1.B\n`);
  await ui.press({ key: "9efb08a1.Decide.1.A-pro-0" });
  expect(state.box).toBe(`${HEADER}9efb08a1.Decide.1.A\n`);

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
  expect(state.box).toBe(`${HEADER}9efb08a1.Decide.1.B: only for the loader\n`);
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

test("a reply whose Decide list isn't found intact draws its items under its text, a Done one dimmed but live", async ($, on) => {
  const open: unknown[] = [...ITEMS];
  const state = engine(on, () => open);
  await $.tool.call({ tool: TOOL, items: ITEMS } as never);
  await $.turn.complete(replyDone("t0"));
  const reply = await $.ui.mount(REPLY);

  // The reply's text first, then its two items, in its order.
  const drawn = JSON.stringify(await reply.drawn());
  expect(drawn.indexOf("Some work.")).toBeGreaterThan(-1);
  expect(drawn.indexOf(" 🧠 Decide.1 ")).toBeGreaterThan(
    drawn.indexOf("Some work."),
  );
  expect(await titles(reply)).toEqual([
    "🧠 Decide.1 · Which cache to keep",
    "🧠 Decide.3 · Ship tonight?",
  ]);
  // The title's label is drawn as the pane draws it: bold on its background.
  const label = async (n: number) =>
    (await reply.find({ type: "Text", text: new RegExp(`^ 🧠 Decide\\.${n} $`) }))?.props;
  expect(await label(1)).toMatchObject({
    weight: "bold",
    color: "inverseText",
    backgroundColor: "claude",
  });
  await reply.press({ key: "9efb08a1.Decide.3.N" });
  expect(state.box).toBe(`${HEADER}9efb08a1.Decide.3.N\n`);

  // Item 1 is answered elsewhere: the next refresh no longer lists it, and
  // its label loses its background.
  open.splice(0, 1);
  await $.turn.complete(replyDone("t1"));
  expect(await titles(reply)).toEqual([
    "🧠 Decide.1 · Which cache to keep (done)",
    "🧠 Decide.3 · Ship tonight?",
  ]);
  expect(await label(1)).not.toHaveProperty("backgroundColor");
  expect(await label(3)).toMatchObject({ backgroundColor: "claude" });
  // Its options still pick, as the pane's do.
  await reply.press({ key: "9efb08a1.Decide.1.A" });
  expect(state.box).toBe(`${HEADER}9efb08a1.Decide.3.N\n9efb08a1.Decide.1.A\n`);
  await reply.unmount();
});

test("a reply's Decide list found intact is cut out, its items' boxes drawn in its place", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.tool.call({ tool: TOOL, items: ITEMS } as never);
  await $.turn.complete(replyDone("t0"));
  const text = `${listsText(ITEMS)}\n📌 Outstanding: 🧠 1\n`;
  const reply = await $.ui.mount({ ...REPLY, props: { ...REPLY.props, text } });

  // The text before the list, the boxes, then the text after it; the list
  // itself, header and summaries, is drawn by the boxes alone.
  const before = await reply.find({ type: "Markdown", key: "kanban-before" });
  expect(before?.props["text"]).toBe("Some work.\n\n🚧 **Pending:**  \n1. **Rework the loader**");
  expect((await reply.find({ type: "Markdown", key: "kanban-after" }))?.props["text"]).toBe(
    "📌 Outstanding: 🧠 1",
  );
  expect(await reply.find({ type: "Markdown", key: "kanban-questions" })).toBeUndefined();
  const drawn = JSON.stringify(await reply.drawn());
  expect(drawn).not.toContain("**Decide:**");
  expect(drawn).not.toContain("**Which cache to keep**");
  expect(drawn.indexOf("Rework the loader")).toBeLessThan(drawn.indexOf(" 🧠 Decide.1 "));
  expect(drawn.indexOf(" 🧠 Decide.3 ")).toBeLessThan(drawn.indexOf("📌 Outstanding: 🧠 1"));
  expect(await titles(reply)).toEqual([
    "🧠 Decide.1 · Which cache to keep",
    "🧠 Decide.2 · Cleanups to start",
    "🧠 Decide.3 · Ship tonight?",
  ]);

  // The boxes write the draft as the pane's do.
  await reply.press({ key: "9efb08a1.Decide.2.B" });
  expect(state.box).toBe(`${HEADER}9efb08a1.Decide.2.B\n`);
  await reply.unmount();
});

test("above the prompt, ✏️ n picked follows the count line while the draft answers open items", async ($, on) => {
  engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  const line = await $.ui.mount({ ...ABOVE_PROMPT, surface: "terminal" });
  expect(await line.find({ type: "Button", key: "picked" })).toBeUndefined();

  await ui.press({ key: "9efb08a1.Decide.1.B" });
  await ui.press({ key: "9efb08a1.Decide.3.Y" });
  const picked = await line.find({ type: "Button", key: "picked" });
  expect(picked?.text).toBe("✏️ 2 picked");
  expect(picked?.props["dimColor"]).not.toBe(true);
  const drawn = JSON.stringify(await line.drawn());
  expect(drawn.indexOf(COUNTS)).toBeLessThan(drawn.indexOf("✏️ 2 picked"));
  await line.unmount();
  await ui.unmount();
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

test("a question in a reply whose item is Done opens its turn's Done section and its box", async ($, on) => {
  const open: unknown[] = [...ITEMS];
  engine(on, () => open);
  await $.tool.call({ tool: TOOL, items: ITEMS } as never);
  await $.turn.complete(replyDone("t0"));
  open.splice(0, 1);
  await $.turn.complete(replyDone("t1"));
  const reply = await $.ui.mount(REPLY);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  expect(await doneLines(ui)).toEqual([]);

  await reply.press({
    key: "kanban-questions",
    link: { href: "https://kanban-turns.invalid/9efb08a1.Decide.1" },
  });
  expect((await ui.find({ type: "Button", key: "9efb08a1.done" }))?.text).toBe("▾ Done (1)");
  expect(await titles(ui)).toContain("🧠 Decide.1 · Which cache to keep (done)");
  await reply.unmount();
  await ui.unmount();
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

test("Reassess adds reassess as the draft's last line for Submit to send, and a second press takes it out", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  const reassess = async () => (await ui.find({ type: "Button", key: "reassess" }))?.text;
  expect(await reassess()).toStartWith("🔄 ");

  await ui.press({ key: "9efb08a1.Decide.1.A" });
  await ui.press({ key: "reassess" });
  expect(state.box).toBe(`${HEADER}9efb08a1.Decide.1.A\nreassess\n`);
  expect(state.sent).toEqual([]);
  expect(await reassess()).toStartWith("✅ ");

  // A pick after it goes above it: reassess stays last.
  await ui.press({ key: "9efb08a1.Decide.2.C" });
  expect(state.box).toBe(`${HEADER}9efb08a1.Decide.1.A\n9efb08a1.Decide.2.C\nreassess\n`);

  // A second press takes it out again.
  await ui.press({ key: "reassess" });
  expect(state.box).toBe(`${HEADER}9efb08a1.Decide.1.A\n9efb08a1.Decide.2.C\n`);
  expect(await reassess()).toStartWith("🔄 ");

  // Pressed again, Submit sends the answers and the reassess in one prompt.
  await ui.press({ key: "reassess" });
  await ui.press({ key: "submit" });
  expect(state.sent).toEqual([`${HEADER}9efb08a1.Decide.1.A\n9efb08a1.Decide.2.C\nreassess\n`]);
  expect(state.isPaneOpen).toBe(true);
  await ui.unmount();
});

test("Submit sends the draft as the user's own and empties the box; an empty box sends nothing", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  // Empty: drawn dim, and a press sends nothing.
  expect((await ui.find({ type: "Button", key: "submit" }))?.props).toMatchObject({
    dimColor: true,
  });
  await ui.press({ key: "submit" });
  state.box = "  \n";
  await ui.press({ key: "submit" });
  expect(state.sent).toEqual([]);
  expect(state.box).toBe("  \n");

  // A draft: drawn at full strength, sent whole, the box emptied.
  state.box = "";
  await ui.press({ key: "9efb08a1.Decide.1.B" });
  expect((await ui.find({ type: "Button", key: "submit" }))?.props).toMatchObject({
    dimColor: false,
  });
  await ui.press({ key: "submit" });
  expect(state.sent).toEqual([`${HEADER}9efb08a1.Decide.1.B\n`]);
  expect(state.asUser).toEqual([true]);
  expect(state.box).toBe("");
  expect(state.isPaneOpen).toBe(true);
  await ui.unmount();
});

test("a Submit the engine refuses, or that throws, puts the draft back and says why", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  const problem = () => sendProblem(ui);

  for (const answer of [
    { drop: "a hook refused it" },
    new Error("the engine fell over"),
  ]) {
    state.submitAnswer = answer;
    state.box = `${HEADER}9efb08a1.Decide.1.B\n`;
    await ui.press({ key: "submit" });
    expect(state.box).toBe(`${HEADER}9efb08a1.Decide.1.B\n`);
    expect(await problem()).toMatch(/^Not sent, the draft put back in the prompt box: /);
  }
  // A hook that throws is skipped, and with nothing else to take the prompt
  // the engine's submit rejects: the pane says what it rejected with.
  expect(await problem()).toContain("prompt.submit");

  // A later Submit that goes through clears what the pane said.
  state.submitAnswer = undefined;
  await ui.press({ key: "submit" });
  expect(state.box).toBe("");
  expect(await problem()).toBeUndefined();
  await ui.unmount();
});

test("a box that can't be emptied sends nothing and keeps the draft", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press({ key: "9efb08a1.Decide.1.B" });
  state.isFillRefused = true;
  await ui.press({ key: "submit" });

  expect(state.sent).toEqual([]);
  expect(state.box).toBe(`${HEADER}9efb08a1.Decide.1.B\n`);
  // The draft the pane draws from stays as it was: the option is still chosen.
  expect(JSON.stringify(await ui.drawn())).toContain("✅");
  expect(await sendProblem(ui)).toContain(
    "couldn't be emptied",
  );
  await ui.unmount();
});

test("a box that throws as Submit empties it sends nothing, names the draft, and frees Submit", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press({ key: "9efb08a1.Decide.1.B" });
  state.fillError = new Error("the box fell over");
  await ui.press({ key: "submit" });

  expect(state.sent).toEqual([]);
  const problem = (await ui.findAll({ type: "Text", text: /^Submit failed/ }))[0]?.text;
  // A hook that throws is skipped, and with nothing else to fill the box the
  // engine's fill rejects: the pane says what it rejected with. The fill may
  // have emptied the box before it failed, so the pane keeps the draft.
  expect(problem).toContain("prompt.fill");
  expect(problem).toContain("9efb08a1.Decide.1.B");

  // Submit isn't left busy: the next press sends.
  state.fillError = undefined;
  await ui.press({ key: "submit" });
  expect(state.sent).toEqual([`${HEADER}9efb08a1.Decide.1.B\n`]);
  await ui.unmount();
});

test("two Submit presses at once send the draft once", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press({ key: "9efb08a1.Decide.1.B" });

  await Promise.all([ui.press({ key: "submit" }), ui.press({ key: "submit" })]);
  expect(state.sent).toEqual([`${HEADER}9efb08a1.Decide.1.B\n`]);

  // Once the first has settled, Submit works again.
  state.box = "9efb08a1.Decide.2.A\n";
  await ui.press({ key: "submit" });
  expect(state.sent).toHaveLength(2);
  await ui.unmount();
});

test("a draft with a file mention, pasted text or a pasted image stays in the box, the pane saying to press Enter", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  for (const draft of [
    "9efb08a1.Decide.1: see @plugin/src/view.ts\n",
    "Decide.1: like [Image #1]\n",
    "Decide.1: the log\n[Pasted text #1 +40 lines]\n",
  ]) {
    state.box = draft;
    await ui.press({ key: "submit" });
    expect(state.sent).toEqual([]);
    expect(state.box).toBe(draft);
  }
  expect(await sendProblem(ui)).toContain(
    "press Enter in the prompt to send file mentions, pasted text or images",
  );

  // A name or a package after @ is no file: it goes.
  state.box = "Decide.1: ask @alice about @types/node\n";
  await ui.press({ key: "submit" });
  expect(state.sent).toEqual(["Decide.1: ask @alice about @types/node\n"]);
  await ui.unmount();
});

test("a draft of the line naming the plugin alone is empty: Submit is dim and sends nothing", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  state.box = HEADER;
  await ui.press({ key: "submit" });

  expect(state.sent).toEqual([]);
  expect(state.box).toBe(HEADER);
  await ui.unmount();
});

test("a refused draft goes back after what was typed while the submit was pending", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press({ key: "9efb08a1.Decide.1.B" });
  state.submitAnswer = { drop: "a hook refused it" };
  state.typedMeanwhile = "my own words";
  await ui.press({ key: "submit" });

  expect(state.box).toBe(`my own words\n${HEADER}9efb08a1.Decide.1.B\n`);
  expect(await sendProblem(ui)).toBe(
    "Not sent, the draft put back in the prompt box after the text typed meanwhile: a hook refused it",
  );
  await ui.unmount();
});

test("a refused draft the box can't take back stays in what the pane says", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press({ key: "9efb08a1.Decide.1.B" });
  state.submitAnswer = { drop: "a hook refused it" };
  state.isAppendRefused = true;
  await ui.press({ key: "submit" });

  expect(state.box).toBe("");
  const said = await sendProblem(ui);
  expect(said).toContain("the prompt box couldn't take the draft back: a hook refused it");
  expect(said).toContain(`${HEADER}9efb08a1.Decide.1.B\n`);
  await ui.unmount();
});

test("while a turn runs Submit is dim and does nothing", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press({ key: "9efb08a1.Decide.1.B" });
  await $.turn.start({ text: "go on", turnId: "t1" });

  expect((await ui.find({ type: "Button", key: "submit" }))?.props).toMatchObject({
    dimColor: true,
  });
  await ui.press({ key: "submit" });
  expect(state.sent).toEqual([]);
  expect(state.box).toBe(`${HEADER}9efb08a1.Decide.1.B\n`);

  // An agent's turn ending doesn't end the main one; the main one's does.
  await $.turn.complete({ ...replyDone("a1"), agentId: "agent-1" } as never);
  await ui.press({ key: "submit" });
  expect(state.sent).toEqual([]);
  await $.turn.complete(replyDone("t1"));
  expect((await ui.find({ type: "Button", key: "submit" }))?.props).toMatchObject({
    dimColor: false,
  });
  await ui.press({ key: "submit" });
  expect(state.sent).toEqual([`${HEADER}9efb08a1.Decide.1.B\n`]);
  await ui.unmount();
});

test("an earlier turn's late end leaves a later turn running", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press({ key: "9efb08a1.Decide.1.B" });
  await $.turn.start({ text: "go on", turnId: "t1" });
  await $.turn.start({ text: "and on", turnId: "t2" });
  await $.turn.complete(replyDone("t1"));

  await ui.press({ key: "submit" });
  expect(state.sent).toEqual([]);
  await $.turn.complete(replyDone("t2"));
  await ui.press({ key: "submit" });
  expect(state.sent).toEqual([`${HEADER}9efb08a1.Decide.1.B\n`]);
  await ui.unmount();
});

/** A gate a hook of the engine waits at: `reached` once a call stands at it, until `release`. */
const gate = () => {
  let reach = () => {};
  let release = () => {};
  const reached = new Promise<void>((resolve) => {
    reach = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const wait = async () => {
    reach();
    await released;
  };

  return { wait, reached, release };
};

test("the session's start ends a turn and a Submit a reload left running", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  // A Submit under way and a turn running, as a reload mid-turn leaves them.
  const held = gate();
  state.holdSubmit = held.wait;
  state.box = "9efb08a1.Decide.1.B\n";
  const pending = ui.press({ key: "submit" });
  await held.reached;
  await $.turn.start({ text: "go on", turnId: "t1" });
  state.box = "9efb08a1.Decide.2.A\n";
  await ui.press({ key: "submit" });
  expect(state.sent).toEqual([]);

  await $.session.start({ cwd: "/work", surface: "terminal", isInteractive: true });
  // The start's refresh runs after it returns: /answers waits on one.
  await $.command.run(ANSWERS);
  await ui.press({ key: "submit" });
  expect(state.sent).toEqual(["9efb08a1.Decide.2.A\n"]);

  held.release();
  await pending;
  await ui.unmount();
});

test("the session's start clears what the pane said about the last Submit", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  state.box = "Decide.1: like [Image #1]\n";
  await ui.press({ key: "submit" });
  expect(await sendProblem(ui)).toBeDefined();

  await $.session.start({ cwd: "/work", surface: "terminal", isInteractive: true });
  expect(await sendProblem(ui)).toBeUndefined();
  await ui.unmount();
});

test("a turn that starts while the session's start registers keeps Submit waiting", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press({ key: "9efb08a1.Decide.1.B" });

  const registering = gate();
  state.registering = registering.wait;
  const starting = $.session.start({ cwd: "/work", surface: "terminal", isInteractive: true });
  await registering.reached;
  await $.turn.start({ text: "go on", turnId: "t1" });
  registering.release();
  await starting;
  // The start's refresh runs after it returns: /answers waits on one.
  await $.command.run(ANSWERS);

  await ui.press({ key: "submit" });
  expect(state.sent).toEqual([]);
  await $.turn.complete(replyDone("t1"));
  await ui.press({ key: "submit" });
  expect(state.sent).toEqual([`${HEADER}9efb08a1.Decide.1.B\n`]);
  await ui.unmount();
});

test("raised items stored under an older shape are not drawn", async ($, on) => {
  engine(on, () => []);
  // What the plugin kept before Raised gained settlements, as a reload
  // finds it.
  const stale = {
    shape: "raised-2",
    value: { session: "session-1", items: ITEMS, settledRefs: [], seenRefs: [], problem: "", warnings: [] },
  };
  on("state.get", (_, e, next) =>
    e.key === "raised" ? { value: { value: stale, version: 1 } } : next(e),
  );
  await $.command.run({ ...ANSWERS, command: "answers-config" });
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  expect(await titles(ui)).toEqual([]);
  expect(await ui.find({ type: "Text", text: "Nothing open" })).toBeDefined();
  await ui.unmount();
});

test("settings stored under an older shape are not used", async ($, on) => {
  engine(on, () => ITEMS);
  // What an earlier version of the plugin kept, before Settings gained
  // notes and lost colors.expand, as a reload finds it: the store answers it
  // whatever the plugin writes since.
  const stale = {
    shape: "settings-2",
    value: {
      settings: { ...JSON.parse(DEFAULTS), notes: undefined, colors: { expand: "claude" } },
      effective: [],
      problems: [],
    },
  };
  on("state.get", (_, e, next) =>
    e.key === "settings" ? { value: { value: stale, version: 1 } } : next(e),
  );
  await $.tool.call({ tool: TOOL, items: ITEMS } as never);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  // Read as absent, the stale value draws nothing: no items drawn with
  // settings that lack notes.rows.
  expect(await titles(ui)).toEqual([]);
  expect(await ui.find({ type: "Text", text: /^No open Decide items/ })).toBeDefined();
  await ui.unmount();
});

test("Submit moves the items its draft answers to Done at once, and the turn's end confirms them", async ($, on) => {
  const later: TranscriptRecord[] = [];
  const state = engine(on, () => ITEMS, listsText, () => later);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press({ key: "9efb08a1.Decide.1.A" });
  await ui.press({ key: "9efb08a1.Decide.3.N" });
  await ui.press({ key: "submit" });

  // Before the turn runs: Done, saying what was sent.
  expect(await titles(ui)).toEqual(["🧠 Decide.2 · Cleanups to start"]);
  await openDone(ui);
  expect(await doneLines(ui)).toEqual([
    "🧠 Decide.1  Which cache to keep · Sent: A",
    "🧠 Decide.3  Ship tonight? · Sent: N",
  ]);

  // The engine records the sent draft as this plugin's prompt; the turn's
  // end reads it, and the items stay Done, now as answered.
  later.push(submitted("b2c3d4e5", state.sent[0] ?? ""), assistant("On it."));
  await $.turn.start({ text: state.sent[0] ?? "", turnId: "t2" });
  await $.turn.complete(replyDone("t2"));
  const line = await $.ui.mount({ ...ABOVE_PROMPT, surface: "terminal" });

  expect(await titles(ui)).toEqual(["🧠 Decide.2 · Cleanups to start"]);
  expect(await doneLines(ui)).toEqual([
    "🧠 Decide.1  Which cache to keep · Answered in b2c3d4e5: A",
    "🧠 Decide.3  Ship tonight? · Answered in b2c3d4e5: N",
  ]);
  expect(await countsOn(line)).toBe("📌 Outstanding: 🚧 1 · 🧠 1");
  await line.unmount();
  await ui.unmount();
});

test("a Submit pressed while the turn's end reads the transcript keeps its answer Done", async ($, on) => {
  const later: TranscriptRecord[] = [];
  const state = engine(on, () => ITEMS, listsText, () => later);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press({ key: "9efb08a1.Decide.1.A" });
  await ui.press({ key: "submit" });
  later.push(submitted("b2c3d4e5", state.sent[0] ?? ""), assistant("On it."));
  await $.turn.start({ text: state.sent[0] ?? "", turnId: "t2" });

  // The turn ends, and while its refresh reads the transcript, another
  // answer is picked and sent.
  const held = gate();
  state.holdRead = held.wait;
  const ending = $.turn.complete(replyDone("t2"));
  await held.reached;
  await ui.press({ key: "9efb08a1.Decide.3.N" });
  await ui.press({ key: "submit" });
  expect(state.sent).toHaveLength(2);
  held.release();
  await ending;

  // The read confirms the first answer; the second, which it couldn't
  // hold, stays Done as sent until a later read.
  await openDone(ui);
  expect(await doneLines(ui)).toEqual([
    "🧠 Decide.1  Which cache to keep · Answered in b2c3d4e5: A",
    "🧠 Decide.3  Ship tonight? · Sent: N",
  ]);
  expect(await titles(ui)).toEqual(["🧠 Decide.2 · Cleanups to start"]);
  await ui.unmount();
});

test("an answer Submit sent that the turn's end doesn't find goes back among the open items", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press({ key: "9efb08a1.Decide.1.A" });
  await ui.press({ key: "submit" });
  expect(state.sent).toHaveLength(1);
  expect(await titles(ui)).toHaveLength(2);

  // A refresh before the turn ends keeps it Done; the turn's end, whose
  // transcript holds no answer, puts it back.
  await $.command.run(ANSWERS);
  expect(await titles(ui)).toHaveLength(2);
  await $.turn.complete(replyDone("t2"));
  expect(await titles(ui)).toEqual([
    "🧠 Decide.1 · Which cache to keep",
    "🧠 Decide.2 · Cleanups to start",
    "🧠 Decide.3 · Ship tonight?",
  ]);
  await ui.unmount();
});

/** Picks an answer to each of ITEMS in the pane: every open item answered. */
const answerAll = async (ui: Pressable) => {
  await ui.press({ key: "9efb08a1.Decide.1.A" });
  await ui.press({ key: "9efb08a1.Decide.2.B" });
  await ui.press({ key: "9efb08a1.Decide.3.Y" });
};

test("a Submit that answers every open item closes the pane", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await answerAll(ui);
  await ui.press({ key: "submit" });

  expect(state.sent).toHaveLength(1);
  expect(state.isPaneOpen).toBe(false);
  await ui.unmount();
});

test("a pane close refused after a Submit went through rejects the press, as the old handlers' did", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await answerAll(ui);
  state.closeDenial = "the pane stays";

  await expect(ui.press({ key: "submit" })).rejects.toThrow("the pane stays");
  expect(state.sent).toHaveLength(1);
  // The press ended once the draft went through: Submit is free.
  state.closeDenial = undefined;
  state.box = "Ship it";
  await ui.press({ key: "submit" });
  expect(state.sent).toEqual([expect.any(String), "Ship it"]);
  await ui.unmount();
});

test("a Submit that leaves an item open keeps the pane open, and a later one answering it closes it", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press({ key: "9efb08a1.Decide.1.A" });
  await ui.press({ key: "9efb08a1.Decide.3.Y" });
  await ui.press({ key: "submit" });
  expect(state.sent).toHaveLength(1);
  expect(state.isPaneOpen).toBe(true);

  // The answers the first Submit sent still count, until the turn's end.
  await ui.press({ key: "9efb08a1.Decide.2.B" });
  await ui.press({ key: "submit" });
  expect(state.sent).toHaveLength(2);
  expect(state.isPaneOpen).toBe(false);
  await ui.unmount();
});

test("with pane.close-when-all-submitted off, a Submit answering every open item keeps the pane open", async ($, on) => {
  const state = engine(on, () => ITEMS);
  state.userFiles = { "config.yaml": "pane:\n  close-when-all-submitted: false\n" };
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await answerAll(ui);
  await ui.press({ key: "submit" });

  expect(state.sent).toHaveLength(1);
  expect(state.isPaneOpen).toBe(true);
  await ui.unmount();
});

test("a Submit the engine refuses, or that throws, keeps the pane open though it answers every item", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  for (const answer of [{ drop: "a hook refused it" }, new Error("the engine fell over")]) {
    state.submitAnswer = answer;
    state.box = "";
    await answerAll(ui);
    await ui.press({ key: "submit" });
    expect(state.sent).toEqual([]);
    expect(state.isPaneOpen).toBe(true);
  }
  await ui.unmount();
});

test("a Submit the engine refuses moves nothing to Done", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press({ key: "9efb08a1.Decide.1.A" });
  state.submitAnswer = { drop: "a hook refused it" };
  await ui.press({ key: "submit" });

  expect(await titles(ui)).toHaveLength(3);
  expect(await ui.find({ type: "Button", key: "9efb08a1.done" })).toBeUndefined();
  await ui.unmount();
});

test("a Done item's lines, opened to its box, have the settled bar beside them, and no hover bar", async ($, on) => {
  const open: unknown[] = [
    {
      ...ITEMS[0],
      options: [
        { letter: "A", name: "Disk", pros: ["Survives restarts."], cons: ["Disk use."] },
        { letter: "B", name: "Memory" },
      ],
    },
    ITEMS[2],
  ];
  engine(on, () => open);
  await $.command.run(ANSWERS);
  open.splice(0, 1);
  await $.turn.complete(replyDone("t1"));
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await openDone(ui);
  await ui.press({ key: "9efb08a1.Decide.1.line" });

  const gutter = async (key: string) =>
    (await ui.find({ type: "Box", key: `${key}-gutter` }))?.props;
  // Every line of the settled item's options: each option, ➕ and ➖ line.
  for (const key of [
    "9efb08a1.Decide.1.A",
    "9efb08a1.Decide.1.A-pro-0",
    "9efb08a1.Decide.1.A-con-0",
    "9efb08a1.Decide.1.B",
  ]) {
    expect(await gutter(key)).toMatchObject({ backgroundColor: "ide" });
    expect(await gutter(key)).not.toHaveProperty("hover");
  }
  // The open item's bar lights only under the pointer, and the settled
  // item's never does.
  const drawn = JSON.stringify(await ui.drawn());
  expect(drawn).toContain('"scope":"9efb08a1.Decide.3.Y","backgroundColor":"suggestion"');
  expect(drawn).not.toContain('"scope":"9efb08a1.Decide.1.A","backgroundColor"');
  expect(await gutter("9efb08a1.Decide.3.Y")).not.toHaveProperty("backgroundColor");
  await ui.unmount();
});

test("the pane's notes field is several rows tall, from the setting", async ($, on) => {
  engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  expect((await ui.find({ type: "Input", key: "9efb08a1.Decide.1.notes" }))?.props).toMatchObject({
    rows: 3,
  });
  expect(await ui.find({ type: "Button", key: "9efb08a1.Decide.1.add-note" })).toBeUndefined();
  await ui.unmount();
});

test("under a reply, ✏️ Add a note opens the pane with the keyboard at the item's notes field", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.tool.call({ tool: TOOL, items: ITEMS } as never);
  await $.turn.complete(replyDone("t0"));
  state.isPaneOpen = false;
  const reply = await $.ui.mount(REPLY);

  // A reply can't take the keyboard: a button in place of the field.
  expect(await reply.find({ type: "Input", key: "9efb08a1.Decide.3.notes" })).toBeUndefined();
  expect((await reply.find({ type: "Button", key: "9efb08a1.Decide.3.add-note" }))?.text).toBe(
    "✏️ Add a note",
  );
  await reply.press({ key: "9efb08a1.Decide.3.add-note" });
  expect(state.isPaneOpen).toBe(true);
  expect(state.opens).toEqual([false, true]);

  // In the pane, which the kit can't scroll, that item's field takes the focus, and no other.
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  expect((await ui.find({ type: "Input", key: "9efb08a1.Decide.3.notes" }))?.props).toMatchObject({
    autoFocus: true,
  });
  expect(
    (await ui.find({ type: "Input", key: "9efb08a1.Decide.1.notes" }))?.props,
  ).not.toHaveProperty("autoFocus");

  // Once the pane closes, the field no longer waits for the focus: /answers
  // opens it with nothing focused.
  await ui.press({ key: "dismiss" });
  await $.command.run(ANSWERS);
  expect(
    (await ui.findAll({ type: "Input" })).filter((found) => found.props.autoFocus === true),
  ).toEqual([]);
  await ui.unmount();
  await reply.unmount();
});

test("✏️ Add a note in a pane already open asks for the ring on the field, which waits for it until it lands", async ($, on) => {
  engine(on, () => ITEMS);
  await $.tool.call({ tool: TOOL, items: ITEMS } as never);
  await $.turn.complete(replyDone("t0"));
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  const focused = async () =>
    (await ui.findAll({ type: "Input" }))
      .filter((found) => found.props.autoFocus === true)
      .map((found) => found.key);
  expect(await focused()).toEqual([]);
  const reply = await $.ui.mount(REPLY);

  // The kit can't move a plugin's ring, so $.ui.focus is refused here: the
  // field keeps the focus to take as the pane draws it.
  await reply.press({ key: "9efb08a1.Decide.3.add-note" });
  expect(await focused()).toEqual(["9efb08a1.Decide.3.notes"]);

  // /answers opens the pane for no field: a later drawing focuses nothing.
  await $.command.run(ANSWERS);
  expect(await focused()).toEqual([]);
  await reply.unmount();
  await ui.unmount();
});

/** The notes fields of a drawing that take the focus as it draws, by key. */
const focusedFields = async (ui: Mounted) =>
  (await ui.findAll({ type: "Input" }))
    .filter((found) => found.props.autoFocus === true)
    .map((found) => found.key);

// A plugin beside this one that closes the pane, as the person's Escape
// does: the close reaches this plugin at ui.close alone, not through ✖,
// which clears the wait itself. The kit's `$` has no `ui.close` to raise.
const CLOSER = {
  name: "closer",
  register: ((on) => {
    on("command.run", { command: "close-kanban" }, async ($) => {
      await $.ui.close({ id: "kanban-turns" });

      return { text: "" };
    });
  }) satisfies Register,
};

test("the pane closed by anything but ✖ leaves no field waiting for the focus", { plugins: [CLOSER] }, async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.tool.call({ tool: TOOL, items: ITEMS } as never);
  await $.turn.complete(replyDone("t0"));
  const reply = await $.ui.mount(REPLY);
  await reply.press({ key: "9efb08a1.Decide.3.add-note" });
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  expect(await focusedFields(ui)).toEqual(["9efb08a1.Decide.3.notes"]);

  // The drawing is read as it stands, since a reopening clears the wait
  // itself.
  await $.command.run({ ...ANSWERS, command: "close-kanban" });
  expect(state.isPaneOpen).toBe(false);
  expect(await focusedFields(ui)).toEqual([]);
  await reply.unmount();
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

test("the context tells the agent about the plugin's tool, and keeps the rest", async ($, on) => {
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

test("the context teaches the whole turn-response format, every list's header and the roll-up's among it", async ($, on) => {
  engine(on, () => []);
  on("prompt.context", (_, e) => ({ blocks: e.blocks }));
  const { blocks } = await $.prompt.context({ blocks: [] });
  const text = blocks.find((block) => block.name === "kanbanTurns")?.text ?? "";

  [
    "✅ **Done:**",
    "🚧 **Pending:**",
    "📝 **Logged:**",
    "⏳ **Waiting:**",
    "❓ **Answers:**",
    "🔑 **Authorizations:**",
    "🔍 **Review:**",
    "👉 **Todo:**",
    "🧠 **Decide:**",
    "📌 **Outstanding from previous turns:**",
    "📌 Outstanding: 🚧 1",
    "## Progress updates",
    "A question is never a choice.",
  ].forEach((phrase) => expect(text).toContain(phrase));
  expect(text).not.toContain("{{");
});

const GO = { text: "go", wait: false, origin: { kind: "composer" } } as const;

test(
  "a prepend hook that sends prompt.context past the plugin still leaves the instructions in the first prompt's context, once",
  {
    plugins: [
      {
        // cc-plugin-sec-default's own hook, seated outermost under managed settings.
        name: "sec-default-stand-in",
        tier: "prepend",
        register(on) {
          on("prompt.context", (_, e, next) => next.to(e, "append"));
        },
      },
    ],
  },
  async ($, on) => {
    const state = engine(on, () => []);
    on("prompt.context", (_, e) => ({ blocks: e.blocks }));

    const { blocks } = await $.prompt.context({ blocks: [] });
    expect(blocks.map((block) => block.name)).not.toContain("kanbanTurns");

    await $.prompt.submit(GO);
    await $.prompt.submit(GO);
    expect(state.contexts).toHaveLength(2);
    expect(state.contexts[0]).toHaveLength(1);
    expect(state.contexts[0]?.[0]).toContain(`\`${TOOL}\``);
    expect(state.contexts[1]).toEqual([]);
  },
);

test("where prompt.context reaches the plugin, the prompts' context gets no second copy", async ($, on) => {
  const state = engine(on, () => []);
  on("prompt.context", (_, e) => ({ blocks: e.blocks }));

  const { blocks } = await $.prompt.context({ blocks: [] });
  expect(blocks.map((block) => block.name)).toEqual(["kanbanTurns"]);

  await $.prompt.submit(GO);
  expect(state.contexts).toEqual([[]]);
});
