// The settings' differential test: the old interpreter, test/oracle/
// settings.ts, around 6784a3e's step, test/oracle/pane-state.ts, while the
// settings were an atom of their own, against `step` and a model of the
// hooks' interpreter, test/fixtures/pane-model.ts, through the same random
// sequences of settings files changing, refreshes, /answers-config reads,
// presses, and answers to every call waiting, settings loads, transcript
// reads, prompt calls and `gh` calls, answered in any order. After every
// command both say the same: the settings in effect, what /answers-config
// and the tool found, the raised items as the pane draws them, the answers
// held Done, what the pane says, the count line, the calls waiting, and how
// often the pane opened by itself and closed.
//
// Differences are found only where the model says a run has reached them,
// judged on each step's input, after which the run's comparison ends; named
// tests show each:
//
// - race made unreachable: a settings read answers after a newer one's,
//   with other files. `step` drops it, where the old handlers wrote the
//   older files over the newer, for the pane, Submit's close and every
//   read after it;
// - fix: a refresh's transcript read lands after a newer settings read
//   found other settings. It draws with the settings in effect, where the
//   old handlers drew it with what its own settings read found: a read that
//   lands after the settings broke settles nothing and says why;
// - fix: a turn's end that holds answers has its settings read answered
//   while the settings are broken. It reads the transcript to let go of
//   them, where the old handlers read none and kept them held;
// - fix: an older refresh's transcript read, as the refresh's test has it.
//
// Temporary: deleted with the oracles once the last of the pane's areas has
// moved into src/pane/pane-state.ts.

import { describe, test } from "node:test";
import { expect } from "expect";
import fc from "fast-check";

import { heldNow, problemsOf, withSent } from "../../../src/items/raised.ts";
import { loadedOf, submitShown } from "../../../src/pane/pane-state.ts";
import type { Found } from "../../../src/pane/pane-state.ts";
import type { Loaded } from "../../../types/index.d.ts";
import { INITIAL_PANE as OLD_INITIAL } from "../../oracle/pane-state.ts";
import type { OldPaneState } from "../../oracle/pane-state.ts";
import { dispatch, readAlone, settingsEngine } from "../../oracle/settings.ts";
import type { SettingsEngine } from "../../oracle/settings.ts";
import type { TranscriptReply } from "../../oracle/submit.ts";
import { BOXES, RAISED, START, replyArb } from "../../fixtures/submit.ts";
import type { Reply } from "../../fixtures/submit.ts";
import { GONE, PULL, TRANSCRIPTS, foundArb, mergedArb } from "../../fixtures/refresh.ts";
import {
  BAD_KEY,
  BROKEN,
  MISSING,
  loadedArb,
  usable,
  withSettings,
} from "../../fixtures/settings.ts";
import {
  answeredAsk,
  answeredLoad,
  answeredPrompt,
  answeredRead,
  callOf,
  dispatched,
  isDiverged,
  model,
  observedNew,
  problemOf,
  withFiles,
} from "../../fixtures/pane-model.ts";
import type { Model } from "../../fixtures/pane-model.ts";

/** Lets the old handlers run until each waits on a call. */
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

type Command = Readonly<
  | { do: "files"; files: Loaded }
  | { do: "refresh"; releases: boolean }
  | { do: "config" }
  | { do: "press" }
  | { do: "answer"; pick: number; reply: Reply }
  | { do: "load"; pick: number }
  | { do: "read"; pick: number; found: Found }
  | { do: "gh"; pick: number; merged: readonly string[] }
>;

// Replies that mostly send: a box answering both items, filled, taken, so
// the pane often closes, or not, by the close setting in effect.
const sendingReplyArb: fc.Arbitrary<Reply> = fc.oneof(
  {
    arbitrary: fc.record({
      text: fc.constantFrom(BOXES.both, BOXES.first),
      isFilled: fc.constant(true),
      refusal: fc.constant(undefined),
    }),
    weight: 3,
  },
  { arbitrary: replyArb, weight: 1 },
);

// Loads answer oldest first more often than not, so more runs reach a
// refresh's transcript read before one answers out of turn.
const commandArb: fc.Arbitrary<Command> = fc.oneof(
  { arbitrary: loadedArb.map((files): Command => ({ do: "files", files })), weight: 2 },
  { arbitrary: fc.boolean().map((releases): Command => ({ do: "refresh", releases })), weight: 3 },
  fc.constant<Command>({ do: "config" }),
  { arbitrary: fc.constant<Command>({ do: "press" }), weight: 2 },
  {
    arbitrary: fc
      .record({ pick: fc.nat({ max: 3 }), reply: sendingReplyArb })
      .map((r): Command => ({ do: "answer", ...r })),
    weight: 4,
  },
  {
    arbitrary: fc
      .oneof({ arbitrary: fc.constant(0), weight: 3 }, fc.nat({ max: 3 }))
      .map((pick): Command => ({ do: "load", pick })),
    weight: 4,
  },
  {
    arbitrary: fc
      .record({
        pick: fc.oneof({ arbitrary: fc.constant(0), weight: 3 }, fc.nat({ max: 3 })),
        found: foundArb,
      })
      .map((r): Command => ({ do: "read", ...r })),
    weight: 3,
  },
  fc
    .record({ pick: fc.nat({ max: 3 }), merged: mergedArb })
    .map((r): Command => ({ do: "gh", ...r })),
);

