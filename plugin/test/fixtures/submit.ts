// What the pane-state tests drive Submit with: two raised items, the
// boxes a press may read, the turns that may run, and the random events
// and answers fast-check draws from them.

import fc from "fast-check";

import { emptyRaised, withItems } from "../../src/items/raised.ts";
import { INITIAL_PANE, step } from "../../src/pane/pane-state.ts";
import type { Effect, Event, Stepped } from "../../src/pane/pane-state.ts";
import type {
  DecideItem,
  Held,
  PaneState,
  Raised,
} from "../../types/index.d.ts";
import { withClosing } from "./settings.ts";

export const HEADER = "coding-agent-kanban-turns:\n";

const radio: DecideItem = {
  turn: "9efb08a1",
  list: "Decide",
  number: 1,
  summary: "Which cache to keep",
  kind: "radio",
  ref: "9efb08a1.Decide.1",
  options: [
    { letter: "A", name: "Disk" },
    { letter: "B", name: "Memory" },
  ],
};
const checkbox: DecideItem = {
  ...radio,
  number: 2,
  summary: "Cleanups to start",
  kind: "checkbox",
  ref: "9efb08a1.Decide.2",
  options: [
    { letter: "A", name: "Matchers" },
    { letter: "C", name: "Stale render" },
  ],
};

export const ITEMS: readonly DecideItem[] = [radio, checkbox];

export const RAISED: Raised = withItems({ ...emptyRaised, session: "s" }, ITEMS);

/** Boxes that answer one item, both, none, an item never raised, or would be mangled by sending. */
export const BOXES = {
  blank: "  \n",
  header: HEADER,
  first: `${HEADER}9efb08a1.Decide.1.B\n`,
  both: `${HEADER}9efb08a1.Decide.1.A\n9efb08a1.Decide.2.A,C\n`,
  stray: `${HEADER}cafecafe.Decide.9.A\n9efb08a1.Decide.2.C\n`,
  mention: "Look at @notes.md\n",
  words: "Ship it",
} as const;

export const TURNS = ["t1", "t2", "t3"] as const;

export const boxArb = fc.constantFrom(...Object.values(BOXES));
const turnArb = fc.constantFrom(...TURNS);
// Half the prompts sent are taken, half refused.
export const refusalArb = fc.option(fc.constantFrom("busy", "hook said no"), {
  nil: undefined,
  freq: 2,
});
// The presses an answer may be for: the first few, so most answers find
// the press under way or one overtaken.
const pressArb = fc.integer({ min: 1, max: 4 });

/**
 * Any event Submit takes, effects' answers among them, for any press, in
 * or out of turn. Presses and session starts outweigh the rest, so a press
 * under way often runs beside one a session's start overtook.
 */
export const eventArb: fc.Arbitrary<Event> = fc.oneof(
  { arbitrary: fc.constant<Event>({ type: "session-started" }), weight: 4 },
  { arbitrary: fc.constant<Event>({ type: "submit-pressed" }), weight: 8 },
  turnArb.map((turn): Event => ({ type: "turn-started", turn })),
  turnArb.map((turn): Event => ({ type: "turn-completed", turn })),
  fc
    .record({
      press: pressArb,
      purpose: fc.constantFrom("submit", "put-back"),
      text: boxArb,
    })
    .map((r): Event => ({ type: "prompt-read", ...r })),
  fc
    .record({
      press: pressArb,
      purpose: fc.constantFrom("empty", "put-back"),
      isFilled: fc.boolean(),
    })
    .map((r): Event => ({ type: "prompt-filled", ...r })),
  fc.record({ press: pressArb, refusal: refusalArb }).map(
    ({ press, refusal }): Event => ({
      type: "prompt-submitted",
      press,
      ...(refusal === undefined ? {} : { refusal }),
    }),
  ),
  pressArb.map((press): Event => ({ type: "press-failed", press, why: "boom" })),
);

/** What the engine answers a prompt call with: the box a read finds, whether a fill took, why a submit was refused. */
export type Reply = Readonly<{
  text: string;
  isFilled: boolean;
  refusal: string | undefined;
}>;

export const replyArb: fc.Arbitrary<Reply> = fc.record({
  text: boxArb,
  isFilled: fc.boolean(),
  refusal: refusalArb,
});

