import { expect, test } from "claude-code/testing";
import type { Engine } from "claude-code/testing";
import type {
  On,
  PromptChangeInput,
  PromptChangeResult,
  PromptEditInput,
  PromptEditResult,
  Register,
} from "claude-code";

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
  marks: {
    sent: "✅",
    chosen: "✅",
    note: "✏️",
    "settled-bar": "▌",
    collapsed: "▸",
    expanded: "▾",
    buttons: {
      dismiss: "✖",
      next: "↓",
      previous: "↑",
      submit: "📤",
      reassess: "🔄",
      help: "?",
      kanban: "🖥️",
    },
  },
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
    // Why a read of the plugin's own defaults file fails; none fails.
    defaultsDenial: undefined as string | undefined,
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
    if (state.defaultsDenial !== undefined && e.path.endsWith("/defaults/config.yaml")) {
      return { deny: state.defaultsDenial };
    }
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

/** The pane's turn headers, each a toggle, in the order drawn: the open branch's, then, while it's expanded, the Done branch's. */
const turnHeaders = async (ui: Drawing) =>
  (await ui.findAll({ type: "Button", text: / ── / })).map((found) => found.text);

/**
 * The Done items' one-line rows, in the order drawn, once their branch and
 * turn are open, each as `label  text`: a Box keyed `<ref>.line-hang`
 * holding the label, then the text, which wraps under its own start.
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

/** Opens the pane's Done branch, by its header, when it's drawn collapsed; its turns are expanded at first. */
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

test("a defaults file whose read fails leaves no settings in use, and the pane and /answers-config say why", async ($, on) => {
  const state = engine(on, () => ITEMS);
  const why = "the defaults can't be read";
  state.defaultsDenial = why;

  const config = (await $.command.run({ ...ANSWERS, command: "answers-config" })).text ?? "";
  expect(config).toMatch(/^Not used: /);
  expect(config).toContain(why);

  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  expect(await titles(ui)).toEqual([]);
  expect(JSON.stringify(await ui.drawn())).toContain(why);
  await ui.unmount();
});

