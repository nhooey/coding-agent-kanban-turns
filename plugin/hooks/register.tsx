// Clickable answers to the kanban turn responses' Decide items: a pane that
// lists every item raised in the session, newest turn first, and the same
// boxes under the reply that raised them, in place of its Decide list. The
// pane opens by itself, without the keyboard, at session start when items
// are open and when a reply raises a new one; 🖥️ Kanban and the skill's
// count line above the prompt, and /answers, open it with the keyboard. A
// click writes the item's reference, on a line of its own, into the prompt
// draft and never sends it; only the pane's Submit sends a prompt. An item
// no longer open is Done: it moves, dimmed, to its turn under the Done
// branch, collapsed until a click opens it, and its options still answer it
// again.
//
// The pane, top to bottom: a header row, `🖥️ Kanban · 📌 <count line>`, how
// many open items the draft answers, and ↑ Previous, ↓ Next, ? Keys and
// ✖ Close; under it, once ? Keys opens it, a panel listing every key; then
// each turn with an open item under a faint header, a toggle, its open
// items drawn in full; then the Done branch's toggle, `▸ Done (n)`, and
// under it each turn with a Done item, under its own toggle; then a footer
// saying what Submit will send, beside 🔄 Reassess and 📤 Submit.
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
  toggledWord,
  withNote,
  wordFor,
} from "../src/items/answers.ts";
import { conversationKeyOf, instructing } from "../src/transcript/instructed.ts";
import type { Instructing } from "../src/transcript/instructed.ts";
import {
  INPUT_SCHEMA,
  INSTRUCTIONS,
  LINT_CALLED,
  OUTSTANDING_CALLED,
  TOOL,
  TOOL_CALLED,
  TOOL_DESCRIPTION,
  withInstructions,
} from "../src/protocol/instructions.ts";
import {
  LINT_DESCRIPTION,
  LINT_SCHEMA,
  LINT_TOOL,
  OUTSTANDING_DESCRIPTION,
  OUTSTANDING_SCHEMA,
  OUTSTANDING_TOOL,
} from "../src/protocol/tools.ts";
import {
  isKanbanReply,
  lintReply,
  lintToolText,
  replyLintText,
} from "../src/lint/reply.ts";
import { outstandingText, unreadText } from "../src/items/roll-up.ts";
import { ignoredSupersedes, isDecide, itemsOf, refOf } from "../src/items/items.ts";
import { freesLineOf } from "../src/items/frees.ts";
import { LAYOUT, codeSpans } from "../src/pane/layout.ts";
import { cellWidth } from "../src/text/cells.ts";
import { DECIDE, REASSESS } from "../src/protocol/rules.ts";
import { capitalized } from "../src/text/words.ts";
import { SPEC } from "../src/protocol/spec.ts";
import {
  decideListCut,
  itemOfRef,
  linkedItems,
  linkedQuestions,
  refOfLink,
} from "../src/pane/links.ts";
import {
  isMergeKnown,
  mergedOfResponse,
  mergedQuery,
  pullRequestsToAsk,
} from "../src/items/outstanding.ts";
import {
  answeredCount,
  decideItemsOf,
  isSettled,
  listedItemsOf,
  problemsOf,
  settlementOf,
  supersedesOf,
} from "../src/items/raised.ts";
import {
  INITIAL_PANE,
  failingPress,
  loadedOf,
  settingsOf,
  shownOf,
  step as paneStep,
  submitShown,
} from "../src/pane/pane-state.ts";
import type { Effect, Event, Found, Stepped } from "../src/pane/pane-state.ts";
import {
  BRANCHES,
  BRANCH_NAMES,
  NO_FOLDS,
  actionKey,
  boxToggle,
  branchHeader,
  branchOf,
  branchToggle,
  countOf,
  countedLabel,
  firstUnansweredIn,
  heldAfterFocus,
  heldAfterPick,
  isOpen,
  lineKey,
  listRuns,
  paneGroups,
  paneStops,
  ringAfterMove,
  steppedStop,
  turnHeader,
  turnToggle,
  withItemShown,
  withToggled,
} from "../src/pane/sections.ts";
import type {
  Branch,
  PaneGroups,
  Toggle,
  TurnGroup,
} from "../src/pane/sections.ts";
import { transcriptPathFor, turnsOfText } from "../src/transcript/claude-code.ts";
import {
  NOT_DECODED,
  chunkOffsets,
  decodedText,
  withRange,
} from "../src/transcript/turns.ts";
import type { Turn } from "../types/index.d.ts";
import {
  actionLead,
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
  noteRows,
  notesKey,
  notesMode,
  optionLead,
  pickedText,
  boxLines,
  doneRowOf,
  sentLetters,
  sentWord,
  submitStep,
  todoActions,
  todoNotePlaceholder,
  wordSaidBy,
} from "../src/pane/view.ts";
import type { DoneRow, ItemLink, NotesMode } from "../src/pane/view.ts";
import type {
  DecideItem,
  Folds,
  ListedItem,
  TodoItem,
  LintNote,
  Loaded,
  PaneState,
  Raised,
  Settings,
} from "../types/index.d.ts";
import { loadSettings } from "./settings.ts";

// The pane that lists the items, and its title. The keys, marks and colours
// are settings, in defaults/config.yaml; its spacing is src/pane/layout.ts's.
const PANE = {
  id: "kanban-turns",
  title: `${DECIDE.glyph} ${DECIDE.header}`,
} as const;
// The most bytes one `$.fs.read` returns: the transcript is read in ranges
// this long.
const READ_BYTES = 4 * 1024 * 1024;
// The keys of the buttons that move the focus ring between items: a ring
// a hotkey leaves on one of them is no item's, so j and k don't count from it.
const STEPS = { next: "next", previous: "previous" } as const;

