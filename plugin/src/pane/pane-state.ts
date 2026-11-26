// The pane's state as one value, and the one function that moves it: every
// change is an `Event`, and `step` answers with the next state and the
// effects to run, as data. The hooks run the effects and dispatch what each
// answers as another event, so data flows one way. No `$`, no I/O.
//
// The pane's areas move here one at a time, and Submit, the refresh and the
// settings have. The others keep their own atoms until they move, which
// `step` reads nothing of, and writes only when an effect says to.

import type {
  Aside,
  DecideItem,
  Held,
  Loaded,
  PaneState,
  Press,
  Raised,
  Reading,
  Refresh,
  Settings,
  SettingsState,
  Settlement,
  Submit,
  SubmitStage,
  Turn,
} from "../../types/index.d.ts";
import { openTodoIn } from "../items/listed.ts";
import {
  countLine,
  factsOf,
  openIn,
  pullRequestsToAsk,
} from "../items/outstanding.ts";
import {
  closesOnSubmit,
  emptyRaised,
  forSession,
  heldNow,
  refreshed,
  released,
  seen,
  sentOf,
  unread,
  unseen,
  withHeld,
  withItems,
  withSent,
  withoutRead,
} from "../items/raised.ts";
import {
  NOT_EMPTIED_TEXT,
  failedText,
  notPutBackText,
  notSentText,
  putBackText,
  submitStep,
} from "./view.ts";

/** Why the box is read: for Submit to send it, or to put a refused draft back after what it holds. */
export type ReadPurpose = "submit" | "put-back";

/** Why the box is filled: emptied before a draft is sent, or a refused draft put back. */
export type FillPurpose = "empty" | "put-back";

/**
 * What a prompt call a press made answered, by the press's number; or
 * that running the effects of one of its steps failed, with why.
 */
export type Answer = Readonly<
  | { type: "prompt-read"; press: number; purpose: ReadPurpose; text: string }
  | {
      type: "prompt-filled";
      press: number;
      purpose: FillPurpose;
      isFilled: boolean;
    }
  | { type: "prompt-submitted"; press: number; refusal?: string }
  | { type: "press-failed"; press: number; why: string }
>;

/** What a refresh's transcript read found: the session's turns, or why it couldn't read them. */
export type Found = Readonly<{ turns: readonly Turn[] } | { problem: string }>;

/** The refresh a `gh` answer is for, with the turns and the window its count line was drawn from. */
export type MergeAsked = Readonly<{
  refresh: number;
  turns: readonly Turn[];
  window: number;
}>;

/**
 * Every change to the pane's state: the person's presses, the engine's
 * events, and what an effect answered. `read-dropped` is a transcript read
 * whose answer couldn't be stepped, and `settings-dropped` a settings read
 * whose answer couldn't, so no refresh waits on either. `settings-asked` is
 * a read of the settings files that no refresh waits on, as a tool or a
 * command asks for.
 */
export type Event =
  | Readonly<
      | { type: "session-started" }
      | { type: "session-joined"; session: string }
      | { type: "turn-started"; turn: string }
      | { type: "turn-completed"; turn: string }
      | { type: "submit-pressed" }
      | { type: "items-drawn"; items: readonly DecideItem[] }
      | { type: "refresh-asked"; releases: boolean }
      | { type: "settings-asked" }
      | { type: "settings-read"; read: number; loaded: Loaded }
      | { type: "settings-dropped"; read: number }
      | { type: "transcript-read"; refresh: number; found: Found }
      | { type: "read-dropped"; refresh: number }
      | { type: "merged-found"; found: readonly string[]; asked?: MergeAsked }
      | { type: "announced" }
      | { type: "seen" }
    >
  | Answer;

/**
 * What `step` asks the hooks to do. Reading, filling and submitting the
 * prompt answer with an event, under the number of the press that asked;
 * reading the transcript and asking `gh` answer under the refresh's
 * number, and reading the settings files under the read's; the rest answer
 * nothing. `set-draft` writes the atom of an area not moved yet.
 */
