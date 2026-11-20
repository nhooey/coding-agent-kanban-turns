// Clickable answers to the kanban turn responses' Decide items: a pane that
// lists every item raised in the session, newest turn first, and the same
// boxes under the reply that raised them, in place of its Decide list. The
// pane opens by itself, without the keyboard, at session start when items
// are open and when a reply raises a new one; 🖥️ Kanban and the skill's
// count line above the prompt, and /answers, open it with the keyboard. A
// click writes the item's reference, on a line of its own, into the prompt
// draft and never sends it; only the pane's Submit sends a prompt. An item
// no longer open is Done: it stays, dimmed, in its turn's Done section,
// collapsed until a click opens it, and its options still answer it again.
//
// The pane, top to bottom: a header row, `🖥️ Kanban · 📌 <count line>`, how
// many open items the draft answers, and ↑ Previous, ↓ Next, ? Keys and
// ✖ Close; under it, once ? Keys opens it, a panel listing every key; then
// each turn under a faint header, its open items drawn in full, then its
// Done section; then a footer saying what Submit will send, beside
// 🔄 Reassess and 📤 Submit.
//
// An item is drawn as the skill writes it: its summary, its note, then each
// option as `glyph letter. name: consequence` with its ➕ and ➖ lines indented
// under it, inside a rounded border. The option the draft picks is marked
// ✅ and underlined; a bar in the column left of an option lights under the
// pointer, and stays lit in another colour once the item is Done.

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
} from "../src/items/answers.ts";
import { instructing } from "../src/transcript/instructed.ts";
import {
  INPUT_SCHEMA,
  INSTRUCTIONS,
  TOOL,
  TOOL_CALLED,
  TOOL_DESCRIPTION,
  withInstructions,
} from "../src/protocol/instructions.ts";
import { CHOSEN_MARK, itemsOf, optionMark, refOf } from "../src/items/items.ts";
import { INDENT, codeSpans } from "../src/pane/layout.ts";
import { cellWidth } from "../src/text/cells.ts";
import { DECIDE, DONE, REASSESS } from "../src/protocol/rules.ts";
import { capitalized } from "../src/text/words.ts";
import { SPEC } from "../src/protocol/spec.ts";
import {
  decideListCut,
  itemOfLink,
  linkedItems,
  linkedQuestions,
} from "../src/pane/links.ts";
import {
  countLine,
  mergedOfResponse,
  mergedQuery,
  openOf,
  pullRequestsToAsk,
} from "../src/items/outstanding.ts";
import {
  answeredCount,
  closesOnSubmit,
  emptyRaised,
  forSession,
  isSettled,
  problemsOf,
  refreshed,
  seen,
  sentOf,
  settlementOf,
  stillOpen,
  unread,
  unseen,
  withItems,
  withSent,
  withoutRead,
} from "../src/items/raised.ts";
import {
  doneHeader,
  doneKey,
  doneLine,
  lineKey,
  paneStops,
  steppedStop,
  toggledKey,
  firstUnansweredIn,
  turnSections,
  withKeys,
} from "../src/pane/sections.ts";
import type { TurnSection } from "../src/pane/sections.ts";
import { transcriptPathFor, turnsOfText } from "../src/transcript/claude-code.ts";
import {
  NOT_DECODED,
  chunkOffsets,
  decodedText,
  withRange,
} from "../src/transcript/turns.ts";
import type { Turn } from "../types/index.d.ts";
import {
  answeredText,
  answersText,
  configText,
  draftSummary,
  drewText,
  gutterStyle,
  keyRows,
  isPlainToolRow,
  itemTitle,
  noItemsText,
  NOT_EMPTIED_TEXT,
  noteRows,
  notesKey,
  notesMode,
  notPutBackText,
  notSentText,
  pickedText,
  putBackText,
  sentLetters,
  settledText,
  submitStep,
} from "../src/pane/view.ts";
import type { NotesMode } from "../src/pane/view.ts";
import type {
  DecideItem,
  Loaded,
  Raised,
  Settings,
  Settlement,
} from "../types/index.d.ts";
import { loadSettings } from "./settings.ts";

// The pane that lists the items, and its title. The keys and colours are
// settings, in defaults/config.yaml.
const PANE = {
  id: "kanban-turns",
  title: `${DECIDE.glyph} ${DECIDE.header}`,
} as const;
// The column left of an option's lines that lights while the pointer is over
// the option, or stays lit once its item is Done: it comes out of the
// option's indent, so its text stays put.
const GUTTER = 1;
// The most bytes one `$.fs.read` returns: the transcript is read in ranges
// this long.
const READ_BYTES = 4 * 1024 * 1024;
// Nothing read yet: no settings until session.start reads the files.
const UNREAD: Loaded = { settings: null, effective: [], problems: [], warnings: [] };
// The keys of the buttons that move the focus ring between items: a ring
// a hotkey leaves on one of them is no item's, so j and k don't count from it.
const STEPS = { next: "next", previous: "previous" } as const;