/** The event the hooks dispatch when the prompt call `effect` asked for answers with `reply`; none for an effect that isn't a prompt call. */
export const answerTo = (effect: Effect, reply: Reply): Event | undefined =>
  effect.kind === "read-prompt"
    ? {
        type: "prompt-read",
        press: effect.press,
        purpose: effect.purpose,
        text: reply.text,
      }
    : effect.kind === "fill-prompt"
      ? {
          type: "prompt-filled",
          press: effect.press,
          purpose: effect.purpose,
          isFilled: reply.isFilled,
        }
      : effect.kind === "submit-prompt"
        ? {
            type: "prompt-submitted",
            press: effect.press,
            ...(reply.refusal === undefined ? {} : { refusal: reply.refusal }),
          }
        : undefined;

// How often a random run's step is an event, against an answer to a call
// waiting: answers often enough that presses reach their later stages,
// events often enough that a press is overtaken before its calls answer.
const EVENT_WEIGHT = 1;
const ANSWER_WEIGHT = 1;

/**
 * One step of a random run: any event, or the answer to one of the calls
 * still waiting, picked by `pick`, so runs reach a press's later stages as
 * often as they throw stray answers at it.
 */
export type CommandOf<R> = Readonly<
  { do: "event"; event: Event } | { do: "answer"; pick: number; reply: R }
>;
export type Command = CommandOf<Reply>;

export const commandArb: fc.Arbitrary<Command> = fc.oneof(
  {
    arbitrary: eventArb.map((event): Command => ({ do: "event", event })),
    weight: EVENT_WEIGHT,
  },
  {
    arbitrary: fc
      .record({ pick: fc.nat({ max: 3 }), reply: replyArb })
      .map((r): Command => ({ do: "answer", ...r })),
    weight: ANSWER_WEIGHT,
  },
);

/** A random run: long enough for presses to reach their later stages and outlast a session's start. */
export const commandsArb: fc.Arbitrary<readonly Command[]> = fc.array(commandArb, {
  minLength: 20,
  maxLength: 60,
});

/** The effects that are prompt calls, which answer with an event. */
export const ENGINE: readonly Effect["kind"][] = [
  "read-prompt",
  "fill-prompt",
  "submit-prompt",
];

/** One step of a walk: the state before it, the event, and what `step` made of it. */
export type Walked = Readonly<{ before: PaneState; event: Event; stepped: Stepped }>;

/**
 * A walk through `commands`: the events they make, each stepped from
 * `from`, with the state before it. An answer command answers a call
 * still waiting, one of the effects whose kind is in `asks`, with the
 * event `answerOf` makes of it, as the hooks would.
 */
export const walkWith =
  <R>(answerOf: (effect: Effect, reply: R) => Event | undefined, asks: readonly Effect["kind"][]) =>
  (commands: readonly CommandOf<R>[], from: PaneState = INITIAL_PANE): readonly Walked[] =>
    commands.reduce<
      Readonly<{
        state: PaneState;
        waiting: readonly Effect[];
        walked: readonly Walked[];
      }>
    >(
      ({ state, waiting, walked }, c) => {
        const at =
          c.do === "answer" && waiting.length > 0 ? c.pick % waiting.length : -1;
        const asked = waiting[at];
        const event =
          c.do === "event"
            ? c.event
            : asked === undefined
              ? undefined
              : answerOf(asked, c.reply);
        const stepped =
          event === undefined ? undefined : step(state, event);

        return event === undefined || stepped === undefined
          ? { state, waiting, walked }
          : {
              state: stepped.state,
              waiting: [
                ...waiting.filter((_, n) => n !== at),
                ...stepped.effects.filter((e) => asks.includes(e.kind)),
              ],
              walked: [...walked, { before: state, event, stepped }],
            };
      },
      { state: from, waiting: [], walked: [] },
    ).walked;

/** The events `commands` make, each stepped from `from`, with the state before it: an answer command answers a prompt call still waiting, as the hooks would. */
export const walk = walkWith(answerTo, ENGINE);

/** The pane's state before a run: both items raised, the settings not read yet. */
export const START: PaneState = { ...INITIAL_PANE, raised: RAISED };

/** The answers an earlier press, press 0, still holds Done when a run starts. */
export const EARLIER: readonly Held[] = [
  { press: 0, settled: { ref: radio.ref, how: "sent", letters: ["A"], note: "" } },
  { press: 0, settled: { ref: checkbox.ref, how: "sent", letters: ["C"], note: "" } },
];

/** The pane's state as a run may find it: both items raised, an earlier press's answers to some held Done, the defaults in effect with the close setting either way. */
export const startArb: fc.Arbitrary<PaneState> = fc
  .tuple(fc.subarray([...EARLIER]), fc.boolean())
  .map(([sent, isClosed]) => withClosing({ ...START, sent }, isClosed));