export type Effect = Readonly<
  | { kind: "read-prompt"; press: number; purpose: ReadPurpose }
  | {
      kind: "fill-prompt";
      press: number;
      purpose: FillPurpose;
      text: string;
      mode: "replace" | "append";
    }
  | { kind: "submit-prompt"; press: number; text: string }
  | { kind: "close-pane" }
  | { kind: "set-draft"; text: string }
  | { kind: "read-settings"; read: number }
  | { kind: "read-transcript"; refresh: number }
  | {
      kind: "ask-merged";
      refs: readonly string[];
      timeoutMs: number;
      asked: MergeAsked;
    }
  | { kind: "open-pane" }
  | { kind: "reveal"; to: "start" }
>;

/** The next state, and the effects to run, in order. */
export type Stepped = Readonly<{ state: PaneState; effects: readonly Effect[] }>;

const IDLE: Submit = { tag: "idle" };
const NO_ASIDE: Aside = { said: "", presses: 0 };

/** The pane's state before anything has happened. */
export const INITIAL_PANE: PaneState = {
  presses: 0,
  submit: IDLE,
  overtaken: [],
  aside: NO_ASIDE,
  refresh: { asked: 0, shown: 0, reads: [] },
  raised: emptyRaised,
  sent: [],
  merged: [],
  counts: "",
  settings: { tag: "unread", asked: 0 },
};

/** The settings in effect, or none while none has been read or the defaults file can't be used. */
export const settingsOf = (settings: SettingsState): Settings | null =>
  settings.tag === "loaded" ? settings.settings : null;

/** The settings as the files' merge gives them: the settings in effect, where each came from, and what was wrong with the files; nothing before a read has answered. */
export const loadedOf = (settings: SettingsState): Loaded =>
  settings.tag === "loaded"
    ? { settings: settings.settings, effective: settings.effective, problems: settings.warnings }
    : { settings: null, effective: [], problems: settings.tag === "broken" ? settings.problems : [] };

/** What a file was wrong with, for the pane to say: a usable file's warnings, or why the defaults file is unusable. */
const settingsProblemsOf = (settings: SettingsState): readonly string[] => loadedOf(settings).problems;

/** The read whose answer the settings are, 0 before any has answered. */
const readOf = (settings: SettingsState): number =>
  settings.tag === "unread" ? 0 : settings.read;

/** The settings read `read` found, as the files' merge gave them, `asked` reads having been asked for. */
export const settingsFrom = (loaded: Loaded, asked: number, read: number): SettingsState =>
  loaded.settings === null
    ? { tag: "broken", asked, read, problems: loaded.problems }
    : {
        tag: "loaded",
        asked,
        read,
        settings: loaded.settings,
        effective: loaded.effective,
        warnings: loaded.problems,
      };

/** The `pane.close-when-all-submitted` setting; false while the settings can't be used. */
const isClosedWhenAllSubmitted = (settings: SettingsState): boolean =>
  settingsOf(settings)?.pane["close-when-all-submitted"] === true;

/** The raised items as the pane and a reply draw them: the answers Submit holds Done until the turn's end reads them. */
export const shownOf = (state: PaneState): Raised =>
  withSent(state.raised, heldNow(state.sent));

type Pressed = Extract<Submit, { tag: "pressed" }>;
type Sending = Extract<Press, { at: "sending" }>;

/** What Submit and its effects become. */
type SubmitStepped = Readonly<{ submit: Submit; effects: readonly Effect[] }>;

const stays = (submit: Submit): SubmitStepped => ({ submit, effects: [] });

/** The turn Submit knows to be running, if any. */
export const turnOf = (submit: Submit): string | undefined =>
  submit.tag === "idle" ? undefined : submit.turn;

/** Submit once a press ends saying `why`, with `turn` still running; idle or running when it says nothing. */
const ended = (why: string, turn: string | undefined): Submit =>
  why !== ""
    ? { tag: "refused", why, ...(turn === undefined ? {} : { turn }) }
    : turn === undefined
      ? IDLE
      : { tag: "running", turn };

/** A main-loop turn starting: Submit waits it out, and what the last press said no longer applies. A press under way keeps going, the turn noted. */
const turnStarted = (submit: Submit, turn: string): Submit =>
  submit.tag === "pressed"
    ? { ...submit, turn, said: "" }
    : { tag: "running", turn };

/** A main-loop turn ending: it clears only the turn it names, so a late end of an earlier turn leaves a later one running. */
const turnCompleted = (submit: Submit, turn: string): Submit =>
  turnOf(submit) !== turn
    ? submit
    : submit.tag === "running"
      ? IDLE
      : submit.tag === "refused"
        ? { tag: "refused", why: submit.why }
        : submit.tag === "pressed"
          ? { tag: "pressed", press: submit.press, said: submit.said }
          : submit;

