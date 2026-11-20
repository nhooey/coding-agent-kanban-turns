// Clickable answers to the kanban turn responses' Decide items: a pane that
// lists every item raised in the session, oldest first, newest at the
// bottom, each in its own box, and the same boxes under the reply that
// raised them. The pane opens by itself, without the keyboard, at session
// start when items are open and when a reply raises a new one; 🖥️ Kanban
// and the skill's count line above the prompt, and /answers, open it with
// the keyboard. A click writes the item's reference, on a line of its own,
// into the prompt draft and never sends it; only the pane's Submit, which
// sends the draft, and its Reassess, the skill's `reassess` command, send a
// prompt. A settled item stays, dimmed, its buttons dead.
//
// An item is drawn as the skill writes it: its summary, its note, then each
// option as `glyph letter. name: consequence` with its ➕ and ➖ lines indented
// under it, inside a rounded border. The option the draft picks is marked
// ✅ and underlined; a bar in the column left of an option lights under the
// pointer, and stays lit in another colour once the item is settled.

import { atom, read, update } from "claude-code";
import type { EngineInterface, Register, RenderNode } from "claude-code";

import {
  choose,
  draftHeader,
  hasReassess,
  headed,
  lettersFor,
  noteFor,
  reassessKept,
  toggledReassess,
  withNote,
} from "../src/answers.ts";
import {
  INPUT_SCHEMA,
  TOOL,
  TOOL_CALLED,
  TOOL_DESCRIPTION,
  withInstructions,
} from "../src/instructions.ts";
import { CHOSEN_MARK, itemsOf, markOf, refOf } from "../src/items.ts";
import { INDENT, codeSpans } from "../src/layout.ts";
import { itemOfLink, linkedItems, linkedQuestions } from "../src/links.ts";
import {
  countLine,
  mergedOfResponse,
  mergedQuery,
  openOf,
  pullRequestsToAsk,
} from "../src/outstanding.ts";
import {
  emptyRaised,
  firstUnanswered,
  forSession,
  isSettled,
  problemsOf,
  refreshed,
  seen,
  settlementOf,
  unread,
  unseen,
  withItems,
} from "../src/raised.ts";
import {
  NOT_DECODED,
  chunkOffsets,
  decodedText,
  transcriptPathFor,
  turnsOfText,
  withRange,
} from "../src/transcript.ts";
import type { Turn } from "../src/transcript.ts";
import {
  answersText,
  configText,
  drewText,
  gutterStyle,
  isPlainToolRow,
  itemTitle,
  noItemsText,
  NOT_EMPTIED_TEXT,
  noteRows,
  notesKey,
  notesMode,
  notPutBackText,
  notSentText,
  putBackText,
  sentLetters,
  settledText,
  submitStep,
} from "../src/view.ts";
import type { NotesMode } from "../src/view.ts";
import type {
  DecideItem,
  Loaded,
  Raised,
  Settings,
} from "../types/index.d.ts";
import { loadSettings } from "./settings.ts";

// The pane that lists the items, and its title. The hotkey and colours are
// settings, in defaults/config.jsonc.
const PANE = { id: "kanban-turns", title: "🧠 Decide" } as const;
// The column left of an option's lines that lights while the pointer is over
// the option, or stays lit once its item is settled: it comes out of the
// option's indent, so its text stays put.
const GUTTER = 1;
// The most bytes one `$.fs.read` returns: the transcript is read in ranges
// this long.
const READ_BYTES = 4 * 1024 * 1024;
// Nothing read yet: no settings until session.start reads the files.
const UNREAD: Loaded = { settings: null, effective: [], problems: [] };