// Change the tag when Raised's fields change: it declines what an earlier
// version stored, which outlives a reload.
const raised = atom(
  { plugin: "coding-agent-kanban-turns", key: "raised" } as const,
  emptyRaised,
  { shape: "raised-4" },
);
// The answers the last Submit sent, Done at once: the turn's end reads the
// transcript, which confirms each or puts it back among the open items.
// Change the tag when Settlement's fields change.
const sent = atom(
  { plugin: "coding-agent-kanban-turns", key: "sent" } as const,
  [] as readonly Settlement[],
  { shape: "sent-1" },
);
// The Done sections a click opened, by `doneKey`, and the Done items a click
// opened to their full box, by ref: everything else Done stays collapsed.
const expanded = atom(
  { plugin: "coding-agent-kanban-turns", key: "expanded" } as const,
  [] as readonly string[],
);
// The key of the element the pane's focus ring is on, as `ui.focus` last
// said; empty before it says, or once the pane closes. j and k count from it.
const focused = atom(
  { plugin: "coding-agent-kanban-turns", key: "focused" } as const,
  "",
);
// Whether the pane's keys panel, which `? Keys` toggles, is open; closed,
// it draws nothing. Closing the pane closes it.
const isKeysOpen = atom(
  { plugin: "coding-agent-kanban-turns", key: "isKeysOpen" } as const,
  false,
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
  { shape: "settings-7" },
);

/** The settings in effect, or none while the defaults file can't be used. */
const settingsNow = async ($: EngineInterface): Promise<Settings | null> =>
  (await read($, settings)).settings;

/** The raised items as the pane and a reply draw them: the answers Submit sent Done until the turn's end reads them. */
const shownNow = async ($: EngineInterface): Promise<Raised> =>
  withSent(await read($, raised), await read($, sent));

/** The pane's sections, newest turn first, the Done sections and items a click opened, and the stops j and k move between. */
const paneNow = async (
  $: EngineInterface,
): Promise<
  Readonly<{
    shown: Raised;
    sections: readonly TurnSection[];
    open: readonly string[];
    stops: ReturnType<typeof paneStops>;
  }>
> => {
  const shown = await shownNow($);
  const sections = turnSections(
    shown.items,
    (item) => isSettled(shown, item),
    shown.turns,
  );
  const open = await read($, expanded);

  return { shown, sections, open, stops: paneStops(sections, open) };
};

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

/** This session's turns, read from its whole transcript file. */
const turnsNow = async ($: EngineInterface): Promise<readonly Turn[]> =>
  turnsOfText(await transcriptText($, await transcriptPath($)));

/**
 * The text of the transcript file at `path`, read whole in ranges the
 * engine's reads allow, one after another, each decoded as it comes.
 */
const transcriptText = async (
  $: EngineInterface,
  path: string,
): Promise<string> => {
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

  return decodedText(decoded);
};

// The conversation a hook last added the agent's instructions to, by
// `conversationKey`: the other route, raised before the transcript shows
// them, then adds none.
const instructed = atom(
  { plugin: "coding-agent-kanban-turns", key: "instructed" } as const,
  "",
);

/**
 * Whether the hook about to add the agent's instructions should: they are
 * owed to this conversation, which is then marked as having them. A
 * transcript not there yet, as at a new session's first prompt, holds none.
 */
