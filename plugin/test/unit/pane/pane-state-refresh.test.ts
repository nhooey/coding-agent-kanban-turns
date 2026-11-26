// The refresh in the pane's state: `step` driven through named sequences
// of refreshes, their transcript reads and `gh` answers, presses among
// them, the state and effects checked after each; then through random
// sequences, reads answered in any order, repeated and stray among them,
// its invariants checked after every step. The named sequences answer each
// settings read a refresh asks for at once, before its transcript read, as
// the files are read; pane-state-settings.test.ts holds the settings' own.

import { describe, test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { expect } from "expect";
import fc from "fast-check";

import { countLine } from "../../../src/items/outstanding.ts";
import { decideItemsOf, problemsOf, unseen } from "../../../src/items/raised.ts";
import { INITIAL_PANE, shownOf, step } from "../../../src/pane/pane-state.ts";
import type { Event, Found, Stepped } from "../../../src/pane/pane-state.ts";
import type { Loaded, PaneState } from "../../../types/index.d.ts";
import { BOXES, EARLIER, ITEMS, RAISED, START, startArb } from "../../fixtures/submit.ts";
import { settledRefsOf } from "../../fixtures/raised.ts";
import { BAD_KEY, BROKEN, MISSING, usable } from "../../fixtures/settings.ts";
import {
  COUNTS,
  DRAWN,
  GONE,
  PULL,
  TRANSCRIPTS,
  paneCommandsArb,
  walkPane,
} from "../../fixtures/refresh.ts";

/** What the settings files say in the named sequences, unless one says otherwise: the defaults. */
const FILES: Loaded = usable(false);

/** `event` stepped from `state`, each settings read it asks for answered at once with `files`, its effects in their place. */
const steppedWith = (state: PaneState, event: Event, files: Loaded): Stepped => {
  const first = step(state, event);

  return first.effects.reduce<Stepped>(
    (sofar, e) => {
      if (e.kind !== "read-settings") {
        return { state: sofar.state, effects: [...sofar.effects, e] };
      }
      const answered = step(sofar.state, { type: "settings-read", read: e.read, loaded: files });

      return { state: answered.state, effects: [...sofar.effects, ...answered.effects] };
    },
    { state: first.state, effects: [] },
  );
};

/** Each step's state and effects, from `from`, as `events` move it, the settings files saying `files`. */
const steps = (
  events: readonly Event[],
  from: PaneState = START,
  files: Loaded = FILES,
): readonly Stepped[] =>
  events.reduce<readonly Stepped[]>(
    (sofar, event) => [...sofar, steppedWith(sofar.at(-1)?.state ?? from, event, files)],
    [],
  );

/** The state after `events`. */
const after = (events: readonly Event[], from: PaneState = START, files: Loaded = FILES): PaneState =>
  steps(events, from, files).at(-1)?.state ?? from;

const ASK: Event = { type: "refresh-asked", releases: false };
const TURN_END: Event = { type: "refresh-asked", releases: true };
const found = (turns: Extract<Found, { turns: unknown }>["turns"]): Found => ({ turns });
const read = (refresh: number, f: Found): Event => ({
  type: "transcript-read",
  refresh,
  found: f,
});
/** A refresh's read waiting on the transcript, holding `releases`. */
const onTranscript = (refresh: number, releases: PaneState["sent"] = []) => ({
  refresh,
  releases,
  on: { at: "transcript" } as const,
});
const OPEN = found(TRANSCRIPTS.open);
const ANSWERED = found(TRANSCRIPTS.answered);
const REASSESSED = found(TRANSCRIPTS.reassessed);
const FAILED: Found = { problem: GONE };
const merged = (refs: readonly string[], refresh?: number): Event => ({
  type: "merged-found",
  found: refs,
  ...(refresh === undefined
    ? {}
    : { asked: { refresh, turns: TRANSCRIPTS.open, window: COUNTS.turns } }),
});

/** The events that send `box` as press `press`, its draft then waiting on the engine. */
const sending = (box: string, press = 1): readonly Event[] => [
  { type: "submit-pressed" },
  { type: "prompt-read", press, purpose: "submit", text: box },
  { type: "prompt-filled", press, purpose: "empty", isFilled: true },
];
const entered = (press = 1): Event => ({ type: "prompt-submitted", press });

const FIRST_SENT = {
  ref: "9efb08a1.Decide.1",
  how: "sent",
  letters: ["B"],
  note: "",
} as const;

describe("a refresh", () => {
  test("asks for the transcript under its number, beside any read still out, once its settings read answers", () => {
    const [first, second] = steps([ASK, ASK]);

    expect(first?.effects).toEqual([{ kind: "read-transcript", refresh: 1 }]);
    expect(second?.effects).toEqual([{ kind: "read-transcript", refresh: 2 }]);
    expect(second?.state.refresh).toEqual({
      asked: 2,
      shown: 0,
      reads: [onTranscript(1), onTranscript(2)],
    });
  });

  test("that reads the transcript settles the items and draws the count line from it, and asks gh about the Review items' pull requests", () => {
    const last = steps([ASK, read(1, ANSWERED)], START, usable(false, [BAD_KEY])).at(-1);

    expect(last?.state.refresh).toEqual({ asked: 1, shown: 1, reads: [] });
    expect(settledRefsOf(last?.state.raised ?? START.raised)).toEqual(["9efb08a1.Decide.1"]);
    expect(last?.state.raised.turns).toEqual(["9efb08a1", "b2c3d4e5"]);
    expect(last?.state.raised.settingsProblems).toEqual([BAD_KEY]);
    expect(last?.state.counts).toBe("📌 Outstanding: 🔍 1");
    expect(last?.effects).toEqual([
      {
        kind: "ask-merged",
        refs: [PULL],
        timeoutMs: COUNTS["gh-timeout-ms"],
        asked: { refresh: 1, turns: TRANSCRIPTS.answered, window: COUNTS.turns },
      },
    ]);
  });

  test("asks gh nothing when no pull request is left to ask about", () => {
    expect(steps([ASK, read(1, REASSESSED)]).at(-1)?.effects).toEqual([]);
    expect(steps([merged([PULL]), ASK, read(1, OPEN)], START).at(-1)?.effects).toEqual([]);
  });

  test("that can't read the transcript settles nothing, says why, and shows no read", () => {
    const settled = after([ASK, read(1, ANSWERED)]);
    const last = steps([ASK, read(2, FAILED)], settled, usable(false, [BAD_KEY])).at(-1);

    expect(last?.state.raised.items).toEqual(settled.raised.items);
    expect(last?.state.counts).toBe(settled.counts);
    expect(problemsOf(last?.state.raised ?? RAISED)).toBe(`${BAD_KEY}; ${GONE}`);
    expect(last?.state.refresh).toEqual({ asked: 2, shown: 1, reads: [] });
    expect(last?.effects).toEqual([]);
  });

  test("whose settings can't be used reads nothing, and says what was wrong with them", () => {
    const last = steps([ASK], START, BROKEN).at(-1);

    expect(problemsOf(last?.state.raised ?? RAISED)).toBe(MISSING);
    expect(last?.state.refresh).toEqual({ asked: 1, shown: 0, reads: [] });
    expect(last?.effects).toEqual([]);
  });

  test("whose answer couldn't be stepped is dropped: nothing waits on it, and nothing else changes", () => {
    const waiting = after([...sending(BOXES.first), entered(), TURN_END, ASK]);
    const dropped = step(waiting, { type: "read-dropped", refresh: 1 });

    expect(dropped.state).toEqual({
      ...waiting,
      refresh: { asked: 2, shown: 0, reads: [onTranscript(2)] },
    });
    expect(dropped.effects).toEqual([]);
    expect(step(dropped.state, read(1, ANSWERED)).state).toBe(dropped.state);
    expect(step(START, { type: "read-dropped", refresh: 1 })).toEqual({
      state: START,
      effects: [],
    });
  });
});

describe("an older refresh", () => {
  test("whose read answers after a newer one's is dropped: it never replaces it", () => {
    const newer = after([ASK, ASK, read(2, ANSWERED)]);
    const last = steps([read(1, OPEN)], newer).at(-1);

    expect(last?.state.raised).toBe(newer.raised);
    expect(last?.state.counts).toBe(newer.counts);
    expect(last?.state.refresh).toEqual({ asked: 2, shown: 2, reads: [] });
    expect(last?.effects).toEqual([]);
  });

  test("whose read answers first is shown until the newer one's answers", () => {
    const older = after([ASK, ASK, read(1, OPEN)]);

    expect(settledRefsOf(older.raised)).toEqual([]);
    expect(older.refresh).toEqual({
      asked: 2,
      shown: 1,
      reads: [onTranscript(2)],
    });
    expect(settledRefsOf(after([read(2, ANSWERED)], older).raised)).toEqual(["9efb08a1.Decide.1"]);
  });

  test("that couldn't read the transcript, answering late, doesn't say why over a newer one", () => {
    expect(problemsOf(after([ASK, ASK, read(2, OPEN), read(1, FAILED)]).raised)).toBe("");
  });

  test("that read the transcript still lands after a newer one that couldn't, which shows nothing", () => {
    const failed = after([ASK, ASK, read(2, FAILED)]);
    const last = after([read(1, ANSWERED)], failed);

    expect(failed.refresh).toEqual({ asked: 2, shown: 0, reads: [onTranscript(1)] });
    expect(problemsOf(failed.raised)).toBe(GONE);
    expect(settledRefsOf(last.raised)).toEqual(["9efb08a1.Decide.1"]);
    expect(problemsOf(last.raised)).toBe("");
    expect(last.refresh).toEqual({ asked: 2, shown: 1, reads: [] });
  });

  test("a read answered twice, or never asked for, changes nothing", () => {
    const once = after([ASK, read(1, OPEN)]);

    expect(step(once, read(1, ANSWERED))).toEqual({ state: once, effects: [] });
    expect(step(START, read(3, ANSWERED))).toEqual({ state: START, effects: [] });
  });
});

describe("a turn's end's refresh", () => {
  test("takes out the answers Submit held when it was asked for, once it has read the transcript they went into", () => {
    const reading = after([...sending(BOXES.first), entered(), TURN_END]);

    expect(reading.refresh.reads).toEqual([
      onTranscript(1, [{ press: 1, settled: FIRST_SENT }]),
    ]);
    expect(after([read(1, OPEN)], reading).sent).toEqual([]);
  });

  test("whose read answers after a newer refresh's that couldn't read the transcript still lands, so the answer it takes out stays settled", () => {
    // A press holds the first item's answer; the turn's end reads holding
    // it; a newer refresh, holding nothing, can't read the transcript.
    const reading = after([
      ...sending(BOXES.first),
      entered(),
      { type: "turn-started", turn: "t1" },
      { type: "turn-completed", turn: "t1" },
      TURN_END,
      ASK,
    ]);
    const failed = after([read(2, FAILED)], reading);
    const last = after([read(1, ANSWERED)], failed);

    expect(settledRefsOf(shownOf(failed))).toEqual(["9efb08a1.Decide.1"]);
    expect(last.sent).toEqual([]);
    expect(settledRefsOf(shownOf(last))).toEqual(["9efb08a1.Decide.1"]);
    expect(last.refresh).toEqual({ asked: 2, shown: 1, reads: [] });
  });

  test("keeps the answers a press holds that it wasn't asked with, one to the same item among them", () => {
    const reading = after([...sending(BOXES.first), entered(), TURN_END]);
    const last = after([...sending(BOXES.first, 2), read(1, OPEN)], reading);

    expect(last.sent).toEqual([{ press: 2, settled: FIRST_SENT }]);
    expect(settledRefsOf(last.raised)).toEqual([]);
  });

  test("that can't read the transcript takes nothing out", () => {
    const reading = after([...sending(BOXES.first), entered(), TURN_END]);

    expect(after([read(1, FAILED)], reading).sent).toEqual(reading.sent);
  });

  test("whose read is dropped as older still takes out what it was asked with, as it read the transcript they went into", () => {
    const reading = after([...sending(BOXES.first), entered(), TURN_END, ASK, read(2, OPEN)]);

    expect(after([read(1, OPEN)], reading).sent).toEqual([]);
  });

  test("any other refresh takes nothing out", () => {
    expect(after([...sending(BOXES.first), entered(), ASK, read(1, OPEN)]).sent).toEqual([
      { press: 1, settled: FIRST_SENT },
    ]);
  });
});

describe("gh saying a pull request merged", () => {
  const shown = after([ASK, read(1, OPEN)]);

  test("joins the known merges, and redraws the count line from the refresh's turns", () => {
    const last = after([merged([PULL], 1)], shown);

    expect(last.merged).toEqual([PULL]);
    expect(last.counts).toBe(countLine(TRANSCRIPTS.open, COUNTS.turns, new Set([PULL])));
    expect(last.counts).toBe("");
  });

  test("leaves the count line once a later refresh has been asked for, which reads the merge itself", () => {
    const later = after([ASK], shown);
    const last = after([merged([PULL], 1)], later);

    expect(last.merged).toEqual([PULL]);
    expect(last.counts).toBe(shown.counts);
    expect(after([read(2, OPEN)], last).counts).toBe("");
  });

  test("from the outstanding tool, joins the known merges and leaves the count line", () => {
    const last = after([merged([PULL])], shown);

    expect(last.merged).toEqual([PULL]);
    expect(last.counts).toBe(shown.counts);
  });

  test("naming nothing changes nothing", () => {
    expect(step(shown, merged([], 1))).toEqual({ state: shown, effects: [] });
  });
});

describe("the items looked at", () => {
  test("at a session's start or a turn's end, open the pane at its top over an open item it hadn't been opened over, once", () => {
    const first = steps([{ type: "announced" }]).at(-1);
    const again = step(first?.state ?? START, { type: "announced" });

    expect(first?.effects).toEqual([{ kind: "open-pane" }, { kind: "reveal", to: "start" }]);
    expect(unseen(first?.state.raised ?? RAISED)).toEqual([]);
    expect(again.effects).toEqual([]);
  });

  test("don't open the pane over items all settled", () => {
    expect(steps([ASK, read(1, REASSESSED), { type: "announced" }]).at(-1)?.effects).toEqual([]);
  });

  test("as the person opens the pane, are all seen, and nothing opens", () => {
    const last = steps([{ type: "seen" }]).at(-1);

    expect(last?.effects).toEqual([]);
    expect(step(last?.state ?? START, { type: "announced" }).effects).toEqual([]);
  });
});

describe("the raised items", () => {
  test("take in the items a kanban_options call draws", () => {
    expect(decideItemsOf(after([{ type: "items-drawn", items: [DRAWN] }]).raised)).toEqual([...ITEMS, DRAWN]);
  });

  test("stay for the same session, and go, with the answers held for them, for another", () => {
    const held = after([...sending(BOXES.first), entered()]);

    expect(after([{ type: "session-joined", session: "s" }], held)).toEqual(held);
    expect(after([{ type: "session-joined", session: "s2" }], held)).toMatchObject({
      raised: { session: "s2", items: [] },
      sent: [],
    });
  });

  test("a session's start lets go of the answers held, and leaves the reads still out, whose hooks still settle", () => {
    const reading = after([...sending(BOXES.first), entered(), TURN_END]);
    const restarted = after([{ type: "session-started" }], reading);

    expect(restarted.sent).toEqual([]);
    expect(restarted.refresh).toEqual(reading.refresh);
    expect(settledRefsOf(after([read(1, ANSWERED)], restarted).raised)).toEqual(["9efb08a1.Decide.1"]);
  });

  test("of another session take in no read asked before it was joined: each is dropped as it answers, and the new session's own refresh is shown", () => {
    const reading = after([ASK, ASK]);
    const joined = after([{ type: "session-started" }, { type: "session-joined", session: "s2" }], reading);
    const late = after([read(1, OPEN), read(2, FAILED)], joined);

    expect(joined.refresh).toEqual({ asked: 2, shown: 2, reads: reading.refresh.reads });
    expect(late.raised).toBe(joined.raised);
    expect(late.raised.items).toEqual([]);
    expect(problemsOf(late.raised)).toBe("");
    expect(decideItemsOf(after([ASK, read(3, OPEN)], late).raised)).toEqual(ITEMS);
  });
});

describe("the random refresh sequences", () => {
  // From an earlier press's answers held, as the invariants' runs may start.
  const runs = fc.sample(paneCommandsArb, { numRuns: 500, seed: 7 });
  const shareOf = (isMet: (before: PaneState, event: Event) => boolean): number =>
    runs.filter((commands) =>
      walkPane(commands, { ...START, sent: EARLIER }).some(({ before, event }) =>
        isMet(before, event),
      ),
    ).length / runs.length;
  const readingOf = (before: PaneState, event: Event) =>
    event.type === "transcript-read"
      ? before.refresh.reads.find((r) => r.refresh === event.refresh && r.on.at === "transcript")
      : undefined;

  test("have an older read answer after a newer one's in at least a quarter of runs", () => {
    expect(
      shareOf(
        (before, event) =>
          readingOf(before, event) !== undefined &&
          event.type === "transcript-read" &&
          event.refresh < before.refresh.shown,
      ),
    ).toBeGreaterThanOrEqual(1 / 4);
  });

  test("have an older read land after a newer one that couldn't read the transcript in at least one run in 25", () => {
    expect(
      shareOf(
        (before, event) =>
          readingOf(before, event) !== undefined &&
          event.type === "transcript-read" &&
          "turns" in event.found &&
          event.refresh > before.refresh.shown &&
          event.refresh < before.refresh.asked &&
          !before.refresh.reads.some((r) => r.refresh === before.refresh.asked),
      ),
    ).toBeGreaterThanOrEqual(1 / 25);
  });

  test("have a turn's end's read take out held answers in at least a tenth of runs", () => {
    expect(
      shareOf((before, event) => (readingOf(before, event)?.releases.length ?? 0) > 0),
    ).toBeGreaterThanOrEqual(1 / 10);
  });
});

describe("the refresh's invariants over random event sequences", () => {
  const sequences = fc.tuple(paneCommandsArb, startArb);
  const holds = (
    check: (s: Readonly<{ before: PaneState; event: Event; stepped: Stepped }>) => boolean,
  ) =>
    fc.assert(
      fc.property(sequences, ([commands, from]) => walkPane(commands, from).every(check)),
      { numRuns: 500 },
    );

  test("an older refresh's result never replaces a newer one's, and a read that couldn't read the transcript, or answers while the settings can't be used, settles nothing", () => {
    holds(({ before, event, stepped: { state } }) => {
      const isWaiting =
        event.type === "transcript-read" &&
        before.refresh.reads.some((r) => r.refresh === event.refresh && r.on.at === "transcript");
      const isNewer = isWaiting && event.refresh > before.refresh.shown;
      const isShown = isNewer && "turns" in event.found && before.settings.tag === "loaded";
      const isSettledSame =
        state.raised.items === before.raised.items &&
        state.counts === before.counts &&
        state.refresh.shown === before.refresh.shown;

      return (
        state.refresh.shown >= before.refresh.shown &&
        (event.type !== "transcript-read" ||
          (isShown
            ? state.refresh.shown === event.refresh
            : isSettledSame && (isNewer || state.raised === before.raised)))
      );
    });
  });

  test("the read shown moves only as a newer read that read the transcript is shown, or as another session is joined, to the last asked for", () => {
    holds(({ before, event, stepped: { state } }) =>
      state.refresh.shown === before.refresh.shown ||
      (event.type === "transcript-read" &&
        "turns" in event.found &&
        state.refresh.shown === event.refresh) ||
      (event.type === "session-joined" && state.refresh.shown === before.refresh.asked),
    );
  });

  test("joining another session leaves no read asked before it to be shown", () => {
    holds(({ before, event, stepped: { state } }) =>
      event.type !== "session-joined" ||
      event.session === before.raised.session ||
      state.refresh.reads.every((r) => r.refresh <= state.refresh.shown),
    );
  });

  test("a dropped read changes nothing but the reads waiting, and leaves a refresh still waiting on its settings", () => {
    holds(({ before, event, stepped: { state, effects } }) =>
      event.type !== "read-dropped" ||
      (effects.length === 0 &&
        isDeepStrictEqual(
          { ...state, refresh: { ...state.refresh, reads: [] } },
          { ...before, refresh: { ...before.refresh, reads: [] } },
        ) &&
        state.refresh.reads.every((r) => r.refresh !== event.refresh || r.on.at === "settings") &&
        before.refresh.reads
          .filter((r) => r.on.at === "settings")
          .every((r) => state.refresh.reads.includes(r))),
    );
  });

  test("a gh answer redraws the count line only for the newest refresh asked for", () => {
    holds(({ before, event, stepped: { state } }) =>
      event.type !== "merged-found" ||
      state.counts === before.counts ||
      event.asked?.refresh === before.refresh.asked,
    );
  });

  test("gh is asked only for the refresh whose result was just shown", () => {
    holds(({ stepped: { state, effects } }) =>
      effects.every((e) => e.kind !== "ask-merged" || e.asked.refresh === state.refresh.shown),
    );
  });

  test("the reads out are numbered in order, none past the last asked for nor at or before none", () => {
    holds(({ stepped: { state } }) => {
      const numbers = state.refresh.reads.map((r) => r.refresh);

      return (
        numbers.every(
          (n, i) => n > 0 && n <= state.refresh.asked && (i === 0 || n > (numbers[i - 1] ?? 0)),
        ) && state.refresh.shown <= state.refresh.asked
      );
    });
  });

  test("a transcript read takes out only the holds its refresh was asked with, and only once it read the transcript", () => {
    holds(({ before, event, stepped: { state } }) => {
      const gone = before.sent.filter((h) => !state.sent.includes(h));
      const reading = before.refresh.reads.find(
        (r) =>
          event.type === "transcript-read" &&
          r.refresh === event.refresh &&
          r.on.at === "transcript",
      );

      return (
        event.type !== "transcript-read" ||
        (gone.every((h) => reading?.releases.includes(h) === true && "turns" in event.found) &&
          state.sent.every((h) => before.sent.includes(h)))
      );
    });
  });

  test("every answer Submit holds Done is a raised item's", () => {
    holds(({ stepped: { state } }) =>
      state.sent.every((h) => decideItemsOf(state.raised).some((item) => item.ref === h.settled.ref)),
    );
  });

  test("the merges known only grow", () => {
    holds(({ before, stepped: { state } }) => before.merged.every((ref) => state.merged.includes(ref)));
  });

  test("a raised item stays raised, but for another session's", () => {
    holds(({ before, event, stepped: { state } }) =>
      event.type === "session-joined" ||
      decideItemsOf(before.raised).every((item) => decideItemsOf(state.raised).some((i) => i.ref === item.ref)),
    );
  });

  test("each raised item is raised once, by its ref", () => {
    holds(({ stepped: { state } }) => {
      const refs = decideItemsOf(state.raised).map((item) => item.ref);

      return new Set(refs).size === refs.length;
    });
  });

  test("the pane opens by itself only over an open item it hadn't been opened over", () => {
    holds(({ before, stepped: { effects } }) =>
      effects.every((e) => e.kind !== "open-pane" || unseen(before.raised).length > 0),
    );
  });

  test("from the start, a refresh's first result is shown", () => {
    const last = steps([ASK, read(1, OPEN)], INITIAL_PANE).at(-1);

    expect(last?.state.refresh.shown).toBe(1);
  });
});