// Change the tag when Raised's fields change: it declines what an earlier
// version stored, which outlives a reload.
const raised = atom(
  { plugin: "coding-agent-kanban-turns", key: "raised" } as const,
  emptyRaised,
  { shape: "raised-3" },
);
// How many refreshes have started: a `gh` answer redraws the count line only
// while the refresh that asked is the latest.
const refreshes = atom(
  { plugin: "coding-agent-kanban-turns", key: "refreshes" } as const,
  0,
);
// The pull requests `gh` said merged, as `owner/repo#N`: a merge stays, so
// none is asked about again.
const merged = atom(
  { plugin: "coding-agent-kanban-turns", key: "merged" } as const,
  [] as readonly string[],
);
const draft = atom(
  { plugin: "coding-agent-kanban-turns", key: "draft" } as const,
  "",
);
// The item whose ✏️ Add a note under a reply opened the pane: its notes
// field takes the focus as the pane opens. Empty for any other opening,
// and again once the field has the focus or the pane closes.
const noting = atom(
  { plugin: "coding-agent-kanban-turns", key: "noting" } as const,
  "",
);
// How many Submit presses there have been: each press's stamp.
const submits = atom(
  { plugin: "coding-agent-kanban-turns", key: "submits" } as const,
  0,
);
// The stamp of the Submit under way, 0 when none is: a second press while
// one is under way does nothing.
const submitting = atom(
  { plugin: "coding-agent-kanban-turns", key: "submitting" } as const,
  0,
);
// The id of the main loop's running turn, from its turn.start to its own
// turn.complete, empty while none runs: Submit waits it out. Only the end
// of the turn it names clears it, so a late end of an earlier turn doesn't.
const runningTurn = atom(
  { plugin: "coding-agent-kanban-turns", key: "runningTurn" } as const,
  "",
);
// Why the last Submit sent nothing, for the pane to say; empty when it
// sent, once a turn starts, or as the session starts.
const submitProblem = atom(
  { plugin: "coding-agent-kanban-turns", key: "submitProblem" } as const,
  "",
);
// The skill's count line, `📌 Outstanding: 🚧 2 · … · 🧠 3`, from the last
// refresh; empty when nothing is open.
const counts = atom(
  { plugin: "coding-agent-kanban-turns", key: "counts" } as const,
  "",
);
// Change the tag when Settings' fields change, as for Raised.
const settings = atom(
  { plugin: "coding-agent-kanban-turns", key: "settings" } as const,
  UNREAD,
  { shape: "settings-3" },
);

/** The settings in effect, or none while the defaults file can't be used. */
const settingsNow = async ($: EngineInterface): Promise<Settings | null> =>
  (await read($, settings)).settings;

/** This session's transcript file: where the engine says it is, else, when it can't say, where Claude Code keeps it. */
const transcriptPath = async ($: EngineInterface): Promise<string> => {
  const given = await $.session.info().then(
    (info) => info.transcriptPath,
    () => undefined,
  );

  return typeof given === "string" && given !== ""
    ? given
    : transcriptPathFor(
        (await $.env.get("HOME")) ?? "",
        await $.session.cwd(),
        await $.session.id(),
      );
};

/**
 * This session's turns, read from its whole transcript file in ranges the
 * engine's reads allow, one after another, each decoded as it comes.
 */
const turnsNow = async ($: EngineInterface): Promise<readonly Turn[]> => {
  const path = await transcriptPath($);
  const { size } = await $.fs.stat(path);
  const decoded = await chunkOffsets(size, READ_BYTES).reduce(
    async (before, offset) => {
      const sofar = await before;
      const range = await $.fs.read(path, {
        as: "bytes",
        offset,
        length: READ_BYTES,
      });

      return withRange(sofar, range.base64);
    },
    Promise.resolve(NOT_DECODED),
  );

  return turnsOfText(decodedText(decoded));
};

/**
 * The pull requests among `refs` that GitHub says merged, asked of `gh` in
 * one call; none when there's nothing to ask, or `gh` is missing, fails or
 * outlasts `timeoutMs`. A GraphQL error exits non-zero yet still answers for
 * the other pull requests, so the output is read whatever the exit code.
 */
const mergedNow = async (
  $: EngineInterface,
  refs: readonly string[],
  timeoutMs: number,
): Promise<ReadonlySet<string>> => {
  const { ordered, argv } = mergedQuery(refs);
  const stdout =
    ordered.length === 0
      ? ""
      : await $.process.run(argv, { timeoutMs }).then(
          (done) => done.stdout,
          () => "",
        );

  return mergedOfResponse(ordered, stdout);
};

/** Reads the settings files again, so an edit to either is taken up at the next refresh. */
const reloadSettings = async ($: EngineInterface): Promise<Loaded> => {
  const now = await loadSettings($).catch(
    (error: unknown): Loaded => ({ ...UNREAD, problems: [String(error)] }),
  );
  await update($, settings, () => now);

  return now;
};

