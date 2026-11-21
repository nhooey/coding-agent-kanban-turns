// Submit's differential test: the old handlers, test/oracle/submit.ts, as
// the hooks sequence them, against `step` and a model of the hooks'
// interpreter, test/fixtures/pane-model.ts, through the same random
// sequences of presses, turns, session starts and answers to the prompt
// calls, answered in any order. After every command both say the same:
// what the pane says, whether a press would do anything, the answers held
// Done, the draft, the prompt calls waiting, the prompts submitted and how
// often the pane closed. A session may start with calls waiting, which
// finish as they would have.
//
// Two differences are fixes, found only where the model says a run has
// reached them, after which the run's comparison ends; named tests show
// each, and pane-state-refresh-differential.test.ts the refresh's:
//
// - two presses hold an answer to one item: a refusal puts back only its
//   press's own;
// - an overtaken press ends while the pane says something of a later
//   press, or of an earlier one: what it says stays apart.
//
// One race of the old handlers is unreachable through `step`, by design: a
// press while a turn runs. The old handlers read the box and skipped it,
// unless the turn ended during the read, when they sent it; `step` reads
// nothing. The random sequences answer that read at once, while the turn
// still runs, and a named test shows the difference.
//
// Temporary: deleted with the oracle once the last of the pane's areas has
// moved into src/pane/pane-state.ts.

import { describe, test } from "node:test";
import { expect } from "expect";
import fc from "fast-check";

import { heldNow } from "../../../src/items/raised.ts";
import type { Event } from "../../../src/pane/pane-state.ts";
import { notSentText } from "../../../src/pane/view.ts";
import {
  isBusy,
  oldEngine,
  sessionStarted,
  submitDraft,
  turnCompleted,
  turnStarted,
} from "../../oracle/submit.ts";
import type { OldEngine } from "../../oracle/submit.ts";
import { observedOld } from "../../oracle/refresh.ts";
import { BOXES, RAISED, START, replyArb, turnArb } from "../../fixtures/submit.ts";
import type { Reply } from "../../fixtures/submit.ts";
import { COUNTS } from "../../fixtures/refresh.ts";
import {
  answeredPrompt,
  dispatched,
  isDiverged,
  model,
  observedNew,
  problemOf,
} from "../../fixtures/pane-model.ts";
import type { Model } from "../../fixtures/pane-model.ts";

const LOADED = { counts: COUNTS, problems: [] } as const;

const fresh = (isClosed: boolean): Model =>
  model(START, { isClosedWhenAllSubmitted: isClosed }, LOADED);

/** Lets the old handlers run until each waits on a prompt call. */
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

type Command = Readonly<
  | { do: "press" }
  | { do: "turn-start"; turn: string }
  | { do: "turn-complete"; turn: string }
  | { do: "session-start" }
  | { do: "answer"; pick: number; reply: Reply }
>;

const ANY: Reply = { text: BOXES.first, isFilled: true, refusal: undefined };

const commandArb: fc.Arbitrary<Command> = fc.oneof(
  fc.constant<Command>({ do: "press" }),
  turnArb.map((turn): Command => ({ do: "turn-start", turn })),
  turnArb.map((turn): Command => ({ do: "turn-complete", turn })),
  fc.constant<Command>({ do: "session-start" }),
  // Answers outnumber the rest, so most presses get through to the engine.
  ...Array.from({ length: 4 }, () =>
    fc
      .record({ pick: fc.nat({ max: 3 }), reply: replyArb })
      .map((r): Command => ({ do: "answer", ...r })),
  ),
);

/** Runs one command on both sides; the old handlers are left waiting on their next prompt call. */
const runCommand = async ($: OldEngine, m: Model, c: Command): Promise<Model> => {
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
      await turnCompleted($, c.turn);
      await flush();

      return dispatched(m, { type: "turn-completed", turn: c.turn });
    case "session-start":
      await sessionStarted($);
      await flush();

      return dispatched(m, { type: "session-started" });
    case "answer": {
      if ($.pending.length === 0) {
        return m;
      }
      const at = c.pick % $.pending.length;
      $.pending.splice(at, 1)[0]?.answer(c.reply);
      await flush();

      return answeredPrompt(m, at, c.reply);
    }
  }
};

/**
 * Runs `commands` on both sides, comparing them after each, until the
 * model says the run has reached a difference made by design; resolves to
 * how many commands were compared.
 */
