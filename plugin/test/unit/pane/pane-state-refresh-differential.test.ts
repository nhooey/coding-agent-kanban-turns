// The refresh's differential test: the old handlers, test/oracle/refresh.ts
// with Submit's in test/oracle/submit.ts, as the hooks sequence them,
// against `step` and a model of the hooks' interpreter,
// test/fixtures/pane-model.ts, through the same random sequences of turns'
// ends, session starts, /answers, `kanban_options` calls, presses and
// answers to every call waiting, transcript reads and `gh` calls among
// them, answered in any order. After every command both say the same: the
// raised items as the pane draws them, the answers held Done, what the pane
// says, the count line, the calls waiting, and how often the pane opened by
// itself and closed.
//
// Five differences are fixes, found only where the model says a run has
// reached them, judged on each step's input, after which the run's
// comparison ends; named tests show each:
//
// - a transcript read answers no newer than the read shown, or after the
//   session changed: it no longer replaces what the pane shows;
// - a press holds an answer to an item another press's release names: a
//   turn's end takes out only the holds its read began with, and a refusal
//   only its press's own;
// - an overtaken press ends while the pane says something of a later
//   press, or of an earlier one: what it says stays apart;
// - a transcript read lands after a later refresh read the settings files
//   to say something else: it draws with the settings in effect, where the
//   old handlers drew it with what its own refresh read;
// - a turn's end that holds answers reads the settings files and finds
//   them broken: it reads the transcript to let go of them, where the old
//   handlers read none and kept them held.
//
// The settings are read at once on both sides, so no settings read answers
// after a newer one here; pane-state-settings-differential.test.ts holds
// them.
//
// A read that couldn't read the transcript shows no read, so an older one
// that did still lands after it, on both sides.
//
// The race Submit's differential test names, a press while a turn runs,
// is answered at once here too.
//
// Temporary: deleted with the oracles once the last of the pane's areas
// has moved into src/pane/pane-state.ts.

import { describe, test } from "node:test";
import { expect } from "expect";
import fc from "fast-check";

import { heldNow } from "../../../src/items/raised.ts";
import type { Event, Found } from "../../../src/pane/pane-state.ts";
import type { DecideItem } from "../../../types/index.d.ts";
import { oldEngine, submitDraft, turnStarted } from "../../oracle/submit.ts";
import type { OldEngine, OldLoaded, TranscriptReply } from "../../oracle/submit.ts";
import {
  itemsDrawn,
  observedOld,
  reopened,
  sessionStartedRefresh,
  turnCompletedRefresh,
} from "../../oracle/refresh.ts";
import { BOXES, ITEMS, RAISED, START, replyArb, turnArb } from "../../fixtures/submit.ts";
import type { Reply } from "../../fixtures/submit.ts";
import {
  COUNTS,
  DRAWN,
  GONE,
  PULL,
  TRANSCRIPTS,
  foundArb,
  mergedArb,
} from "../../fixtures/refresh.ts";
import {
  answeredAsk,
  answeredPrompt,
  answeredRead,
  NOT_DIVERGED,
  dispatched,
  filesOf,
  isDiverged,
  model,
  observedNew,
  withFiles,
} from "../../fixtures/pane-model.ts";
import type { Model } from "../../fixtures/pane-model.ts";
import { BAD_KEY, withSettings } from "../../fixtures/settings.ts";

/** Lets the old handlers run until each waits on a call. */
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

type Command = Readonly<
  | { do: "press" }
  | { do: "turn-start"; turn: string }
  | { do: "turn-complete"; turn: string }
  | { do: "session-start"; session: string }
  | { do: "answers" }
  | { do: "items-drawn"; items: readonly DecideItem[] }
  | { do: "answer"; pick: number; reply: Reply }
  | { do: "read"; pick: number; found: Found }
  | { do: "gh"; pick: number; merged: readonly string[] }
  | { do: "settings"; loaded: OldLoaded }
>;

/** Settings files with nothing wrong. */
const CLEAN_FILES: OldLoaded = { counts: COUNTS, problems: [] };

/** The settings files may say: usable, usable with a file's problem, or not usable. */
const LOADS: readonly OldLoaded[] = [
  CLEAN_FILES,
  { counts: COUNTS, problems: ["config.yaml: bad key"] },
  { counts: null, problems: ["defaults/config.yaml: missing"] },
];

const ANY: Reply = { text: BOXES.first, isFilled: true, refusal: undefined };