/** Sets the count line and the raised items from what `turns` leave open, given the pull requests known merged. */
const settle = async (
  $: EngineInterface,
  turns: readonly Turn[],
  window: number,
  warnings: readonly string[],
): Promise<void> => {
  const open = openOf(turns, window, new Set(await read($, merged)));
  await update($, counts, () => open.counts);
  await update($, raised, (r) => refreshed(r, open.items, open.settlements, warnings));
};

/**
 * Asks `gh` which of the Review items' pull requests not yet known merged
 * have merged since, the pane and the count line drawn without waiting for
 * it. A merge joins the known ones, and redraws the count line from the
 * refresh's turns while no later refresh has started; one that has reads
 * the merge itself. The raised items don't hang on merges, so they stay.
 */
const askMerged = async (
  $: EngineInterface,
  stamp: number,
  turns: readonly Turn[],
  window: Settings["counts"],
): Promise<void> => {
  const known = new Set(await read($, merged));
  const found = await mergedNow(
    $,
    pullRequestsToAsk(turns, window.turns, known),
    window["gh-timeout-ms"],
  );

  if (found.size > 0) {
    const now = await update($, merged, (m) =>
      [...new Set([...m, ...found])].sort(),
    );

    if ((await read($, refreshes)) === stamp) {
      await update($, counts, () =>
        countLine(turns, window.turns, new Set(now)),
      );
    }
  }
};

/**
 * Reads the settings, the open items and the count line again: open items
 * join the raised ones, and raised ones no longer open settle. A transcript
 * that can't be read, or settings that can't be used, settle nothing.
 */
const refresh = async ($: EngineInterface): Promise<void> => {
  const stamp = await update($, refreshes, (n) => n + 1);
  const { settings: s, problems } = await reloadSettings($);
  // Without settings there's no window to read: the settings' problems say why.
  const found: Readonly<{ turns: readonly Turn[] } | { problem: string }> =
    s === null
      ? { problem: "" }
      : await turnsNow($).then(
          (turns) => ({ turns }),
          (error: unknown) => ({ problem: String(error) }),
        );

  if (s === null || "problem" in found) {
    const problem = "problem" in found ? found.problem : "";
    await update($, raised, (r) => unread(r, problem, problems));

    return;
  }
  await settle($, found.turns, s.counts.turns, problems);
  void askMerged($, stamp, found.turns, s.counts).catch(() => undefined);
};

/**
 * Rewrites the prompt draft with `edit`: the one way a click, a note or
 * Reassess reaches the draft. A draft a click starts opens with a line
 * naming the plugin, which stays first, once, until nothing is left.
 */
const rewriteDraft = async (
  $: EngineInterface,
  edit: (text: string) => string,
): Promise<void> => {
  const box = await $.prompt.read();
  // The engine names the plugin, not its marketplace: the header is the name.
  const text = headed(box.text, draftHeader($.plugin.name), edit);
  await $.prompt.fill({ text, mode: "replace" });
  await update($, draft, () => text);
};

/** Writes the draft with the item's answer for `letter`, a `reassess` line kept last. */
const answer = ($: EngineInterface, item: DecideItem, letter: string) =>
  rewriteDraft($, (text) =>
    reassessKept(text, (body) => choose(body, item, letter)),
  );

/** Writes the item's note into the draft, on a line of its own, a `reassess` line kept last. */
const note = ($: EngineInterface, item: DecideItem, said: string) =>
  rewriteDraft($, (text) =>
    reassessKept(text, (body) => withNote(body, item, said)),
  );

/** Adds a `reassess` line at the draft's end, or takes the one there out. */
const toggleReassess = ($: EngineInterface) =>
  rewriteDraft($, toggledReassess);

/** Why the engine didn't take a prompt it was sent, or undefined once it entered. */
const refusalOf = ($: EngineInterface, text: string): Promise<string | undefined> =>
  $.prompt.submit({ text, asUser: true }).then(
    (done) => done.drop,
    (error: unknown) => String(error),
  );

/**
 * Puts a draft the engine refused back in the box Submit emptied, after
 * whatever the person typed there meanwhile, and says why it wasn't sent.
 * A box that can't take it back leaves the draft in what the pane says.
 */