test("a settings read whose answer can't be written is dropped: its refresh waits on nothing, and the next refresh reads as before", async ($, on) => {
  engine(on, () => ITEMS);
  type Written = Readonly<{ settings: Readonly<{ tag: string }>; refresh: Readonly<{ reads: readonly unknown[] }> }>;
  const pane = { denied: 0, written: [] as Written[] };
  // The first write of a settings read's answer fails, as a full store's
  // would; every other write lands, and is kept.
  on("state.set", (_, e, next) => {
    const written = (e as unknown as { key: string; value: { value: Written } });

    if (written.key !== "pane") {
      return next(e);
    }
    if (pane.denied === 0 && written.value.value.settings.tag !== "unread") {
      pane.denied += 1;

      return { deny: "the store is full" };
    }
    pane.written.push(written.value.value);

    return next(e);
  });

  await $.command.run(ANSWERS).catch(() => undefined);
  expect(pane.denied).toBe(1);
  expect(pane.written.at(-1)?.settings.tag).toBe("unread");
  expect(pane.written.at(-1)?.refresh.reads).toEqual([]);

  await $.command.run(ANSWERS);
  expect(pane.written.at(-1)?.settings.tag).toBe("loaded");
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  expect(await titles(ui)).not.toEqual([]);
  await ui.unmount();
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

test("the pane keeps every item raised, newest turn first, a Done one in its turn under the collapsed Done branch", async ($, on) => {
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

  // Each turn with an open item under a faint header, a toggle, expanded,
  // naming its index, the latest ₀, and its open items' count; its open
  // items drawn in full.
  expect(await turnHeaders(ui)).toEqual(["▾ ── b2c3d4e5 ₀ (1) ──", "▾ ── 9efb08a1 ₋₁ (2) ──"]);
  expect((await ui.find({ type: "Button", key: "open.9efb08a1" }))?.props).toMatchObject({ dimColor: true });
  expect(await titles(ui)).toEqual([
    "🧠 Decide.1 · Which loader to keep",
    "🧠 Decide.2 · Cleanups to start",
    "🧠 Decide.3 · Ship tonight?",
  ]);

  // The Done branch is collapsed: its header alone, none of its turns' or
  // the item's elements.
  const header = await ui.find({ type: "Button", key: "done" });
  expect(header?.text).toBe("▸ Done (1)");
  expect(header?.props["dimColor"]).not.toBe(true);
  expect(await ui.find({ type: "Button", key: "done.9efb08a1" })).toBeUndefined();
  expect(await ui.find({ type: "Button", key: "9efb08a1.Decide.1.A" })).toBeUndefined();
  expect(await doneLines(ui)).toEqual([]);

  // A click opens it to each turn with a Done item, under its own header,
  // expanded, counting the turn's Done items, then one dim line per Done
  // item, opened by a ▌ in the settled colour.
  await ui.press({ key: "done" });
  expect((await ui.find({ type: "Button", key: "done" }))?.text).toBe("▾ Done (1)");
  expect(await turnHeaders(ui)).toEqual([
    "▾ ── b2c3d4e5 ₀ (1) ──",
    "▾ ── 9efb08a1 ₋₁ (2) ──",
    "▾ ── 9efb08a1 ₋₁ (1) ──",
  ]);
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
  // keeping its sent mark, and the item stays under the Done branch. A click on its
  // title closes it to its line again.
  await ui.press({ key: "9efb08a1.Decide.1.line" });
  expect(await titles(ui)).toContain("🧠 Decide.1 · Which cache to keep (done)");
  await ui.press({ key: "9efb08a1.Decide.1.B" });
  expect(state.box).toBe(`${HEADER}9efb08a1.Decide.1.B\n`);
  expect(await leadOf(ui, "9efb08a1.Decide.1.B")).toBe("✅ B. ");
  expect(await leadOf(ui, "9efb08a1.Decide.1.A")).toBe("✅ A. ");
  expect((await ui.find({ type: "Button", key: "9efb08a1.Decide.1.B" }))?.props["dimColor"]).not.toBe(true);
  expect(await titles(ui)).toContain("🧠 Decide.1 · Which cache to keep (done)");
  await ui.press({ key: "9efb08a1.Decide.1.B" });
  expect(state.box).toBe("");
  await ui.press({ key: "9efb08a1.Decide.1.line" });
  expect(await titles(ui)).not.toContain("🧠 Decide.1 · Which cache to keep (done)");
  expect(await doneLines(ui)).toHaveLength(1);

  // A second click on the Done header collapses the branch again.
  await ui.press({ key: "done" });
  expect(await doneLines(ui)).toEqual([]);

  await ui.press({ key: "b2c3d4e5.Decide.1.B" });
  expect(state.box).toBe(`${HEADER}b2c3d4e5.Decide.1.B\n`);
  await ui.unmount();
});

test("the Done branch's header folds every Done turn together, and a turn's header folds that turn in its own branch alone", async ($, on) => {
  const later: TranscriptRecord[] = [];
  engine(on, () => ITEMS, listsText, () => later);
  await $.turn.complete(replyDone("t1"));
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  // Two turns with a Done item: 9efb08a1, with open items too, and
  // b2c3d4e5, whose one item a later prompt answers.
  later.push(
    human("b2c3d4e5", "9efb08a1.Decide.1.A"),
    replyRecord([LATER], listsText([LATER])),
  );
  await $.turn.complete(replyDone("t2"));
  later.push(human("c3d4e5f6", "b2c3d4e5.Decide.1.A"), assistant("On it."));
  await $.turn.complete(replyDone("t3"));
  const header = async (key: string) => (await ui.find({ type: "Button", key }))?.text;

  // The Done branch counts every Done item, across its turns.
  expect(await header("done")).toBe("▸ Done (2)");
  await ui.press({ key: "done" });
  expect(await turnHeaders(ui)).toEqual([
    "▾ ── 9efb08a1 ₋₂ (2) ──",
    "▾ ── b2c3d4e5 ₋₁ (1) ──",
    "▾ ── 9efb08a1 ₋₂ (1) ──",
  ]);
  expect(await doneLines(ui)).toEqual([
    "🧠 Decide.1  Which loader to keep · Answered in c3d4e5f6: A",
    "🧠 Decide.1  Which cache to keep · Answered in b2c3d4e5: A",
  ]);

  // Folding 9efb08a1 under Open hides its open items, and leaves it under
  // Done as it was.
  await ui.press({ key: "open.9efb08a1" });
  expect(await header("open.9efb08a1")).toBe("▸ ── 9efb08a1 ₋₂ (2) ──");
  expect(await titles(ui)).toEqual([]);
  expect(await header("done.9efb08a1")).toBe("▾ ── 9efb08a1 ₋₂ (1) ──");
  expect(await doneLines(ui)).toHaveLength(2);

  // Folding it under Done too hides its Done line alone; opening it under
  // Open again brings back its open items.
  await ui.press({ key: "done.9efb08a1" });
  expect(await doneLines(ui)).toEqual(["🧠 Decide.1  Which loader to keep · Answered in c3d4e5f6: A"]);
  await ui.press({ key: "open.9efb08a1" });
  expect(await titles(ui)).toEqual(["🧠 Decide.2 · Cleanups to start", "🧠 Decide.3 · Ship tonight?"]);
  expect(await header("done.9efb08a1")).toBe("▸ ── 9efb08a1 ₋₂ (1) ──");

  // Collapsing the Done branch hides every Done turn together, and the
  // Open branch stays.
  await ui.press({ key: "done" });
  expect(await header("done")).toBe("▸ Done (2)");
  expect(await header("done.b2c3d4e5")).toBeUndefined();
  expect(await header("done.9efb08a1")).toBeUndefined();
  expect(await doneLines(ui)).toEqual([]);
  expect(await turnHeaders(ui)).toEqual(["▾ ── 9efb08a1 ₋₂ (2) ──"]);

  // Opened again, each Done turn is as it was left.
  await ui.press({ key: "done" });
  expect(await header("done.b2c3d4e5")).toBe("▾ ── b2c3d4e5 ₋₁ (1) ──");
  expect(await header("done.9efb08a1")).toBe("▸ ── 9efb08a1 ₋₂ (1) ──");
  await ui.unmount();
});

test("the Open branch's header folds every open turn together, and opens them again as they were", async ($, on) => {
  const later: TranscriptRecord[] = [];
  engine(on, () => ITEMS, listsText, () => later);
  await $.turn.complete(replyDone("t1"));
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  later.push(human("b2c3d4e5", "go on"), replyRecord([LATER], listsText([LATER])));
  await $.turn.complete(replyDone("t2"));
  const header = async (key: string) => (await ui.find({ type: "Button", key }))?.text;

  expect(await header("open")).toBe("▾ Open (4)");
  await ui.press({ key: "open.9efb08a1" });
  await ui.press({ key: "open" });
  expect(await header("open")).toBe("▸ Open (4)");
  expect(await turnHeaders(ui)).toEqual([]);
  expect(await titles(ui)).toEqual([]);

  await ui.press({ key: "open" });
  expect(await turnHeaders(ui)).toEqual(["▾ ── b2c3d4e5 ₀ (1) ──", "▸ ── 9efb08a1 ₋₁ (3) ──"]);
  expect(await titles(ui)).toEqual(["🧠 Decide.1 · Which loader to keep"]);
  await ui.unmount();
});

test("a pick moves its item to Queued and an unpick back to Open, every toggle as it was left, only the counts changing; Submit moves it to Done", async ($, on) => {
  const later: TranscriptRecord[] = [];
  const state = engine(on, () => ITEMS, listsText, () => later);
  await $.turn.complete(replyDone("t1"));
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  later.push(human("b2c3d4e5", "go on"), replyRecord([LATER], listsText([LATER])));
  await $.turn.complete(replyDone("t2"));
  const header = async (key: string) => (await ui.find({ type: "Button", key }))?.text;
  // The newer turn folded under Open.
  await ui.press({ key: "open.b2c3d4e5" });

  // A pick: the item moves to its turn under Queued, expanded at first, its
  // box whole there, its options still live; nothing else folds or opens.
  await ui.press({ key: "9efb08a1.Decide.1.A" });
  expect(await header("open")).toBe("▾ Open (3)");
  expect(await header("open.b2c3d4e5")).toBe("▸ ── b2c3d4e5 ₀ (1) ──");
  expect(await header("open.9efb08a1")).toBe("▾ ── 9efb08a1 ₋₁ (2) ──");
  expect(await header("queued")).toBe("▾ Queued (1)");
  expect(await header("queued.9efb08a1")).toBe("▾ ── 9efb08a1 ₋₁ (1) ──");
  expect(await titles(ui)).toEqual([
    "🧠 Decide.2 · Cleanups to start",
    "🧠 Decide.3 · Ship tonight?",
    "🧠 Decide.1 · Which cache to keep",
  ]);
  expect(await leadOf(ui, "9efb08a1.Decide.1.A")).toBe("✅ A. ");
  expect(await ui.find({ type: "Input", key: "9efb08a1.Decide.1.notes" })).toBeDefined();
  expect(await ui.find({ type: "Text", text: /^1 of 4 answered$/ })).toBeDefined();

  // Folded under Queued, a second pick only counts there.
  await ui.press({ key: "queued.9efb08a1" });
  await ui.press({ key: "9efb08a1.Decide.3.Y" });
  expect(await header("queued.9efb08a1")).toBe("▸ ── 9efb08a1 ₋₁ (2) ──");
  expect(await header("open.9efb08a1")).toBe("▾ ── 9efb08a1 ₋₁ (1) ──");
  expect(await header("open.b2c3d4e5")).toBe("▸ ── b2c3d4e5 ₀ (1) ──");

  // An unpick puts the item back in Open, Queued's turn still folded.
  await ui.press({ key: "queued.9efb08a1" });
  await ui.press({ key: "9efb08a1.Decide.3.Y" });
  expect(await header("open.9efb08a1")).toBe("▾ ── 9efb08a1 ₋₁ (2) ──");
  expect(await header("queued")).toBe("▾ Queued (1)");
  await ui.press({ key: "queued.9efb08a1" });

  // Submit moves the queued item to Done, which stays collapsed.
  await ui.press({ key: "submit" });
  expect(state.sent).toHaveLength(1);
  expect(await header("queued")).toBeUndefined();
  expect(await header("done")).toBe("▸ Done (1)");
  expect(await header("open.b2c3d4e5")).toBe("▸ ── b2c3d4e5 ₀ (1) ──");
  await ui.press({ key: "done" });
  expect(await doneLines(ui)).toEqual(["🧠 Decide.1  Which cache to keep · Sent: A"]);

  // A turn new to Queued starts expanded, the folded ones staying folded.
  await ui.press({ key: "open.b2c3d4e5" });
  await ui.press({ key: "b2c3d4e5.Decide.1.B" });
  expect(await header("queued.b2c3d4e5")).toBe("▾ ── b2c3d4e5 ₀ (1) ──");
  await ui.unmount();
});

test("a pick under the ring moves a radio item to Queued at once; a checkbox item stays in Open until the ring leaves it", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  // The ring landing on an element, as the engine says of a Tab, an arrow
  // or a click. A plugin's own $.ui.focus never reaches the kit's hooks, nor
  // another plugin's, so where a pick sends the ring is left to a live
  // session; test/unit/pane/sections.test.ts's ringAfterMove tests hold it.
  state.isRingMovable = true;
  const ringOn = (element: string) =>
    $.ui.focus({ component: "Pane", requestId: "kanban-turns", element, origin: { kind: "person" } });

  // A radio item, one pick: it moves.
  await ringOn("9efb08a1.Decide.1.A");
  await ui.press({ key: "9efb08a1.Decide.1.A" });
  expect(await titles(ui)).toEqual([
    "🧠 Decide.2 · Cleanups to start",
    "🧠 Decide.3 · Ship tonight?",
    "🧠 Decide.1 · Which cache to keep",
  ]);

  // A checkbox item takes more than one pick: it stays in Open while the
  // ring is on one of its elements.
  await ringOn("9efb08a1.Decide.2.A");
  await ui.press({ key: "9efb08a1.Decide.2.A" });
  await ringOn("9efb08a1.Decide.2.C");
  await ui.press({ key: "9efb08a1.Decide.2.C" });
  expect((await titles(ui))[0]).toBe("🧠 Decide.2 · Cleanups to start");
  expect((await ui.find({ type: "Button", key: "open" }))?.text).toBe("▾ Open (2)");
  expect(state.box).toBe(`${HEADER}9efb08a1.Decide.1.A\n9efb08a1.Decide.2.A,C\n`);

  // Once the ring leaves it, it moves to Queued.
  await ringOn("9efb08a1.Decide.3.Y");
  expect(await titles(ui)).toEqual([
    "🧠 Decide.3 · Ship tonight?",
    "🧠 Decide.1 · Which cache to keep",
    "🧠 Decide.2 · Cleanups to start",
  ]);
  expect((await ui.find({ type: "Button", key: "queued" }))?.text).toBe("▾ Queued (2)");

  // A checkbox item picked again in Queued stays there.
  await ringOn("9efb08a1.Decide.2.B");
  await ui.press({ key: "9efb08a1.Decide.2.B" });
  expect((await ui.find({ type: "Button", key: "queued" }))?.text).toBe("▾ Queued (2)");
  await ui.unmount();
});

test("/answers opens the turn its first unanswered item is under, where a click folded it", async ($, on) => {
  engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press({ key: "open.9efb08a1" });
  expect((await ui.find({ type: "Button", key: "open.9efb08a1" }))?.text).toBe("▸ ── 9efb08a1 ₀ (3) ──");

  await $.command.run(ANSWERS);
  expect((await ui.find({ type: "Button", key: "open.9efb08a1" }))?.text).toBe("▾ ── 9efb08a1 ₀ (3) ──");
  expect(await titles(ui)).toHaveLength(3);
  await ui.unmount();
});

test("folds stored under an older shape are not used: every toggle starts as it's made", async ($, on) => {
  const later: TranscriptRecord[] = [];
  engine(on, () => ITEMS, listsText, () => later);
  // What an older shape kept, the Done branch opened; the store answers it
  // whatever the plugin writes since.
  on("state.get", (_, e, next) =>
    e.key === "folds"
      ? { value: { value: { shape: "folds-0", value: { expanded: ["done"], collapsed: ["open"] } }, version: 1 } }
      : next(e),
  );
  await $.turn.complete(replyDone("t1"));
  later.push(human("b2c3d4e5", "9efb08a1.Decide.1.A"), assistant("On it."));
  await $.turn.complete(replyDone("t2"));
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  expect((await ui.find({ type: "Button", key: "done" }))?.text).toBe("▸ Done (1)");
  expect((await ui.find({ type: "Button", key: "open" }))?.text).toBe("▾ Open (2)");
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
  expect(await row(0)).toBe("n↓ Next: the next item, or header");
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

test("↓ Next and ↑ Previous follow the focus ring, stopping on each toggle, dim at either end", async ($, on) => {
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

  // On the Open branch's header, the first stop: nothing is before it.
  await ringOn("open");
  expect(await dim("previous")).toBe(true);
  expect(await dim("next")).toBe(false);

  // On the first turn's header, the Open branch's is before it.
  await ringOn("open.9efb08a1");
  expect(await dim("previous")).toBe(false);
  expect(await dim("next")).toBe(false);

  // On the first item's notes field, the item counts: its turn's header is
  // before it.
  await ringOn("9efb08a1.Decide.2.notes");
  expect(await dim("previous")).toBe(false);
  expect(await dim("next")).toBe(false);

  // On the Done branch's header, the last stop while the branch is closed.
  await ringOn("done");
  expect(await dim("next")).toBe(true);
  expect(await dim("previous")).toBe(false);

  // Opened, its turn's header and that turn's line follow it; the line is
  // the last.
  await ui.press({ key: "done" });
  expect(await dim("next")).toBe(false);
  await ringOn("done.9efb08a1");
  expect(await dim("next")).toBe(false);
  expect(await dim("previous")).toBe(false);
  await ringOn("9efb08a1.Decide.1.line");
  expect(await dim("next")).toBe(true);

  // A folded turn's items are no stops: its header is the last.
  await ringOn("done.9efb08a1");
  await ui.press({ key: "done.9efb08a1" });
  expect(await dim("next")).toBe(true);
  expect(await dim("previous")).toBe(false);

  // A press of ↓ itself, which a hotkey may leave the ring on, keeps the
  // item the ring was on.
  await ringOn("next");
  expect(await dim("next")).toBe(true);
  expect(state.focus).toEqual([
    "open",
    "open.9efb08a1",
    "9efb08a1.Decide.2.notes",
    "done",
    "done.9efb08a1",
    "9efb08a1.Decide.1.line",
    "done.9efb08a1",
    "next",
  ]);
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
    expect(await leadOf(drawing, "9efb08a1.Decide.1.A")).toBe("✅ A. ");
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
  expect((await ui.find({ type: "Button", key: "done" }))?.text).toBe("▸ Done (1)");
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

  expect(await turnHeaders(ui)).toEqual(["▾ ── b2c3d4e5 ₀ (1) ──"]);
  expect(await titles(ui)).toEqual(["🧠 Decide.1 · Which loader to keep"]);
  expect((await ui.find({ type: "Button", key: "done" }))?.text).toBe("▸ Done (3)");
  await ui.press({ key: "done" });
  expect(await turnHeaders(ui)).toEqual(["▾ ── b2c3d4e5 ₀ (1) ──", "▾ ── 9efb08a1 ₋₁ (3) ──"]);
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
  expect((await ui.find({ type: "Button", key: "done" }))?.text).toBe("▸ Done (1)");
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
  // lines, its name, ➕ and ➖ lines alike, in the hover colour, and no
  // longer inverts its text.
  // The hover style rides on the gutter's cell, which the engine reports
  // beside its props.
  const gutter = async (key: string) =>
    JSON.stringify(await ui.find({ type: "Box", key: `${key}-gutter` }));
  for (const key of ["9efb08a1.Decide.1.A", "9efb08a1.Decide.1.A-pro-0", "9efb08a1.Decide.1.A-con-0"]) {
    expect(await gutter(key)).toContain(
      '"hover":{"scope":"9efb08a1.Decide.1.A","backgroundColor":"suggestion"}',
    );
  }
  expect(JSON.stringify(await ui.drawn())).not.toContain('"inverse":true');
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

test("a Decide item's box draws the Frees: line naming what it frees, under its options, and none for an item that frees nothing", async ($, on) => {
  const freeing = [{ ...ITEMS[0], frees: ["9efb08a1.Todo.1", "9efb08a1.Review.2"] }, ITEMS[2]];
  engine(on, () => freeing);
  await $.tool.call({ tool: TOOL, items: freeing } as never);
  await $.turn.complete(replyDone("t0"));
  const reply = await $.ui.mount(REPLY);

  const drawn = JSON.stringify(await reply.drawn());
  expect(drawn).toContain("Frees: 9efb08a1.Todo.1, 9efb08a1.Review.2");
  expect(drawn.indexOf("Frees: ")).toBeGreaterThan(drawn.indexOf("Memory"));
  expect(drawn.indexOf("Frees: ")).toBeLessThan(drawn.indexOf(" 🧠 Decide.3 "));
  expect(drawn.split("Frees: ").length).toBe(2);
  await reply.unmount();
});

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

/**
 * The prompt box's own events, which the engine raises for the person's
 * edits and the test kit's `$` carries, though its types list only the
 * calls a plugin makes.
 */
type PromptEvents = Readonly<{
  edit: (e: PromptEditInput) => Promise<PromptEditResult>;
  change: (e: PromptChangeInput) => Promise<PromptChangeResult>;
}>;

const promptEvents = ($: Engine): PromptEvents => $.prompt as unknown as PromptEvents;

test("a pick in a reply's box shows in the pane's, and one in the pane's in the reply's, both read from the draft, which the person's own edits change", async ($, on) => {
  const state = engine(on, () => ITEMS);
  // The engine's box takes the person's edit, as core splices it in, and
  // echoes a change.
  on("prompt.edit", (_, e) => {
    state.box = `${e.text.slice(0, e.start)}${e.inputText}${e.text.slice(e.end)}`;

    return { text: state.box, cursor: e.start + e.inputText.length };
  });
  on("prompt.change", (_, e) => {
    state.box = e.text;

    return { text: e.text };
  });
  await $.tool.call({ tool: TOOL, items: ITEMS } as never);
  await $.turn.complete(replyDone("t0"));
  const reply = await $.ui.mount(REPLY);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  const leads = async (key: string) => [await leadOf(reply, key), await leadOf(ui, key)];
  expect(await leads("9efb08a1.Decide.1.B")).toEqual(["🔘 B. ", "🔘 B. "]);

  await reply.press({ key: "9efb08a1.Decide.1.B" });
  expect(await leads("9efb08a1.Decide.1.B")).toEqual(["✅ B. ", "✅ B. "]);
  await ui.press({ key: "9efb08a1.Decide.3.N" });
  expect(await leads("9efb08a1.Decide.3.N")).toEqual(["✅ N. ", "✅ N. "]);
  const picked = `${HEADER}9efb08a1.Decide.1.B\n9efb08a1.Decide.3.N\n`;
  expect(state.box).toBe(picked);

  // The person deletes the second answer's line by hand: both copies unpick
  // it. Taking the edit back puts it back in both.
  const at = picked.indexOf("9efb08a1.Decide.3.N");
  await promptEvents($).edit({
    origin: { kind: "composer" },
    text: picked,
    cursor: picked.length,
    start: at,
    end: picked.length,
    inputText: "",
  });
  expect(state.box).toBe(`${HEADER}9efb08a1.Decide.1.B\n`);
  expect(await leads("9efb08a1.Decide.3.N")).toEqual(["👎 N. ", "👎 N. "]);
  expect(await leads("9efb08a1.Decide.1.B")).toEqual(["✅ B. ", "✅ B. "]);
  await promptEvents($).change({ text: picked, cursor: picked.length, origin: { kind: "undo" } });
  expect(await leads("9efb08a1.Decide.3.N")).toEqual(["✅ N. ", "✅ N. "]);

  // Unpicked in either, the option is unpicked in both.
  await ui.press({ key: "9efb08a1.Decide.1.B" });
  expect(await leads("9efb08a1.Decide.1.B")).toEqual(["🔘 B. ", "🔘 B. "]);
  expect(state.sent).toEqual([]);
  await reply.unmount();
  await ui.unmount();
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

test("a question in a reply whose item is Done opens every level it's under, the Done branch and its turn there, and its box", async ($, on) => {
  const open: unknown[] = [...ITEMS];
  engine(on, () => open);
  await $.tool.call({ tool: TOOL, items: ITEMS } as never);
  await $.turn.complete(replyDone("t0"));
  open.splice(0, 1);
  await $.turn.complete(replyDone("t1"));
  const reply = await $.ui.mount(REPLY);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  // The item's turn folded under the Done branch, and the branch closed;
  // the same turn folded under Open too.
  await ui.press({ key: "done" });
  await ui.press({ key: "done.9efb08a1" });
  await ui.press({ key: "done" });
  await ui.press({ key: "open.9efb08a1" });
  expect(await ui.find({ type: "Button", key: "done.9efb08a1" })).toBeUndefined();
  expect(await doneLines(ui)).toEqual([]);

  await reply.press({
    key: "kanban-questions",
    link: { href: "https://kanban-turns.invalid/9efb08a1.Decide.1" },
  });
  expect((await ui.find({ type: "Button", key: "done" }))?.text).toBe("▾ Done (1)");
  expect((await ui.find({ type: "Button", key: "done.9efb08a1" }))?.text).toBe("▾ ── 9efb08a1 ₀ (1) ──");
  expect(await titles(ui)).toContain("🧠 Decide.1 · Which cache to keep (done)");
  // The turn under Open stays as it was: folded.
  expect((await ui.find({ type: "Button", key: "open.9efb08a1" }))?.text).toBe("▸ ── 9efb08a1 ₀ (2) ──");
  await reply.unmount();
  await ui.unmount();
});

// A later turn's item restating ITEMS[0] on another subject, naming it in
// supersedes.
const RESTATED = { ...LATER, supersedes: ["9efb08a1.Decide.1"] } as const;

/** The records of the later turn b2c3d4e5, whose reply raises RESTATED. */
const restating = (): readonly TranscriptRecord[] => [
  human("b2c3d4e5", "go on"),
  replyRecord([RESTATED], listsText([RESTATED])),
];

/**
 * The engine with ITEMS raised in turn 9efb08a1, then RESTATED in turn
 * b2c3d4e5, each turn's end read. The kit has no layout to scroll a pane
 * by, and hands no `$.ui.scroll` on to a hook, so a link's scroll to the
 * item can't be seen here: the tests see the pane open with the keyboard
 * and the item's levels opened.
 */
const superseding = async ($: Engine, on: On) => {
  const later: TranscriptRecord[] = [];
  const state = engine(on, () => ITEMS, listsText, () => later);
  await $.tool.call({ tool: TOOL, items: ITEMS } as never);
  await $.turn.complete(replyDone("t0"));
  later.push(...restating());
  await $.tool.call({ tool: TOOL, items: [RESTATED] } as never);
  await $.turn.complete(replyDone("t1"));

  return state;
};

test("an item a later one names in supersedes is Done, its line a link to the later item, whose box links back, each opening the other", async ($, on) => {
  const state = await superseding($, on);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  expect(await titles(ui)).toEqual([
    "🧠 Decide.1 · Which loader to keep",
    "🧠 Decide.2 · Cleanups to start",
    "🧠 Decide.3 · Ship tonight?",
  ]);

  // The newer item's box names the item it supersedes, a link that opens
  // the Done branch, that item's turn there and its box.
  const back = "b2c3d4e5.Decide.1.link.9efb08a1.Decide.1";
  expect((await ui.find({ type: "Button", key: back }))?.text).toBe("Supersedes 9efb08a1.Decide.1");
  expect((await ui.find({ type: "Button", key: "done" }))?.text).toBe("▸ Done (1)");
  await ui.press({ key: back });
  expect((await ui.find({ type: "Button", key: "done" }))?.text).toBe("▾ Done (1)");
  expect((await ui.find({ type: "Button", key: "done.9efb08a1" }))?.text).toContain("▾ ── 9efb08a1");
  expect(await titles(ui)).toContain("🧠 Decide.1 · Which cache to keep (done)");
  expect(state.opens.at(-1)).toBe(true);

  // The older item's box says what superseded it, a link back.
  const forth = "9efb08a1.Decide.1.link.b2c3d4e5.Decide.1";
  expect((await ui.find({ type: "Button", key: forth }))?.text).toBe("Superseded by b2c3d4e5.Decide.1");
  state.opens.length = 0;
  await ui.press({ key: forth });
  expect(state.opens).toEqual([true]);

  // Its box closed again, its Done line ends on the same link.
  await ui.press({ key: "9efb08a1.Decide.1.line" });
  expect(await doneLines(ui)).toEqual(["🧠 Decide.1  Which cache to keep · Superseded by b2c3d4e5.Decide.1"]);
  const row = "9efb08a1.Decide.1.superseded-by";
  expect((await ui.find({ type: "Button", key: row }))?.text).toBe("Superseded by b2c3d4e5.Decide.1");
  state.opens.length = 0;
  await ui.press({ key: row });
  expect(state.opens).toEqual([true]);
  expect(await doneLines(ui)).toEqual(["🧠 Decide.1  Which cache to keep · Superseded by b2c3d4e5.Decide.1"]);
  await ui.unmount();
});

test("a reply's own boxes draw the same links, and a click there opens the pane at the other item, every level above it open", async ($, on) => {
  const state = await superseding($, on);
  const reply = await $.ui.mount({ ...REPLY, props: { ...REPLY.props, text: listsText([RESTATED]) } });
  const back = "b2c3d4e5.Decide.1.link.9efb08a1.Decide.1";
  expect((await reply.find({ type: "Button", key: back }))?.text).toBe("Supersedes 9efb08a1.Decide.1");
  state.isPaneOpen = false;

  await reply.press({ key: back });
  expect(state.isPaneOpen).toBe(true);
  expect(state.opens.at(-1)).toBe(true);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  expect((await ui.find({ type: "Button", key: "done" }))?.text).toBe("▾ Done (1)");
  expect((await ui.find({ type: "Button", key: "done.9efb08a1" }))?.text).toContain("▾ ── 9efb08a1");
  expect(await titles(ui)).toContain("🧠 Decide.1 · Which cache to keep (done)");
  await reply.unmount();

  // The older item's reply box links forward to the newer one.
  const first = await $.ui.mount({ ...REPLY, props: { ...REPLY.props, text: listsText(ITEMS) } });
  const forth = "9efb08a1.Decide.1.link.b2c3d4e5.Decide.1";
  expect((await first.find({ type: "Button", key: forth }))?.text).toBe("Superseded by b2c3d4e5.Decide.1");
  state.opens.length = 0;
  await first.press({ key: forth });
  expect(state.opens).toEqual([true]);
  await first.unmount();
  await ui.unmount();
});

test("the tool's result says what it ignored of an item's supersedes, as naming no Decide item", async ($, on) => {
  engine(on, () => ITEMS);
  const given = { ...RESTATED, supersedes: ["9efb08a1.Decide.1", "Decide.2", "9efb08a1.Todo.1"] };
  const answer: Readonly<{ result?: unknown }> = await $.tool.call({ tool: TOOL, items: [given] } as never);

  expect(answer.result).toBe(
    "Drew buttons for 1 Decide items under the final response and in the Decide pane: b2c3d4e5.Decide.1." +
      ` Ignored in b2c3d4e5.Decide.1's supersedes, as no Decide item's reference, <turn>.Decide.<n>: "Decide.2", "9efb08a1.Todo.1".`,
  );

  const bare: Readonly<{ result?: unknown }> = await $.tool.call({
    tool: TOOL,
    items: [{ ...RESTATED, supersedes: "9efb08a1.Decide.1" }],
  } as never);
  expect(bare.result).toBe(
    "Drew buttons for 1 Decide items under the final response and in the Decide pane: b2c3d4e5.Decide.1." +
      ` Ignored b2c3d4e5.Decide.1's supersedes, "9efb08a1.Decide.1", as no list, ["<turn>.Decide.<n>"];` +
      " so it replaces an earlier item on its subject, as with no supersedes.",
  );
});

test("an answer that only asks a question leaves its item open on Submit, until the reply restates it", async ($, on) => {
  const later: TranscriptRecord[] = [];
  const state = engine(on, () => ITEMS, listsText, () => later);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.input({ key: "9efb08a1.Decide.1.notes", text: "how would B work?" });

  // Waiting in the draft, the question leaves the item Open, not Queued.
  expect(await ui.find({ type: "Button", key: "queued" })).toBeUndefined();
  expect((await ui.find({ type: "Button", key: "open" }))?.text).toBe("▾ Open (3)");
  await ui.press({ key: "submit" });

  // Sent, and the item still open: a question picks nothing.
  expect(state.sent).toEqual([`${HEADER}9efb08a1.Decide.1: how would B work?\n`]);
  expect(await titles(ui)).toEqual([
    "🧠 Decide.1 · Which cache to keep",
    "🧠 Decide.2 · Cleanups to start",
    "🧠 Decide.3 · Ship tonight?",
  ]);
  expect(await ui.find({ type: "Button", key: "done" })).toBeUndefined();

  // The reply restates it, naming it in supersedes: now it's Done.
  later.push(submitted("b2c3d4e5", state.sent[0] ?? ""), replyRecord([RESTATED], listsText([RESTATED])));
  await $.turn.start({ text: state.sent[0] ?? "", turnId: "t2" });
  await $.turn.complete(replyDone("t2"));
  await openDone(ui);
  expect(await doneLines(ui)).toEqual(["🧠 Decide.1  Which cache to keep · Superseded by b2c3d4e5.Decide.1"]);
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
  // What the plugin kept before the raised items moved into the pane's
  // state, under the pane's earlier shape, as a reload finds it: the first
  // read finds it, and the plugin's writes since, of the settings it reads,
  // land over it.
  const stale = {
    shape: "pane-2",
    value: {
      presses: 0,
      submit: { tag: "idle" },
      overtaken: [],
      raised: { session: "session-1", items: ITEMS, settledRefs: [], seenRefs: [], problem: "", warnings: [] },
    },
  };
  const reads = { pane: 0 };
  on("state.get", (_, e, next) => {
    if (e.key !== "pane") {
      return next(e);
    }
    reads.pane += 1;

    return reads.pane === 1 ? { value: { value: stale, version: 1 } } : next(e);
  });
  await $.command.run({ ...ANSWERS, command: "answers-config" });
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  expect(await titles(ui)).toEqual([]);
  expect(await ui.find({ type: "Text", text: "Nothing open" })).toBeDefined();
  await ui.unmount();
});

test("a pane stored under the shape from before the settings moved into it is not used", async ($, on) => {
  engine(on, () => ITEMS);
  // What the plugin kept under the pane-3 shape, while the settings were an
  // atom of their own: no settings field, and a refresh's read out with no
  // `on`, as a reload finds it. The store answers it whatever the plugin
  // writes since.
  const stale = {
    shape: "pane-3",
    value: {
      presses: 1,
      submit: { tag: "idle" },
      overtaken: [],
      aside: { said: "", presses: 0 },
      refresh: { asked: 2, shown: 1, reads: [{ refresh: 2, releases: [] }] },
      raised: { session: "session-1", items: ITEMS, settledRefs: [], seenRefs: [], problem: "", warnings: [] },
      sent: [],
      merged: [],
      counts: "",
    },
  };
  on("state.get", (_, e, next) =>
    e.key === "pane" ? { value: { value: stale, version: 1 } } : next(e),
  );
  await $.tool.call({ tool: TOOL, items: ITEMS } as never);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  // Read as absent, the stale value draws nothing: no items, and no
  // settings it never held.
  expect(await titles(ui)).toEqual([]);
  expect(await ui.find({ type: "Text", text: /^No open Decide items/ })).toBeDefined();
  await ui.unmount();
});

test("a pane stored under the shape from before each raised item held where it stands is not used", async ($, on) => {
  engine(on, () => ITEMS);
  // What the plugin kept under the pane-4 shape, while the raised items
  // were bare and their settled refs, settlements and the settings'
  // problems lists beside them: the first item settled, as a reload finds
  // it. The store answers it whatever the plugin writes since.
  const stale = {
    shape: "pane-4",
    value: {
      presses: 1,
      submit: { tag: "idle" },
      overtaken: [],
      aside: { said: "", presses: 0 },
      refresh: { asked: 1, shown: 1, reads: [] },
      raised: {
        session: "session-1",
        turns: [],
        items: ITEMS,
        settledRefs: [ITEMS[0]?.ref],
        settlements: [],
        seenRefs: [],
        problem: "",
        warnings: [],
      },
      sent: [],
      merged: [],
      counts: "",
      settings: { tag: "unread", asked: 0 },
    },
  };
  on("state.get", (_, e, next) =>
    e.key === "pane" ? { value: { value: stale, version: 1 } } : next(e),
  );
  await $.tool.call({ tool: TOOL, items: ITEMS } as never);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  // Read as absent, the stale value draws nothing: no items, open or Done.
  expect(await titles(ui)).toEqual([]);
  expect(await ui.find({ type: "Text", text: /^No open Decide items/ })).toBeDefined();
  await ui.unmount();
});

test("a pane stored under the shape from before a superseded item named what superseded it is not used", async ($, on) => {
  engine(on, () => ITEMS);
  // What the plugin kept under the pane-5 shape, while an item a later one
  // restated settled as `restated`, naming no item: the first item so
  // settled, as a reload finds it. The store answers it whatever the plugin
  // writes since.
  const [first, ...rest] = ITEMS;
  const stale = {
    shape: "pane-5",
    value: {
      presses: 1,
      submit: { tag: "idle" },
      overtaken: [],
      aside: { said: "", presses: 0 },
      refresh: { asked: 1, shown: 1, reads: [] },
      raised: {
        session: "session-1",
        turns: [],
        items: [
          { item: first, state: { tag: "settled", settlement: { how: "restated" } } },
          ...rest.map((item) => ({ item, state: { tag: "open" } })),
        ],
        seenRefs: [],
        problem: "",
        settingsProblems: [],
      },
      sent: [],
      merged: [],
      counts: "",
      settings: { tag: "unread", asked: 0 },
    },
  };
  on("state.get", (_, e, next) =>
    e.key === "pane" ? { value: { value: stale, version: 1 } } : next(e),
  );
  await $.tool.call({ tool: TOOL, items: ITEMS } as never);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  // Read as absent, the stale value draws nothing: no items, open or Done.
  expect(await titles(ui)).toEqual([]);
  expect(await ui.find({ type: "Button", key: "done" })).toBeUndefined();
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

// A user's file setting every mark to a character of its own, each one cell
// wide where the kind glyphs take two.
const OWN_MARKS = [
  "marks:",
  "  sent: S",
  "  chosen: C",
  "  note: N",
  "  settled-bar: '|'",
  "  collapsed: '+'",
  "  expanded: '-'",
  "  buttons:",
  "    dismiss: X",
  "    next: v",
  "    previous: '^'",
  "    submit: '>'",
  "    reassess: R",
  "    help: H",
  "    kanban: K",
  "",
].join("\n");

test("a user's marks draw every surface in their own glyphs, an option's lead padded to the widest of its item's", async ($, on) => {
  const later: TranscriptRecord[] = [];
  const state = engine(on, () => ITEMS, listsText, () => later);
  state.userFiles = { "config.yaml": OWN_MARKS };
  await $.turn.complete(replyDone("t1"));
  later.push(human("b2c3d4e5", "9efb08a1.Decide.1.A"), replyRecord([LATER], listsText([LATER])));
  await $.turn.complete(replyDone("t2"));
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  const line = await $.ui.mount({ ...ABOVE_PROMPT, surface: "terminal" });
  const button = async (
    drawing: { find: (q: { type: "Button"; key: string }) => Promise<{ text: string } | undefined> },
    key: string,
  ) => (await drawing.find({ type: "Button", key }))?.text;

  // Each button, atop the pane, in the keys panel and above the prompt.
  expect(await button(ui, "previous")).toBe("^ Previous");
  expect(await button(ui, "next")).toBe("v Next");
  expect(await button(ui, "keys")).toBe("H Keys");
  expect(await button(ui, "dismiss")).toBe("X Close");
  expect(await button(ui, "submit")).toBe("> Submit");
  expect(await button(ui, "reassess")).toBe("R Reassess");
  expect(await button(line, "kanban")).toBe("K Kanban");
  await ui.press({ key: "keys" });
  expect(await ui.find({ type: "Text", text: /^v Next: the next item/ })).toBeDefined();
  expect(await ui.find({ type: "Text", text: /^X Close: close the pane$/ })).toBeDefined();

  // The Done branch's header and a turn's, closed and open, and the bar
  // opening a Done line.
  expect(await button(ui, "done")).toBe("+ Done (1)");
  await ui.press({ key: "done" });
  expect(await button(ui, "done")).toBe("- Done (1)");
  expect(await button(ui, "done.9efb08a1")).toBe("- ── 9efb08a1 ₋₁ (1) ──");
  await ui.press({ key: "open.9efb08a1" });
  expect(await button(ui, "open.9efb08a1")).toBe("+ ── 9efb08a1 ₋₁ (2) ──");
  expect((await ui.find({ type: "Text", text: /^\|$/ }))?.props).toMatchObject({ color: "ide" });

  // The Done item's sent option and the option the draft picks, each lead
  // padded to the radio glyph's two cells, so its text stays put.
  await ui.press({ key: "9efb08a1.Decide.1.line" });
  expect(await leadOf(ui, "9efb08a1.Decide.1.A")).toBe("S  A. ");
  expect(await leadOf(ui, "9efb08a1.Decide.1.B")).toBe("🔘 B. ");
  await ui.press({ key: "9efb08a1.Decide.1.B" });
  expect(await leadOf(ui, "9efb08a1.Decide.1.B")).toBe("C  B. ");
  await ui.press({ key: "9efb08a1.Decide.1.B" });

  // The note: the notes field's label, and the count of picks above the prompt.
  expect((await ui.find({ type: "Input", key: "b2c3d4e5.Decide.1.notes" }))?.props).toMatchObject({ label: "N " });
  await ui.press({ key: "b2c3d4e5.Decide.1.A" });
  expect(await button(line, "picked")).toBe("N 1 picked");

  // Reassess's glyph turns to the chosen mark while the draft ends on its line.
  await ui.press({ key: "reassess" });
  expect(state.box.endsWith("reassess\n")).toBe(true);
  expect(await button(ui, "reassess")).toBe("C Reassess");
  await line.unmount();
  await ui.unmount();

  // Under a reply, the note opens ✏️ Add a note's place.
  const reply = await $.ui.mount(REPLY);
  expect(await button(reply, "9efb08a1.Decide.3.add-note")).toBe("N Add a note");
  await reply.unmount();
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
  expect(await ui.find({ type: "Button", key: "done" })).toBeUndefined();
  await ui.unmount();
});

test("a Submit the engine refuses puts back only its own answers: an earlier Submit's answer to the same item stays Done", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press({ key: "9efb08a1.Decide.1.A" });
  await ui.press({ key: "submit" });
  expect(state.sent).toHaveLength(1);

  // Before a turn starts, a second Submit answers the same item again, and
  // the engine refuses it.
  state.submitAnswer = { drop: "a hook refused it" };
  state.box = `${HEADER}9efb08a1.Decide.1.B\n`;
  await ui.press({ key: "submit" });
  await openDone(ui);

  expect(await doneLines(ui)).toEqual(["🧠 Decide.1  Which cache to keep · Sent: A"]);
  expect(await titles(ui)).toEqual([
    "🧠 Decide.2 · Cleanups to start",
    "🧠 Decide.3 · Ship tonight?",
  ]);
  await ui.unmount();
});

test("a Submit a reload overtook keeps to itself: its refusal leaves a later Submit's answers Done, and what the pane says of it outlasts the later Submit", async ($, on) => {
  const state = engine(on, () => ITEMS);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  const said = async () =>
    (await ui.findAll({ type: "Text", text: /^Not sent/ })).map((found) => found.text);
  const refusal = "Not sent, the draft put back in the prompt box: a hook refused it";

  // The first Submit waits on the engine as the plugin reloads.
  const first = gate();
  state.holdSubmit = first.wait;
  state.box = `${HEADER}9efb08a1.Decide.1.B\n`;
  const overtaken = ui.press({ key: "submit" });
  await first.reached;
  await $.session.start({ cwd: "/work", surface: "terminal", isInteractive: true });
  await $.command.run(ANSWERS);

  // A later Submit answers the same item and another, and waits too.
  const second = gate();
  state.holdSubmit = second.wait;
  state.box = `${HEADER}9efb08a1.Decide.1.A\n9efb08a1.Decide.2.B\n`;
  const later = ui.press({ key: "submit" });
  await second.reached;

  // The engine refuses the first Submit's draft.
  state.submitAnswer = { drop: "a hook refused it" };
  first.release();
  await overtaken;
  await openDone(ui);

  expect(await doneLines(ui)).toEqual([
    "🧠 Decide.1  Which cache to keep · Sent: A",
    "🧠 Decide.2  Cleanups to start · Sent: B",
  ]);
  expect(await said()).toEqual([refusal]);

  // The later Submit goes through, and what the pane says of the first stays.
  state.submitAnswer = undefined;
  second.release();
  await later;

  expect(state.sent).toEqual([`${HEADER}9efb08a1.Decide.1.A\n9efb08a1.Decide.2.B\n`]);
  expect(await said()).toEqual([refusal]);
  await ui.unmount();
});

test("a refresh whose transcript read answers after a later refresh's leaves what the later one found", async ($, on) => {
  const later: TranscriptRecord[] = [];
  const state = engine(on, () => ITEMS, listsText, () => later);
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

  // The first turn's end reads the transcript, and its read waits.
  const held = gate();
  state.holdRead = held.wait;
  const first = $.turn.complete(replyDone("t1"));
  await held.reached;

  // A later turn answers an item, and its end's read answers first.
  later.push(human("b2c3d4e5", "9efb08a1.Decide.1.A"), assistant("On it."));
  await $.turn.complete(replyDone("t2"));
  expect(await titles(ui)).toEqual([
    "🧠 Decide.2 · Cleanups to start",
    "🧠 Decide.3 · Ship tonight?",
  ]);

  // The first read answers last, with the transcript as it stood when it
  // began, before the later turn.
  later.length = 0;
  held.release();
  await first;

  expect(await titles(ui)).toEqual([
    "🧠 Decide.2 · Cleanups to start",
    "🧠 Decide.3 · Ship tonight?",
  ]);
  await ui.unmount();
});

// Item 1 with ➕ and ➖ lines under each option, so a bar's every row shows.
const WITH_LINES = {
  ...ITEMS[0],
  options: [
    { letter: "A", name: "Disk", pros: ["Survives restarts."], cons: ["Disk use."] },
    { letter: "B", name: "Memory", pros: ["Fast."], cons: ["Lost on restart."] },
  ],
} as const;

const OPTION_LINES = {
  A: ["9efb08a1.Decide.1.A", "9efb08a1.Decide.1.A-pro-0", "9efb08a1.Decide.1.A-con-0"],
  B: ["9efb08a1.Decide.1.B", "9efb08a1.Decide.1.B-pro-0", "9efb08a1.Decide.1.B-con-0"],
} as const;

test("a Done item answered with A has the settled bar beside A's lines alone, a cell clear of their marks, in the pane and under the reply", async ($, on) => {
  const later: TranscriptRecord[] = [];
  engine(on, () => [WITH_LINES, ITEMS[2]], listsText, () => later);
  await $.turn.complete(replyDone("t1"));
  later.push(human("b2c3d4e5", "9efb08a1.Decide.1.A"), assistant("On it."));
  await $.turn.complete(replyDone("t2"));
  const pane = await $.ui.mount({ ...PANE, surface: "terminal" });
  await openDone(pane);
  await pane.press({ key: "9efb08a1.Decide.1.line" });

  for (const ui of [pane, await $.ui.mount(REPLY)]) {
    const gutter = async (key: string) =>
      (await ui.find({ type: "Box", key: `${key}-gutter` }))?.props;
    // A's every line, its name, ➕ and ➖, lit in the settled colour, and
    // none hovering.
    for (const key of OPTION_LINES.A) {
      expect(await gutter(key)).toMatchObject({ backgroundColor: "ide" });
      expect(await gutter(key)).not.toHaveProperty("hover");
    }
    // B, which the answer didn't pick, unlit, and hovering neither.
    for (const key of OPTION_LINES.B) {
      expect(await gutter(key)).toBeDefined();
      expect(await gutter(key)).not.toHaveProperty("backgroundColor");
      expect(await gutter(key)).not.toHaveProperty("hover");
    }
    // The bar sits a column left of where it did, one blank cell between it
    // and the mark, and the option's text where it was: 1 + 1 + 1 cells of
    // the 3-cell indent.
    expect((await ui.find({ type: "Box", key: "9efb08a1.Decide.1.A-box" }))?.props).toMatchObject({
      marginLeft: 1,
    });
    expect(await gutter("9efb08a1.Decide.1.A")).toMatchObject({ width: 1, marginRight: 1 });
  }
  await pane.unmount();
});

test("a Done item settled with no letters has no bar beside any option, and no hover bar", async ($, on) => {
  const open: unknown[] = [WITH_LINES, ITEMS[2]];
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
  for (const key of [...OPTION_LINES.A, ...OPTION_LINES.B]) {
    expect(await gutter(key)).toBeDefined();
    expect(await gutter(key)).not.toHaveProperty("backgroundColor");
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

test("✏️ Add a note under a reply opens every level its item is under: its turn under Open, folded by a click", async ($, on) => {
  const open: unknown[] = [...ITEMS];
  engine(on, () => open);
  await $.tool.call({ tool: TOOL, items: ITEMS } as never);
  await $.turn.complete(replyDone("t0"));
  open.splice(0, 1);
  await $.turn.complete(replyDone("t1"));
  await $.command.run(ANSWERS);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  const reply = await $.ui.mount(REPLY);
  // The turn folded under Open, and under Done, its branch open.
  await ui.press({ key: "open.9efb08a1" });
  await ui.press({ key: "done" });
  await ui.press({ key: "done.9efb08a1" });
  expect(await ui.find({ type: "Input", key: "9efb08a1.Decide.3.notes" })).toBeUndefined();
  // A Done item has no notes, so no ✏️ Add a note under the reply.
  expect(await reply.find({ type: "Button", key: "9efb08a1.Decide.1.add-note" })).toBeUndefined();

  await reply.press({ key: "9efb08a1.Decide.3.add-note" });
  expect((await ui.find({ type: "Button", key: "open.9efb08a1" }))?.text).toBe("▾ ── 9efb08a1 ₀ (2) ──");
  expect((await ui.find({ type: "Input", key: "9efb08a1.Decide.3.notes" }))?.props).toMatchObject({
    autoFocus: true,
  });
  // The same turn under Done stays as it was: folded.
  expect((await ui.find({ type: "Button", key: "done.9efb08a1" }))?.text).toBe("▸ ── 9efb08a1 ₀ (1) ──");
  await reply.unmount();
  await ui.unmount();
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

test("the context tells an item that blocks other work to end on the line naming the items it frees", async ($, on) => {
  engine(on, () => []);
  on("prompt.context", (_, e) => ({ blocks: e.blocks }));
  const { blocks } = await $.prompt.context({ blocks: [] });
  const text = blocks.find((block) => block.name === "kanbanTurns")?.text ?? "";

  [
    "## What an item frees",
    "An item that blocks other work ends on a line naming, by reference, the items it frees",
    "Frees: 0f311c94.Decide.2, 0f311c94.Review.1",
    "- `frees`: the references the item's `Frees:` line names",
  ].forEach((phrase) => expect(text).toContain(phrase));
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

// The plugin's own skill, as Claude Code names a plugin's skill.
const PLUGIN_SKILL = `${PLUGIN}:coding-agent-kanban-turn-responses`;

/** The agent loading `skill` with the Skill tool, its use's id `id`, and the result it got, an error where `isError`. */
const skillLoad = (
  skill: string,
  isError: boolean = false,
  id: string = "toolu_skill",
): readonly TranscriptRecord[] => [
  {
    isSidechain: false,
    type: "assistant",
    message: {
      role: "assistant",
      content: [{ type: "tool_use", id, name: "Skill", input: { skill } }],
    },
  },
  {
    isSidechain: false,
    type: "user",
    message: {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: id,
          content: isError ? "<tool_use_error>Unknown skill</tool_use_error>" : `Launching skill: ${skill}`,
          ...(isError ? { is_error: true } : {}),
        },
      ],
    },
  },
];

/** The command record a user's slash command for `skill` leaves. */
const skillCommandRecord = (skill: string): TranscriptRecord => ({
  isSidechain: false,
  type: "user",
  message: {
    role: "user",
    content: `<command-message>${skill}</command-message>\n<command-name>/${skill}</command-name>\n<command-args></command-args>`,
  },
});

test("where the transcript shows the agent loaded the plugin's skill, the hooks add no instructions", async ($, on) => {
  const state = engine(on, () => [], listsText, () => skillLoad(PLUGIN_SKILL));
  on("prompt.context", (_, e) => ({ blocks: e.blocks }));

  const { blocks } = await $.prompt.context({ blocks: [] });
  expect(blocks.map((block) => block.name)).toEqual([]);

  await $.prompt.submit(GO);
  expect(state.contexts).toEqual([[]]);
});

test("where the transcript shows the user's slash command for the plugin's skill, the prompts' context gets no instructions", async ($, on) => {
  const state = engine(on, () => [], listsText, () => [skillCommandRecord(PLUGIN_SKILL)]);

  await $.prompt.submit(GO);
  expect(state.contexts).toEqual([[]]);
});

test("where the agent's load of the plugin's skill failed, or loaded another skill, the hooks still add the instructions", async ($, on) => {
  const failed = engine(on, () => [], listsText, () => [
    ...skillLoad(PLUGIN_SKILL, true, "toolu_failed"),
    ...skillLoad("coding-agent-kanban-turn-responses", false, "toolu_bare"),
  ]);

  await $.prompt.submit(GO);
  expect(failed.contexts).toHaveLength(1);
  expect(failed.contexts[0]?.[0]).toContain(`\`${TOOL}\``);
});