// Replies that mostly send: a box answering items, filled, taken. Submit's
// own differential test draws every reply evenly.
const sendingReplyArb: fc.Arbitrary<Reply> = fc.oneof(
  {
    arbitrary: fc.record({
      text: fc.constantFrom(BOXES.first, BOXES.both, BOXES.stray),
      isFilled: fc.constant(true),
      refusal: fc.constant(undefined),
    }),
    weight: 3,
  },
  { arbitrary: replyArb, weight: 1 },
);

// Presses and the answers to their calls outweigh the rest, so a press
// often holds answers Done before a turn's end reads the transcript. A
// transcript read finds what `found` gives, and the settings files change
// to what `files` gives.
const commandArbWith = (
  found: fc.Arbitrary<Found>,
  files: readonly OldLoaded[] = LOADS,
): fc.Arbitrary<Command> => fc.oneof(
  { arbitrary: fc.constant<Command>({ do: "press" }), weight: 3 },
  turnArb.map((turn): Command => ({ do: "turn-start", turn })),
  { arbitrary: turnArb.map((turn): Command => ({ do: "turn-complete", turn })), weight: 2 },
  fc.constantFrom("s", "s2").map((session): Command => ({ do: "session-start", session })),
  fc.constant<Command>({ do: "answers" }),
  fc
    .subarray([...ITEMS, DRAWN], { minLength: 1 })
    .map((items): Command => ({ do: "items-drawn", items })),
  {
    arbitrary: fc
      .record({ pick: fc.nat({ max: 3 }), reply: sendingReplyArb })
      .map((r): Command => ({ do: "answer", ...r })),
    weight: 6,
  },
  // Reads mostly answer oldest first, so fewer runs end early on an older
  // read answering after a newer one, and more reach a turn's end's read.
  {
    arbitrary: fc
      .record({
        pick: fc.oneof({ arbitrary: fc.constant(0), weight: 3 }, fc.nat({ max: 3 })),
        found,
      })
      .map((r): Command => ({ do: "read", ...r })),
    weight: 3,
  },
  fc
    .record({ pick: fc.nat({ max: 3 }), merged: mergedArb })
    .map((r): Command => ({ do: "gh", ...r })),
  // The settings files change between refreshes, so a newer refresh may
  // read none while an older one's read is still out.
  fc.constantFrom(...files).map((loaded): Command => ({ do: "settings", loaded })),
);

/** The commands, a transcript read finding what the fixtures' reads do. */
const commandArb: fc.Arbitrary<Command> = commandArbWith(foundArb);

/**
 * The commands, a transcript read failing one time in two and the settings
 * files staying clean: a newer refresh that reads no transcript is how an
 * older read lands late, and clean files keep the settings' fixes from
 * ending a run first.
 */
const failingCommandArb: fc.Arbitrary<Command> = commandArbWith(
  fc.oneof(foundArb, fc.constant<Found>({ problem: GONE })),
  [CLEAN_FILES],
);

/** The settings a run starts with. */
const loadedArb: fc.Arbitrary<OldLoaded> = fc.constantFrom(...LOADS);

/** What the old transcript read answers with for what `step`'s found. */
const oldReply = (found: Found): TranscriptReply =>
  "turns" in found ? { turns: found.turns } : { problem: found.problem };

const releasing: Event = { type: "refresh-asked", releases: true };
const refreshing: Event = { type: "refresh-asked", releases: false };