const instructNow = async ($: EngineInterface): Promise<boolean> => {
  const path = await transcriptPath($);
  const text = await transcriptText($, path).catch(() => "");
  const { key, isOwed } = instructing(path, text, await read($, instructed));

  if (isOwed) {
    await update($, instructed, () => key);
  }

  return isOwed;
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
  await update($, raised, (r) =>
    refreshed(
      r,
      open.items,
      open.settlements,
      warnings,
      turns.map((turn) => turn.id),
    ),
  );
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
 * Resolves to whether it read the transcript.
 */
const refresh = async ($: EngineInterface): Promise<boolean> => {
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

    return false;
  }
  await settle($, found.turns, s.counts.turns, problems);
  void askMerged($, stamp, found.turns, s.counts).catch(() => undefined);

  return true;
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
 * The items the draft answers are Done from the moment it's sent, until the
 * turn's end reads the transcript; a refused prompt puts them back at once.
 * A prompt that went through closes the pane when it leaves no item open,
 * as `pane.close-when-all-submitted` says.
 */
const sendDraft = async ($: EngineInterface, text: string): Promise<void> => {
  const emptied = await $.prompt.fill({ text: "", mode: "replace" });

  if (!emptied.isFilled) {
    await update($, submitProblem, () => NOT_EMPTIED_TEXT);

    return;
  }
  await update($, draft, () => "");
  const moved = sentOf(text, await shownNow($));
  const isMoved = (held: Settlement) =>
    moved.some((settled) => settled.ref === held.ref);
  await update($, sent, (held) => [...held.filter((s) => !isMoved(s)), ...moved]);
  const refusal = await refusalOf($, text);

  if (refusal !== undefined) {
    await update($, sent, (held) => held.filter((s) => !isMoved(s)));
    await putBack($, text, refusal);

    return;
  }
  await update($, submitProblem, () => "");
  const s = await settingsNow($);

  if (
    closesOnSubmit(
      await read($, raised),
      await read($, sent),
      s?.pane["close-when-all-submitted"] === true,
    )
  ) {
    await closePane($);
  }
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

/** Scrolls the pane to `to`, an element by its key or its start or end, landing at `block`; a pane not drawn yet stays as it is. */
const reveal = async (
  $: EngineInterface,
  to: { key: string } | "start" | "end",
  block: "start" | "end" | "nearest" = "start",
): Promise<void> => {
  await $.ui.scroll({ in: PANE.id, to, block }).catch(() => undefined);
};

/** Moves the pane's focus ring onto the element `key` names; resolves to whether it moved. */
const ringTo = async ($: EngineInterface, key: string): Promise<boolean> => {
  const moved = await $.ui
    .focus({ requestId: PANE.id, key })
    .catch((error: unknown) => ({ deny: String(error) }));

  return moved.deny === undefined;
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

  if (await ringTo($, notesKey(item))) {
    await update($, noting, () => "");
  }
};

/**
 * j or k: the focus ring to the next or the previous item, or Done header,
 * from the one it's on, the pane scrolled to show it; nothing past either
 * end.
 */
const step = async ($: EngineInterface, by: 1 | -1): Promise<void> => {
  const { stops } = await paneNow($);
  const key = steppedStop(stops, await read($, focused), by);

  if (key !== undefined) {
    await reveal($, { key }, "nearest");

    if (await ringTo($, key)) {
      await update($, focused, () => key);
    }
  }
};

/** A click on a Done header, a Done item's line or its box's title: that section or item opened, or closed again. */
const toggleExpanded = ($: EngineInterface, key: string) =>
  update($, expanded, (open) => toggledKey(open, key));

/** Closes the pane; its notes field no longer waits for the focus, its ring is on nothing, and its keys panel is closed. */
const closePane = async ($: EngineInterface): Promise<void> => {
  await update($, noting, () => "");
  await update($, focused, () => "");
  await update($, isKeysOpen, () => false);
  await $.ui.close({ id: PANE.id });
};

/** `? Keys`: the keys panel opened, or closed again. */
const toggleKeys = ($: EngineInterface) =>
  update($, isKeysOpen, (isOpen) => !isOpen);

/** The end of a main-loop turn, or the session's start: opens the pane at its top, the newest turn, when an item is open that the pane hasn't been opened over. */
const announce = async ($: EngineInterface): Promise<void> => {
  const r = await read($, raised);
  await update($, raised, seen);

  if (unseen(r).length > 0) {
    await openPane($, false);
    await reveal($, "start");
  }
};

/** /answers: re-reads the open items and opens the pane with the keyboard, at the first item the draft doesn't answer. */
const reopen = async ($: EngineInterface): Promise<Raised> => {
  await refresh($);
  await update($, raised, seen);
  await openPane($, true);
  const { shown, sections } = await paneNow($);
  const item = firstUnansweredIn(sections, await read($, draft));

  if (item !== undefined) {
    await reveal($, { key: refOf(item) });
  }

  return shown;
};

/** A question's link pressed: the pane, with the keyboard, scrolled to its item, its Done section and box opened when it's Done. */
const showItem = async ($: EngineInterface, href: string): Promise<void> => {
  const r = await shownNow($);
  const item = r.items[itemOfLink(r.items, href)];
  await openPane($, true);

  if (item !== undefined) {
    if (isSettled(r, item)) {
      await update($, expanded, (open) =>
        withKeys(open, [doneKey(item.turn), refOf(item)]),
      );
    }
    await reveal($, { key: refOf(item) });
  }
};

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    // No turn runs as the session starts, no Submit is under way, none has
    // a problem to say, no sent answer waits for a turn's end and the ring
    // is on nothing, though a reload mid-turn or mid-Submit may have left
    // them set; the refresh reads what a sent answer did. Cleared before the
    // hook awaits anything else, so a turn.start or a Submit that lands while
    // it registers stays.
    await update($, runningTurn, () => "");
    await update($, submitting, () => 0);
    await update($, submitProblem, () => "");
    await update($, sent, () => []);
    await update($, focused, () => "");
    const started = await next(e);
    await $.command.register({
      name: "answers",
      description: `Open the kanban ${DECIDE.header} pane, at the first unanswered item`,
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

  // The plugin teaches the agent the turn-response format and its tool
  // itself, once per conversation, by whichever route runs first, from the
  // prose fragments the spec fills. This hook puts the instructions in the
  // conversation's context, after whatever the engine and other hooks put
  // there. A plugin above can send the event on past it, as
  // cc-plugin-sec-default does under managed settings; then the prompt.submit
  // hook below puts them in the prompt's context. Where the transcript can't
  // be read, the context still takes them.
  on("prompt.context", async ($, e, next) => {
    const built = await next(e);

    return (await instructNow($)) ? withInstructions(built) : built;
  }).catch(async ($, e, next) => withInstructions(await next(e)));

  // A slash command's prompt may never reach the agent, so the instructions
  // wait for one that does; a prompt that doesn't enter leaves them owed. A
  // failure here never holds up the prompt.
  on("prompt.submit", async ($, e, next) => {
    if (e.command !== undefined || !(await instructNow($))) {
      return next(e);
    }
    const entered = await next({
      ...e,
      context: [...(e.context ?? []), INSTRUCTIONS],
    });

    if (entered.drop !== undefined) {
      await update($, instructed, () => "");
    }

    return entered;
  }).catch(($, e, next) => next(e));

  on("command.run", { command: "answers-config" }, async ($) => {
    const { effective, problems, warnings } = await reloadSettings($);

    return { text: configText(effective, problems, warnings) };
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
  // this turn, so an earlier turn's late end leaves a later one running; and
  // the transcript read again confirms the answers Submit sent or puts their
  // items back among the open ones. Only the answers sent before the read
  // began are taken out: a Submit pressed while it reads keeps its own.
  on("turn.complete", async ($, e, next) => {
    const done = await next(e);

    if (e.agentId === undefined) {
      await update($, runningTurn, (held) => (held === e.turnId ? "" : held));
      const before = await read($, sent);

      if (await refresh($)) {
        await update($, sent, (held) => withoutRead(held, before));
      }
      await announce($);
    }

    return done;
  });

  // The person closing the pane: its notes field no longer waits for the
  // focus, its ring is on nothing, and its keys panel is closed. The
  // plugin's own close, ✖, clears them itself.
  on("ui.close", async ($, e, next) => {
    const closed = await next(e);

    if (e.id === PANE.id) {
      await update($, noting, () => "");
      await update($, focused, () => "");
      await update($, isKeysOpen, () => false);
    }

    return closed;
  });

  // Where the pane's focus ring lands, for j and k to count from; a ring a
  // hotkey left on ↑ or ↓ keeps the item it was on. The ring moves whatever
  // becomes of the note.
  on("ui.focus", { requestId: PANE.id }, async ($, e, next) => {
    const moved = await next(e);
    const key = e.element ?? "";

    if (moved.deny === undefined && key !== STEPS.next && key !== STEPS.previous) {
      await update($, focused, () => key).catch(() => undefined);
    }

    return moved;
  });

  on("prompt.change", async ($, e, next) => {
    const changed = await next(e);
    await update($, draft, () => e.text);

    return changed;
  });

  // Above the prompt: 🖥️ Kanban, then a faint ` · ` and the skill's count
  // line, then, while the draft answers open items, ` · ✏️ 2 picked`, each
  // opening the pane with the keyboard; 🖥️ Kanban alone when nothing is
  // open. Claude Code stacks each plugin's drawing here itself, so another
  // plugin's band, such as the usage mod's agents tree, is drawn beside this
  // one.
  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const s = await settingsNow($);

    if (e.props.hasSurvey || s === null) {
      return next(e);
    }

    const elements = $.ui.resolve(e);
    const picked = answeredCount(await shownNow($), await read($, draft));

    return kanbanLine(
      elements,
      s,
      [
        { key: "counts", text: await read($, counts) },
        { key: "picked", text: pickedText(picked) },
      ],
      () => openPane($, true),
    );
  });

  // A reply's Decide questions: the items the reply names are drawn in place
  // of its Decide list, each in its box, the text either side of the list
  // kept. Where the list isn't found intact, each raised item's summary line
  // becomes a link that opens the pane at that item, and the items are drawn
  // under the whole text instead.
  on("ui.render", { component: "AssistantMessage" }, async ($, e, next) => {
    const r = await shownNow($);
    const linked = linkedQuestions(e.props.text, r.items);

    if (linked.hrefs.length === 0) {
      return next(e);
    }

    const s = await settingsNow($);
    const elements = $.ui.resolve(e);
    const { Box, Markdown } = elements;
    const items = linkedItems(r.items, linked.hrefs);
    const boxes =
      s === null
        ? null
        : itemBoxes($, elements, s, r, items, {
            key: "kanban-items",
            text: await read($, draft),
            isPane: false,
            noting: "",
          });
    const cut = s === null ? undefined : decideListCut(e.props.text, items);

    return cut === undefined ? (
      <Box flexDirection="column">
        <Markdown
          key="kanban-questions"
          text={linked.text}
          pressableLinks={linked.hrefs}
          onLinkPress={(link) => showItem($, link.href)}
        />
        {boxes}
      </Box>
    ) : (
      <Box flexDirection="column">
        {cut.before === "" ? null : (
          <Markdown key="kanban-before" text={cut.before} />
        )}
        {boxes}
        {cut.after === "" ? null : (
          <Markdown key="kanban-after" text={cut.after} />
        )}
      </Box>
    );
  });

  // The pane: the header row, the keys panel when it's open, then each
  // turn, newest first, then the footer.
  on("ui.render", { component: "Pane", requestId: PANE.id }, async ($, e) => {
    const elements = $.ui.resolve(e);
    const { Box, Text } = elements;
    const s = await settingsNow($);
    const { shown: r, sections, open, stops } = await paneNow($);

    if (s === null) {
      return <Text dimColor>{noItemsText(problemsOf(r))}</Text>;
    }

    const text = await read($, draft);
    const isBusy =
      (await read($, runningTurn)) !== "" || (await read($, submitting)) !== 0;
    const problem = await read($, submitProblem);
    const ring = await read($, focused);
    const notingNow = await read($, noting);
    const line = await read($, counts);
    const openCount = stillOpen(r).length;

    return (
      <Box flexDirection="column">
        <Box
          key="header"
          marginBottom={1}
          columnGap={2}
          flexWrap="wrap"
          justifyContent="space-between"
        >
          <Box key="header-status" columnGap={2} flexWrap="wrap">
            {kanbanLine(elements, s, [{ key: "counts", text: line }])}
            {openCount === 0 ? null : (
              <Text key="answered">
                {answeredText(answeredCount(r, text), openCount)}
              </Text>
            )}
          </Box>
          <Box key="header-controls" columnGap={2}>
            {control(elements, {
              key: STEPS.previous,
              glyph: "↑",
              label: "Previous",
              hotkey: s.keys.previous,
              isInert: steppedStop(stops, ring, -1) === undefined,
              onPress: () => step($, -1),
            })}
            {control(elements, {
              key: STEPS.next,
              glyph: "↓",
              label: "Next",
              hotkey: s.keys.next,
              isInert: steppedStop(stops, ring, 1) === undefined,
              onPress: () => step($, 1),
            })}
            {control(elements, {
              key: "keys",
              glyph: "?",
              label: "Keys",
              hotkey: s.keys.help,
              onPress: () => toggleKeys($),
            })}
            {control(elements, {
              key: "dismiss",
              glyph: "✖",
              glyphColor: s.colors.close,
              label: "Close",
              hotkey: s.keys.dismiss,
              role: "dismiss",
              onPress: () => closePane($),
            })}
          </Box>
        </Box>
        {(await read($, isKeysOpen)) ? keysPanel(elements, s) : null}
        {/* The filters will go here, a row under the header. */}
        {problem ? (
          <Text key="submit-problem" wrap="wrap">
            {problem}
          </Text>
        ) : null}
        {problemsOf(r) ? (
          <Text key="problems" dimColor wrap="wrap">
            {problemsOf(r)}
          </Text>
        ) : null}
        {openCount === 0 ? (
          <Text key="nothing-open" dimColor>
            Nothing open
          </Text>
        ) : null}
        {sections.map((section, n) => (
          <Box
            key={`${section.turn}.section`}
            flexDirection="column"
            marginTop={n === 0 && openCount > 0 ? 0 : 1}
          >
            <Text key={`${section.turn}.turn`} dimColor>
              {section.header}
            </Text>
            {itemBoxes($, elements, s, r, section.open, {
              key: `${section.turn}.open`,
              text,
              isPane: true,
              noting: notingNow,
            })}
            {doneSection($, elements, s, r, section, open, text)}
          </Box>
        ))}
        <Box
          key="footer"
          marginTop={1}
          columnGap={2}
          flexWrap="wrap"
          justifyContent="space-between"
        >
          <Text key="draft-summary" wrap="wrap">
            {draftSummary(text)}
          </Text>
          <Box key="footer-controls" columnGap={2}>
            {/* A toggle: it adds `reassess` as the draft's last line, for
                Submit to send after any answers, or alone, and takes it out
                again; its glyph is ✅ while the line is there. */}
            {control(elements, {
              key: REASSESS,
              glyph: hasReassess(text) ? CHOSEN_MARK : "🔄",
              label: capitalized(REASSESS),
              hotkey: s.keys.reassess,
              onPress: () => toggleReassess($),
            })}
            {control(elements, {
              key: "submit",
              glyph: "📤",
              label: "Submit",
              hotkey: s.keys.submit,
              isInert: "skip" in submitStep(text, isBusy),
              onPress: () => submitDraft($),
            })}
          </Box>
        </Box>
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
 * One of the pane's controls, drawn as every button is: `glyph label`, no
 * chrome, its key drawn before it where it has one, inverted under the
 * pointer; dim while it can't act. A press always runs `onPress`, which
 * itself does nothing while it can't act, as it reads that afresh: what
 * the drawing knew may be a moment old.
 */
const control = (
  elements: Pick<Elements, "Button" | "Text">,
  c: Readonly<{
    key: string;
    glyph: string;
    label: string;
    onPress: () => unknown;
    hotkey?: string;
    isInert?: boolean;
    glyphColor?: string;
    role?: "dismiss";
  }>,
) => {
  const { Button, Text } = elements;

  return (
    <Button
      key={c.key}
      label={c.label}
      plain
      dimColor={c.isInert === true}
      {...(c.hotkey ? { hotkey: c.hotkey } : {})}
      {...(c.role ? { role: c.role } : {})}
      onPress={() => c.onPress()}
    >
      {c.glyphColor ? (
        <Text key={`${c.key}-glyph`} color={c.glyphColor}>
          {c.glyph}
        </Text>
      ) : (
        c.glyph
      )}
      {` ${c.label}`}
    </Button>
  );
};

/**
 * `🖥️ Kanban`, the word in its colour, then each of `pieces` that isn't
 * empty after a faint ` · `: above the prompt each a button that runs
 * `onOpen`; atop the pane, which is already open, the same text unpressable.
 */
const kanbanLine = (
  elements: Pick<Elements, "Box" | "Button" | "Text">,
  s: Settings,
  pieces: readonly Readonly<{ key: string; text: string }>[],
  onOpen?: () => unknown,
) => {
  const { Box, Button, Text } = elements;
  const piece = (key: string, label: string, content: readonly RenderNode[]) =>
    onOpen === undefined ? (
      <Text key={key}>{content}</Text>
    ) : (
      <Button key={key} label={label} plain onPress={() => onOpen()}>
        {content}
      </Button>
    );

  return (
    <Box key="kanban-line">
      {piece("kanban", `Open the ${DECIDE.header} pane`, [
        "🖥️ ",
        <Text key="kanban-word" color={s.colors.kanban}>
          Kanban
        </Text>,
      ])}
      {pieces
        .filter((p) => p.text !== "")
        .flatMap((p) => [
          <Text key={p.key === "counts" ? "divider" : `${p.key}-divider`} dimColor>
            {" · "}
          </Text>,
          piece(p.key, p.text, [p.text]),
        ])}
    </Box>
  );
};

/** The cells between a label and the text after it, on a title or a Done line. */
const LABEL_GAP = 2;

/**
 * A line with a lead, `🔘 A. `, `➕ ` or an item's label, whose wrapped rows
 * start under the text after the lead rather than at the lead's edge: the
 * lead in a Box as wide as its cells, which never shrinks, the text in one
 * that takes the rest of the row and wraps there. The engine lays it out;
 * only the lead's width is counted here.
 */
const hanging = (
  elements: Pick<Elements, "Box">,
  key: string,
  lead: Readonly<{ width: number; node: RenderNode }>,
  body: RenderNode,
) => {
  const { Box } = elements;

  return (
    <Box key={`${key}-hang`} flexGrow={1} flexShrink={1}>
      <Box key={`${key}-hang-lead`} width={lead.width} flexShrink={0}>
        {lead.node}
      </Box>
      <Box key={`${key}-hang-text`} flexGrow={1} flexShrink={1}>
        {body}
      </Box>
    </Box>
  );
};

/**
 * The keys panel `? Keys` opens under the pane's header: a row per key,
 * the key bold in a column as wide as the widest, then what it does, which
 * wraps under its own start. The keys are the settings', so a rebound key
 * shows as rebound.
 */
const keysPanel = (elements: Pick<Elements, "Box" | "Text">, s: Settings) => {
  const { Box, Text } = elements;
  const rows = keyRows(s.keys);
  const width =
    Math.max(...rows.map((row) => cellWidth(row.key))) + LABEL_GAP;

  return (
    <Box key="keys-panel" flexDirection="column" marginBottom={1}>
      {rows.map((row, n) =>
        hanging(
          elements,
          `keys-${n}`,
          { width, node: <Text weight="bold">{row.key}</Text> },
          <Text dimColor wrap="wrap">
            {row.does}
          </Text>,
        ),
      )}
    </Box>
  );
};

/**
 * A Done item's one dim line in its open section, `▌🧠 Decide.1  <summary> ·
 * <what made it Done>`, the summary wrapping under its own start; a click on
 * it, the summary's button, opens the item's full box.
 */
const doneRow = (
  $: EngineInterface,
  elements: Elements,
  s: Settings,
  item: DecideItem,
  line: Readonly<{ label: string; text: string }>,
) => {
  const { Box, Button, Text } = elements;
  const key = lineKey(item);

  return (
    <Box key={`${refOf(item)}.row`}>
      <Text key={`${refOf(item)}.bar`} color={s.colors.settled}>
        ▌
      </Text>
      {hanging(
        elements,
        key,
        {
          width: cellWidth(line.label) + LABEL_GAP,
          node: <Text dimColor>{line.label}</Text>,
        },
        <Button
          key={key}
          label={item.summary}
          plain
          dimColor
          onPress={() => toggleExpanded($, refOf(item))}
        >
          {line.text}
        </Button>,
      )}
    </Box>
  );
};

/**
 * A turn's Done section: its header, `▸ Done (2)`, a toggle; once open, each
 * Done item's one dim line, `▌🧠 Decide.1  <summary> · <what made it Done>`,
 * which a click opens to the item's full box, whose title closes it again.
 * A closed section draws its header alone.
 */
const doneSection = (
  $: EngineInterface,
  elements: Elements,
  s: Settings,
  r: Raised,
  section: TurnSection,
  open: readonly string[],
  text: string,
) => {
  const { Box, Button } = elements;
  const key = doneKey(section.turn);
  const isOpen = open.includes(key);

  return section.done.length === 0 ? null : (
    <Box key={`${key}-box`} flexDirection="column">
      <Button
        key={key}
        label={`${DONE.header} (${section.done.length})`}
        plain
        onPress={() => toggleExpanded($, key)}
      >
        {doneHeader(section.done.length, isOpen)}
      </Button>
      {isOpen
        ? section.done.map((item) =>
            open.includes(refOf(item)) ? (
              <Box key={`${refOf(item)}.full`} flexDirection="column">
                {itemBoxes($, elements, s, r, [item], {
                  key: `${refOf(item)}.boxes`,
                  text,
                  isPane: true,
                  noting: "",
                  onTitle: () => toggleExpanded($, refOf(item)),
                })}
              </Box>
            ) : (
              doneRow(
                $,
                elements,
                s,
                item,
                doneLine(item, settledText(settlementOf(r, item))),
              )
            ),
          )
        : null}
    </Box>
  );
};

/**
 * Each item in its own rounded box, keyed by its ref, a Done one dimmed but
 * for its options, which pick as an open item's do, its sent options marked
 * beside what the draft chooses afresh: the pane's drawing and a reply's
 * alike, but for the notes, which a Done item has none of. In the pane an
 * open item has its notes field, `noting`'s taking the focus; under a
 * reply, which can't take the keyboard, a ✏️ Add a note button opens the
 * pane at that field. With `onTitle`, a Done item's summary is a button
 * that runs it.
 */
const itemBoxes = (
  $: EngineInterface,
  elements: Elements,
  s: Settings,
  r: Raised,
  items: readonly DecideItem[],
  at: Readonly<{
    key: string;
    text: string;
    isPane: boolean;
    noting: string;
    onTitle?: () => unknown;
  }>,
) => {
  const { Box } = elements;

  return (
    <Box key={at.key} flexDirection="column">
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
              chosen: lettersFor(at.text, item),
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
              onPick: (letter) => answer($, item, letter),
              onNote: (said) => (isDone ? undefined : note($, item, said)),
              onOpenNotes: () => openNotes($, item),
              ...(at.onTitle ? { onTitle: at.onTitle } : {}),
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
    /** The letters the answer that made the item Done picked. */
    sent: readonly string[];
    /** What made the item Done, the line under its title; empty while open. */
    settled: string;
    note: string;
    isSettled?: boolean;
    /** The notes: none, the field, the field taking the focus, or a button that opens the pane at it. */
    notes: NotesMode;
    keyOf: (letter: string) => string;
    onPick: (letter: string) => unknown;
    onNote: (note: string) => unknown;
    onOpenNotes: () => unknown;
    /** What a press on the title runs, which makes it a button; none, a plain line. */
    onTitle?: () => unknown;
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
  // The label bold on its background, the summary plain after it on the
  // same line, wrapping under its own start; a Done item's label is dimmed
  // with the rest, with no background. With `onTitle` each is a button
  // that runs it.
  const ref = refOf(item);
  const label = (
    <Text
      key={`${ref}.title-label`}
      dimColor={dim}
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
  );
  const summary = (
    <Text key={`${ref}.title-summary`} dimColor={dim} wrap="wrap">
      {inline(view.title.summary, "title")}
    </Text>
  );
  const onTitle = view.onTitle;

  return (
    <Box flexDirection="column">
      {hanging(
        elements,
        `${ref}.title`,
        { width: cellWidth(view.title.label) + 1, node: label },
        onTitle === undefined ? (
          summary
        ) : (
          <Button
            key={lineKey(item)}
            label={item.summary}
            plain
            dimColor={dim}
            onPress={() => onTitle()}
          >
            {summary}
          </Button>
        ),
      )}
      {view.settled ? (
        <Box key="done-by" marginLeft={INDENT}>
          <Text dimColor wrap="wrap">
            {view.settled}
          </Text>
        </Box>
      ) : null}
      {lines("", item.note, undefined, "note")}
      {item.options.map((option) => {
        const isChosen = view.chosen.includes(option.letter);
        // An option the answer that made the item Done picked: its own mark,
        // at full strength in the dimmed item, never underlined.
        const isSent = view.sent.includes(option.letter);
        // A chosen option's line is underlined, its glyph turned to ✅;
        // nothing of it, and none of its ➕ and ➖ lines, is highlighted.
        const pick = isChosen ? { underline: true } : {};
        const key = view.keyOf(option.letter);
        // A Button holds only text, so each of the option's lines is a button
        // of its own that picks it. They share a hover group, so the pointer
        // on any of them lights the gutter beside every one: a bar the
        // option's height. A Done option's gutter stays lit in the
        // settled colour instead, and never hovers.
        const gutter = gutterStyle(dim, key, colors);
        // Every option picks, a Done item's too, so none is dim.
        const press = {
          plain: true,
          hover: { scope: key },
          onPress: () => view.onPick(option.letter),
        } as const;
        // A line's lead, a glyph and a letter or a ➕ or ➖, is plain text in
        // a Box as wide as its cells; the line's text, the one button that
        // picks, wraps beside it, so its rows start under the text. A
        // Button holds only text, so one button can't hold both: the lead
        // takes no press of its own, and a line is one focus stop.
        const led = (at: string, lead: string, body: RenderNode) =>
          lead === ""
            ? body
            : hanging(
                elements,
                at,
                { width: cellWidth(lead), node: <Text>{lead}</Text> },
                body,
              );
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
              <Box key={`${key}-${part}-${n}-box`} marginLeft={INDENT} flexGrow={1} flexShrink={1}>
                {led(
                  `${key}-${part}-${n}`,
                  prefix ? `${prefix} ` : "",
                  <Button key={`${key}-${part}-${n}`} label={line} {...press}>
                    {inline(line, `${key}-${part}-${n}`)}
                  </Button>,
                )}
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
              led(
                key,
                `${optionMark(item, option.letter, { chosen: isChosen, sent: isSent }, s.marks.sent)} ${option.letter}. `,
                <Button key={key} label={option.name} {...press}>
                {inline(option.name, `${option.letter}-name`, {
                  ...pick,
                  bold: true,
                })}
                {option.consequence ? <Text {...pick}>: </Text> : null}
                {option.consequence
                  ? inline(option.consequence, `${option.letter}-then`, pick)
                  : null}
                </Button>,
              ),
            )}
            {under(SPEC.options.pro, option.pros, "pro")}
            {under(SPEC.options.con, option.cons, "con")}
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
            onPress={() => view.onOpenNotes()}
          >
            ✏️ Add a note
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