/** Submit pressed: the next press reads the box, but only while no turn runs and no press is under way. */
const pressed = (state: PaneState): Stepped => {
  const { submit } = state;
  const press = state.presses + 1;

  return submit.tag === "idle" ||
    (submit.tag === "refused" && submit.turn === undefined)
    ? {
        state: {
          ...state,
          presses: press,
          submit: {
            tag: "pressed",
            press: { press, at: "reading" },
            said: submit.tag === "refused" ? submit.why : "",
          },
        },
        effects: [{ kind: "read-prompt", press, purpose: "submit" }],
      }
    : { state, effects: [] };
};

/**
 * Where a press goes on an answer: on to its next step, holding the
 * answers its draft sends Done; to its end, saying why, or nothing once
 * its draft went through; or to an end that says nothing new, its box of
 * blanks or a turn running when the box was read. A press that puts its
 * answers back releases its own holds, and no other press's.
 */
type Next = Readonly<{
  to: "next";
  press: Press;
  effects: readonly Effect[];
  holds?: readonly Settlement[];
  releases?: true;
}>;
type End = Readonly<{
  to: "end";
  why: string;
  effects: readonly Effect[];
  releases?: true;
}>;
type Moved = Next | End | Readonly<{ to: "skip" }>;

const ends = (why: string, effects: readonly Effect[] = []): End => ({
  to: "end",
  why,
  effects,
});

const next = (
  press: Sending,
  stage: SubmitStage,
  effects: readonly Effect[],
): Next => ({ to: "next", press: { ...press, stage }, effects });

/** The box read for a press: a box of blanks, or one read while a turn ran, sends nothing; one the engine would mangle stays with why; the rest is emptied to send. */
const readForSubmit = (
  press: number,
  text: string,
  isTurnRunning: boolean,
): Moved => {
  const step = submitStep(text, isTurnRunning);

  return "send" in step
    ? {
        to: "next",
        press: {
          press,
          at: "sending",
          draft: step.send,
          stage: { at: "emptying" },
        },
        effects: [
          {
            kind: "fill-prompt",
            press,
            purpose: "empty",
            text: "",
            mode: "replace",
          },
        ],
      }
    : "refuse" in step
      ? ends(step.refuse)
      : { to: "skip" };
};

/** The box emptied, or not: an emptied box sends the draft, its answers Done until the turn's end reads them; one that kept the draft sends nothing. */
const emptied = (press: Sending, isFilled: boolean, state: PaneState): Moved =>
  isFilled ? sending(press, sentOf(press.draft, shownOf(state))) : ends(NOT_EMPTIED_TEXT);

/** The draft sent, the box emptied: the answers it moves are Done, held under the press, until the turn's end reads them. */
const sending = (press: Sending, moved: readonly Settlement[]): Moved => ({
  ...next(press, { at: "submitting", moved }, [
    { kind: "set-draft", text: "" },
    { kind: "submit-prompt", press: press.press, text: press.draft },
  ]),
  holds: moved,
});

/**
 * The engine's answer to the draft sent: one it took ends the press, and
 * closes the pane when it leaves nothing open and the setting says to; one
 * it refused puts the press's own answers back among the open items and
 * reads the box to put the draft back.
 */
const submitted = (
  press: Sending,
  refusal: string | undefined,
  state: PaneState,
): Moved =>
  refusal === undefined
    ? ends(
        "",
        closesOnSubmit(
          state.raised,
          heldNow(state.sent),
          isClosedWhenAllSubmitted(state.settings),
        )
          ? [{ kind: "close-pane" }]
          : [],
      )
    : {
        ...next(press, { at: "reading-back", refusal }, [
          { kind: "read-prompt", press: press.press, purpose: "put-back" },
        ]),
        releases: true,
      };

/** The box read to put a refused draft back: the draft goes after what it holds. */
const readForPutBack = (press: Sending, refusal: string, box: string): Moved =>
  next(press, { at: "putting-back", refusal, box }, [
    {
      kind: "fill-prompt",
      press: press.press,
      purpose: "put-back",
      text: putBackText(box, press.draft),
      mode: "append",
    },
  ]);

