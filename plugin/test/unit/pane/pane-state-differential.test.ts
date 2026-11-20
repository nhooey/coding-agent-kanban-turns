// Submit's differential test: the old handlers, test/oracle/submit.ts, as
// the hooks sequence them, against `step` and a model of the hooks'
// interpreter, through the same random sequences of presses, turns,
// session starts and answers to the prompt calls, answered in any order.
// After every command both say the same: the problem the pane shows,
// whether a press would do anything, the answers held Done, the draft, the
// prompt calls waiting, the prompts submitted and how often the pane
// closed. A session may start with calls waiting, which finish as they
// would have.
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

import { withHeld, withoutRead } from "../../../src/items/raised.ts";
import { INITIAL_PANE, step, submitShown } from "../../../src/pane/pane-state.ts";
import type { Effect, Event } from "../../../src/pane/pane-state.ts";
import type { PaneState, Raised, Settlement } from "../../../types/index.d.ts";
import {
  isBusy,
  oldEngine,
  sessionStarted,
  submitDraft,
  turnCompleted,
  turnStarted,
} from "../../oracle/submit.ts";
import type { Call, OldEngine } from "../../oracle/submit.ts";
import {
  BOXES,
  RAISED,
  answerTo,
  replyArb,
  turnArb,
} from "../../fixtures/submit.ts";
import type { Reply } from "../../fixtures/submit.ts";

/** What the hooks hold around `step`: the pane's state, the atoms its effects write, and the prompt calls waiting. */
type Model = Readonly<{
  state: PaneState;
  raised: Raised;
  isClosedWhenAllSubmitted: boolean;
  sent: readonly Settlement[];
  draft: string;
  pending: readonly Effect[];
  submitted: readonly string[];
  closes: number;
}>;

const model = (raised: Raised, isClosedWhenAllSubmitted: boolean): Model => ({
  state: INITIAL_PANE,
  raised,
  isClosedWhenAllSubmitted,
  sent: [],
  draft: "",
  pending: [],
  submitted: [],
  closes: 0,
});

/** One effect run as the hooks run it: a prompt call left waiting for its answer, the rest done at once. */
const ran = (m: Model, effect: Effect): Model => {
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
    case "hold-sent":
      return { ...m, sent: withHeld(m.sent, effect.moved) };
    case "release-sent":
      return { ...m, sent: withoutRead(m.sent, effect.moved) };
  }
};

const dispatched = (m: Model, event: Event): Model => {
  const { state, effects } = step(m.state, event, {
    raised: m.raised,
    sent: m.sent,
    isClosedWhenAllSubmitted: m.isClosedWhenAllSubmitted,
  });

  return effects.reduce(ran, { ...m, state });
};

const answered = (m: Model, at: number, reply: Reply): Model => {
  const effect = m.pending[at];
  const event = effect === undefined ? undefined : answerTo(effect, reply);

  return event === undefined
    ? m
    : dispatched({ ...m, pending: m.pending.filter((_, n) => n !== at) }, event);
};

const callOf = (effect: Effect): Call =>
  effect.kind === "fill-prompt"
    ? { kind: "fill", text: effect.text, mode: effect.mode }
    : effect.kind === "submit-prompt"
      ? { kind: "submit", text: effect.text }
      : { kind: "read" };

/** What both sides are compared on. */
const observedNew = (m: Model) => ({
  ...submitShown(m.state.submit),
  sent: m.sent,
  draft: m.draft,
  pending: m.pending.map(callOf),
  submitted: m.submitted,
  closes: m.closes,
});

const observedOld = ($: OldEngine) => ({
  isBusy: isBusy($),
  problem: $.atoms.submitProblem,
  sent: $.atoms.sent,
  draft: $.atoms.draft,
  pending: $.pending.map((p) => p.call),
  submitted: $.submitted,
  closes: $.closes,
});

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

      return { ...dispatched(m, { type: "session-started" }), sent: [] };
    case "answer": {
      if ($.pending.length === 0) {
        return m;
      }
      const at = c.pick % $.pending.length;
      $.pending.splice(at, 1)[0]?.answer(c.reply);
      await flush();

      return answered(m, at, c.reply);
    }
  }
};

describe("Submit's step against the old handlers", () => {
  test("say the same after every command of random sequences", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(commandArb, { maxLength: 40 }),
        fc.boolean(),
        async (commands, isClosed) => {
          const $ = oldEngine(RAISED, isClosed);
          await commands.reduce(async (before, command, n) => {
            const m = await runCommand($, await before, command);
            expect({ n, ...observedOld($) }).toEqual({ n, ...observedNew(m) });

            return m;
          }, Promise.resolve(model(RAISED, isClosed)));
        },
      ),
      { numRuns: 400 },
    );
  });

  test("a press while a turn runs: the old handlers read the box, and send it when the turn ends first; step reads nothing", async () => {
    const $ = oldEngine(RAISED, true);
    await turnStarted($, "t1");
    void submitDraft($);
    await flush();
    await turnCompleted($, "t1");
    $.pending.pop()?.answer(ANY);
    await flush();
    const m = dispatched(
      dispatched(dispatched(model(RAISED, true), { type: "turn-started", turn: "t1" }), {
        type: "submit-pressed",
      }),
      { type: "turn-completed", turn: "t1" },
    );

    expect($.pending.map((p) => p.call)).toEqual([{ kind: "fill", text: "", mode: "replace" }]);
    expect(m.pending).toEqual([]);
  });
});
