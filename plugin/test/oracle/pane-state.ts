// The settings' differential test's oracle for the step function: `step`
// as it was while the settings were an atom of their own, copied from
// plugin/src/pane/pane-state.ts at 6784a3e. It read the close setting from
// `Outside`, which the hooks read from the `settings` atom, and a refresh's
// transcript read brought the count line's settings and the files'
// problems with it, read just before the transcript.
//
// Where the copy departs from the file it was taken from: the types it
// declared on PaneState, Reading and Refresh, which have since changed, are
// declared here as they were, and its imports reach src/ from here.
// `failingPress` and `submitShown`, which the hooks used beside it, are
// left out, and most doc comments are trimmed; the code is as it was.
//
// Temporary: deleted with the oracles once the last of the pane's areas has
// moved into src/pane/pane-state.ts.

import type {
  Aside,
  DecideItem,
  Held,
  PaneState,
  Press,
  Raised,
  Settings,
  Settlement,
  Submit,
  SubmitStage,
  Turn,
} from "../../types/index.d.ts";
import {
  countLine,
  openOf,
  pullRequestsToAsk,
} from "../../src/items/outstanding.ts";
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
} from "../../src/items/raised.ts";
import {
  NOT_EMPTIED_TEXT,
  failedText,
  notPutBackText,
  notSentText,
  putBackText,
  submitStep,
} from "../../src/pane/view.ts";

/** A transcript read a refresh asked for that hasn't answered, as 6784a3e had it. */
export type Reading = Readonly<{ refresh: number; releases: readonly Held[] }>;

/** The refresh, as 6784a3e had it. */
export type Refresh = Readonly<{
  asked: number;
  shown: number;
  reads: readonly Reading[];
}>;

/** The pane's state, as 6784a3e had it: no settings. */
export type OldPaneState = Readonly<
  Omit<PaneState, "settings" | "refresh"> & { refresh: Refresh }
>;

type PaneStateOf = OldPaneState;

/** Why the box is read: for Submit to send it, or to put a refused draft back after what it holds. */
export type ReadPurpose = "submit" | "put-back";

/** Why the box is filled: emptied before a draft is sent, or a refused draft put back. */
export type FillPurpose = "empty" | "put-back";

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

/** What a refresh's transcript read found: the session's turns, with the count line's settings; or why it couldn't read them, empty while the settings can't be used. */
export type Found = Readonly<
  { turns: readonly Turn[]; counts: Settings["counts"] } | { problem: string }
>;

export type MergeAsked = Readonly<{
  refresh: number;
  turns: readonly Turn[];
  window: number;
}>;

export type Event =
  | Readonly<
      | { type: "session-started" }
      | { type: "session-joined"; session: string }
      | { type: "turn-started"; turn: string }
      | { type: "turn-completed"; turn: string }
      | { type: "submit-pressed" }
      | { type: "items-drawn"; items: readonly DecideItem[] }
      | { type: "refresh-asked"; releases: boolean }
      | {
          type: "transcript-read";
          refresh: number;
          found: Found;
          warnings: readonly string[];
        }
      | { type: "read-dropped"; refresh: number }
      | { type: "merged-found"; found: readonly string[]; asked?: MergeAsked }
      | { type: "announced" }
      | { type: "seen" }
    >
  | Answer;

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

/** What `step` reads of the areas whose state is still in atoms of their own. */
export type Outside = Readonly<{
  /** The `pane.close-when-all-submitted` setting; false while the settings can't be used. */
  isClosedWhenAllSubmitted: boolean;
}>;

/** The outside areas as nothing: what a failed press is stepped with, as ending it reads none of them. */
export const NO_OUTSIDE: Outside = { isClosedWhenAllSubmitted: false };

export type Stepped = Readonly<{ state: PaneStateOf; effects: readonly Effect[] }>;

const IDLE: Submit = { tag: "idle" };
const NO_ASIDE: Aside = { said: "", presses: 0 };

/** The pane's state before anything has happened. */
export const INITIAL_PANE: PaneStateOf = {
  presses: 0,
  submit: IDLE,
  overtaken: [],
  aside: NO_ASIDE,
  refresh: { asked: 0, shown: 0, reads: [] },
  raised: emptyRaised,
  sent: [],
  merged: [],
  counts: "",
};

export const shownOf = (state: PaneStateOf): Raised =>
  withSent(state.raised, heldNow(state.sent));

type Pressed = Extract<Submit, { tag: "pressed" }>;
type Sending = Extract<Press, { at: "sending" }>;

type SubmitStepped = Readonly<{ submit: Submit; effects: readonly Effect[] }>;

const stays = (submit: Submit): SubmitStepped => ({ submit, effects: [] });

export const turnOf = (submit: Submit): string | undefined =>
  submit.tag === "idle" ? undefined : submit.turn;

const ended = (why: string, turn: string | undefined): Submit =>
  why !== ""
    ? { tag: "refused", why, ...(turn === undefined ? {} : { turn }) }
    : turn === undefined
      ? IDLE
      : { tag: "running", turn };

const turnStarted = (submit: Submit, turn: string): Submit =>
  submit.tag === "pressed"
    ? { ...submit, turn, said: "" }
    : { tag: "running", turn };

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