/** The box taking a refused draft back, or not: the pane says why it wasn't sent, and the draft itself when the box couldn't take it. */
const putBack = (
  press: Sending,
  stage: Extract<SubmitStage, { at: "putting-back" }>,
  isFilled: boolean,
): Moved =>
  isFilled
    ? ends(notSentText(stage.refusal, stage.box !== ""), [
        {
          kind: "set-draft",
          text: `${stage.box}${putBackText(stage.box, press.draft)}`,
        },
      ])
    : ends(notPutBackText(stage.refusal, press.draft));

/** A step of the press failed: it ends, naming its draft once it has one, and puts back any answers it held Done. */
const failed = (press: Press, why: string): Moved => ({
  ...ends(press.at === "reading" ? failedText(why) : failedText(why, press.draft)),
  releases: true,
});

/** Where `press` goes on `answer`; undefined for an answer its stage didn't ask for, which is dropped. */
const advanced = (
  press: Press,
  answer: Answer,
  state: PaneState,
): Moved | undefined => {
  if (answer.type === "press-failed") {
    return failed(press, answer.why);
  }
  if (press.at === "reading") {
    return answer.type === "prompt-read" && answer.purpose === "submit"
      ? readForSubmit(press.press, answer.text, turnOf(state.submit) !== undefined)
      : undefined;
  }
  const { stage } = press;

  switch (stage.at) {
    case "emptying":
      return answer.type === "prompt-filled" && answer.purpose === "empty"
        ? emptied(press, answer.isFilled, state)
        : undefined;
    case "submitting":
      return answer.type === "prompt-submitted"
        ? submitted(press, answer.refusal, state)
        : undefined;
    case "reading-back":
      return answer.type === "prompt-read" && answer.purpose === "put-back"
        ? readForPutBack(press, stage.refusal, answer.text)
        : undefined;
    case "putting-back":
      return answer.type === "prompt-filled" && answer.purpose === "put-back"
        ? putBack(press, stage, answer.isFilled)
        : undefined;
  }
};

/** The answers held once press `press` has moved: its own put back, or its draft's held, every other press's left as they were. */
const heldAfter = (sent: readonly Held[], press: number, moved: Moved): readonly Held[] => {
  const kept = moved.to !== "skip" && moved.releases === true ? released(sent, press) : sent;

  return moved.to === "next" && moved.holds !== undefined
    ? withHeld(kept, press, moved.holds)
    : kept;
};

/**
 * The press under way moved: on, or ended with what it says, or ended
 * keeping what the pane said before it. An end, sent or not, clears what an
 * overtaken press said before this press was pressed, as this press's own
 * message now stands in its place. A press that sends nothing and says
 * nothing new, for a box of blanks or one read while a turn ran, keeps all
 * the pane said before it, what an overtaken press said among it.
 */
const foregroundMoved = (state: PaneState, submit: Pressed, moved: Moved): Stepped => {
  const press = submit.press.press;
  const s: SubmitStepped =
    moved.to === "next"
      ? { submit: { ...submit, press: moved.press }, effects: moved.effects }
      : moved.to === "end"
        ? { submit: ended(moved.why, submit.turn), effects: moved.effects }
        : stays(ended(submit.said, submit.turn));

  return {
    state: {
      ...state,
      submit: s.submit,
      sent: heldAfter(state.sent, press, moved),
      aside: moved.to === "end" && state.aside.presses < press ? NO_ASIDE : state.aside,
    },
    effects: s.effects,
  };
};

/**
 * An overtaken press moved: on, or gone, what it ended saying kept apart
 * from what the pane says of the press under way, which it leaves as it
 * is.
 */
const overtakenMoved = (state: PaneState, at: number, press: Press, moved: Moved): Stepped => {
  const sent = heldAfter(state.sent, press.press, moved);

  return moved.to === "next"
    ? {
        state: {
          ...state,
          sent,
          overtaken: state.overtaken.map((p, n) => (n === at ? moved.press : p)),
        },
        effects: moved.effects,
      }
    : {
        state: {
          ...state,
          sent,
          aside:
            moved.to === "end"
              ? { said: moved.why, presses: state.presses }
              : state.aside,
          overtaken: state.overtaken.filter((_, n) => n !== at),
        },
        effects: moved.to === "end" ? moved.effects : [],
      };
};