const putBack = async (
  $: EngineInterface,
  text: string,
  refusal: string,
): Promise<void> => {
  const box = (await $.prompt.read().catch(() => ({ text: "" }))).text;
  const added = putBackText(box, text);
  const put = await $.prompt
    .fill({ text: added, mode: "append" })
    .catch(() => ({ isFilled: false }));

  if (put.isFilled) {
    await update($, draft, () => `${box}${added}`);
  }
  await update($, submitProblem, () =>
    put.isFilled
      ? notSentText(refusal, box !== "")
      : notPutBackText(refusal, text),
  );
};

/**
 * Sends `text`, the box emptied first, as the person's own words. A box that
 * can't be emptied sends nothing and leaves the draft as it was; a prompt
 * the engine refuses goes back in the box. Either way the pane says why.
 */
const sendDraft = async ($: EngineInterface, text: string): Promise<void> => {
  const emptied = await $.prompt.fill({ text: "", mode: "replace" });

  if (!emptied.isFilled) {
    await update($, submitProblem, () => NOT_EMPTIED_TEXT);

    return;
  }
  await update($, draft, () => "");
  const refusal = await refusalOf($, text);

  if (refusal !== undefined) {
    await putBack($, text, refusal);

    return;
  }
  await update($, submitProblem, () => "");
};

/**
 * The pane's Submit: sends the prompt box's text as the person's own. One
 * press at a time: a press while another is under way, or while a turn
 * runs, does nothing, as does a box of blanks or of the line naming the
 * plugin alone; a draft with a file mention, pasted text or an image stays
 * in the box, the pane saying why.
 */
const submitDraft = async ($: EngineInterface): Promise<void> => {
  const stamp = await update($, submits, (n) => n + 1);
  const holder = await update($, submitting, (held) =>
    held === 0 ? stamp : held,
  );

  if (holder !== stamp) {
    return;
  }

  try {
    const step = submitStep(
      (await $.prompt.read()).text,
      (await read($, runningTurn)) !== "",
    );

    if ("refuse" in step) {
      await update($, submitProblem, () => step.refuse);
    } else if ("send" in step) {
      await sendDraft($, step.send);
    }
  } finally {
    await update($, submitting, (held) => (held === stamp ? 0 : held));
  }
};

/**
 * Opens the pane: with the keyboard in it when the person asked for it, else
 * beside the prompt, which keeps the keys. `notes` names the item whose notes
 * field takes the focus, when its ✏️ Add a note opened the pane.
 */
const openPane = async ($: EngineInterface, isAsked: boolean, notes = "") => {
  await update($, noting, () => notes);

  return $.ui.open({ ...PANE, ...(isAsked ? { focus: true as const } : {}) });
};

/** Scrolls the pane to `to`, an element by its key or its end, landing at `block`; a pane not drawn yet stays as it is. */
const reveal = async (
  $: EngineInterface,
  to: { key: string } | "end",
  block: "start" | "end" = "start",
): Promise<void> => {
  await $.ui.scroll({ in: PANE.id, to, block }).catch(() => undefined);
};

/**
 * ✏️ Add a note under a reply: the pane, with the keyboard, its item's
 * notes field in sight, the item above it, and the ring on the field.
 * The field also takes the focus as the pane draws it, until the ring is
 * on it: a pane already open with the ring elsewhere moves it there.
 */
const openNotes = async ($: EngineInterface, item: DecideItem): Promise<void> => {
  await openPane($, true, refOf(item));
  await reveal($, { key: notesKey(item) }, "end");
  const moved = await $.ui
    .focus({ requestId: PANE.id, key: notesKey(item) })
    .catch((error: unknown) => ({ deny: String(error) }));

  if (moved.deny === undefined) {
    await update($, noting, () => "");
  }
};

/** Closes the pane; its notes field no longer waits for the focus. */
const closePane = async ($: EngineInterface): Promise<void> => {
  await update($, noting, () => "");
  await $.ui.close({ id: PANE.id });
};

/** The end of a main-loop turn, or the session's start: opens the pane at its end when an item is open that the pane hasn't been opened over. */
const announce = async ($: EngineInterface): Promise<void> => {
  const r = await read($, raised);
  await update($, raised, seen);

  if (unseen(r).length > 0) {
    await openPane($, false);
    await reveal($, "end");
  }
};

/** /answers: re-reads the open items and opens the pane with the keyboard, at the first item the draft doesn't answer. */
const reopen = async ($: EngineInterface): Promise<Raised> => {
  await refresh($);
  await update($, raised, seen);
  await openPane($, true);
  const r = await read($, raised);
  const item = firstUnanswered(r, await read($, draft));

  if (item !== undefined) {
    await reveal($, { key: refOf(item) });
  }

  return r;
};