const pressed = (state: PaneStateOf): Stepped => {
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

const emptied = (press: Sending, isFilled: boolean, state: PaneStateOf): Moved =>
  isFilled ? sending(press, sentOf(press.draft, shownOf(state))) : ends(NOT_EMPTIED_TEXT);

const sending = (press: Sending, moved: readonly Settlement[]): Moved => ({
  ...next(press, { at: "submitting", moved }, [
    { kind: "set-draft", text: "" },
    { kind: "submit-prompt", press: press.press, text: press.draft },
  ]),
  holds: moved,
});

const submitted = (
  press: Sending,
  refusal: string | undefined,
  state: PaneStateOf,
  outside: Outside,
): Moved =>
  refusal === undefined
    ? ends(
        "",
        closesOnSubmit(
          state.raised,
          heldNow(state.sent),
          outside.isClosedWhenAllSubmitted,
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

const failed = (press: Press, why: string): Moved => ({
  ...ends(press.at === "reading" ? failedText(why) : failedText(why, press.draft)),
  releases: true,
});

const advanced = (
  press: Press,
  answer: Answer,
  state: PaneStateOf,
  outside: Outside,
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
        ? submitted(press, answer.refusal, state, outside)
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

const heldAfter = (sent: readonly Held[], press: number, moved: Moved): readonly Held[] => {
  const kept = moved.to !== "skip" && moved.releases === true ? released(sent, press) : sent;

  return moved.to === "next" && moved.holds !== undefined
    ? withHeld(kept, press, moved.holds)
    : kept;
};

const foregroundMoved = (state: PaneStateOf, submit: Pressed, moved: Moved): Stepped => {
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

const overtakenMoved = (state: PaneStateOf, at: number, press: Press, moved: Moved): Stepped => {
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

const answered = (state: PaneStateOf, answer: Answer, outside: Outside): Stepped => {
  const { submit } = state;

  if (submit.tag === "pressed" && submit.press.press === answer.press) {
    const moved = advanced(submit.press, answer, state, outside);

    return moved === undefined
      ? { state, effects: [] }
      : foregroundMoved(state, submit, moved);
  }
  const at = state.overtaken.findIndex((p) => p.press === answer.press);
  const press = state.overtaken[at];
  const moved =
    press === undefined ? undefined : advanced(press, answer, state, outside);

  return moved === undefined || press === undefined
    ? { state, effects: [] }
    : overtakenMoved(state, at, press, moved);
};

const withSubmit = (state: PaneStateOf, submit: Submit): Stepped => ({
  state: { ...state, submit },
  effects: [],
});

const refreshAsked = (state: PaneStateOf, releases: boolean): Stepped => {
  const refresh = state.refresh.asked + 1;

  return {
    state: {
      ...state,
      refresh: {
        ...state.refresh,
        asked: refresh,
        reads: [
          ...state.refresh.reads,
          { refresh, releases: releases ? state.sent : [] },
        ],
      },
    },
    effects: [{ kind: "read-transcript", refresh }],
  };
};

const withoutReading = (refresh: Refresh, reading: Reading): Refresh => ({
  ...refresh,
  reads: refresh.reads.filter((r) => r !== reading),
});

const settled = (
  state: PaneStateOf,
  refresh: number,
  found: Extract<Found, { turns: readonly Turn[] }>,
  warnings: readonly string[],
): Stepped => {
  const { turns, counts } = found;
  const known = new Set(state.merged);
  const open = openOf(turns, counts.turns, known);
  const refs = pullRequestsToAsk(turns, counts.turns, known);

  return {
    state: {
      ...state,
      counts: open.counts,
      raised: refreshed(
        state.raised,
        open.items,
        open.settlements,
        warnings,
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

const transcriptRead = (
  state: PaneStateOf,
  event: Extract<Event, { type: "transcript-read" }>,
): Stepped => {
  const reading = state.refresh.reads.find((r) => r.refresh === event.refresh);

  if (reading === undefined) {
    return { state, effects: [] };
  }
  const after: PaneStateOf = {
    ...state,
    sent:
      "turns" in event.found
        ? withoutRead(state.sent, reading.releases)
        : state.sent,
    refresh: withoutReading(state.refresh, reading),
  };

  return event.refresh <= state.refresh.shown
    ? { state: after, effects: [] }
    : "turns" in event.found
      ? settled(
          { ...after, refresh: { ...after.refresh, shown: event.refresh } },
          event.refresh,
          event.found,
          event.warnings,
        )
      : {
          state: {
            ...after,
            raised: unread(after.raised, event.found.problem, event.warnings),
          },
          effects: [],
        };
};

const readDropped = (state: PaneStateOf, refresh: number): PaneStateOf => {
  const reading = state.refresh.reads.find((r) => r.refresh === refresh);

  return reading === undefined
    ? state
    : { ...state, refresh: withoutReading(state.refresh, reading) };
};

const mergedFound = (
  state: PaneStateOf,
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

const announced = (state: PaneStateOf): Stepped => ({
  state: { ...state, raised: seen(state.raised) },
  effects:
    unseen(state.raised).length > 0
      ? [{ kind: "open-pane" }, { kind: "reveal", to: "start" }]
      : [],
});

/** The pane's state after `event`, and the effects to run for it, in order, as 6784a3e stepped them. */
export const step = (
  state: PaneStateOf,
  event: Event,
  outside: Outside,
): Stepped => {
  switch (event.type) {
    case "session-started":
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
      return answered(state, event, outside);
  }
};

/** Whether `step` reads `Outside` for `event`: only the engine's answer to the draft, for whether the pane closes. */
export const readsOutside = (event: Event): boolean =>
  event.type === "prompt-submitted";