const compared = async (commands: readonly Command[], isClosed: boolean): Promise<number> => {
  const $ = oldEngine(RAISED, isClosed);
  const run = await commands.reduce(
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
    Promise.resolve({ m: fresh(isClosed), count: 0 }),
  );

  return run.count;
};

describe("Submit's step against the old handlers", () => {
  test("say the same after every command of random sequences, until a run reaches a fix", async () => {
    const counts = { compared: 0, all: 0 };
    // Seeded, so the share below is measured over the same runs each time.
    await fc.assert(
      fc.asyncProperty(
        fc.array(commandArb, { maxLength: 40 }),
        fc.boolean(),
        async (commands, isClosed) => {
          counts.compared += await compared(commands, isClosed);
          counts.all += commands.length;
        },
      ),
      { numRuns: 400, seed: 20261121 },
    );

    // The fixes cut few runs short: most commands are compared.
    expect(counts.compared / counts.all).toBeGreaterThan(0.8);
  });

  test("a press while a turn runs: the old handlers read the box, and send it when the turn ends first; step reads nothing", async () => {
    const $ = oldEngine(RAISED, true);
    await turnStarted($, "t1");
    void submitDraft($);
    await flush();
    await turnCompleted($, "t1");
    $.pending.pop()?.answer(ANY);
    await flush();
    const m = [
      { type: "turn-started", turn: "t1" },
      { type: "submit-pressed" },
      { type: "turn-completed", turn: "t1" },
    ].reduce<Model>((sofar, e) => dispatched(sofar, e as Event), fresh(true));

    expect($.pending.map((p) => p.call)).toEqual([{ kind: "fill", text: "", mode: "replace" }]);
    expect(m.pending).toEqual([]);
  });

  /** Answers the prompt call waiting at `at`, the oldest by default, on both sides with `reply`. */
  const answer = async ($: OldEngine, m: Model, reply: Reply, at = 0): Promise<Model> => {
    $.pending.splice(at, 1)[0]?.answer(reply);
    await flush();

    return answeredPrompt(m, at, reply);
  };
  const sendBox = async ($: OldEngine, m: Model, box: string, refusal?: string) => {
    void submitDraft($);
    await flush();
    const read = await answer($, dispatched(m, { type: "submit-pressed" }), { ...ANY, text: box });
    const emptied = await answer($, read, ANY);

    return answer($, emptied, { ...ANY, refusal });
  };

  test("fix: a press the engine refuses puts back only its own answers; the old handlers took back an earlier press's answer to the same item", async () => {
    const $ = oldEngine(RAISED, false);
    const first = await sendBox($, fresh(false), BOXES.both);
    const second = await sendBox($, first, BOXES.first, "busy");

    // The old handlers put the first item back among the open ones.
    expect($.atoms.sent.map((s) => s.ref)).toEqual(["9efb08a1.Decide.2"]);
    // `step` keeps the first press's answer to it Done.
    expect(heldNow(second.state.sent).map((s) => s.ref)).toEqual([
      "9efb08a1.Decide.1",
      "9efb08a1.Decide.2",
    ]);
    expect(second.diverged.holds).toBe(true);
  });

  test("fix: an overtaken press's refusal, while a later press sends, is said apart and outlasts it; the old handlers said it in the later press's place, which its end then replaced", async () => {
    const $ = oldEngine(RAISED, false);
    void submitDraft($);
    await flush();
    const pressed = dispatched(fresh(false), { type: "submit-pressed" });
    const read = await answer($, pressed, ANY);
    const emptied = await answer($, read, ANY);
    await sessionStarted($);
    const restarted = dispatched(emptied, { type: "session-started" });
    // Press 2 reads and empties the box, after press 1's submit waiting.
    void submitDraft($);
    await flush();
    const later = await answer(
      $,
      dispatched(restarted, { type: "submit-pressed" }),
      { ...ANY, text: BOXES.both },
      1,
    );
    const sending = await answer($, later, ANY, 1);
    // Press 1's draft refused, then read back and put back, after press 2's
    // submit waiting.
    const refused = await answer($, sending, { ...ANY, refusal: "busy" });
    const readBack = await answer($, refused, { ...ANY, text: "" }, 1);
    const putBack = await answer($, readBack, ANY, 1);
    // Press 2's draft taken.
    const taken = await answer($, putBack, ANY);

    expect($.atoms.submitProblem).toBe("");
    expect(problemOf(taken.state)).toBe(notSentText("busy"));
    expect(isBusy($)).toBe(false);
    expect(taken.diverged.aside).toBe(true);
  });
});
