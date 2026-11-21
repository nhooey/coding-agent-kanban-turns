// A model of the hooks' interpreter around `step`, for the differential
// tests: the pane's state, the atoms its effects still write, and the
// calls waiting for an answer, each answered when the test says. Beside it,
// what tells the tests where `step` was made to differ from the old
// handlers, so a difference found anywhere else fails them.
//
// Temporary: deleted with the oracles once the last of the pane's areas has
// moved into src/pane/pane-state.ts.

import { heldNow, problemsOf } from "../../src/items/raised.ts";
import { shownOf, step, submitShown } from "../../src/pane/pane-state.ts";
import type { Effect, Event, Found, Outside } from "../../src/pane/pane-state.ts";
import type { Held, PaneState, Press } from "../../types/index.d.ts";
import type { Call, OldLoaded } from "../oracle/submit.ts";
import { answerTo } from "./submit.ts";
import type { Reply } from "./submit.ts";

type ReadTranscript = Extract<Effect, { kind: "read-transcript" }>;
type AskMerged = Extract<Effect, { kind: "ask-merged" }>;

/**
 * Where `step` was made to differ from the old handlers, once a run has
 * reached it: a refusal or a turn's end taking out answers by press and
 * item while an answer the old handlers took out by ref stays; an
 * overtaken press ending while the pane says something of a later press,
 * or of none, so what it says stays apart; a transcript read answering no
 * newer than the read shown, or asked before the session changed, which
 * is dropped.
 */
export type Diverged = Readonly<{ holds: boolean; aside: boolean; stale: boolean }>;

export const NOT_DIVERGED: Diverged = { holds: false, aside: false, stale: false };

/** What the hooks hold around `step`: the pane's state, the atoms its effects write, and the calls waiting. */
export type Model = Readonly<{
  state: PaneState;
  outside: Outside;
  loaded: OldLoaded;
  draft: string;
  pending: readonly Effect[];
  /** Each transcript read waiting, with what its hook dispatches once it answers, and the settings it was asked under. */
  reads: readonly Readonly<{ effect: ReadTranscript; then: readonly Event[]; loaded: OldLoaded }>[];
  asks: readonly AskMerged[];
  submitted: readonly string[];
  closes: number;
  opens: number;
  /** How many transcript reads took out answers Submit held: how often a run reached that path. */
  released: number;
  /** How many transcript reads were shown after a newer refresh's read had answered without reading the transcript. */
  landedLate: number;
  diverged: Diverged;
}>;

export const model = (state: PaneState, outside: Outside, loaded: OldLoaded): Model => ({
  state,
  outside,
  loaded,
  draft: "",
  pending: [],
  reads: [],
  asks: [],
  submitted: [],
  closes: 0,
  opens: 0,
  released: 0,
  landedLate: 0,
  diverged: NOT_DIVERGED,
});

/** Whether `event` shows a transcript read after a newer refresh's read has answered, which, since none newer is shown, couldn't read the transcript. */
const isLandedLate = (before: PaneState, event: Event, after: PaneState): boolean =>
  event.type === "transcript-read" &&
  after.refresh.shown === event.refresh &&
  before.refresh.shown !== event.refresh &&
  Array.from(
    { length: before.refresh.asked - event.refresh },
    (_, n) => event.refresh + 1 + n,
  ).some((newer) => !before.refresh.reads.some((r) => r.refresh === newer));

/** The model once the settings files change to say `loaded`: what a refresh asked for from now reads. */
export const withLoaded = (m: Model, loaded: OldLoaded): Model => ({ ...m, loaded });

/** The press `number` names in `state`: the one under way, or one overtaken. */
const pressIn = (state: PaneState, number: number): Press | undefined =>
  state.submit.tag === "pressed" && state.submit.press.press === number
    ? state.submit.press
    : state.overtaken.find((p) => p.press === number);