/** A question's link pressed: the pane, with the keyboard, scrolled to its item. */
const showItem = async ($: EngineInterface, href: string): Promise<void> => {
  const r = await read($, raised);
  const item = r.items[itemOfLink(r.items, href)];
  await openPane($, true);

  if (item !== undefined) {
    await reveal($, { key: refOf(item) });
  }
};

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    // No turn runs as the session starts, no Submit is under way and none
    // has a problem to say, though a reload mid-turn or mid-Submit may have
    // left them set. Cleared before the hook awaits anything else, so a
    // turn.start or a Submit that lands while it registers stays.
    await update($, runningTurn, () => "");
    await update($, submitting, () => 0);
    await update($, submitProblem, () => "");
    const started = await next(e);
    await $.command.register({
      name: "answers",
      description:
        "Open the kanban Decide pane, at the first unanswered item",
    });
    await $.command.register({
      name: "answers-config",
      description:
        "List the kanban turns plugin's settings in effect, and the file each came from",
    });
    await $.tool.register({
      name: TOOL,
      description: TOOL_DESCRIPTION,
      isDeferred: false,
      inputSchema: INPUT_SCHEMA,
    });
    const session = await $.session.id();
    await update($, raised, (r) => forSession(r, session));
    void refresh($)
      .then(() => announce($))
      .catch(() => undefined);

    return started;
  });

  // The plugin tells the agent about its tool itself: the instructions go in the
  // conversation's context, after whatever the engine and other hooks put there.
  on("prompt.context", async ($, e, next) => withInstructions(await next(e)));

  on("command.run", { command: "answers-config" }, async ($) => {
    const { effective, problems } = await reloadSettings($);

    return { text: configText(effective, problems) };
  });

  on("command.run", { command: "answers" }, async ($) => ({
    text: answersText(await reopen($)),
  }));

  on("tool.call", { tool: TOOL_CALLED }, async ($, e) => {
    const items = itemsOf(e);
    await update($, raised, (r) => withItems(r, items));

    return { result: drewText(items) };
  }).catch(() => ({
    result: "The buttons could not be drawn; the reply reads as before.",
  }));

  // A main-loop turn starting: Submit waits it out, and what the last
  // Submit said no longer applies.
  on("turn.start", async ($, e, next) => {
    const started = await next(e);

    if (e.agentId === undefined) {
      await update($, runningTurn, () => e.turnId);
      await update($, submitProblem, () => "");
    }

    return started;
  });

  // A main-loop turn ending: it clears the running turn only where that is
  // this turn, so an earlier turn's late end leaves a later one running.
  on("turn.complete", async ($, e, next) => {
    const done = await next(e);

    if (e.agentId === undefined) {
      await update($, runningTurn, (held) => (held === e.turnId ? "" : held));
      await refresh($);
      await announce($);
    }

    return done;
  });

  // The person closing the pane: its notes field no longer waits for the
  // focus. The plugin's own close, ✖, clears it itself.
  on("ui.close", async ($, e, next) => {
    const closed = await next(e);

    if (e.id === PANE.id) {
      await update($, noting, () => "");
    }

    return closed;
  });

  on("prompt.change", async ($, e, next) => {
    const changed = await next(e);
    await update($, draft, () => e.text);

    return changed;
  });

  // Above the prompt: 🖥️ Kanban, then a faint ` · ` and the skill's count
  // line, both opening the pane with the keyboard; 🖥️ Kanban alone when
  // nothing is open. Claude Code stacks each plugin's drawing here itself,
  // so another plugin's band, such as the usage mod's agents tree, is drawn
  // beside this one.
  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const s = await settingsNow($);
    const line = await read($, counts);

    if (e.props.hasSurvey || s === null) {
      return next(e);
    }

    const { Box, Button, Text } = $.ui.resolve(e);
    const open = () => openPane($, true);

    return (
      <Box>
        <Button key="kanban" label="Open the Decide pane" plain onPress={open}>
          🖥️ <Text color={s.colors.kanban}>Kanban</Text>
        </Button>
        {line === "" ? null : (
          <Text key="divider" dimColor>
            {" · "}
          </Text>
        )}
        {line === "" ? null : (
          <Button key="counts" label={line} plain dimColor onPress={open}>
            {line}
          </Button>
        )}
      </Box>
    );
  });

  // A reply's Decide questions: each raised item's summary line becomes a
  // link that opens the pane at that item, and the items the reply names are
  // drawn under it, each in its box.
  on("ui.render", { component: "AssistantMessage" }, async ($, e, next) => {
    const r = await read($, raised);
    const linked = linkedQuestions(e.props.text, r.items);

    if (linked.hrefs.length === 0) {
      return next(e);
    }

    const s = await settingsNow($);
    const elements = $.ui.resolve(e);
    const { Box, Markdown } = elements;

    return (
      <Box flexDirection="column">
        <Markdown
          key="kanban-questions"
          text={linked.text}
          pressableLinks={linked.hrefs}
          onLinkPress={(link) => showItem($, link.href)}
        />
        {s === null
          ? null
          : itemBoxes($, elements, s, r, linkedItems(r.items, linked.hrefs), {
              text: await read($, draft),
              isPane: false,
              noting: "",
            })}
      </Box>
    );
  });

  // The pane: Reassess, Submit and ✖ on top, then every raised item, oldest
  // first.
  on("ui.render", { component: "Pane", requestId: PANE.id }, async ($, e) => {
    const r = await read($, raised);
    const elements = $.ui.resolve(e);
    const { Box, Button, Text } = elements;
    const s = await settingsNow($);

    if (r.items.length === 0 || s === null) {
      return <Text dimColor>{noItemsText(problemsOf(r))}</Text>;
    }

    const text = await read($, draft);
    const isBusy =
      (await read($, runningTurn)) !== "" || (await read($, submitting)) !== 0;
    const problem = await read($, submitProblem);

    return (
      <Box flexDirection="column">
        <Box marginBottom={1} columnGap={2}>
          {/* A toggle: it adds `reassess` as the draft's last line, for
              Submit to send after any answers, or alone, and takes it out
              again; it shows as chosen while the line is there. */}
          <Button
            key="reassess"
            label="Reassess"
            plain
            dimColor={!hasReassess(text)}
            onPress={() => toggleReassess($)}
          >
            {hasReassess(text) ? CHOSEN_MARK : "🔄"}{" "}
            <Text underline>Reassess</Text>
          </Button>
          <Button
            key="submit"
            label="Submit"
            plain
            dimColor={"skip" in submitStep(text, isBusy)}
            onPress={() => submitDraft($)}
          >
            📤 <Text underline>Submit</Text>
          </Button>
          <Button
            key="dismiss"
            label="Close the pane"
            plain
            role="dismiss"
            hotkey={s.keys.dismiss}
            onPress={() => closePane($)}
          >
            <Text
              weight="bold"
              color={s.colors["close-x"]}
              backgroundColor={s.colors.close}
            >
              {" ✖ "}
            </Text>
          </Button>
        </Box>
        {problem ? (
          <Text key="submit-problem" wrap="wrap">
            {problem}
          </Text>
        ) : null}
        {problemsOf(r) ? <Text dimColor>{problemsOf(r)}</Text> : null}
        {itemBoxes($, elements, s, r, r.items, {
          text,
          isPane: true,
          noting: await read($, noting),
        })}
      </Box>
    );
  });

  // Where the engine draws the result apart from the call's row, such as the
  // view after a compaction, the result line repeats the call: keep it for
  // ctrl+o and for an error only.
  on("ui.render", { component: "ToolResult" }, async ($, e, next) => {
    if (
      e.props.tool !== TOOL_CALLED ||
      !isPlainToolRow({
        // Absent where the surface doesn't say: drawn compact.
        isExpanded: e.props.isExpanded === true,
        isErrored: e.props.isErrored,
      })
    ) {
      return next(e);
    }
    const { Box } = $.ui.resolve(e);

    return <Box />;
  });

  // The call's row comes before the reply, and its items are drawn under the
  // reply instead, so the row draws nothing. Keep the engine's row only where
  // it says more: ctrl+o, an error, an interrupted call, or a call that drew
  // no items.
  on("ui.render", { component: "ToolUse" }, async ($, e, next) => {
    if (
      e.props.tool !== TOOL_CALLED ||
      !isPlainToolRow({
        // Absent where the surface doesn't say: drawn compact.
        isExpanded: e.props.isExpanded === true,
        isErrored: e.props.isErrored,
        isInterrupted: e.props.isInterrupted,
        itemCount: itemsOf(e.props.input).length,
      })
    ) {
      return next(e);
    }
    const { Box } = $.ui.resolve(e);

    return <Box />;
  });
};

