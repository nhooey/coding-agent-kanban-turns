// A model of the hooks' interpreter around `step`, for the differential
// tests: the pane's state, the atoms its effects still write, the settings
// files as they stand, and the calls waiting for an answer, each answered
// when the test says. Beside it, what tells the tests where `step` was made
// to differ from the old handlers, so a difference found anywhere else
// fails them.
//
// Temporary: deleted with the oracles once the last of the pane's areas has
// moved into src/pane/pane-state.ts.

import { isDeepStrictEqual } from "node:util";

import { heldNow, problemsOf } from "../../src/items/raised.ts";
import { loadedOf, shownOf, step, submitShown } from "../../src/pane/pane-state.ts";
import type { Effect, Event, Found } from "../../src/pane/pane-state.ts";
import type { Held, Loaded, PaneState, Press } from "../../types/index.d.ts";
import type { Call, OldLoaded } from "../oracle/submit.ts";
import { usable } from "./settings.ts";
import { answerTo } from "./submit.ts";
import type { Reply } from "./submit.ts";

type ReadSettings = Extract<Effect, { kind: "read-settings" }>;
type ReadTranscript = Extract<Effect, { kind: "read-transcript" }>;
type AskMerged = Extract<Effect, { kind: "ask-merged" }>;

/**
 * Where `step` was made to differ from the old handlers, once a run has
 * reached it:
 *
 * - `holds`: a refusal or a turn's end taking out answers by press and
 *   item while an answer the old handlers took out by ref stays;
 * - `aside`: an overtaken press ending while the pane says something of a
 *   later press, or of none, so what it says stays apart;
 * - `stale`: a transcript read answering no newer than the read shown, or
 *   asked before the session changed, which is dropped;
 * - `older`: a settings read answering no newer than the read the settings
 *   are, with other files than theirs, which is dropped;
 * - `drawn`: a refresh's transcript read landing while the settings differ
 *   from what its own settings read found, which it draws with;
 * - `freed`: a refresh that holds answers, its settings read answered while
 *   the settings are broken, which reads the transcript to let go of them.
 */
export type Diverged = Readonly<{
  holds: boolean;
  aside: boolean;
  stale: boolean;
  older: boolean;
  drawn: boolean;
  freed: boolean;
}>;

export const NOT_DIVERGED: Diverged = {
  holds: false,
  aside: false,
  stale: false,
  older: false,
  drawn: false,
  freed: false,
};

/** A call waiting, with what its hook dispatches once it and the calls it leads to have answered. */
type Waiting<E> = Readonly<{ effect: E; then: readonly Event[] }>;