/**
 * An answer to a press's prompt call: it moves only the press whose number
 * it carries, the one under way or one a session's start overtook, and
 * only at the stage that asked for it. Any other is dropped. A box read
 * while a turn runs, as Submit knows it, sends nothing.
 */
const answered = (state: PaneState, answer: Answer): Stepped => {
  const { submit } = state;

  if (submit.tag === "pressed" && submit.press.press === answer.press) {
    const moved = advanced(submit.press, answer, state);

    return moved === undefined
      ? { state, effects: [] }
      : foregroundMoved(state, submit, moved);
  }
  const at = state.overtaken.findIndex((p) => p.press === answer.press);
  const press = state.overtaken[at];
  const moved =
    press === undefined ? undefined : advanced(press, answer, state);

  return moved === undefined || press === undefined
    ? { state, effects: [] }
    : overtakenMoved(state, at, press, moved);
};

const withSubmit = (state: PaneState, submit: Submit): Stepped => ({
  state: { ...state, submit },
  effects: [],
});

/** The settings files asked to be read again: the next read's number, and the effect that reads them. */
const settingsAsked = (state: PaneState): Readonly<{ state: PaneState; read: number }> => {
  const read = state.settings.asked + 1;

  return { state: { ...state, settings: { ...state.settings, asked: read } }, read };
};

/** The settings files read again for no refresh, as a tool or a command asks. */
const settingsAskedAlone = (state: PaneState): Stepped => {
  const asked = settingsAsked(state);

  return { state: asked.state, effects: [{ kind: "read-settings", read: asked.read }] };
};

/**
 * A refresh asked for: the next number reads the settings files, then the
 * transcript, beside any read still out, holding the answers Submit holds
 * now to take out once it has read them when it `releases`, as a turn's
 * end does.
 */
const refreshAsked = (state: PaneState, releases: boolean): Stepped => {
  const refresh = state.refresh.asked + 1;
  const asked = settingsAsked(state);

  return {
    state: {
      ...asked.state,
      refresh: {
        ...state.refresh,
        asked: refresh,
        reads: [
          ...state.refresh.reads,
          {
            refresh,
            releases: releases ? state.sent : [],
            on: { at: "settings", read: asked.read },
          },
        ],
      },
    },
    effects: [{ kind: "read-settings", read: asked.read }],
  };
};

/** The refresh once read `reading` has answered, or been dropped: nothing waits on it. */
const withoutReading = (refresh: Refresh, reading: Reading): Refresh => ({
  ...refresh,
  reads: refresh.reads.filter((r) => r !== reading),
});

/** Whether `reading` waits on settings read `read`. */
const waitsOn = (reading: Reading, read: number): boolean =>
  reading.on.at === "settings" && reading.on.read === read;

/**
 * Whether `reading`, its settings read answered, goes on to read the
 * transcript: while the settings, the newest read's, are usable, or, while
 * they aren't, when it holds answers to let go of, so whether a turn's end
 * lets go of them hangs on whether it read the transcript alone, not on
 * which settings read answered first.
 */
const readsOn = (reading: Reading, settings: SettingsState): boolean =>
  settings.tag === "loaded" || reading.releases.length > 0;

/**
 * A settings read answered. Its answer replaces the settings when it's
 * newer than the read they are; an older one's is dropped. A refresh that
 * waited on it then reads the transcript, as `readsOn` says; one that
 * doesn't reads nothing, and says what was wrong with the settings when
 * it's newer than the refresh shown.
 */
const settingsRead = (state: PaneState, read: number, loaded: Loaded): Stepped => {
  const settings =
    read > readOf(state.settings) && read <= state.settings.asked
      ? settingsFrom(loaded, state.settings.asked, read)
      : state.settings;
  const waiting = state.refresh.reads.filter((r) => waitsOn(r, read));
  const isSaid = waiting.some(
    (r) => !readsOn(r, settings) && r.refresh > state.refresh.shown,
  );

  return {
    state: {
      ...state,
      settings,
      refresh: {
        ...state.refresh,
        reads: state.refresh.reads.flatMap((r): readonly Reading[] =>
          !waitsOn(r, read) ? [r] : readsOn(r, settings) ? [{ ...r, on: { at: "transcript" } }] : [],
        ),
      },
      raised: isSaid ? unread(state.raised, "", settingsProblemsOf(settings)) : state.raised,
    },
    effects: waiting
      .filter((r) => readsOn(r, settings))
      .map((r): Effect => ({ kind: "read-transcript", refresh: r.refresh })),
  };
};