/** Runs one command on both sides; the old handlers are left waiting on their next call. */
const runCommand = async ($: OldEngine, m: Model, c: Command): Promise<Model> => {
  const isClosed = $.isClosedWhenAllSubmitted;

  switch (c.do) {
    case "press": {
      const readsWhileRunning = $.atoms.runningTurn !== "" && $.atoms.submitting === 0;
      void submitDraft($);
      await flush();

      if (readsWhileRunning) {
        $.pending.pop()?.answer(ANY);
        await flush();
      }

      return dispatched(m, { type: "submit-pressed" });
    }
    case "turn-start":
      await turnStarted($, c.turn);
      await flush();

      return dispatched(m, { type: "turn-started", turn: c.turn });
    case "turn-complete":
      void turnCompletedRefresh($, c.turn);
      await flush();

      return dispatched(dispatched(m, { type: "turn-completed", turn: c.turn }), releasing, [
        { type: "announced" },
      ]);
    case "session-start":
      void sessionStartedRefresh($, c.session);
      await flush();

      return dispatched(
        dispatched(dispatched(m, { type: "session-started" }), {
          type: "session-joined",
          session: c.session,
        }),
        refreshing,
        [{ type: "announced" }],
      );
    case "answers":
      void reopened($);
      await flush();

      return dispatched(m, refreshing, [{ type: "seen" }]);
    case "items-drawn":
      await itemsDrawn($, c.items);
      await flush();

      return dispatched(m, { type: "items-drawn", items: c.items });
    case "answer": {
      if ($.pending.length === 0) {
        return m;
      }
      const at = c.pick % $.pending.length;
      $.pending.splice(at, 1)[0]?.answer(c.reply);
      await flush();

      return answeredPrompt(m, at, c.reply);
    }
    case "read": {
      if ($.reads.length === 0) {
        return m;
      }
      const at = c.pick % $.reads.length;
      $.reads.splice(at, 1)[0]?.answer(oldReply(c.found));
      await flush();

      return answeredRead(m, at, c.found);
    }
    case "gh": {
      if ($.asks.length === 0) {
        return m;
      }
      const at = c.pick % $.asks.length;
      $.asks.splice(at, 1)[0]?.answer(c.merged);
      await flush();

      return answeredAsk(m, at, c.merged);
    }
    case "settings":
      $.loaded = c.loaded;

      return withFiles(m, filesOf(c.loaded, isClosed));
  }
};

/** The model as a run starts: the settings `loaded` read, the close setting `isClosed`. */
const fresh = (loaded: OldLoaded, isClosed: boolean): Model =>
  model(withSettings(START, filesOf(loaded, isClosed)), filesOf(loaded, isClosed));

/**
 * Runs `commands` on both sides, comparing them after each, until the
 * model says the run has reached a difference made by design; resolves to
 * how many commands were compared, and the run's model.
 */
const compared = async (
  commands: readonly Command[],
  loaded: OldLoaded,
  isClosed: boolean,
): Promise<Readonly<{ count: number; m: Model }>> => {
  const $ = oldEngine(RAISED, isClosed, loaded);

  return commands.reduce(
    async (before, command, n) => {
      const { m, count } = await before;

      if (isDiverged(m.diverged)) {
        return { m, count };
      }
      const next = await runCommand($, m, command);

      if (!isDiverged(next.diverged)) {
        expect({ n, ...observedOld($) }).toEqual({ n, ...observedNew(next) });
      }

      return { m: next, count: count + 1 };
    },
    Promise.resolve({ m: fresh(loaded, isClosed), count: 0 }),
  );
};