/** The elements an item is drawn with, from the surface's table. */
type Elements = Pick<
  ReturnType<EngineInterface["ui"]["resolve"]>,
  "Box" | "Button" | "Text" | "Input"
>;

/**
 * Each item in its own rounded box, keyed by its ref, a settled one dimmed
 * with its buttons dead: the pane's drawing and a reply's alike, but for
 * the notes. In the pane an open item has its notes field, `noting`'s
 * taking the focus; under a reply, which can't take the keyboard, a ✏️ Add
 * a note button opens the pane at that field.
 */
const itemBoxes = (
  $: EngineInterface,
  elements: Elements,
  s: Settings,
  r: Raised,
  items: readonly DecideItem[],
  at: Readonly<{ text: string; isPane: boolean; noting: string }>,
) => {
  const { Box } = elements;

  return (
    <Box key="kanban-items" flexDirection="column">
      {items.map((item) => {
        const isDone = isSettled(r, item);
        const settlement = isDone ? settlementOf(r, item) : undefined;

        return (
          <Box
            key={refOf(item)}
            flexDirection="column"
            borderStyle="round"
            borderColor={s.colors.border}
            borderDimColor={isDone}
            paddingX={1}
          >
            {itemView(elements, s, item, {
              title: itemTitle(item, isDone),
              chosen: isDone ? [] : lettersFor(at.text, item),
              sent: sentLetters(settlement),
              settled: isDone ? settledText(settlement) : "",
              note: isDone ? "" : noteFor(at.text, item),
              isSettled: isDone,
              notes: notesMode({
                isSettled: isDone,
                isPane: at.isPane,
                isNoting: at.noting === refOf(item),
              }),
              keyOf: (letter) => `${refOf(item)}.${letter}`,
              onPick: (letter) =>
                isDone ? undefined : answer($, item, letter),
              onNote: (said) => (isDone ? undefined : note($, item, said)),
              onOpenNotes: () => openNotes($, item),
            })}
          </Box>
        );
      })}
    </Box>
  );
};

