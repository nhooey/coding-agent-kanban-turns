// The settings in the pane's state: `step` driven through named sequences
// of settings reads, a refresh's and a tool's, answered in and out of turn,
// the state and effects checked after each; then through random sequences,
// reads answered in any order, repeated and stray among them, its
// invariants checked after every step, over seeded runs.

import { describe, test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { expect } from "expect";
import fc from "fast-check";

import { problemsOf } from "../../../src/items/raised.ts";
import {
  INITIAL_PANE,
  loadedOf,
  settingsFrom,
  settingsOf,
  step,
} from "../../../src/pane/pane-state.ts";
import type { Event, Found, Stepped } from "../../../src/pane/pane-state.ts";
import type { Loaded, PaneState } from "../../../types/index.d.ts";
import { BOXES, START, startArb } from "../../fixtures/submit.ts";
import { GONE, TRANSCRIPTS, paneCommandsArb, walkPane } from "../../fixtures/refresh.ts";
import { BAD_KEY, BROKEN, MISSING, SETTINGS, usable } from "../../fixtures/settings.ts";

/** Each step's state and effects, from `from`, as `events` move it. */
const steps = (events: readonly Event[], from: PaneState = START): readonly Stepped[] =>
  events.reduce<readonly Stepped[]>(
    (sofar, event) => [...sofar, step(sofar.at(-1)?.state ?? from, event)],
    [],
  );

/** The state after `events`. */
const after = (events: readonly Event[], from: PaneState = START): PaneState =>
  steps(events, from).at(-1)?.state ?? from;

const ASK: Event = { type: "refresh-asked", releases: false };
const TURN_END: Event = { type: "refresh-asked", releases: true };
const ALONE: Event = { type: "settings-asked" };
const CLEAN = usable(false);
const WARNED = usable(false, [BAD_KEY]);
const loads = (read: number, loaded: Loaded = CLEAN): Event => ({
  type: "settings-read",
  read,
  loaded,
});
const read = (refresh: number, found: Found): Event => ({
  type: "transcript-read",
  refresh,
  found,
});
const ANSWERED: Found = { turns: TRANSCRIPTS.answered };
const sending: readonly Event[] = [
  { type: "submit-pressed" },
  { type: "prompt-read", press: 1, purpose: "submit", text: BOXES.both },
  { type: "prompt-filled", press: 1, purpose: "empty", isFilled: true },
];
const ENTERED: Event = { type: "prompt-submitted", press: 1 };

describe("the settings", () => {
  test("are unread before any read answers, with nothing in effect and nothing wrong", () => {
    expect(INITIAL_PANE.settings).toEqual({ tag: "unread", asked: 0 });
    expect(settingsOf(INITIAL_PANE.settings)).toBeNull();
    expect(loadedOf(INITIAL_PANE.settings)).toEqual({ settings: null, effective: [], problems: [] });
  });

  test("a read finds loaded, with where each came from and their warnings, or broken, with why", () => {
    const loaded = settingsFrom(WARNED, 2, 1);

    expect(loaded).toEqual({
      tag: "loaded",
      asked: 2,
      read: 1,
      settings: WARNED.settings,
      effective: WARNED.effective,
      warnings: [BAD_KEY],
    });
    expect(loadedOf(loaded)).toEqual(WARNED);
    expect(settingsOf(loaded)).toBe(WARNED.settings);
    expect(settingsFrom(BROKEN, 1, 1)).toEqual({ tag: "broken", asked: 1, read: 1, problems: [MISSING] });
    expect(loadedOf(settingsFrom(BROKEN, 1, 1))).toEqual(BROKEN);
    expect(settingsOf(settingsFrom(BROKEN, 1, 1))).toBeNull();
  });
});

describe("a settings read", () => {
  test("for a tool or a command asks under the next number, and no refresh waits on it", () => {
    const [first, second] = steps([ALONE, ALONE]);

    expect(first?.effects).toEqual([{ kind: "read-settings", read: 1 }]);
    expect(second?.effects).toEqual([{ kind: "read-settings", read: 2 }]);
    expect(second?.state.settings).toEqual({ tag: "unread", asked: 2 });
    expect(second?.state.refresh).toBe(START.refresh);
  });

  test("puts what it found in effect, and asks for nothing more when no refresh waits on it", () => {
    const last = steps([ALONE, loads(1, WARNED)]).at(-1);

    expect(last?.state.settings).toEqual(settingsFrom(WARNED, 1, 1));
    expect(last?.effects).toEqual([]);
    expect(last?.state.raised).toBe(START.raised);
  });

  test("that answers after a newer one's is dropped: the newer stays in effect", () => {
    const newer = after([ALONE, ALONE, loads(2, WARNED)]);
    const last = step(newer, loads(1, CLEAN));

    expect(last).toEqual({ state: newer, effects: [] });
    expect(loadedOf(last.state.settings).problems).toEqual([BAD_KEY]);
  });

  test("that answers first is in effect until the newer one's answers", () => {
    const older = after([ALONE, ALONE, loads(1, CLEAN)]);

    expect(loadedOf(older.settings).problems).toEqual([]);
    expect(loadedOf(after([loads(2, WARNED)], older).settings).problems).toEqual([BAD_KEY]);
  });

  test("never asked for, or answered twice, changes nothing", () => {
    const once = after([ALONE, loads(1, CLEAN)]);

    expect(step(once, loads(1, WARNED))).toEqual({ state: once, effects: [] });
    expect(step(once, loads(2, WARNED))).toEqual({ state: once, effects: [] });
    expect(step(START, loads(0, WARNED))).toEqual({ state: START, effects: [] });
  });
});

describe("a refresh's settings read", () => {
  test("is asked first, under the next settings number, its refresh waiting on it", () => {
    const [first] = steps([ALONE, ASK]).slice(1);

    expect(first?.effects).toEqual([{ kind: "read-settings", read: 2 }]);
    expect(first?.state.refresh.reads).toEqual([
      { refresh: 1, releases: [], on: { at: "settings", read: 2 } },
    ]);
    expect(first?.state.settings.asked).toBe(2);
  });

  test("that finds usable settings asks for the transcript, its refresh waiting on that", () => {
    const last = steps([ASK, loads(1)]).at(-1);

    expect(last?.effects).toEqual([{ kind: "read-transcript", refresh: 1 }]);
    expect(last?.state.refresh.reads).toEqual([{ refresh: 1, releases: [], on: { at: "transcript" } }]);
    expect(last?.state.settings.tag).toBe("loaded");
  });

  test("that finds them broken reads no transcript, and the pane says why", () => {
    const last = steps([ASK, loads(1, BROKEN)]).at(-1);

    expect(last?.effects).toEqual([]);
    expect(last?.state.refresh).toEqual({ asked: 1, shown: 0, reads: [] });
    expect(problemsOf(last?.state.raised ?? START.raised)).toBe(MISSING);
  });

  test("that finds them broken, for a refresh no newer than the one shown, says nothing", () => {
    const joined = after([ASK, { type: "session-joined", session: "s2" }]);
    const last = step(joined, loads(1, BROKEN));

    expect(joined.refresh.shown).toBe(1);
    expect(last.state.raised).toBe(joined.raised);
    expect(last.state.refresh.reads).toEqual([]);
    expect(last.state.settings.tag).toBe("broken");
  });

  test("that answers older than the settings in effect still lets its refresh read, by the newer settings", () => {
    const newer = after([ASK, ALONE, loads(2, WARNED)]);
    const last = step(newer, loads(1, BROKEN));

    expect(last.state.settings).toBe(newer.settings);
    expect(last.effects).toEqual([{ kind: "read-transcript", refresh: 1 }]);
  });

  test("that answers older than broken settings in effect reads nothing, and says what's wrong with those", () => {
    const broken = after([ASK, ALONE, loads(2, BROKEN)]);
    const last = step(broken, loads(1, CLEAN));

    expect(last.effects).toEqual([]);
    expect(last.state.refresh.reads).toEqual([]);
    expect(problemsOf(last.state.raised)).toBe(MISSING);
  });

  test("whose answer couldn't be stepped is dropped: its refresh waits on nothing, and nothing else changes", () => {
    const waiting = after([ASK, ASK]);
    const dropped = step(waiting, { type: "settings-dropped", read: 1 });

    expect(dropped.state).toEqual({
      ...waiting,
      refresh: { ...waiting.refresh, reads: [{ refresh: 2, releases: [], on: { at: "settings", read: 2 } }] },
    });
    expect(dropped.effects).toEqual([]);
    expect(step(dropped.state, loads(1)).effects).toEqual([]);
  });
});

describe("a refresh's transcript read", () => {
  test("draws with the settings in effect as it lands: a newer read's warnings", () => {
    const reading = after([ASK, loads(1, CLEAN), ALONE, loads(2, WARNED)]);
    const last = after([read(1, ANSWERED)], reading);

    expect(last.raised.settledRefs).toEqual(["9efb08a1.Decide.1"]);
    expect(last.raised.warnings).toEqual([BAD_KEY]);
  });

  test("that lands while the settings are broken settles nothing, says why, shows no read, and still lets go of the answers it read", () => {
    const reading = after([...sending, ENTERED, TURN_END, loads(1), ALONE, loads(2, BROKEN)]);
    const last = after([read(1, ANSWERED)], reading);

    expect(reading.sent).not.toEqual([]);
    expect(last.raised.settledRefs).toEqual([]);
    expect(last.counts).toBe(reading.counts);
    expect(problemsOf(last.raised)).toBe(MISSING);
    expect(last.refresh).toEqual({ asked: 1, shown: 0, reads: [] });
    expect(last.sent).toEqual([]);
  });

  test("that couldn't read the transcript says why beside the settings' warnings", () => {
    expect(problemsOf(after([ASK, loads(1, WARNED), read(1, { problem: GONE })]).raised)).toBe(
      `${BAD_KEY}; ${GONE}`,
    );
  });

  test("waiting on its settings read takes no transcript answer", () => {
    const waiting = after([ASK]);

    expect(step(waiting, read(1, ANSWERED))).toEqual({ state: waiting, effects: [] });
  });

  test("asks gh with the timeout the settings in effect give", () => {
    const timeout = { ...SETTINGS, counts: { ...SETTINGS.counts, "gh-timeout-ms": 7 } };
    const last = steps([ASK, loads(1, { ...CLEAN, settings: timeout }), read(1, { turns: TRANSCRIPTS.open })]).at(-1);

    expect(last?.effects).toMatchObject([{ kind: "ask-merged", timeoutMs: 7 }]);
  });
});

describe("a turn's end that holds answers", () => {
  const HELD: readonly Event[] = [...sending, ENTERED];
  /** The state once the turn's end, read 1, and a read alone, read 2, have answered as `answers` say, in that order, and the transcript read lands. */
  const answered = (answers: readonly Event[]): Readonly<{ reading: PaneState; last: PaneState }> => {
    const reading = after([...HELD, TURN_END, ALONE, ...answers]);

    return { reading, last: after([read(1, ANSWERED)], reading) };
  };

  test("whose settings read finds them broken still reads the transcript, and says nothing until it lands", () => {
    const [, last] = steps([...HELD, TURN_END, loads(1, BROKEN)]).slice(-2);

    expect(last?.effects).toEqual([{ kind: "read-transcript", refresh: 1 }]);
    expect(last?.state.refresh.reads).toMatchObject([{ refresh: 1, on: { at: "transcript" } }]);
    expect(problemsOf(last?.state.raised ?? START.raised)).toBe("");
  });

  test("lets go of its answers, settles nothing and says why, whichever read answers first, when the newer read finds the settings broken", () => {
    const newerFirst = answered([loads(2, BROKEN), loads(1, CLEAN)]);
    const ownFirst = answered([loads(1, CLEAN), loads(2, BROKEN)]);

    expect(newerFirst.reading.sent).not.toEqual([]);
    expect(newerFirst.reading.refresh.reads).toMatchObject([{ refresh: 1, on: { at: "transcript" } }]);
    [newerFirst, ownFirst].forEach(({ last }) => {
      expect(last.sent).toEqual([]);
      expect(last.raised.settledRefs).toEqual([]);
      expect(problemsOf(last.raised)).toBe(MISSING);
      expect(last.refresh).toEqual({ asked: 1, shown: 0, reads: [] });
    });
    expect(newerFirst.last).toEqual(ownFirst.last);
  });

  test("lets go of its answers and settles by the newer settings, whichever read answers first, when its own read finds them broken", () => {
    const newerFirst = answered([loads(2, CLEAN), loads(1, BROKEN)]);
    const ownFirst = answered([loads(1, BROKEN), loads(2, CLEAN)]);

    [newerFirst, ownFirst].forEach(({ last }) => {
      expect(last.sent).toEqual([]);
      expect(last.raised.settledRefs).toEqual(["9efb08a1.Decide.1"]);
      expect(problemsOf(last.raised)).toBe("");
      expect(last.refresh).toMatchObject({ asked: 1, shown: 1, reads: [] });
    });
    expect(newerFirst.last).toEqual(ownFirst.last);
  });

  test("keeps its answers when the transcript can't be read, whatever the settings", () => {
    const { last } = answered([loads(1, BROKEN), loads(2, BROKEN)]);
    const gone = after([read(1, { problem: GONE })], answered([loads(1, BROKEN), loads(2, BROKEN)]).reading);

    expect(last.sent).toEqual([]);
    expect(gone.sent).not.toEqual([]);
    expect(problemsOf(gone.raised)).toBe(`${MISSING}; ${GONE}`);
  });
});

describe("Submit", () => {
  test("closes the pane by the close setting the newest read found", () => {
    const closing = after([ALONE, loads(1, usable(true))]);
    const sent = (from: PaneState) => steps([...sending, ENTERED], from).at(-1)?.effects;

    expect(sent(closing)).toEqual([{ kind: "close-pane" }]);
    expect(sent(after([ALONE, loads(2, usable(false))], closing))).toEqual([]);
    expect(sent(after([ALONE, loads(2, BROKEN)], closing))).toEqual([]);
  });
});

describe("the random settings sequences", () => {
  const runs = fc.sample(paneCommandsArb, { numRuns: 500, seed: 11 });
  const shareOf = (isMet: (before: PaneState, event: Event) => boolean): number =>
    runs.filter((commands) => walkPane(commands, START).some(({ before, event }) => isMet(before, event)))
      .length / runs.length;
  const readIn = (state: PaneState) => (state.settings.tag === "unread" ? 0 : state.settings.read);

  test("have an older settings read answer after a newer one's in at least a tenth of runs", () => {
    expect(
      shareOf(
        (before, event) =>
          event.type === "settings-read" &&
          event.read > 0 &&
          event.read < readIn(before) &&
          before.refresh.reads.some((r) => r.on.at === "settings" && r.on.read === event.read),
      ),
    ).toBeGreaterThanOrEqual(1 / 10);
  });

  test("have a transcript read land while the settings are broken in at least one run in 25", () => {
    expect(
      shareOf(
        (before, event) =>
          event.type === "transcript-read" &&
          before.settings.tag === "broken" &&
          before.refresh.reads.some((r) => r.refresh === event.refresh && r.on.at === "transcript"),
      ),
    ).toBeGreaterThanOrEqual(1 / 25);
  });
});

describe("the settings' invariants over random event sequences", () => {
  const holds = (
    check: (s: Readonly<{ before: PaneState; event: Event; stepped: Stepped }>) => boolean,
  ) =>
    fc.assert(
      fc.property(paneCommandsArb, startArb, (commands, from) =>
        walkPane(commands, from).every(check),
      ),
      { numRuns: 500, seed: 20261126 },
    );
  const readIn = (state: PaneState) => (state.settings.tag === "unread" ? 0 : state.settings.read);

  test("the settings change only as a settings read newer than theirs, and asked for, answers, with what it found", () => {
    holds(({ before, event, stepped: { state } }) => {
      const isNewer =
        event.type === "settings-read" &&
        event.read > readIn(before) &&
        event.read <= before.settings.asked;
      const { asked: _a, ...was } = before.settings;
      const { asked: _b, ...now } = state.settings;

      return isNewer
        ? isDeepStrictEqual(state.settings, settingsFrom(event.loaded, before.settings.asked, event.read))
        : isDeepStrictEqual(now, was);
    });
  });

  test("the reads asked for only grow, by one for each refresh or read alone, and none answered is past them", () => {
    holds(({ before, event, stepped: { state } }) =>
      state.settings.asked ===
        before.settings.asked + (event.type === "refresh-asked" || event.type === "settings-asked" ? 1 : 0) &&
      readIn(state) <= state.settings.asked &&
      readIn(state) >= readIn(before),
    );
  });

  test("a read of the settings is asked for under the number just asked, and only for a refresh or a read alone", () => {
    holds(({ event, stepped: { state, effects } }) =>
      effects.every(
        (e) =>
          e.kind !== "read-settings" ||
          ((event.type === "refresh-asked" || event.type === "settings-asked") &&
            e.read === state.settings.asked),
      ),
    );
  });

  test("a refresh whose settings read answers reads the transcript while the settings are usable or it holds answers, and else waits on nothing", () => {
    holds(({ before, event, stepped: { state, effects } }) =>
      event.type !== "settings-read" ||
      before.refresh.reads
        .filter((r) => r.on.at === "settings" && r.on.read === event.read)
        .every((r) => {
          const isRead = state.settings.tag === "loaded" || r.releases.length > 0;

          return (
            isRead ===
              effects.some((e) => e.kind === "read-transcript" && e.refresh === r.refresh) &&
            isRead ===
              state.refresh.reads.some((s) => s.refresh === r.refresh && s.on.at === "transcript")
          );
        }),
    );
  });

  test("a transcript read is asked for only as the settings read its refresh waited on answers", () => {
    holds(({ before, event, stepped: { state, effects } }) =>
      effects.every(
        (e) =>
          e.kind !== "read-transcript" ||
          (event.type === "settings-read" &&
            before.refresh.reads.some(
              (r) => r.refresh === e.refresh && r.on.at === "settings" && r.on.read === event.read,
            ) &&
            state.refresh.reads.some((r) => r.refresh === e.refresh && r.on.at === "transcript")),
      ),
    );
  });

  test("a refresh waits on a settings read asked for, and on none answered before it", () => {
    holds(({ stepped: { state } }) =>
      state.refresh.reads.every(
        (r) => r.on.at === "transcript" || (r.on.read > 0 && r.on.read <= state.settings.asked),
      ),
    );
  });

  test("a dropped settings read changes nothing but the reads waiting", () => {
    holds(({ before, event, stepped: { state, effects } }) =>
      event.type !== "settings-dropped" ||
      (effects.length === 0 &&
        isDeepStrictEqual(
          { ...state, refresh: { ...state.refresh, reads: [] } },
          { ...before, refresh: { ...before.refresh, reads: [] } },
        ) &&
        state.refresh.reads.every((r) => r.on.at !== "settings" || r.on.read !== event.read)),
    );
  });

  test("a transcript read settles items only while the settings are usable", () => {
    holds(({ before, event, stepped: { state } }) =>
      event.type !== "transcript-read" ||
      before.settings.tag === "loaded" ||
      (state.raised.settledRefs === before.raised.settledRefs &&
        state.refresh.shown === before.refresh.shown &&
        state.counts === before.counts),
    );
  });
});