/** The new side: the model, and which settings reads /answers-config asked for, with what each found once it answered. */
type New = Readonly<{ m: Model; configs: readonly number[]; said: readonly Loaded[] }>;

/** What the transcript read answers the old handlers with for what `step`'s found. */
const oldReply = (found: Found): TranscriptReply =>
  "turns" in found ? { turns: found.turns } : { problem: found.problem };

/** What the differential test compares of the old handlers. */
const observedOld = ($: SettingsEngine) => ({
  settings: $.settings,
  said: $.said,
  isBusy: submitShown($.pane.submit).isBusy,
  problem: [$.pane.aside.said, submitShown($.pane.submit).problem]
    .filter((p) => p !== "")
    .join("\n"),
  sent: heldNow($.pane.sent),
  shown: withSent($.pane.raised, heldNow($.pane.sent)),
  problems: problemsOf($.pane.raised),
  counts: $.pane.counts,
  draft: $.draft,
  pending: $.pending.map((p) => p.call),
  loads: $.loads.length,
  reads: $.reads.length,
  asks: $.asks.map((a) => a.refs),
  submitted: $.submitted,
  closes: $.closes,
  opens: $.opens,
});

/** What the differential test compares of the model. */
const observed = (n: New) => ({
  settings: loadedOf(n.m.state.settings),
  said: n.said,
  ...observedNew(n.m),
  loads: n.m.loads.length,
});

/** Runs one command on both sides; the old handlers are left waiting on their next call. */
const runCommand = async ($: SettingsEngine, n: New, c: Command): Promise<New> => {
  switch (c.do) {
    case "files":
      $.files = c.files;

      return { ...n, m: withFiles(n.m, c.files) };
    case "refresh": {
      const then = { type: c.releases ? "announced" : "seen" } as const;
      void dispatch($, { type: "refresh-asked", releases: c.releases }).then(() =>
        dispatch($, then),
      );
      await flush();

      return { ...n, m: dispatched(n.m, { type: "refresh-asked", releases: c.releases }, [then]) };
    }
    case "config": {
      void readAlone($);
      await flush();
      const m = dispatched(n.m, { type: "settings-asked" });

      return { ...n, m, configs: [...n.configs, m.state.settings.asked] };
    }
    case "press":
      void dispatch($, { type: "submit-pressed" });
      await flush();

      return { ...n, m: dispatched(n.m, { type: "submit-pressed" }) };
    case "answer": {
      if ($.pending.length === 0) {
        return n;
      }
      const at = c.pick % $.pending.length;
      $.pending.splice(at, 1)[0]?.answer(c.reply);
      await flush();

      return { ...n, m: answeredPrompt(n.m, at, c.reply) };
    }
    case "load": {
      if ($.loads.length === 0) {
        return n;
      }
      const at = c.pick % $.loads.length;
      const read = n.m.loads[at]?.effect.read ?? 0;
      $.loads.splice(at, 1)[0]?.answer();
      await flush();
      const m = answeredLoad(n.m, at);

      return n.configs.includes(read)
        ? { m, configs: n.configs, said: [...n.said, loadedOf(m.state.settings)] }
        : { ...n, m };
    }
    case "read": {
      if ($.reads.length === 0) {
        return n;
      }
      const at = c.pick % $.reads.length;
      $.reads.splice(at, 1)[0]?.answer(oldReply(c.found));
      await flush();

      return { ...n, m: answeredRead(n.m, at, c.found) };
    }
    case "gh": {
      if ($.asks.length === 0) {
        return n;
      }
      const at = c.pick % $.asks.length;
      $.asks.splice(at, 1)[0]?.answer(c.merged);
      await flush();

      return { ...n, m: answeredAsk(n.m, at, c.merged) };
    }
  }
};

const OLD_START: OldPaneState = { ...OLD_INITIAL, raised: RAISED };

/** Both sides as a run starts: the files `files`, read once already. */
const fresh = (files: Loaded): Readonly<{ $: SettingsEngine; n: New }> => ({
  $: settingsEngine(OLD_START, files),
  n: { m: model(withSettings(START, files), files, true), configs: [], said: [] },
});