/** A settings read whose answer couldn't be stepped: no refresh waits on it, and nothing else changes. */
const settingsDropped = (state: PaneState, read: number): PaneState => ({
  ...state,
  refresh: {
    ...state.refresh,
    reads: state.refresh.reads.filter((r) => !waitsOn(r, read)),
  },
});

/**
 * The count line and the raised items from what the turns leave open,
 * given the pull requests known merged: open items, the Decide items the
 * `kanban_options` calls raised and the Todo items the replies' own lists
 * print, join the raised ones, raised ones no longer open settle, each as
 * its list's reading says, and `gh` is asked which of the Review
 * items' pull requests not yet known merged have, the pane and the count
 * line drawn without waiting for it.
 */
const settled = (
  state: PaneState,
  refresh: number,
  turns: readonly Turn[],
  { counts }: Settings,
  settingsProblems: readonly string[],
): Stepped => {
  const known = new Set(state.merged);
  const facts = factsOf(turns);
  const open = openIn(facts, counts.turns, known);
  const todo = openTodoIn(facts);
  const refs = pullRequestsToAsk(turns, counts.turns, known);

  return {
    state: {
      ...state,
      counts: open.counts,
      raised: refreshed(
        state.raised,
        [...open.items, ...todo.items],
        [...open.settlements, ...todo.settlements],
        settingsProblems,
        turns.map((turn) => turn.id),
      ),
    },
    effects:
      refs.length === 0
        ? []
        : [
            {
              kind: "ask-merged",
              refs,
              timeoutMs: counts["gh-timeout-ms"],
              asked: { refresh, turns, window: counts.turns },
            },
          ],
  };
};

/**
 * A refresh's transcript read answered. A read that read the transcript
 * takes out the answers Submit held when it was asked, whatever else
 * happens to it, and its result replaces what the items and the count line
 * show when it's newer than the read they show, drawn with the settings as
 * they are now; an older one's is dropped. A read that couldn't read the
 * transcript, or that answers while the settings can't be used, settles
 * nothing and shows no read, so an older read that did still lands after
 * it; it says why only when it's newer than the read shown. An answer to
 * no read waiting on the transcript is dropped whole.
 */
const transcriptRead = (
  state: PaneState,
  event: Extract<Event, { type: "transcript-read" }>,
): Stepped => {
  const reading = state.refresh.reads.find(
    (r) => r.refresh === event.refresh && r.on.at === "transcript",
  );

  if (reading === undefined) {
    return { state, effects: [] };
  }
  const after: PaneState = {
    ...state,
    sent:
      "turns" in event.found
        ? withoutRead(state.sent, reading.releases)
        : state.sent,
    refresh: withoutReading(state.refresh, reading),
  };
  const settings = settingsOf(state.settings);
  const settingsProblems = settingsProblemsOf(state.settings);

  return event.refresh <= state.refresh.shown
    ? { state: after, effects: [] }
    : "turns" in event.found && settings !== null
      ? settled(
          { ...after, refresh: { ...after.refresh, shown: event.refresh } },
          event.refresh,
          event.found.turns,
          settings,
          settingsProblems,
        )
      : {
          state: {
            ...after,
            raised: unread(
              after.raised,
              "problem" in event.found ? event.found.problem : "",
              settingsProblems,
            ),
          },
          effects: [],
        };
};

/** A transcript read whose answer couldn't be stepped: nothing waits on it, and nothing else changes; a refresh still waiting on its settings read isn't one. */
const readDropped = (state: PaneState, refresh: number): PaneState => {
  const reading = state.refresh.reads.find(
    (r) => r.refresh === refresh && r.on.at === "transcript",
  );

  return reading === undefined
    ? state
    : { ...state, refresh: withoutReading(state.refresh, reading) };
};

/**
 * `gh` named pull requests merged: they join the known ones, and, for a
 * refresh's ask, redraw the count line from that refresh's turns while no
 * later refresh has been asked for; one that has reads the merges itself.
 * The raised items don't hang on merges, so they stay.
 */