/**
 * What `event` takes out of the answers held, judged on the state before
 * it: the holds `step` takes out, each by its press and item, and the refs
 * the old handlers took out, every answer to each. A turn's end's read,
 * once it read the transcript, takes out the holds it began with, which
 * the old handlers took out by ref; a press the engine refused, or that
 * failed while its draft was out, takes out its own, where the old
 * handlers took out the refs its draft moved. Undefined for an event that
 * takes none out.
 */
const takenOut = (
  before: PaneState,
  event: Event,
): Readonly<{ holds: readonly Held[]; refs: readonly string[] }> | undefined => {
  if (event.type === "transcript-read") {
    const reading = before.refresh.reads.find((r) => r.refresh === event.refresh);

    return reading !== undefined && "turns" in event.found
      ? { holds: reading.releases, refs: reading.releases.map((h) => h.settled.ref) }
      : undefined;
  }
  const press = "press" in event ? pressIn(before, event.press) : undefined;
  const isPutBack =
    event.type === "press-failed" ||
    (event.type === "prompt-submitted" && event.refusal !== undefined);

  return isPutBack && press?.at === "sending" && press.stage.at === "submitting"
    ? {
        holds: before.sent.filter((h) => h.press === press.press),
        refs: press.stage.moved.map((s) => s.ref),
      }
    : undefined;
};

/**
 * Whether `event` takes answers out where, before it, one is held that the
 * old handlers would take out by its ref and `step` keeps: another press's
 * answer to an item the release names, or one a press holds that a
 * session's start emptied the releasing press's own holds before. Judged
 * on the step's input alone, so a release that keeps or takes out the
 * wrong holds still fails the comparison.
 */
const isReleaseApart = (before: PaneState, event: Event): boolean => {
  const taken = takenOut(before, event);

  return (
    taken !== undefined &&
    before.sent.some(
      (h) =>
        taken.refs.includes(h.settled.ref) &&
        !taken.holds.some((t) => t.press === h.press && t.settled.ref === h.settled.ref),
    )
  );
};

/**
 * Whether `event` is the answer to a transcript read `step` drops: one no
 * newer than the read shown, or one asked before the session changed,
 * which the old handlers drew whatever came since.
 */
const isStale = (before: PaneState, event: Event): boolean =>
  event.type === "transcript-read" &&
  before.refresh.reads.some((r) => r.refresh === event.refresh) &&
  event.refresh <= before.refresh.shown;

/** Where a run stands once `event` has moved `before` to `after`. */
export const divergedBy = (
  d: Diverged,
  before: PaneState,
  event: Event,
  after: PaneState,
): Diverged => ({
  holds: d.holds || isReleaseApart(before, event),
  aside:
    d.aside ||
    ("press" in event &&
      before.overtaken.some((p) => p.press === event.press) &&
      !after.overtaken.some((p) => p.press === event.press) &&
      (before.submit.tag === "pressed" || before.submit.tag === "refused")),
  stale: d.stale || isStale(before, event),
});

/** The event a transcript read answers with, as the hooks build it from what it found and the settings' problems as it was asked. */
const transcriptRead = (
  refresh: number,
  found: Found,
  loaded: OldLoaded,
): Event => ({
  type: "transcript-read",
  refresh,
  found,
  warnings: loaded.problems,
});

/** `events` dispatched in turn. */
const dispatchedAll = (m: Model, events: readonly Event[]): Model =>
  events.reduce((sofar, e) => dispatched(sofar, e), m);

/**
 * One effect run as the hooks run it: a prompt call, a transcript read or
 * a `gh` call left waiting for its answer, the rest done at once. A read
 * with settings that can't be used answers at once, as the hooks read no
 * transcript then; `then` are the events the hook dispatches once the
 * read has answered.
 */