/** What the hooks hold around `step`: the pane's state, the atoms its effects write, the settings files, and the calls waiting. */
export type Model = Readonly<{
  state: PaneState;
  /** What a read of the settings files finds now. */
  files: Loaded;
  /** Whether a settings read waits for the test to answer it, with the files as they were when it was asked; else it answers at once. */
  holdsLoads: boolean;
  draft: string;
  pending: readonly Effect[];
  /** Each settings read waiting, with the files it finds. */
  loads: readonly (Waiting<ReadSettings> & Readonly<{ files: Loaded }>)[];
  /** Each transcript read waiting, with what its refresh's own settings read found. */
  reads: readonly (Waiting<ReadTranscript> & Readonly<{ files: Loaded }>)[];
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

/** The settings files as the old handlers' fake gives them, the close setting `isClosed`, merged as the plugin merges them. */
export const filesOf = (old: OldLoaded, isClosed: boolean): Loaded =>
  old.counts === null
    ? { settings: null, effective: [], problems: old.problems }
    : usable(isClosed, old.problems);

export const model = (state: PaneState, files: Loaded, holdsLoads = false): Model => ({
  state,
  files,
  holdsLoads,
  draft: "",
  pending: [],
  loads: [],
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

/** The model once the settings files change to say `files`: what a settings read asked for from now finds. */
export const withFiles = (m: Model, files: Loaded): Model => ({ ...m, files });

/** The press `number` names in `state`: the one under way, or one overtaken. */
const pressIn = (state: PaneState, number: number): Press | undefined =>
  state.submit.tag === "pressed" && state.submit.press.press === number
    ? state.submit.press
    : state.overtaken.find((p) => p.press === number);

/** The refresh's read waiting on the transcript that `event` answers, if any. */
const transcriptReading = (before: PaneState, event: Event) =>
  event.type === "transcript-read"
    ? before.refresh.reads.find((r) => r.refresh === event.refresh && r.on.at === "transcript")
    : undefined;

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
    const reading = transcriptReading(before, event);

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

/** The read whose answer the settings in `state` are, 0 before any. */
const readIn = (state: PaneState): number =>
  state.settings.tag === "unread" ? 0 : state.settings.read;

/**
 * Whether `event` is the answer to a transcript read `step` drops: one no
 * newer than the read shown, or asked before the session changed, which
 * the old handlers drew whatever came since.
 */
const isStale = (before: PaneState, event: Event): boolean =>
  transcriptReading(before, event) !== undefined &&
  event.type === "transcript-read" &&
  event.refresh <= before.refresh.shown;

/**
 * Whether `event` answers a settings read no newer than the one the
 * settings in `before` are, with other files than theirs: `step` drops it,
 * where the old handlers wrote it over them. An older read that found the
 * same files leaves the two alike.
 */
const isOlder = (before: PaneState, event: Event): boolean =>
  event.type === "settings-read" &&
  event.read <= before.settings.asked &&
  event.read <= readIn(before) &&
  !isDeepStrictEqual(event.loaded, loadedOf(before.settings));

/**
 * Whether `event` answers the settings read of a refresh that holds
 * answers, leaving the settings broken: `step` reads the transcript to let
 * go of them, where the old handlers, their read finding the settings
 * broken or drawing with the broken ones, read none and kept them held.
 */
const isFreed = (event: Event, before: PaneState, after: PaneState): boolean =>
  event.type === "settings-read" &&
  after.settings.tag !== "loaded" &&
  before.refresh.reads.some(
    (r) => r.on.at === "settings" && r.on.read === event.read && r.releases.length > 0,
  );

/** What the old handlers drew a read with, of the settings: the count line's, and the files' problems. */
const drawnWith = (files: Loaded) => ({
  counts: files.settings?.counts ?? null,
  problems: files.problems,
});

/** Where a run stands once `event` has moved `before` to `after`. */
export const divergedBy = (
  d: Diverged,
  before: PaneState,
  event: Event,
  after: PaneState,
): Diverged => ({
  ...d,
  holds: d.holds || isReleaseApart(before, event),
  aside:
    d.aside ||
    ("press" in event &&
      before.overtaken.some((p) => p.press === event.press) &&
      !after.overtaken.some((p) => p.press === event.press) &&
      (before.submit.tag === "pressed" || before.submit.tag === "refused")),
  stale: d.stale || isStale(before, event),
  older: d.older || isOlder(before, event),
  freed: d.freed || isFreed(event, before, after),
});

/** `events` dispatched in turn. */
const dispatchedAll = (m: Model, events: readonly Event[]): Model =>
  events.reduce((sofar, e) => dispatched(sofar, e), m);

/**
 * One effect run as the hooks run it: a prompt call, a transcript read or
 * a `gh` call left waiting for its answer, a settings read too when the
 * model holds them, the rest done at once. `then` are the events the hook
 * dispatches once the read has answered; `files` is what the settings read
 * a transcript read follows found.
 */
const ran = (m: Model, effect: Effect, then: readonly Event[], files: Loaded): Model => {
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
    case "read-settings":
      return m.holdsLoads
        ? { ...m, loads: [...m.loads, { effect, then, files: m.files }] }
        : dispatched(m, { type: "settings-read", read: effect.read, loaded: m.files }, then);
    case "read-transcript":
      return { ...m, reads: [...m.reads, { effect, then, files }] };
    case "ask-merged":
      return { ...m, asks: [...m.asks, effect] };
    case "open-pane":
      return { ...m, opens: m.opens + 1 };
    case "reveal":
      return m;
  }
};

/** `event` stepped, its effects run, then `then` dispatched once the read it leads to, if any, has answered. */
export const dispatched = (m: Model, event: Event, then: readonly Event[] = []): Model => {
  const { state, effects } = step(m.state, event);
  const reading = effects.find((e) => e.kind === "read-settings" || e.kind === "read-transcript");
  const files = event.type === "settings-read" ? event.loaded : m.files;
  const isReleased =
    event.type === "transcript-read" && state.sent.length < m.state.sent.length;
  const done = effects.reduce(
    (sofar, e) => ran(sofar, e, e === reading ? then : [], files),
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

/** The settings read waiting at `at` answered with the files as they were when it was asked, then what follows it. */
export const answeredLoad = (m: Model, at: number): Model => {
  const load = m.loads[at];

  return load === undefined
    ? m
    : dispatched(
        { ...m, loads: m.loads.filter((_, n) => n !== at) },
        { type: "settings-read", read: load.effect.read, loaded: load.files },
        load.then,
      );
};

/**
 * The transcript read waiting at `at` answered with what it found, then
 * what the hook dispatches after it. A read newer than the one shown that
 * lands while the settings differ from what its own settings read found
 * is drawn with them, where the old handlers drew it with what it found.
 */
export const answeredRead = (m: Model, at: number, found: Found): Model => {
  const read = m.reads[at];

  if (read === undefined) {
    return m;
  }
  const isDrawnApart =
    m.state.refresh.reads.some(
      (r) => r.refresh === read.effect.refresh && r.on.at === "transcript",
    ) &&
    read.effect.refresh > m.state.refresh.shown &&
    !isDeepStrictEqual(drawnWith(loadedOf(m.state.settings)), drawnWith(read.files));

  return dispatchedAll(
    dispatched(
      {
        ...m,
        reads: m.reads.filter((_, n) => n !== at),
        diverged: { ...m.diverged, drawn: m.diverged.drawn || isDrawnApart },
      },
      { type: "transcript-read", refresh: read.effect.refresh, found },
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
export const isDiverged = (d: Diverged): boolean =>
  d.holds || d.aside || d.stale || d.older || d.drawn || d.freed;