const mergedFound = (
  state: PaneState,
  found: readonly string[],
  asked: MergeAsked | undefined,
): Stepped => {
  const merged = [...new Set([...state.merged, ...found])].sort();

  return found.length === 0
    ? { state, effects: [] }
    : {
        state: {
          ...state,
          merged,
          counts:
            asked !== undefined && asked.refresh === state.refresh.asked
              ? countLine(asked.turns, asked.window, new Set(merged))
              : state.counts,
        },
        effects: [],
      };
};

/** A session's start or a turn's end looked at the items: the pane opens at its top, the newest turn, when an item is open that it hasn't been opened over. */
const announced = (state: PaneState): Stepped => ({
  state: { ...state, raised: seen(state.raised) },
  effects:
    unseen(state.raised).length > 0
      ? [{ kind: "open-pane" }, { kind: "reveal", to: "start" }]
      : [],
});

/** The pane's state after `event`, and the effects to run for it, in order. */
export const step = (state: PaneState, event: Event): Stepped => {
  switch (event.type) {
    case "session-started":
      // No turn runs, nothing is said and no sent answer waits for a turn's
      // end as a session starts: the refresh reads what a sent answer did.
      // A press under way finishes, overtaken.
      return {
        state: {
          ...state,
          submit: IDLE,
          aside: NO_ASIDE,
          sent: [],
          overtaken:
            state.submit.tag === "pressed"
              ? [...state.overtaken, state.submit.press]
              : state.overtaken,
        },
        effects: [],
      };
    case "session-joined":
      // Another session's items, and the answers held for them, are gone,
      // and a read still out read that session's transcript: the reads
      // asked so far count as shown, so each is dropped as it answers.
      return {
        state:
          state.raised.session === event.session
            ? state
            : {
                ...state,
                raised: forSession(state.raised, event.session),
                sent: [],
                refresh: { ...state.refresh, shown: state.refresh.asked },
              },
        effects: [],
      };
    case "turn-started":
      return {
        state: {
          ...withSubmit(state, turnStarted(state.submit, event.turn)).state,
          aside: NO_ASIDE,
        },
        effects: [],
      };
    case "turn-completed":
      return withSubmit(state, turnCompleted(state.submit, event.turn));
    case "submit-pressed":
      return pressed(state);
    case "items-drawn":
      return {
        state: { ...state, raised: withItems(state.raised, event.items) },
        effects: [],
      };
    case "refresh-asked":
      return refreshAsked(state, event.releases);
    case "settings-asked":
      return settingsAskedAlone(state);
    case "settings-read":
      return settingsRead(state, event.read, event.loaded);
    case "settings-dropped":
      return { state: settingsDropped(state, event.read), effects: [] };
    case "transcript-read":
      return transcriptRead(state, event);
    case "read-dropped":
      return { state: readDropped(state, event.refresh), effects: [] };
    case "merged-found":
      return mergedFound(state, event.found, event.asked);
    case "announced":
      return announced(state);
    case "seen":
      return { state: { ...state, raised: seen(state.raised) }, effects: [] };
    default:
      return answered(state, event);
  }
};

/** Whether press `press` is under way in `state`, or overtaken and finishing. */
const isLive = (state: PaneState, press: number): boolean =>
  (state.submit.tag === "pressed" && state.submit.press.press === press) ||
  state.overtaken.some((p) => p.press === press);

/**
 * The press to end when stepping `event` or running its effects failed,
 * given `state`, the one written for it: the press the effects asked a
 * prompt call for, else the one whose answer `event` is, while that press
 * is under way or overtaken in `state`. None for a press already ended, or
 * a failure already ending one, so the failure is the caller's.
 */
export const failingPress = (
  state: PaneState,
  event: Event,
  effects: readonly Effect[],
): number | undefined => {
  const press =
    event.type === "press-failed"
      ? undefined
      : (effects.flatMap((e) => ("press" in e ? [e.press] : []))[0] ??
        ("press" in event ? event.press : undefined));

  return press !== undefined && isLive(state, press) ? press : undefined;
};

/** What Submit shows: whether a press would do nothing now, and what the pane says of the last one. */
export const submitShown = (
  submit: Submit,
): Readonly<{ isBusy: boolean; problem: string }> => ({
  isBusy:
    submit.tag === "running" ||
    submit.tag === "pressed" ||
    (submit.tag === "refused" && submit.turn !== undefined),
  problem:
    submit.tag === "refused"
      ? submit.why
      : submit.tag === "pressed"
        ? submit.said
        : "",
});