const ran = (m: Model, effect: Effect, then: readonly Event[]): Model => {
  switch (effect.kind) {
    case "read-prompt":
    case "fill-prompt":
      return { ...m, pending: [...m.pending, effect] };
    case "submit-prompt":
      return {
        ...m,
        pending: [...m.pending, effect],
        submitted: [...m.submitted, effect.text],
      };
    case "close-pane":
      return { ...m, closes: m.closes + 1 };
    case "set-draft":
      return { ...m, draft: effect.text };
    case "read-transcript":
      return m.loaded.counts === null
        ? dispatchedAll(
            dispatched(m, transcriptRead(effect.refresh, { problem: "" }, m.loaded)),
            then,
          )
        : { ...m, reads: [...m.reads, { effect, then, loaded: m.loaded }] };
    case "ask-merged":
      return { ...m, asks: [...m.asks, effect] };
    case "open-pane":
      return { ...m, opens: m.opens + 1 };
    case "reveal":
      return m;
  }
};

/** `event` stepped, its effects run, then `then` dispatched once its transcript read, if any, has answered. */
export const dispatched = (m: Model, event: Event, then: readonly Event[] = []): Model => {
  const { state, effects } = step(m.state, event, m.outside);
  const reading = effects.find((e) => e.kind === "read-transcript");
  const isReleased =
    event.type === "transcript-read" && state.sent.length < m.state.sent.length;
  const done = effects.reduce(
    (sofar, e) => ran(sofar, e, e === reading ? then : []),
    {
      ...m,
      state,
      released: m.released + (isReleased ? 1 : 0),
      landedLate: m.landedLate + (isLandedLate(m.state, event, state) ? 1 : 0),
      diverged: divergedBy(m.diverged, m.state, event, state),
    },
  );

  return reading === undefined ? dispatchedAll(done, then) : done;
};

/** The prompt call waiting at `at` answered with `reply`. */
export const answeredPrompt = (m: Model, at: number, reply: Reply): Model => {
  const effect = m.pending[at];
  const event = effect === undefined ? undefined : answerTo(effect, reply);

  return event === undefined
    ? m
    : dispatched({ ...m, pending: m.pending.filter((_, n) => n !== at) }, event);
};

/** The transcript read waiting at `at` answered with what it found, then what the hook dispatches after it. */
export const answeredRead = (m: Model, at: number, found: Found): Model => {
  const read = m.reads[at];

  return read === undefined
    ? m
    : dispatchedAll(
        dispatched(
          { ...m, reads: m.reads.filter((_, n) => n !== at) },
          transcriptRead(read.effect.refresh, found, read.loaded),
        ),
        read.then,
      );
};

/** The `gh` call waiting at `at` answered with the pull requests it says merged. */
export const answeredAsk = (m: Model, at: number, merged: readonly string[]): Model => {
  const ask = m.asks[at];

  return ask === undefined
    ? m
    : dispatched(
        { ...m, asks: m.asks.filter((_, n) => n !== at) },
        {
          type: "merged-found",
          found: merged.filter((ref) => ask.refs.includes(ref)),
          asked: ask.asked,
        },
      );
};

export const callOf = (effect: Effect): Call =>
  effect.kind === "fill-prompt"
    ? { kind: "fill", text: effect.text, mode: effect.mode }
    : effect.kind === "submit-prompt"
      ? { kind: "submit", text: effect.text }
      : { kind: "read" };

/** What the pane says of Submit: what an overtaken press said, then what it says of the press since, each on a line. */
export const problemOf = (state: PaneState): string =>
  [state.aside.said, submitShown(state.submit).problem].filter((p) => p !== "").join("\n");

/** What the differential tests compare of the model. */
export const observedNew = (m: Model) => ({
  isBusy: submitShown(m.state.submit).isBusy,
  problem: problemOf(m.state),
  sent: heldNow(m.state.sent),
  shown: shownOf(m.state),
  problems: problemsOf(m.state.raised),
  counts: m.state.counts,
  draft: m.draft,
  pending: m.pending.map(callOf),
  reads: m.reads.length,
  asks: m.asks.map((a) => a.refs),
  submitted: m.submitted,
  closes: m.closes,
  opens: m.opens,
});

/** Whether a run has reached a place where `step` was made to differ. */
export const isDiverged = (d: Diverged): boolean => d.holds || d.aside || d.stale;