/**
 * Runs `commands` on both sides, comparing them after each, until the
 * model says the run has reached a difference made by design; resolves to
 * how many commands were compared, and the run's new side.
 */
const compared = async (
  commands: readonly Command[],
  files: Loaded,
): Promise<Readonly<{ count: number; n: New; loadsAtOnce: boolean }>> => {
  const start = fresh(files);

  return commands.reduce(
    async (before, command, at) => {
      const run = await before;

      if (isDiverged(run.n.m.diverged)) {
        return run;
      }
      const n = await runCommand(start.$, run.n, command);

      if (!isDiverged(n.m.diverged)) {
        expect({ at, ...observedOld(start.$) }).toEqual({ at, ...observed(n) });
      }

      return { count: run.count + 1, n, loadsAtOnce: run.loadsAtOnce || n.m.loads.length > 1 };
    },
    Promise.resolve({ count: 0, n: start.n, loadsAtOnce: false }),
  );
};

describe("the settings' step against the old handlers", () => {
  test("say the same after every command of random sequences, until a run reaches a difference", async () => {
    const counts = { compared: 0, all: 0, runs: 0, older: 0, drawn: 0, freed: 0, loadsAtOnce: 0, closes: 0, said: 0 };
    // Seeded, so the shares below are measured over the same runs each time.
    await fc.assert(
      fc.asyncProperty(
        fc.array(commandArb, { minLength: 30, maxLength: 80 }),
        loadedArb,
        async (commands, files) => {
          const run = await compared(commands, files);
          counts.compared += run.count;
          counts.all += commands.length;
          counts.runs += 1;
          counts.older += run.n.m.diverged.older ? 1 : 0;
          counts.drawn += run.n.m.diverged.drawn ? 1 : 0;
          counts.freed += run.n.m.diverged.freed ? 1 : 0;
          counts.loadsAtOnce += run.loadsAtOnce ? 1 : 0;
          counts.closes += run.n.m.closes > 0 ? 1 : 0;
          counts.said += run.n.said.length > 0 ? 1 : 0;
        },
      ),
      { numRuns: 300, seed: 20261126 },
    );

    // Most commands are compared; many runs have settings reads out side by
    // side, and enough reach each difference, close the pane by the setting
    // a read found, or answer /answers-config, to be checked. Measured over
    // these runs: 0.82 of commands compared, and of runs, 0.92 with reads
    // side by side, 0.087 older, 0.163 drawn, 0.067 freed, 0.163 closing
    // and 0.70 answering /answers-config.
    expect(counts.compared / counts.all).toBeGreaterThan(0.8);
    expect(counts.loadsAtOnce / counts.runs).toBeGreaterThan(0.9);
    expect(counts.older / counts.runs).toBeGreaterThan(0.08);
    expect(counts.drawn / counts.runs).toBeGreaterThan(0.15);
    expect(counts.freed / counts.runs).toBeGreaterThan(0.06);
    expect(counts.closes / counts.runs).toBeGreaterThan(0.15);
    expect(counts.said / counts.runs).toBeGreaterThan(0.65);
  });

  /** Runs `commands` on both sides from `files`, comparing nothing; resolves to both sides after them. */
  const ran = async (commands: readonly Command[], files: Loaded) => {
    const start = fresh(files);
    const n = await commands.reduce(
      async (before, c) => runCommand(start.$, await before, c),
      Promise.resolve(start.n),
    );

    return { $: start.$, n };
  };
  const REFRESH: Command = { do: "refresh", releases: false };
  const CONFIG: Command = { do: "config" };
  const load = (pick = 0): Command => ({ do: "load", pick });
  const files = (f: Loaded): Command => ({ do: "files", files: f });

  test("race made unreachable: a settings read that answers after a newer one's is dropped; the old handlers wrote the older files over the newer", async () => {
    // /answers-config reads clean files; the user file goes wrong, and a
    // second read finds it; the second answers first.
    const { $, n } = await ran(
      [CONFIG, files(usable(false, [BAD_KEY])), CONFIG, load(1), load(0)],
      usable(false),
    );

    // The old handlers' atom holds the older, clean read.
    expect($.settings.problems).toEqual([]);
    // `step` keeps the newer read's warning.
    expect(loadedOf(n.m.state.settings).problems).toEqual([BAD_KEY]);
    expect(n.m.diverged.older).toBe(true);
  });

  test("an older settings read that answers first is in effect until the newer one's answers, on both sides", async () => {
    const { $, n } = await ran(
      [CONFIG, files(usable(false, [BAD_KEY])), CONFIG, load(0)],
      usable(false),
    );

    expect(observed(n)).toEqual(observedOld($));
    expect($.said).toEqual([usable(false)]);
    expect(n.m.diverged.older).toBe(false);
  });

  test("a refresh whose settings can't be used reads no transcript, and the pane says why, on both sides", async () => {
    const { $, n } = await ran([files(BROKEN), REFRESH, load()], usable(false));

    expect(observed(n)).toEqual(observedOld($));
    expect(n.m.reads).toEqual([]);
    expect(problemsOf(n.m.state.raised)).toBe(MISSING);
  });

  test("Submit closes the pane by the close setting the last read found, on both sides", async () => {
    const both = { text: BOXES.both, isFilled: true, refusal: undefined };
    const send: readonly Command[] = [
      { do: "press" },
      { do: "answer", pick: 0, reply: both },
      { do: "answer", pick: 0, reply: both },
      { do: "answer", pick: 0, reply: both },
    ];
    const { $, n } = await ran([files(usable(true)), CONFIG, load(), ...send], usable(false));

    expect(observed(n)).toEqual(observedOld($));
    expect(n.m.closes).toBe(1);
  });

  test("fix: a refresh's read that lands after the settings broke settles nothing and says why; the old handlers drew it with the settings its own read found", async () => {
    const { $, n } = await ran(
      [REFRESH, load(), files(BROKEN), CONFIG, load(), { do: "read", pick: 0, found: { turns: TRANSCRIPTS.answered } }],
      usable(false),
    );

    // The old handlers settled the first item from the read.
    expect(withSent($.pane.raised, []).settledRefs).toEqual(["9efb08a1.Decide.1"]);
    // `step` settles nothing while the settings can't be used, and says why.
    expect(n.m.state.raised.settledRefs).toEqual([]);
    expect(problemsOf(n.m.state.raised)).toBe(MISSING);
    expect(n.m.diverged.drawn).toBe(true);
  });

  test("fix: a turn's end whose settings read finds them broken still reads the transcript and lets go of the answers it held; the old handlers read none and kept them held", async () => {
    const both = { text: BOXES.both, isFilled: true, refusal: undefined };
    const send: readonly Command[] = [
      { do: "press" },
      { do: "answer", pick: 0, reply: both },
      { do: "answer", pick: 0, reply: both },
      { do: "answer", pick: 0, reply: both },
    ];
    const { $, n } = await ran(
      [...send, files(BROKEN), { do: "refresh", releases: true }, load()],
      usable(false),
    );
    const landed = answeredRead(n.m, 0, { turns: TRANSCRIPTS.answered });

    // The old handlers read no transcript, so the answers stay held.
    expect($.reads).toEqual([]);
    expect(heldNow($.pane.sent)).not.toEqual([]);
    // `step` reads it, and lets go of them once it lands, settling nothing.
    expect(n.m.reads).toHaveLength(1);
    expect(n.m.diverged.freed).toBe(true);
    expect(heldNow(landed.state.sent)).toEqual([]);
    expect(landed.state.raised.settledRefs).toEqual([]);
    expect(problemsOf(landed.state.raised)).toBe(MISSING);
  });

  test("a refresh that holds no answers reads no transcript while the settings are broken, on both sides", async () => {
    const { $, n } = await ran([files(BROKEN), { do: "refresh", releases: true }, load()], usable(false));

    expect(observed(n)).toEqual(observedOld($));
    expect(n.m.diverged.freed).toBe(false);
  });

  test("an older settings read that found the files the newer one did leaves both sides alike", async () => {
    const { $, n } = await ran([CONFIG, CONFIG, load(1), load(0)], usable(false, [BAD_KEY]));

    expect(observed(n)).toEqual(observedOld($));
    expect(n.m.diverged.older).toBe(false);
  });

  test("a refresh's read that can't read the transcript says so, with the settings' warnings, on both sides", async () => {
    const { $, n } = await ran(
      [REFRESH, load(), { do: "read", pick: 0, found: { problem: GONE } }],
      usable(false, [BAD_KEY]),
    );

    expect(observed(n)).toEqual(observedOld($));
    expect(problemsOf(n.m.state.raised)).toBe(`${BAD_KEY}; ${GONE}`);
  });

  test("gh is asked with the timeout the settings in effect give, on both sides", async () => {
    const { $, n } = await ran(
      [REFRESH, load(), { do: "read", pick: 0, found: { turns: TRANSCRIPTS.open } }],
      usable(false),
    );

    expect(observed(n)).toEqual(observedOld($));
    expect(n.m.asks.map((a) => [a.refs, a.timeoutMs])).toEqual([
      [[PULL], usable(false).settings?.counts["gh-timeout-ms"]],
    ]);
    expect(n.m.pending.map(callOf)).toEqual([]);
    expect(problemOf(n.m.state)).toBe("");
  });
});
