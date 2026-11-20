// The pane's state as one value, and the one function that moves it: every
// change is an `Event`, and `step` answers with the next state and the
// effects to run, as data. The hooks run the effects and dispatch what each
// answers as another event, so data flows one way. No `$`, no I/O.
//
// The pane's areas move here one at a time, and Submit has. The others keep
// their own atoms until they move: the hooks read what `step` needs of them
// into `Outside`, and write them when an effect says to.

import type {
  PaneState,
  Press,
  Raised,
  Settlement,
  Submit,
  SubmitStage,
} from "../../types/index.d.ts";
import {
  closesOnSubmit,
  emptyRaised,
  sentOf,
  withSent,
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

/**
 * Every change to the pane's state: the person's presses, the engine's
 * events, and what an effect answered.
 */
export type Event =
  | Readonly<
      | { type: "session-started" }
      | { type: "turn-started"; turn: string }
      | { type: "turn-completed"; turn: string }
      | { type: "submit-pressed" }
    >
  | Answer;

/**
 * What `step` asks the hooks to do. Reading, filling and submitting the
 * prompt answer with an event, under the number of the press that asked;
 * the rest answer nothing. `set-draft`, `hold-sent` and `release-sent`
 * write the atoms of areas not moved yet.
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
  | { kind: "hold-sent"; moved: readonly Settlement[] }
  | { kind: "release-sent"; moved: readonly Settlement[] }
>;

/** What `step` reads of the areas whose state is still in atoms of their own. */
export type Outside = Readonly<{
  raised: Raised;
  /** The answers Submit sent that the turn's end hasn't read yet. */
  sent: readonly Settlement[];
  /** The `pane.close-when-all-submitted` setting; false while the settings can't be used. */
  isClosedWhenAllSubmitted: boolean;
}>;

/** The outside areas as nothing: what a failed press is stepped with, as ending it reads none of them. */
export const NO_OUTSIDE: Outside = {
  raised: emptyRaised,
  sent: [],
  isClosedWhenAllSubmitted: false,
};

/** The next state, and the effects to run, in order. */
export type Stepped = Readonly<{ state: PaneState; effects: readonly Effect[] }>;

const IDLE: Submit = { tag: "idle" };

/** The pane's state before anything has happened. */
export const INITIAL_PANE: PaneState = {
  presses: 0,
  submit: IDLE,
  overtaken: [],
};

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

/** Submit once an overtaken press ends saying `why`: what the pane says is the last press's to end, as when they shared one line. */
const saying = (submit: Submit, why: string): Submit =>
  submit.tag === "pressed" ? { ...submit, said: why } : ended(why, turnOf(submit));

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
 * Where a press goes on an answer: on to its next step; to its end, saying
 * why, or nothing once its draft went through; or to an end that says
 * nothing new, its box of blanks or a turn running when the box was read.
 */
type Moved = Readonly<
  | { to: "next"; press: Press; effects: readonly Effect[] }
  | { to: "end"; why: string; effects: readonly Effect[] }
  | { to: "skip" }
>;

const ends = (why: string, effects: readonly Effect[] = []): Moved => ({
  to: "end",
  why,
  effects,
});

const next = (
  press: Sending,
  stage: SubmitStage,
  effects: readonly Effect[],
): Moved => ({ to: "next", press: { ...press, stage }, effects });

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
const emptied = (press: Sending, isFilled: boolean, outside: Outside): Moved =>
  isFilled
    ? sending(press, sentOf(press.draft, withSent(outside.raised, outside.sent)))
    : ends(NOT_EMPTIED_TEXT);

/** The draft sent, the box emptied: the answers it moves are Done until the turn's end reads them. */
const sending = (press: Sending, moved: readonly Settlement[]): Moved =>
  next(press, { at: "submitting", moved }, [
    { kind: "set-draft", text: "" },
    { kind: "hold-sent", moved },
    { kind: "submit-prompt", press: press.press, text: press.draft },
  ]);

/**
 * The engine's answer to the draft sent: one it took ends the press, and
 * closes the pane when it leaves nothing open and the setting says to; one
 * it refused puts its answers back among the open items and reads the box
 * to put the draft back.
 */
const submitted = (
  press: Sending,
  moved: readonly Settlement[],
  refusal: string | undefined,
  outside: Outside,
): Moved =>
  refusal === undefined
    ? ends(
        "",
        closesOnSubmit(
          outside.raised,
          outside.sent,
          outside.isClosedWhenAllSubmitted,
        )
          ? [{ kind: "close-pane" }]
          : [],
      )
    : next(press, { at: "reading-back", refusal }, [
        { kind: "release-sent", moved },
        { kind: "read-prompt", press: press.press, purpose: "put-back" },
      ]);

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
const failed = (press: Press, why: string): Moved =>
  press.at === "reading"
    ? ends(failedText(why))
    : ends(
        failedText(why, press.draft),
        press.stage.at === "submitting"
          ? [{ kind: "release-sent", moved: press.stage.moved }]
          : [],
      );

/** Where `press` goes on `answer`; undefined for an answer its stage didn't ask for, which is dropped. */
const advanced = (
  press: Press,
  answer: Answer,
  isTurnRunning: boolean,
  outside: Outside,
): Moved | undefined => {
  if (answer.type === "press-failed") {
    return failed(press, answer.why);
  }
  if (press.at === "reading") {
    return answer.type === "prompt-read" && answer.purpose === "submit"
      ? readForSubmit(press.press, answer.text, isTurnRunning)
      : undefined;
  }
  const { stage } = press;

  switch (stage.at) {
    case "emptying":
      return answer.type === "prompt-filled" && answer.purpose === "empty"
        ? emptied(press, answer.isFilled, outside)
        : undefined;
    case "submitting":
      return answer.type === "prompt-submitted"
        ? submitted(press, stage.moved, answer.refusal, outside)
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

/** The press under way moved: on, or ended with what it says, or ended keeping what the pane said before it. */
const foregroundMoved = (submit: Pressed, moved: Moved): SubmitStepped =>
  moved.to === "next"
    ? { submit: { ...submit, press: moved.press }, effects: moved.effects }
    : moved.to === "end"
      ? { submit: ended(moved.why, submit.turn), effects: moved.effects }
      : stays(ended(submit.said, submit.turn));

/** An overtaken press moved: on, or gone, what it ended saying now what the pane says. */
const overtakenMoved = (state: PaneState, at: number, moved: Moved): Stepped =>
  moved.to === "next"
    ? {
        state: {
          ...state,
          overtaken: state.overtaken.map((p, n) => (n === at ? moved.press : p)),
        },
        effects: moved.effects,
      }
    : {
        state: {
          ...state,
          submit:
            moved.to === "end" ? saying(state.submit, moved.why) : state.submit,
          overtaken: state.overtaken.filter((_, n) => n !== at),
        },
        effects: moved.to === "end" ? moved.effects : [],
      };

/**
 * An answer to a press's prompt call: it moves only the press whose number
 * it carries, the one under way or one a session's start overtook, and
 * only at the stage that asked for it. Any other is dropped. A box read
 * while a turn runs, as Submit knows it, sends nothing.
 */
const answered = (state: PaneState, answer: Answer, outside: Outside): Stepped => {
  const { submit } = state;
  const isTurnRunning = turnOf(submit) !== undefined;

  if (submit.tag === "pressed" && submit.press.press === answer.press) {
    const moved = advanced(submit.press, answer, isTurnRunning, outside);

    return moved === undefined
      ? { state, effects: [] }
      : withSubmit(state, foregroundMoved(submit, moved));
  }
  const at = state.overtaken.findIndex((p) => p.press === answer.press);
  const press = state.overtaken[at];
  const moved =
    press === undefined
      ? undefined
      : advanced(press, answer, isTurnRunning, outside);

  return moved === undefined
    ? { state, effects: [] }
    : overtakenMoved(state, at, moved);
};

const withSubmit = (state: PaneState, s: SubmitStepped): Stepped => ({
  state: { ...state, submit: s.submit },
  effects: s.effects,
});

/** The pane's state after `event`, and the effects to run for it, in order. */
export const step = (
  state: PaneState,
  event: Event,
  outside: Outside,
): Stepped => {
  switch (event.type) {
    case "session-started":
      // No turn runs and nothing is said as a session starts; a press under
      // way finishes, overtaken.
      return {
        state: {
          ...state,
          submit: IDLE,
          overtaken:
            state.submit.tag === "pressed"
              ? [...state.overtaken, state.submit.press]
              : state.overtaken,
        },
        effects: [],
      };
    case "turn-started":
      return withSubmit(state, stays(turnStarted(state.submit, event.turn)));
    case "turn-completed":
      return withSubmit(state, stays(turnCompleted(state.submit, event.turn)));
    case "submit-pressed":
      return pressed(state);
    default:
      return answered(state, event, outside);
  }
};

/** Whether `step` reads `Outside` for `event`: only the box emptied, for the answers it holds Done, and the engine's answer to the draft, for whether the pane closes. */
export const readsOutside = (event: Event): boolean =>
  (event.type === "prompt-filled" && event.purpose === "empty") ||
  event.type === "prompt-submitted";

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