describe("the refresh's step against the old handlers", () => {
  /** Runs `numRuns` seeded random sequences of `commands`, comparing both sides; resolves to what share of commands were compared, and what share of runs reached each path. */
  const measured = async (
    commands: fc.Arbitrary<Command>,
    seed: number,
    numRuns: number,
    files: fc.Arbitrary<OldLoaded> = loadedArb,
  ) => {
    const counts = {
      compared: 0,
      all: 0,
      readsAtOnce: 0,
      released: 0,
      landedLate: 0,
      merged: 0,
      runs: 0,
    };
    await fc.assert(
      fc.asyncProperty(
        fc.array(commands, { minLength: 30, maxLength: 80 }),
        files,
        fc.boolean(),
        async (sequence, loaded, isClosed) => {
          const run = await compared(sequence, loaded, isClosed);
          counts.compared += run.count;
          counts.all += sequence.length;
          counts.runs += 1;
          counts.readsAtOnce += run.m.state.refresh.asked > 1 ? 1 : 0;
          counts.released += run.m.released > 0 ? 1 : 0;
          counts.landedLate += run.m.landedLate > 0 ? 1 : 0;
          counts.merged += run.m.state.merged.length > 0 ? 1 : 0;
        },
      ),
      { numRuns, seed },
    );

    return {
      compared: counts.compared / counts.all,
      readsAtOnce: counts.readsAtOnce / counts.runs,
      released: counts.released / counts.runs,
      landedLate: counts.landedLate / counts.runs,
      merged: counts.merged / counts.runs,
    };
  };

  test("say the same after every command of random sequences, until a run reaches a fix", async () => {
    // Seeded, so the shares below are measured over the same runs each time.
    const shares = await measured(commandArb, 20261121, 400);

    // The fixes cut some runs short: of 400 runs, 145 at a stale read, and
    // 54 and 47 at the settings' drawn and freed fixes, as the files change
    // while a read is out, so 0.642 of commands are compared, short of the
    // 0.75 this test held before the settings moved. Most runs refresh more
    // than once (0.97), and enough take out answers a turn's end read
    // (0.073) or learn of a merge (0.125).
    expect(shares.compared).toBeGreaterThan(0.6);
    expect(shares.readsAtOnce).toBeGreaterThan(0.9);
    expect(shares.released).toBeGreaterThan(0.06);
    expect(shares.merged).toBeGreaterThan(0.1);
  });

  test("say the same after every command of random sequences whose reads fail one time in two, the files clean, until a run reaches a fix", async () => {
    // An older read lands late after a newer one that read no transcript,
    // which the fixtures' reads reach in few runs (0.02 above). Measured
    // here: 0.0575 of runs land one late, and 0.70 of commands compared.
    const shares = await measured(failingCommandArb, 20261126, 400, fc.constant(CLEAN_FILES));

    expect(shares.landedLate).toBeGreaterThan(0.05);
    expect(shares.compared).toBeGreaterThan(0.65);
  });

  /** Answers the call waiting at `at` on both sides. */
  const answerRead = async ($: OldEngine, m: Model, found: Found, at = 0): Promise<Model> => {
    $.reads.splice(at, 1)[0]?.answer(oldReply(found));
    await flush();

    return answeredRead(m, at, found);
  };
  /** Answers the prompt call waiting at `at` on both sides. */
  const answer = async ($: OldEngine, m: Model, reply: Reply, at = 0): Promise<Model> => {
    $.pending.splice(at, 1)[0]?.answer(reply);
    await flush();

    return answeredPrompt(m, at, reply);
  };
  /** A press sending `box` on both sides, its draft waiting on the engine. */
  const sendOut = async ($: OldEngine, m: Model, box: string): Promise<Model> => {
    void submitDraft($);
    await flush();
    const read = await answer($, dispatched(m, { type: "submit-pressed" }), { ...ANY, text: box });

    return answer($, read, ANY);
  };
  /** A press sending `box` on both sides, the engine taking its draft. */
  const send = async ($: OldEngine, m: Model, box: string): Promise<Model> =>
    answer($, await sendOut($, m, box), ANY);
  /** A turn's end on both sides, its read waiting. */
  const turnEnd = async ($: OldEngine, m: Model, turn: string): Promise<Model> => {
    void turnCompletedRefresh($, turn);
    await flush();

    return dispatched(dispatched(m, { type: "turn-completed", turn }), releasing, [
      { type: "announced" },
    ]);
  };
  const LOADED: OldLoaded = { counts: COUNTS, problems: [] };
  const open: Found = { turns: TRANSCRIPTS.open };
  const answered: Found = { turns: TRANSCRIPTS.answered };

  test("fix: an older refresh's read that answers after a newer one's no longer replaces it; the old handlers drew the older", async () => {
    const $ = oldEngine(RAISED, false, LOADED);
    void turnCompletedRefresh($, "t1");
    void turnCompletedRefresh($, "t2");
    await flush();
    const asked = dispatched(
      dispatched(fresh(LOADED, false), releasing, [{ type: "announced" }]),
      releasing,
      [{ type: "announced" }],
    );
    const newer = await answerRead($, asked, answered, 1);
    const older = await answerRead($, newer, open, 0);

    // The old handlers drew the first item open again, from the older read.
    expect(observedOld($).shown.settledRefs).toEqual([]);
    // `step` keeps what the newer read found: the first item answered.
    expect(observedNew(older).shown.settledRefs).toEqual(["9efb08a1.Decide.1"]);
    expect(older.state.refresh).toEqual({ asked: 2, shown: 2, reads: [] });
    expect(older.diverged.stale).toBe(true);
  });

  test("a newer refresh's read that can't read the transcript leaves an older one's that did to land, and the answer it took out stays settled, on both sides", async () => {
    const $ = oldEngine(RAISED, false, LOADED);
    // A press holds the first item's answer Done, and the turn's end reads
    // the transcript holding it; /answers asks for a newer read beside it.
    const reading = await turnEnd($, await send($, fresh(LOADED, false), BOXES.first), "t1");
    void reopened($);
    await flush();
    const both = dispatched(reading, refreshing, [{ type: "seen" }]);
    const failed = await answerRead($, both, { problem: GONE }, 1);
    const landed = await answerRead($, failed, answered, 0);

    expect(observedNew(landed)).toEqual(observedOld($));
    expect(landed.state.sent).toEqual([]);
    expect(observedNew(landed).shown.settledRefs).toEqual(["9efb08a1.Decide.1"]);
    expect(landed.state.refresh).toEqual({ asked: 2, shown: 1, reads: [] });
    expect(landed.landedLate).toBe(1);
    expect(landed.diverged).toEqual(NOT_DIVERGED);
  });

  test("fix: a read that lands after a later refresh read other settings draws with those; the old handlers drew it with what its own refresh read", async () => {
    const $ = oldEngine(RAISED, false, LOADED);
    // The turn's end reads under clean files; then a user file goes wrong,
    // and /answers reads it before the first read lands.
    const reading = await turnEnd($, fresh(LOADED, false), "t1");
    const warned: OldLoaded = { counts: COUNTS, problems: [BAD_KEY] };
    $.loaded = warned;
    void reopened($);
    await flush();
    const both = dispatched(withFiles(reading, filesOf(warned, false)), refreshing, [
      { type: "seen" },
    ]);
    const landed = await answerRead($, both, open, 0);

    // The old handlers drew the first read with its own clean files.
    expect(observedOld($).problems).toBe("");
    // `step` draws it with the settings in effect, which warn.
    expect(observedNew(landed).problems).toBe(BAD_KEY);
    expect(landed.diverged.drawn).toBe(true);
  });

  test("fix: a read asked before the session changed is dropped as it answers; the old handlers drew the last session's transcript into the new one's items", async () => {
    const $ = oldEngine(RAISED, false, LOADED);
    const reading = await turnEnd($, fresh(LOADED, false), "t1");
    void sessionStartedRefresh($, "s2");
    await flush();
    const joined = dispatched(
      dispatched(dispatched(reading, { type: "session-started" }), {
        type: "session-joined",
        session: "s2",
      }),
      refreshing,
      [{ type: "announced" }],
    );
    const late = await answerRead($, joined, open, 0);

    // The old handlers raised the last session's items in the new one.
    expect(observedOld($).shown.items).toHaveLength(2);
    // `step` drops the read: the new session's items wait for its own.
    expect(observedNew(late).shown.items).toEqual([]);
    expect(late.state.refresh).toEqual({
      asked: 2,
      shown: 1,
      reads: [{ refresh: 2, releases: [], on: { at: "transcript" } }],
    });
    expect(late.diverged.stale).toBe(true);
  });

  test("fix: a turn's end takes out the holds its read began with, and keeps a later press's answer to the same item; the old handlers took both out by ref", async () => {
    const $ = oldEngine(RAISED, false, LOADED);
    // The turn's end begins its read holding press 1's answer.
    const reading = await turnEnd($, await send($, fresh(LOADED, false), BOXES.first), "t1");
    // Press 2 answers the same item again while the read is out.
    const second = await send($, reading, BOXES.first);
    const read = await answerRead($, second, open);

    expect($.atoms.sent).toEqual([]);
    expect(heldNow(read.state.sent).map((s) => s.ref)).toEqual(["9efb08a1.Decide.1"]);
    expect(read.state.sent.map((h) => h.press)).toEqual([2]);
    expect(read.diverged.holds).toBe(true);
  });

  test("a read that can't read the transcript settles nothing on either side, and says why", async () => {
    const $ = oldEngine(RAISED, false, LOADED);
    void turnCompletedRefresh($, "t1");
    await flush();
    const asked = dispatched(fresh(LOADED, false), releasing, [{ type: "announced" }]);
    const read = await answerRead($, asked, { problem: GONE });

    expect(observedNew(read)).toEqual(observedOld($));
    expect(observedNew(read).problems).toBe(GONE);
  });

  test("a merge gh reports redraws the count line on both sides", async () => {
    const $ = oldEngine(RAISED, false, LOADED);
    void turnCompletedRefresh($, "t1");
    await flush();
    const read = await answerRead(
      $,
      dispatched(fresh(LOADED, false), releasing, [{ type: "announced" }]),
      open,
    );
    $.asks.splice(0, 1)[0]?.answer([PULL]);
    await flush();
    const merged = answeredAsk(read, 0, [PULL]);

    expect(observedNew(read).counts).toBe("📌 Outstanding: 🔍 1");
    expect(observedNew(merged)).toEqual(observedOld($));
    expect(merged.state.counts).toBe("");
    expect(merged.state.merged).toEqual([PULL]);
  });
});