/**
 * One Decide item as the skill writes it: the title, the note, and each
 * option a plain button reading `glyph letter. name: consequence`, its ➕ and
 * ➖ lines indented under it, always in full.
 */
const itemView = (
  elements: Elements,
  s: Settings,
  item: DecideItem,
  view: {
    title: Readonly<{ label: string; summary: string }>;
    chosen: readonly string[];
    /** The letters the answer that settled the item picked. */
    sent: readonly string[];
    /** What settled the item, the line under its title; empty while open. */
    settled: string;
    note: string;
    isSettled?: boolean;
    /** The notes: none, the field, the field taking the focus, or a button that opens the pane at it. */
    notes: NotesMode;
    keyOf: (letter: string) => string;
    onPick: (letter: string) => unknown;
    onNote: (note: string) => unknown;
    onOpenNotes: () => unknown;
  },
) => {
  const { Box, Button, Input, Text } = elements;
  const { colors } = s;
  const dim = view.isSettled === true;
  const inline = (
    line: string,
    key: string,
    props: Record<string, unknown> = {},
  ) =>
    codeSpans(line).map((part, n) => (
      <Text
        key={`${key}-${n}`}
        {...props}
        {...(part.isCode ? { color: colors.code } : {})}
      >
        {part.text}
      </Text>
    ));
  const lines = (
    prefix: string,
    texts: readonly string[] | undefined,
    background: string | undefined,
    key: string,
  ) =>
    (texts ?? []).map((line, n) => (
      <Box key={`${key}-${n}`} marginLeft={INDENT}>
        <Text
          dimColor={dim}
          {...(background ? { backgroundColor: background } : {})}
          wrap="wrap"
        >
          {prefix ? `${prefix} ` : ""}
          {inline(line, `${key}-${n}`)}
        </Text>
      </Box>
    ));

  return (
    <Box flexDirection="column">
      {/* The label bold on its background, the summary plain after it on
          the same line; a settled item's label is dimmed with the rest,
          with no background. */}
      <Text dimColor={dim} wrap="wrap">
        <Text
          key="title-label"
          {...(dim
            ? {}
            : {
                weight: "bold" as const,
                color: colors["title-label"],
                backgroundColor: colors["title-background"],
              })}
        >
          {view.title.label}
        </Text>
        <Text key="title-gap"> </Text>
        {inline(view.title.summary, "title")}
      </Text>
      {view.settled ? (
        <Box key="settled-by" marginLeft={INDENT}>
          <Text dimColor wrap="wrap">
            {view.settled}
          </Text>
        </Box>
      ) : null}
      {lines("", item.note, undefined, "note")}
      {item.options.map((option) => {
        const isChosen = view.chosen.includes(option.letter);
        // An option the answer that settled the item picked: its own mark,
        // at full strength in the dimmed item, never underlined.
        const isSent = view.sent.includes(option.letter);
        // A chosen option's line is underlined, its glyph turned to ✅;
        // nothing of it, and none of its ➕ and ➖ lines, is highlighted.
        const pick = isChosen ? { underline: true } : {};
        const key = view.keyOf(option.letter);
        // A Button holds only text, so each of the option's lines is a button
        // of its own that picks it. They share a hover group, so the pointer
        // on any of them lights the gutter beside every one: a bar the
        // option's height. A settled option's gutter stays lit in the
        // settled colour instead, and never hovers.
        const gutter = gutterStyle(dim, key, colors);
        const press = {
          plain: true,
          dimColor: dim && !isSent,
          hover: { scope: key },
          onPress: () => view.onPick(option.letter),
        } as const;
        // One line of the option: the gutter cell, then the line, which wraps
        // beside it; the gutter's Box stretches to the line's rows.
        const row = (rowKey: string, content: RenderNode) => (
          <Box key={`${rowKey}-row`}>
            <Box
              key={`${rowKey}-gutter`}
              width={GUTTER}
              flexShrink={0}
              {...gutter}
            >
              <Text {...gutter}> </Text>
            </Box>
            {content}
          </Box>
        );
        const under = (
          prefix: string,
          texts: readonly string[] | undefined,
          part: string,
        ) =>
          (texts ?? []).map((line, n) =>
            row(
              `${key}-${part}-${n}`,
              <Box key={`${key}-${part}-${n}-box`} marginLeft={INDENT}>
                <Button key={`${key}-${part}-${n}`} label={line} {...press}>
                  <Text>{prefix ? `${prefix} ` : ""}</Text>
                  {inline(line, `${key}-${part}-${n}`)}
                </Button>
              </Box>,
            ),
          );

        return (
          <Box
            key={`${key}-box`}
            flexDirection="column"
            marginLeft={INDENT - GUTTER}
          >
            {row(
              key,
              <Button key={key} label={option.name} {...press}>
                <Text>
                  {isSent ? s.marks.sent : markOf(item, option.letter, isChosen)}{" "}
                  {option.letter}.{" "}
                </Text>
                {inline(option.name, `${option.letter}-name`, {
                  ...pick,
                  bold: true,
                })}
                {option.consequence ? <Text {...pick}>: </Text> : null}
                {option.consequence
                  ? inline(option.consequence, `${option.letter}-then`, pick)
                  : null}
              </Button>,
            )}
            {under("➕", option.pros, "pro")}
            {under("➖", option.cons, "con")}
            {under("", option.notes, "note")}
          </Box>
        );
      })}
      {view.notes === "none" ? null : view.notes === "button" ? (
        <Box key={`${view.keyOf("add-note")}-box`} marginLeft={INDENT}>
          <Button
            key={view.keyOf("add-note")}
            label="Add a note"
            plain
            dimColor
            onPress={() => view.onOpenNotes()}
          >
            ✏️ <Text underline>Add a note</Text>
          </Button>
        </Box>
      ) : (
        <Box key={`${notesKey(item)}-box`} marginLeft={INDENT}>
          <Input
            key={notesKey(item)}
            label="✏️ "
            placeholder="Notes, or an answer in your own words"
            submitLabel="add to the draft"
            rows={noteRows(s.notes.rows)}
            {...(view.notes === "focused" ? { autoFocus: true as const } : {})}
            value={view.note}
            onSubmit={(said) => view.onNote(said)}
          />
        </Box>
      )}
    </Box>
  );
};