// The toggles a click moved, by key: in `expanded`, those that start
// collapsed, the Done branch and the Done items opened to their full box;
// in `collapsed`, those that start expanded, the Open and Queued branches
// and every turn's header. Only a click on a toggle, or what scrolls to an
// item, changes them: an item moving between branches leaves them as they
// are. Change the tag when Folds' fields change.
const folds = atom(
  { plugin: "coding-agent-kanban-turns", key: "folds" } as const,
  NO_FOLDS,
  { shape: "folds-1" },
);
// The key of the element the pane's focus ring is on, as `ui.focus` last
// said; empty before it says, or once the pane closes. j and k count from it.
const focused = atom(
  { plugin: "coding-agent-kanban-turns", key: "focused" } as const,
  "",
);
// The checkbox item a pick in Open holds there, by ref, so further picks
// land where the first did: it moves to Queued once the ring leaves it.
// Empty for none, and once the pane closes.
const held = atom(
  { plugin: "coding-agent-kanban-turns", key: "held" } as const,
  "",
);
// Whether the pane's keys panel, which `? Keys` toggles, is open; closed,
// it draws nothing. Closing the pane closes it.
const isKeysOpen = atom(
  { plugin: "coding-agent-kanban-turns", key: "isKeysOpen" } as const,
  false,
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
// The pane's state, one value that `step` moves and `dispatch` alone writes:
// Submit and the refresh, with the raised items, the answers Submit holds
// Done, the pull requests known merged and the count line, and the
// settings, so far. Change the tag when PaneState's fields, or those of a
// type it holds, Settings' among them, change: it declines what an earlier
// version stored, which outlives a reload.
const pane = atom(
  { plugin: "coding-agent-kanban-turns", key: "pane" } as const,
  INITIAL_PANE,
  { shape: "pane-7" },
);

// What the reply lint found in the main loop's last final response, for the
// next prompt's context to hand the agent, and the conversation it was
// found in: a prompt in another, after a `/clear`, a compaction or a
// resume, carries none. Empty when it found nothing, or once a prompt
// carrying it has entered. Change the tag when LintNote's fields change.
const NO_LINT_NOTE: LintNote = { conversation: "", text: "" };
const lintNote = atom(
  { plugin: "coding-agent-kanban-turns", key: "lintNote" } as const,
  NO_LINT_NOTE,
  { shape: "lint-note-1" },
);
/** The settings in effect, or none before a read has answered or while the defaults file can't be used. */
const settingsNow = async ($: EngineInterface): Promise<Settings | null> =>
  settingsOf((await read($, pane)).settings);

/** The raised items as the pane and a reply draw them: the answers Submit sent Done until the turn's end reads them. */
const shownNow = async ($: EngineInterface): Promise<Raised> =>
  shownOf(await read($, pane));

/**
 * The pane's state, read once, with the draft, the element the ring is on,
 * the groups, Open, Queued and Done, each newest turn first, the toggles a
 * click moved, and the stops j and k move between.
 */
const paneNow = async (
  $: EngineInterface,
): Promise<
  Readonly<{
    state: PaneState;
    shown: Raised;
    text: string;
    ring: string;
    groups: PaneGroups;
    folded: Folds;
    stops: ReturnType<typeof paneStops>;
  }>
> => {
  const state = await read($, pane);
  const shown = shownOf(state);
  const text = await read($, draft);
  const ring = await read($, focused);
  const groups = paneGroups(
    shown.items,
    text,
    shown.turns,
    await read($, held),
  );
  const folded = await read($, folds);

  return {
    state,
    shown,
    text,
    ring,
    groups,
    folded,
    stops: paneStops(groups, folded),
  };
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
 * owed to this conversation, which is then marked as having them; and the
 * conversation's key, read in the same pass. A transcript not there yet, as
 * at a new session's first prompt, holds none.
 */
const instructNow = async ($: EngineInterface): Promise<Instructing> => {
  const path = await transcriptPath($);
  const text = await transcriptText($, path).catch(() => "");
  const now = instructing(path, text, await read($, instructed));

  if (now.isOwed) {
    await update($, instructed, () => now.key);
  }

  return now;
};

/** The conversation the agent has now, by `conversationKey`; a transcript not there yet holds no records. */
const conversationNow = async ($: EngineInterface): Promise<string> => {
  const path = await transcriptPath($);

  return conversationKeyOf(path, await transcriptText($, path).catch(() => ""));
};

/**
 * The pull requests among `refs` that GitHub says merged, asked of `gh` in
 * one call; none when there's nothing to ask, or `gh` is missing, fails or
 * outlasts `timeoutMs`; and whether its answer covers every one asked, as
 * `isMergeKnown` says. A GraphQL error exits non-zero yet still answers for
 * the other pull requests, so the output is read whatever the exit code.
 */
const mergedNow = async (
  $: EngineInterface,
  refs: readonly string[],
  timeoutMs: number,
): Promise<Readonly<{ found: ReadonlySet<string>; isKnown: boolean }>> => {
  const { ordered, argv } = mergedQuery(refs);
  const stdout =
    ordered.length === 0
      ? ""
      : await $.process.run(argv, { timeoutMs }).then(
          (done) => done.stdout,
          () => "",
        );

  return {
    found: mergedOfResponse(ordered, stdout),
    isKnown: isMergeKnown(ordered, stdout),
  };
};

/** Reads the settings files again, for a tool or a command: the settings as the newest read to answer, this one or a later, found them. */
const reloadSettings = async ($: EngineInterface): Promise<Loaded> => {
  await dispatch($, { type: "settings-asked" });

  return loadedOf((await read($, pane)).settings);
};

/** The settings files merged, as `loadSettings` reads them; a read that throws says why, as a defaults file that can't be used does. */
const settingsFound = ($: EngineInterface): Promise<Loaded> =>
  attempt(() => loadSettings($)).catch(
    (error: unknown): Loaded => ({
      settings: null,
      effective: [],
      problems: [String(error)],
    }),
  );

/**
 * `kanban_outstanding`: the count line, the roll-up's draft and the open
 * Decide items over the window the count line reads, once `gh` has said
 * which of the Review items' pull requests not yet known merged have; a
 * merge joins the known ones, and a `gh` that says nothing leaves the
 * merges unknown, which the result says. Settings that can't be used say
 * why instead.
 */
const outstandingNow = async ($: EngineInterface): Promise<string> => {
  const { settings: s, problems } = await reloadSettings($);

  if (s === null) {
    return unreadText(problems.join("; "));
  }
  const turns = await turnsNow($);
  const known = new Set((await read($, pane)).merged);
  const { found, isKnown } = await mergedNow(
    $,
    pullRequestsToAsk(turns, s.counts.turns, known),
    s.counts["gh-timeout-ms"],
  );

  if (found.size > 0) {
    await dispatch($, { type: "merged-found", found: [...found] });
  }

  return outstandingText(turns, {
    window: s.counts.turns,
    width: s["roll-up"]["summary-width"],
    merged: new Set([...known, ...found]),
    isMergeKnown: isKnown,
  });
};

/** What a refresh's transcript read finds: the session's turns; or, for a read that fails or throws, why it couldn't read them. */
const transcriptFound = ($: EngineInterface): Promise<Found> =>
  attempt(() => turnsNow($)).then(
    (turns) => ({ turns }),
    (error: unknown) => ({ problem: String(error) }),
  );

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

/**
 * Rewrites the draft with `edit` for `item`, then, where that moved the item
 * out of Open with the ring on it, moves the ring on as `ringAfterMove`
 * says, so the person picks down the list without scrolling. The folds stay
 * as they are.
 */
const answerItem = async (
  $: EngineInterface,
  item: ListedItem,
  edit: (text: string) => string,
): Promise<void> => {
  const before = await paneNow($);
  await rewriteDraft($, edit);
  await update($, held, () =>
    heldAfterPick(item, branchOf(before.groups, item)),
  );
  const after = await paneNow($);
  const key = ringAfterMove(
    before.groups,
    after.groups,
    after.folded,
    item,
    after.ring,
  );

  if (key !== undefined) {
    await reveal($, { key }, "nearest");

    if (await ringTo($, key)) {
      await ringMoved($, key);
    }
  }
};

/** The ring landed on `key`: the element j and k count from, and a held item let go once the ring leaves it. */
const ringMoved = async ($: EngineInterface, key: string): Promise<void> => {
  await update($, focused, () => key);
  await update($, held, (now) => heldAfterFocus(now, key));
};

/** Writes the draft with the item's answer for `letter`, a `reassess` line kept last. */
const answer = ($: EngineInterface, item: DecideItem, letter: string) =>
  answerItem($, item, (text) =>
    reassessKept(text, (body) => choose(body, item, letter)),
  );

/** Writes the draft with the item's settling word, `word`, or takes the one there out, its note kept and a `reassess` line kept last. */
const pressWord = ($: EngineInterface, item: TodoItem, word: string) =>
  answerItem($, item, (text) =>
    reassessKept(text, (body) => toggledWord(body, item, word)),
  );

/** Writes the item's note into the draft, on a line of its own, a `reassess` line kept last. */
const note = ($: EngineInterface, item: ListedItem, said: string) =>
  answerItem($, item, (text) =>
    reassessKept(text, (body) => withNote(body, item, said)),
  );

/** Adds a `reassess` line at the draft's end, or takes the one there out. */
const toggleReassess = ($: EngineInterface) =>
  rewriteDraft($, toggledReassess);

/** `call()`'s promise, a synchronous throw in it turned into a rejection. */
const attempt = <T,>(call: () => T | Promise<T>): Promise<T> =>
  Promise.resolve().then(call);

/** `event` stepped in a single update of the pane's atom: the state written, and the effects of the step that wrote it. */
const stepNow = async ($: EngineInterface, event: Event): Promise<Stepped> => {
  // `update` may run its function again on a missed write: the step whose
  // state it wrote is the last it ran, taken once the write has landed.
  let attempted = undefined as Stepped | undefined;
  const written = await update($, pane, (state) => {
    attempted = paneStep(state, event);

    return attempted.state;
  });

  return { state: written, effects: attempted?.effects ?? [] };
};

/**
 * What a failure stepping `event` or running its effects does: the press
 * still under way or overtaken in `state` that it was for ends, saying why,
 * as the old `finally` freed Submit; a failure for no such press rejects,
 * as the old handlers' did.
 */
const failedOn = async (
  $: EngineInterface,
  event: Event,
  done: Stepped,
  error: unknown,
): Promise<void> => {
  const press = failingPress(done.state, event, done.effects);

  if (press === undefined) {
    throw error;
  }

  return dispatch($, { type: "press-failed", press, why: String(error) });
};

/** Runs `effects` in order, each prompt call's answer dispatched before the next, stopping at the first that fails. */
const runEffects = async (
  $: EngineInterface,
  event: Event,
  done: Stepped,
  effects: readonly Effect[],
): Promise<void> => {
  const [effect, ...rest] = effects;

  if (effect === undefined) {
    return;
  }
  const ran = await runEffect($, effect).then(
    (answer) => ({ answer }),
    (error: unknown) => ({ error }),
  );

  if ("error" in ran) {
    return failedOn($, event, done, ran.error);
  }
  if (ran.answer !== undefined) {
    await dispatch($, ran.answer);
  }

  return runEffects($, event, done, rest);
};

/**
 * The one way the pane's state changes: `event` stepped in a single update
 * of the pane's atom, then the effects it asked for run in order, each
 * prompt call's answer dispatched in turn. Resolves once they all have.
 * A step that fails, before anything is written, is judged by the state as
 * it stands; a transcript or settings read whose answer fails to step is
 * dropped, so no refresh waits on it.
 */
const dispatch = async ($: EngineInterface, event: Event): Promise<void> => {
  const done = await stepNow($, event).then(
    (stepped) => ({ stepped }),
    (error: unknown) => ({ error }),
  );

  if ("error" in done) {
    const dropped: Event | undefined =
      event.type === "transcript-read"
        ? { type: "read-dropped", refresh: event.refresh }
        : event.type === "settings-read"
          ? { type: "settings-dropped", read: event.read }
          : undefined;

    if (dropped !== undefined) {
      await dispatch($, dropped).catch(() => undefined);
    }
    const state = await attempt(() => read($, pane)).catch(() => INITIAL_PANE);

    return failedOn($, event, { state, effects: [] }, done.error);
  }

  return runEffects($, event, done.stepped, done.stepped.effects);
};

/**
 * Runs one effect `paneStep` asked for, and resolves to the event its
 * answer makes: under the press's number for a prompt call, and under the
 * refresh's for a transcript read, and the read's for the settings files.
 * A read that throws reads as an empty box, a put-back fill that throws as
 * not taken, and a submit that throws as refused, for why; emptying the
 * box that throws rejects, failing the press, as the box may have been
 * emptied. A transcript read that throws reads as one that couldn't read
 * the transcript, and a settings read that throws as files that can't be
 * used, saying why. `gh` is asked without
 * waiting for it, so the pane and the count line are drawn first; its
 * answer is dispatched once it comes, and one that fails changes nothing.
 */
const runEffect = async (
  $: EngineInterface,
  effect: Effect,
): Promise<Event | undefined> => {
  switch (effect.kind) {
    case "read-prompt":
      return {
        type: "prompt-read",
        press: effect.press,
        purpose: effect.purpose,
        text: await attempt(() => $.prompt.read()).then(
          (box) => box.text,
          () => "",
        ),
      };
    case "fill-prompt": {
      const filled = attempt(() =>
        $.prompt.fill({ text: effect.text, mode: effect.mode }),
      ).then((done) => done.isFilled);

      return {
        type: "prompt-filled",
        press: effect.press,
        purpose: effect.purpose,
        isFilled: await (effect.purpose === "put-back"
          ? filled.catch(() => false)
          : filled),
      };
    }
    case "submit-prompt": {
      const refusal = await attempt(() =>
        $.prompt.submit({ text: effect.text, asUser: true }),
      ).then(
        (done) => done.drop,
        (error: unknown) => String(error),
      );

      return {
        type: "prompt-submitted",
        press: effect.press,
        ...(refusal === undefined ? {} : { refusal }),
      };
    }
    case "close-pane":
      await attempt(() => closePane($));

      return undefined;
    case "set-draft":
      await attempt(() => update($, draft, () => effect.text));

      return undefined;
    case "read-settings":
      return {
        type: "settings-read",
        read: effect.read,
        loaded: await settingsFound($),
      };
    case "read-transcript":
      return {
        type: "transcript-read",
        refresh: effect.refresh,
        found: await transcriptFound($),
      };
    case "ask-merged":
      void attempt(() => mergedNow($, effect.refs, effect.timeoutMs))
        .then(({ found }) =>
          dispatch($, {
            type: "merged-found",
            found: [...found],
            asked: effect.asked,
          }),
        )
        .catch(() => undefined);

      return undefined;
    case "open-pane":
      await openPane($, false);

      return undefined;
    case "reveal":
      await reveal($, effect.to);

      return undefined;
    default:
      return effect satisfies never;
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
 * ✏️ Add a note under a reply: the pane, with the keyboard, every level its
 * item is under opened, its notes field in sight, the item above it, and
 * the ring on the field.
 * The field also takes the focus as the pane draws it, until the ring is
 * on it: a pane already open with the ring elsewhere moves it there.
 */
const openNotes = async ($: EngineInterface, item: ListedItem): Promise<void> => {
  await showLevels($, item);
  await openPane($, true, refOf(item));
  await reveal($, { key: notesKey(item) }, "end");

  if (await ringTo($, notesKey(item))) {
    await update($, noting, () => "");
  }
};

/**
 * j or k: the focus ring to the next or the previous item, or header, from
 * the one it's on, the pane scrolled to show it; nothing past either end.
 */
const step = async ($: EngineInterface, by: 1 | -1): Promise<void> => {
  const { stops } = await paneNow($);
  const key = steppedStop(stops, await read($, focused), by);

  if (key !== undefined) {
    await reveal($, { key }, "nearest");

    if (await ringTo($, key)) {
      await ringMoved($, key);
    }
  }
};

/** A click on a toggle, a branch's header, a turn's, a Done item's line or its box's title: that toggle flipped. */
const fold = ($: EngineInterface, toggle: Toggle) =>
  update($, folds, (now) => withToggled(now, toggle));

/** Every level `item` is under opened, to scroll to it: its branch, its turn there and, for a Done item, its box. */
const showLevels = async ($: EngineInterface, item: ListedItem): Promise<void> => {
  const branch = branchOf((await paneNow($)).groups, item);

  if (branch !== undefined) {
    await update($, folds, (now) => withItemShown(now, item, branch));
  }
};

/** Closes the pane; its notes field no longer waits for the focus, its ring is on nothing, no item is held, and its keys panel is closed. */
const closePane = async ($: EngineInterface): Promise<void> => {
  await update($, noting, () => "");
  await update($, focused, () => "");
  await update($, held, () => "");
  await update($, isKeysOpen, () => false);
  await $.ui.close({ id: PANE.id });
};

/** `? Keys`: the keys panel opened, or closed again. */
const toggleKeys = ($: EngineInterface) =>
  update($, isKeysOpen, (isOpen) => !isOpen);

/**
 * Reads the settings, the open items and the count line again, once the
 * transcript read and its result have been stepped; a turn's end's read
 * also takes out the answers Submit held when it began. `gh` may answer
 * later.
 */
const refresh = ($: EngineInterface, releases = false): Promise<void> =>
  dispatch($, { type: "refresh-asked", releases });

/** /answers: re-reads the open items and opens the pane with the keyboard, at the first item the draft doesn't answer. */
const reopen = async ($: EngineInterface): Promise<Raised> => {
  await refresh($);
  await dispatch($, { type: "seen" });
  await openPane($, true);
  const { shown, groups } = await paneNow($);
  const item = firstUnansweredIn(groups, await read($, draft));

  if (item !== undefined) {
    await showLevels($, item);
    await reveal($, { key: refOf(item) });
  }

  return shown;
};

/** A question's link pressed: its item shown, as showRef shows it. */
const showItem = ($: EngineInterface, href: string): Promise<void> =>
  showRef($, refOfLink(href));

/**
 * A link to the item `ref` names pressed, a question's or one between a
 * superseded item and the item that replaced it: the pane, with the
 * keyboard, scrolled to the item, every level it's under opened, as
 * showLevels opens them, and its box when it's Done.
 */
const showRef = async ($: EngineInterface, ref: string): Promise<void> => {
  const r = await shownNow($);
  const items = listedItemsOf(r);
  const item = items[itemOfRef(items, ref)];
  await openPane($, true);

  if (item !== undefined) {
    await showLevels($, item);
    await reveal($, { key: refOf(item) });
  }
};

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    // No turn runs as the session starts, no Submit holds the button, none
    // has a problem to say, no sent answer waits for a turn's end and the
    // ring is on nothing, though a reload mid-turn or mid-Submit may have
    // left them set; the refresh reads what a sent answer did. A Submit
    // under way finishes as it would have, overtaken, since a hook already
    // running when the plugin reloads still settles. Cleared before the hook
    // registers anything, so a turn.start or a Submit that lands while it
    // registers stays. What the reply lint found stays: a `/reload-plugins`
    // starts the session again in the same conversation, and the note's
    // conversation key keeps it from any other.
    await dispatch($, { type: "session-started" });
    await update($, focused, () => "");
    await update($, held, () => "");
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
    await $.tool.register({
      name: OUTSTANDING_TOOL,
      description: OUTSTANDING_DESCRIPTION,
      isDeferred: false,
      inputSchema: OUTSTANDING_SCHEMA,
    });
    await $.tool.register({
      name: LINT_TOOL,
      description: LINT_DESCRIPTION,
      isDeferred: false,
      inputSchema: LINT_SCHEMA,
    });
    const session = await $.session.id();
    await dispatch($, { type: "session-joined", session });
    void refresh($)
      .then(() => dispatch($, { type: "announced" }))
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

    return (await instructNow($)).isOwed ? withInstructions(built) : built;
  }).catch(async ($, e, next) => withInstructions(await next(e)));

  // The conversation ending, at a `/clear`, a resume or the session's own
  // end: what the reply lint found in it is for it alone, and no
  // `session.start` follows a `/clear` to clear it.
  on("session.end", async ($, e, next) => {
    await update($, lintNote, () => NO_LINT_NOTE);

    return next(e);
  });

  // A slash command's prompt may never reach the agent, so the instructions
  // wait for one that does; a prompt that doesn't enter leaves them owed.
  // What the reply lint found in the last final response goes in the same
  // prompt's context, while the prompt is in the conversation it was found
  // in, and waits the same way. A failure here never holds up the prompt.
  on("prompt.submit", async ($, e, next) => {
    if (e.command !== undefined) {
      return next(e);
    }
    const { isOwed: isInstructing, key } = await instructNow($);
    const held = await read($, lintNote);
    const note =
      held.text !== "" && held.conversation === key ? held.text : "";
    const added = [
      ...(isInstructing ? [INSTRUCTIONS] : []),
      ...(note === "" ? [] : [note]),
    ];

    if (added.length === 0) {
      return next(e);
    }
    const entered = await next({
      ...e,
      context: [...(e.context ?? []), ...added],
    });

    if (entered.drop !== undefined) {
      if (isInstructing) {
        await update($, instructed, () => "");
      }
    } else if (note !== "") {
      await update($, lintNote, (now) =>
        now.text === held.text && now.conversation === held.conversation
          ? NO_LINT_NOTE
          : now,
      );
    }

    return entered;
  }).catch(($, e, next) => next(e));

  on("command.run", { command: "answers-config" }, async ($) => {
    const { effective, problems } = await reloadSettings($);

    return { text: configText(effective, problems) };
  });

  on("command.run", { command: "answers" }, async ($) => ({
    text: answersText(await reopen($)),
  }));

  on("tool.call", { tool: TOOL_CALLED }, async ($, e) => {
    const items = itemsOf(e);
    await dispatch($, { type: "items-drawn", items });

    return { result: drewText(items, ignoredSupersedes(e)) };
  }).catch(() => ({
    result: "The buttons could not be drawn; the reply reads as before.",
  }));

  on("tool.call", { tool: OUTSTANDING_CALLED }, async ($) => ({
    result: await outstandingNow($),
  })).catch(($, e, next) => ({
    result: unreadText(next.error.message ?? next.error.kind),
  }));

  on("tool.call", { tool: LINT_CALLED }, async ($, e) => ({
    result: lintToolText(e),
  }));

  // A main-loop turn starting: Submit waits it out, and what the last
  // Submit said no longer applies.
  on("turn.start", async ($, e, next) => {
    const started = await next(e);

    if (e.agentId === undefined) {
      await dispatch($, { type: "turn-started", turn: e.turnId });
    }

    return started;
  });

  // A main-loop turn ending: it clears the running turn only where that is
  // this turn, so an earlier turn's late end leaves a later one running; and
  // the transcript read again confirms the answers Submit sent or puts their
  // items back among the open ones. Only the answers held when the read
  // began are taken out: a Submit pressed while it reads keeps its own, one
  // to the same item among them.
  // Then the reply lint, on an answer, while the `lint.turn-end` setting is
  // on: what it finds in one in the protocol's shape is shown beneath it,
  // after whatever a hook beneath showed there, and waits, keyed by the
  // conversation, for the next prompt's context, which hands it to the
  // agent. A clean answer, or one in no list's shape, clears what an
  // earlier one left waiting. A `/clear` that lands while the hook runs
  // moves the session to a new id, and the note, the old conversation's, is
  // then not written; a `/rewind` keeps the conversation's key, so its note
  // still reaches the next prompt.
  on("turn.complete", async ($, e, next) => {
    const done = await next(e);

    if (e.agentId !== undefined) {
      return done;
    }
    const session = await $.session.id();
    await dispatch($, { type: "turn-completed", turn: e.turnId });
    await refresh($, true);
    await dispatch($, { type: "announced" });
    // The refresh has read the settings again.
    const isLinting = (await settingsNow($))?.lint["turn-end"] === true;
    const note =
      isLinting && e.reason === "answer" && isKanbanReply(e.answer)
        ? replyLintText(lintReply(e.answer))
        : "";

    const held: LintNote =
      note === "" ? NO_LINT_NOTE : { conversation: await conversationNow($), text: note };

    if (e.reason === "answer" && (await $.session.id()) === session) {
      await update($, lintNote, () => held);
    }

    return note === ""
      ? done
      : {
          ...done,
          text: done.text === e.answer ? note : `${done.text}\n\n${note}`,
        };
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
      await ringMoved($, key).catch(() => undefined);
    }

    return moved;
  });

  on("prompt.change", async ($, e, next) => {
    const changed = await next(e);
    await update($, draft, () => e.text);

    return changed;
  });

  // The person typing or pasting raises `prompt.edit`, not `prompt.change`:
  // the draft is the box as the edit leaves it.
  on("prompt.edit", async ($, e, next) => {
    const edited = await next(e);
    await update($, draft, () => edited.text);

    return edited;
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
    const state = await read($, pane);
    const picked = answeredCount(shownOf(state), await read($, draft));

    return kanbanLine(
      elements,
      s,
      [
        { key: "counts", text: state.counts },
        { key: "picked", text: pickedText(picked, s.marks.note) },
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
    const raisedItems = decideItemsOf(r);
    const linked = linkedQuestions(e.props.text, raisedItems);

    if (linked.hrefs.length === 0) {
      return next(e);
    }

    const s = await settingsNow($);
    const elements = $.ui.resolve(e);
    const { Box, Markdown } = elements;
    const items = linkedItems(raisedItems, linked.hrefs);
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
  // branch, Open, Queued and Done, its turns newest first, then the footer.
  on("ui.render", { component: "Pane", requestId: PANE.id }, async ($, e) => {
    const elements = $.ui.resolve(e);
    const { Box, Text } = elements;
    const s = await settingsNow($);
    const { state, shown: r, text, ring, groups, folded, stops } =
      await paneNow($);

    if (s === null) {
      return <Text dimColor>{noItemsText(problemsOf(r))}</Text>;
    }

    const { isBusy, problem } = submitShown(state.submit);
    const drawn = BRANCHES.filter((branch) => groups[branch].length > 0);
    const notingNow = await read($, noting);
    const line = state.counts;
    const queuedCount = countOf(groups.queued);
    const openCount = countOf(groups.open) + queuedCount;

    return (
      <Box flexDirection="column">
        <Box
          key="header"
          marginBottom={LAYOUT.blockGap}
          columnGap={LAYOUT.controlGap}
          flexWrap="wrap"
          justifyContent="space-between"
        >
          <Box key="header-status" columnGap={LAYOUT.controlGap} flexWrap="wrap">
            {kanbanLine(elements, s, [{ key: "counts", text: line }])}
            {openCount === 0 ? null : (
              <Text key="answered">
                {answeredText(queuedCount, openCount)}
              </Text>
            )}
          </Box>
          <Box key="header-controls" columnGap={LAYOUT.controlGap}>
            {control(elements, {
              key: STEPS.previous,
              glyph: s.marks.buttons.previous,
              label: "Previous",
              hotkey: s.keys.previous,
              isInert: steppedStop(stops, ring, -1) === undefined,
              onPress: () => step($, -1),
            })}
            {control(elements, {
              key: STEPS.next,
              glyph: s.marks.buttons.next,
              label: "Next",
              hotkey: s.keys.next,
              isInert: steppedStop(stops, ring, 1) === undefined,
              onPress: () => step($, 1),
            })}
            {control(elements, {
              key: "keys",
              glyph: s.marks.buttons.help,
              label: "Keys",
              hotkey: s.keys.help,
              onPress: () => toggleKeys($),
            })}
            {control(elements, {
              key: "dismiss",
              glyph: s.marks.buttons.dismiss,
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
        {/* What a Submit a reload overtook said as it ended, on a line of
            its own, apart from what the pane says of the press since. */}
        {state.aside.said ? (
          <Text key="submit-overtaken" wrap="wrap">
            {state.aside.said}
          </Text>
        ) : null}
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
        {drawn.map((branch, n) =>
          branchSection(
            $,
            elements,
            s,
            branch,
            groups[branch],
            folded,
            n === 0 && openCount > 0 ? 0 : LAYOUT.blockGap,
            (group) =>
              listSections(elements, group, (items, key) =>
                branch === "done"
                  ? doneItems($, elements, s, r, items, key, folded, text)
                  : itemBoxes($, elements, s, r, items, {
                      key,
                      text,
                      isPane: true,
                      noting: notingNow,
                    }),
              ),
          ),
        )}
        <Box
          key="footer"
          marginTop={LAYOUT.blockGap}
          columnGap={LAYOUT.controlGap}
          flexWrap="wrap"
          justifyContent="space-between"
        >
          <Text key="draft-summary" wrap="wrap">
            {draftSummary(text)}
          </Text>
          <Box key="footer-controls" columnGap={LAYOUT.controlGap}>
            {/* A toggle: it adds `reassess` as the draft's last line, for
                Submit to send after any answers, or alone, and takes it out
                again; its glyph is the chosen mark while the line is there. */}
            {control(elements, {
              key: REASSESS,
              glyph: hasReassess(text)
                ? s.marks.chosen
                : s.marks.buttons.reassess,
              label: capitalized(REASSESS),
              hotkey: s.keys.reassess,
              onPress: () => toggleReassess($),
            })}
            {control(elements, {
              key: "submit",
              glyph: s.marks.buttons.submit,
              label: "Submit",
              hotkey: s.keys.submit,
              isInert: "skip" in submitStep(text, isBusy),
              onPress: () => dispatch($, { type: "submit-pressed" }),
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
 * The line carries on the count line, so its pieces part by the count
 * line's own separator, the spec's, and the two can't differ.
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
        `${s.marks.buttons.kanban} `,
        <Text key="kanban-word" color={s.colors.kanban}>
          Kanban
        </Text>,
      ])}
      {pieces
        .filter((p) => p.text !== "")
        .flatMap((p) => [
          <Text key={p.key === "counts" ? "divider" : `${p.key}-divider`} dimColor>
            {SPEC["roll-up"]["count-separator"]}
          </Text>,
          piece(p.key, p.text, [p.text]),
        ])}
    </Box>
  );
};

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
  const rows = keyRows(s.keys, s.marks.buttons);
  const width =
    Math.max(...rows.map((row) => cellWidth(row.key))) + LAYOUT.labelGap;

  return (
    <Box
      key="keys-panel"
      flexDirection="column"
      marginBottom={LAYOUT.blockGap}
    >
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
 * A line naming another item, `Superseded by <ref>` or `Supersedes <ref>`,
 * drawn underlined: a button that shows that item, as showRef does.
 */
const itemLink = (
  $: EngineInterface,
  elements: Pick<Elements, "Button" | "Text">,
  key: string,
  link: ItemLink,
) => {
  const { Button, Text } = elements;

  return (
    <Button key={key} label={link.text} plain dimColor onPress={() => showRef($, link.to)}>
      <Text key={`${key}-text`} dimColor underline>
        {link.text}
      </Text>
    </Button>
  );
};

/**
 * A Done item's one dim line in its open group, `▌🧠 Decide.1  <summary> ·
 * <what made it Done>`, the summary wrapping under its own start; a click on
 * it, the summary's button, opens the item's full box. Where what made it
 * Done is a link, the link follows the summary.
 */
const doneRow = (
  $: EngineInterface,
  elements: Elements,
  s: Settings,
  item: ListedItem,
  { line, link }: DoneRow,
) => {
  const { Box, Button, Text } = elements;
  const key = lineKey(item);
  const summary = (
    <Button
      key={key}
      label={item.summary}
      plain
      dimColor
      onPress={() => fold($, boxToggle(item))}
    >
      {line.text}
    </Button>
  );

  return (
    <Box key={`${refOf(item)}.row`}>
      <Text key={`${refOf(item)}.bar`} color={s.colors.settled}>
        {s.marks["settled-bar"]}
      </Text>
      {hanging(
        elements,
        key,
        {
          width: cellWidth(line.label) + LAYOUT.labelGap,
          node: <Text dimColor>{line.label}</Text>,
        },
        link === undefined ? (
          summary
        ) : (
          <Box key={`${key}-linked`} flexWrap="wrap">
            {summary}
            {itemLink($, elements, `${refOf(item)}.superseded-by`, link)}
          </Box>
        ),
      )}
    </Box>
  );
};

/**
 * A branch: its header, `▾ Open (3)`, `▾ Queued (1)` or `▸ Done (2)`, a
 * toggle, Open and Queued expanded at first and Done collapsed; once
 * expanded, each turn with an item in it, newest first, under its own
 * header, and in each what `body` draws of the turn's items there.
 */
const branchSection = (
  $: EngineInterface,
  elements: Elements,
  s: Settings,
  branch: Branch,
  groups: readonly TurnGroup[],
  folded: Folds,
  marginTop: number,
  body: (group: TurnGroup) => RenderNode,
) => {
  const { Box, Button } = elements;
  const count = countOf(groups);
  const toggle = branchToggle(branch);
  const isExpanded = isOpen(folded, toggle);

  return (
    <Box key={`${branch}-branch`} flexDirection="column" marginTop={marginTop}>
      <Button
        key={branch}
        label={countedLabel(BRANCH_NAMES[branch], count)}
        plain
        onPress={() => fold($, toggle)}
      >
        {branchHeader(branch, count, isExpanded, s.marks)}
      </Button>
      {isExpanded
        ? groups.map((group, n) =>
            turnSection(
              $,
              elements,
              s,
              group,
              folded,
              n === 0 ? 0 : LAYOUT.blockGap,
              () => body(group),
            ),
          )
        : null}
    </Box>
  );
};

/**
 * A turn's group in a branch: its faint header, `▾ ── 9efb08a1 ₋₂ (2) ──`,
 * a toggle that folds the group's items, in this branch alone; once
 * expanded, which it is at first, what `body` draws of its items.
 */
const turnSection = (
  $: EngineInterface,
  elements: Elements,
  s: Settings,
  group: TurnGroup,
  folded: Folds,
  marginTop: number,
  body: () => RenderNode,
) => {
  const { Box, Button } = elements;
  const toggle = turnToggle(group);
  const isExpanded = isOpen(folded, toggle);

  return (
    <Box key={`${group.key}-box`} flexDirection="column" marginTop={marginTop}>
      <Button
        key={group.key}
        label={countedLabel(group.label, group.items.length)}
        plain
        dimColor
        onPress={() => fold($, toggle)}
      >
        {turnHeader(group.label, group.items.length, isExpanded, s.marks)}
      </Button>
      {isExpanded ? body() : null}
    </Box>
  );
};

/**
 * A turn's group's items, list by list in the spec's order, each list's
 * run under a faint header naming it, `👉 Todo`, then what `body` draws of
 * the run's items, under `key`.
 */
const listSections = (
  elements: Pick<Elements, "Box" | "Text">,
  group: TurnGroup,
  body: (items: readonly ListedItem[], key: string) => RenderNode,
) => {
  const { Box, Text } = elements;

  return (
    <Box key={`${group.key}-lists`} flexDirection="column">
      {listRuns(group.items).map((run) => (
        <Box key={`${group.key}.${run.list.header}-list`} flexDirection="column">
          <Text key={`${group.key}.${run.list.header}`} dimColor>
            {run.header}
          </Text>
          {body(run.items, `${group.key}.${run.list.header}-items`)}
        </Box>
      ))}
    </Box>
  );
};

/**
 * A turn's Done items of one list: each one dim line, `▌🧠 Decide.1
 * <summary> · <what made it Done>`, which a click opens to the item's full
 * box, whose title closes it again.
 */
const doneItems = (
  $: EngineInterface,
  elements: Elements,
  s: Settings,
  r: Raised,
  items: readonly ListedItem[],
  key: string,
  folded: Folds,
  text: string,
) => {
  const { Box } = elements;

  return (
    <Box key={key} flexDirection="column">
      {items.map((item) =>
        isOpen(folded, boxToggle(item)) ? (
          <Box key={`${refOf(item)}.full`} flexDirection="column">
            {itemBoxes($, elements, s, r, [item], {
              key: `${refOf(item)}.boxes`,
              text,
              isPane: true,
              noting: "",
              onTitle: () => fold($, boxToggle(item)),
            })}
          </Box>
        ) : (
          doneRow(
            $,
            elements,
            s,
            item,
            doneRowOf(item, settlementOf(r, item), wordSaidBy(s.actions)),
          )
        ),
      )}
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
  items: readonly ListedItem[],
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
        const common = {
          title: itemTitle(item, isDone),
          ...boxLines(isDone, settlement, supersedesOf(r, item), wordSaidBy(s.actions)),
          link: (key: string, link: ItemLink) => itemLink($, elements, key, link),
          note: isDone ? "" : noteFor(at.text, item),
          isSettled: isDone,
          notes: notesMode({
            isSettled: isDone,
            isPane: at.isPane,
            isNoting: at.noting === refOf(item),
          }),
          keyOf: (part: string) => actionKey(item, part),
          onNote: (said: string) => (isDone ? undefined : note($, item, said)),
          onOpenNotes: () => openNotes($, item),
          ...(at.onTitle ? { onTitle: at.onTitle } : {}),
        };

        return (
          <Box
            key={refOf(item)}
            flexDirection="column"
            borderStyle={LAYOUT.border}
            borderColor={s.colors.border}
            borderDimColor={isDone}
            paddingX={LAYOUT.boxPadding}
          >
            {isDecide(item)
              ? itemView(elements, s, item, {
                  ...common,
                  chosen: lettersFor(at.text, item),
                  sent: sentLetters(settlement),
                  onPick: (letter) => answer($, item, letter),
                })
              : todoView(elements, s, item, {
                  ...common,
                  chosen: wordFor(at.text, item),
                  sent: sentWord(settlement),
                  onWord: (word) => pressWord($, item, word),
                })}
          </Box>
        );
      })}
    </Box>
  );
};

/** What both kinds of item box draw from: the title, what made the item Done, its links, the draft's note, the notes, the keys and the presses every item takes. */
type BoxView = {
  title: Readonly<{ label: string; summary: string }>;
  /** What made the item Done, the line under its title; empty while open, or where that's a link. */
  settled: string;
  /** The lines under it naming other items, each a link: the item that superseded it, then those it supersedes. */
  links: readonly ItemLink[];
  /** A link's line, as a button keyed `key`. */
  link: (key: string, link: ItemLink) => RenderNode;
  note: string;
  isSettled?: boolean;
  /** The notes: none, the field, the field taking the focus, or a button that opens the pane at it. */
  notes: NotesMode;
  keyOf: (part: string) => string;
  onNote: (note: string) => unknown;
  onOpenNotes: () => unknown;
  /** What a press on the title runs, which makes it a button; none, a plain line. */
  onTitle?: () => unknown;
};

/**
 * An item's title line, the label bold on its background, the summary
 * plain after it on the same line, wrapping under its own start; a Done
 * item's label is dimmed with the rest, with no background. With
 * `onTitle` the summary is a button that runs it.
 */
const titleRow = (
  elements: Elements,
  s: Settings,
  item: ListedItem,
  view: BoxView,
) => {
  const { Button, Text } = elements;
  const { colors } = s;
  const inline = inlineOf(elements, s);
  const dim = view.isSettled === true;
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

  return hanging(
    elements,
    `${ref}.title`,
    { width: cellWidth(view.title.label) + LAYOUT.titleGap, node: label },
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
  );
};

/** The lines under an item's title naming other items, each a link indented under it, keyed `<ref>.link.<to>`. */
const linkLines = (
  elements: Pick<Elements, "Box">,
  item: ListedItem,
  view: BoxView,
) => {
  const { Box } = elements;
  const ref = refOf(item);

  return view.links.map((link) => (
    <Box key={`${ref}.link.${link.to}-box`} marginLeft={LAYOUT.indent}>
      {view.link(`${ref}.link.${link.to}`, link)}
    </Box>
  ));
};

/** A text's code spans in the code colour, the rest plain, each a Text. */
const inlineOf =
  (elements: Pick<Elements, "Text">, s: Settings) =>
  (line: string, key: string, props: Record<string, unknown> = {}) => {
    const { Text } = elements;

    return codeSpans(line).map((part, n) => (
      <Text
        key={`${key}-${n}`}
        {...props}
        {...(part.isCode ? { color: s.colors.code } : {})}
      >
        {part.text}
      </Text>
    ));
  };

/** Lines indented under an item's title, dimmed while it's Done, each opening on `prefix` where it has one. */
const indentedLines = (
  elements: Pick<Elements, "Box" | "Text">,
  s: Settings,
  dim: boolean,
  texts: readonly string[] | undefined,
  key: string,
) => {
  const { Box, Text } = elements;
  const inline = inlineOf(elements, s);

  return (texts ?? []).map((line, n) => (
    <Box key={`${key}-${n}`} marginLeft={LAYOUT.indent}>
      <Text dimColor={dim} wrap="wrap">
        {inline(line, `${key}-${n}`)}
      </Text>
    </Box>
  ));
};

/** The notes under an item: none, a button that opens the pane at the field under a reply, or the field, taking the focus where `✏️ Add a note` asked for it. */
const notesView = (
  elements: Elements,
  s: Settings,
  item: ListedItem,
  view: BoxView,
  placeholder: string,
) => {
  const { Box, Button, Input } = elements;

  return view.notes === "none" ? null : view.notes === "button" ? (
    <Box key={`${view.keyOf("add-note")}-box`} marginLeft={LAYOUT.indent}>
      <Button
        key={view.keyOf("add-note")}
        label="Add a note"
        plain
        onPress={() => view.onOpenNotes()}
      >
        {`${s.marks.note} Add a note`}
      </Button>
    </Box>
  ) : (
    <Box key={`${notesKey(item)}-box`} marginLeft={LAYOUT.indent}>
      <Input
        key={notesKey(item)}
        label={`${s.marks.note} `}
        placeholder={placeholder}
        submitLabel="add to the draft"
        rows={noteRows(s.notes.rows)}
        {...(view.notes === "focused" ? { autoFocus: true as const } : {})}
        value={view.note}
        onSubmit={(said) => view.onNote(said)}
      />
    </Box>
  );
};

/**
 * One Todo item: the title, what made it Done, its body, the lines the
 * reply printed under its summary, then a row of its actions, each a plain
 * button, `Done` and `Skip`, opening on the chosen mark while the draft
 * gives its word, or the sent mark where the word made the item Done; then
 * the `Frees:` line, and the notes, whose note alone settles nothing. Its
 * actions write the draft whether it's open or Done.
 */
const todoView = (
  elements: Elements,
  s: Settings,
  item: TodoItem,
  view: BoxView & {
    /** The settling word the draft gives the item; empty for none. */
    chosen: string;
    /** The settling word that made the item Done; empty for none. */
    sent: string;
    onWord: (word: string) => unknown;
  },
) => {
  const { Box, Button, Text } = elements;
  const dim = view.isSettled === true;

  return (
    <Box flexDirection="column">
      {titleRow(elements, s, item, view)}
      {view.settled ? (
        <Box key="done-by" marginLeft={LAYOUT.indent}>
          <Text dimColor wrap="wrap">
            {view.settled}
          </Text>
        </Box>
      ) : null}
      {linkLines(elements, item, view)}
      {indentedLines(elements, s, dim, item.note, "note")}
      <Box
        key={`${refOf(item)}.actions`}
        marginLeft={LAYOUT.indent}
        columnGap={LAYOUT.controlGap}
        flexWrap="wrap"
      >
        {todoActions(s.actions).map(({ word, label }) => {
          const isChosen = view.chosen === word;

          return (
            <Button
              key={view.keyOf(word)}
              label={label}
              plain
              onPress={() => view.onWord(word)}
            >
              {`${actionLead({ chosen: isChosen, sent: view.sent === word }, s.marks)} `}
              <Text key={`${view.keyOf(word)}-label`} {...(isChosen ? { underline: true } : {})}>
                {label}
              </Text>
            </Button>
          );
        })}
      </Box>
      {indentedLines(elements, s, dim, freesLineOf(item.frees ?? []), "frees")}
      {notesView(elements, s, item, view, todoNotePlaceholder(todoActions(s.actions)))}
    </Box>
  );
};

/**
 * One Decide item as the skill writes it: the title, the note, each option
 * a plain button reading `glyph letter. name: consequence`, its ➕ and ➖
 * lines indented under it, always in full, and the `Frees:` line naming
 * what it frees, where it frees anything.
 */
const itemView = (
  elements: Elements,
  s: Settings,
  item: DecideItem,
  view: BoxView & {
    chosen: readonly string[];
    /** The letters the answer that made the item Done picked. */
    sent: readonly string[];
    onPick: (letter: string) => unknown;
  },
) => {
  const { Box, Button, Text } = elements;
  const { colors } = s;
  const dim = view.isSettled === true;
  const inline = inlineOf(elements, s);
  const lines = (
    prefix: string,
    texts: readonly string[] | undefined,
    background: string | undefined,
    key: string,
  ) =>
    (texts ?? []).map((line, n) => (
      <Box key={`${key}-${n}`} marginLeft={LAYOUT.indent}>
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
      {titleRow(elements, s, item, view)}
      {view.settled ? (
        <Box key="done-by" marginLeft={LAYOUT.indent}>
          <Text dimColor wrap="wrap">
            {view.settled}
          </Text>
        </Box>
      ) : null}
      {linkLines(elements, item, view)}
      {lines("", item.note, undefined, "note")}
      {item.options.map((option) => {
        const isChosen = view.chosen.includes(option.letter);
        // An option the answer that made the item Done picked: its own mark,
        // at full strength in the dimmed item, never underlined.
        const isSent = view.sent.includes(option.letter);
        // A chosen option's line is underlined, its glyph turned to the
        // chosen mark; nothing of it, and none of its ➕ and ➖ lines, is
        // highlighted.
        const pick = isChosen ? { underline: true } : {};
        const key = view.keyOf(option.letter);
        // A Button holds only text, so each of the option's lines is a button
        // of its own that picks it. They share a hover group, so the pointer
        // on any of them lights the gutter beside every one: a bar the
        // option's height. A Done item's gutter stays lit in the settled
        // colour instead beside an option its answer picked, is unlit
        // beside the others, and never hovers.
        const gutter = gutterStyle(
          { isSettled: dim, answered: view.sent, letter: option.letter, scope: key },
          colors,
        );
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
        // One line of the option: the gutter cell, a blank gap, then the
        // line, which wraps beside them; the gutter's Box stretches to the
        // line's rows.
        const row = (rowKey: string, content: RenderNode) => (
          <Box key={`${rowKey}-row`}>
            <Box
              key={`${rowKey}-gutter`}
              width={LAYOUT.gutter}
              marginRight={LAYOUT.gutterGap}
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
              <Box key={`${key}-${part}-${n}-box`} marginLeft={LAYOUT.indent} flexGrow={1} flexShrink={1}>
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
            marginLeft={LAYOUT.indent - LAYOUT.gutter - LAYOUT.gutterGap}
          >
            {row(
              key,
              led(
                key,
                optionLead(item, option.letter, { chosen: isChosen, sent: isSent }, s.marks),
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
      {lines("", freesLineOf(item.frees ?? []), undefined, "frees")}
      {notesView(elements, s, item, view, "Notes, or an answer in your own words")}
    </Box>
  );
};
