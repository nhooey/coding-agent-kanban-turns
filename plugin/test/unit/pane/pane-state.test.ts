// The pane's state and the step function that moves it: Submit driven
// through named sequences of events, the state and effects checked after
// each, then through random sequences, answers for any press, repeated and
// out of turn among them, its invariants checked after every step.

import { describe, test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { expect } from "expect";
import fc from "fast-check";

import { closesOnSubmit, withHeld, withoutRead } from "../../../src/items/raised.ts";
import {
  INITIAL_PANE,
  NO_OUTSIDE,
  failingPress,
  readsOutside,
  step,
  submitShown,
  turnOf,
} from "../../../src/pane/pane-state.ts";
import type {
  Answer,
  Effect,
  Event,
  Outside,
  Stepped,
} from "../../../src/pane/pane-state.ts";
import {
  NEEDS_ENTER_TEXT,
  NOT_EMPTIED_TEXT,
  failedText,
  notPutBackText,
  notSentText,
} from "../../../src/pane/view.ts";
import type { PaneState, Press, Settlement } from "../../../types/index.d.ts";
import {
  BOXES,
  ITEMS,
  RAISED,
  ENGINE,
  commandsArb,
  outsideArb,
  walk,
} from "../../fixtures/submit.ts";

const OUTSIDE: Outside = {
  raised: RAISED,
  sent: [],
  isClosedWhenAllSubmitted: true,
};

/** Each step's state and effects, from `from`, as `events` move it. */
const steps = (
  events: readonly Event[],
  outside: Outside = OUTSIDE,
  from: PaneState = INITIAL_PANE,
): readonly Stepped[] =>
  events.reduce<readonly Stepped[]>(
    (sofar, event) => [
      ...sofar,
      step(sofar.at(-1)?.state ?? from, event, outside),
    ],
    [],
  );

/** The state after `events`. */
const after = (events: readonly Event[], outside: Outside = OUTSIDE): PaneState =>
  steps(events, outside).at(-1)?.state ?? INITIAL_PANE;

const PRESS: Event = { type: "submit-pressed" };
const SESSION: Event = { type: "session-started" };
const read = (text: string, press = 1): Event => ({
  type: "prompt-read",
  press,
  purpose: "submit",
  text,
});
const emptied = (press = 1, isFilled = true): Event => ({
  type: "prompt-filled",
  press,
  purpose: "empty",
  isFilled,
});
const entered = (press = 1): Event => ({ type: "prompt-submitted", press });
const refused = (refusal: string, press = 1): Event => ({
  type: "prompt-submitted",
  press,
  refusal,
});
const readBack = (text: string, press = 1): Event => ({
  type: "prompt-read",
  press,
  purpose: "put-back",
  text,
});
const putBack = (isFilled: boolean, press = 1): Event => ({
  type: "prompt-filled",
  press,
  purpose: "put-back",
  isFilled,
});
const failed = (why: string, press = 1): Event => ({ type: "press-failed", press, why });
const started = (turn: string): Event => ({ type: "turn-started", turn });
const completed = (turn: string): Event => ({ type: "turn-completed", turn });

/** The events that send `box` as press `press`, up to the engine's answer. */
const sending = (box: string, press = 1): readonly Event[] => [
  PRESS,
  read(box, press),
  emptied(press),
];

const FIRST_SENT = {
  ref: "9efb08a1.Decide.1",
  how: "sent",
  letters: ["B"],
  note: "",
} as const;

const BOTH_SENT = {
  ...OUTSIDE,
  sent: [FIRST_SENT, { ref: "9efb08a1.Decide.2", how: "sent", letters: ["A"], note: "" }],
} as const;

describe("a Submit sent", () => {
  test("reads the box, empties it, holds its answers Done and sends it, each call under the press's number", () => {
    const [press, box, emptiedBox, enteredDraft] = steps([
      ...sending(BOXES.first),
      entered(),
    ]);

    expect(press?.effects).toEqual([
      { kind: "read-prompt", press: 1, purpose: "submit" },
    ]);
    expect(box?.effects).toEqual([
      { kind: "fill-prompt", press: 1, purpose: "empty", text: "", mode: "replace" },
    ]);
    expect(emptiedBox?.effects).toEqual([
      { kind: "set-draft", text: "" },
      { kind: "hold-sent", moved: [FIRST_SENT] },
      { kind: "submit-prompt", press: 1, text: BOXES.first },
    ]);
    expect(enteredDraft?.state).toEqual({
      presses: 1,
      submit: { tag: "idle" },
      overtaken: [],
    });
    expect(enteredDraft?.effects).toEqual([]);
  });

  test("closes the pane when it leaves nothing open and the setting says to", () => {
    expect(steps([...sending(BOXES.both), entered()], BOTH_SENT).at(-1)?.effects).toEqual([
      { kind: "close-pane" },
    ]);
    expect(
      steps([...sending(BOXES.both), entered()], {
        ...BOTH_SENT,
        isClosedWhenAllSubmitted: false,
      }).at(-1)?.effects,
    ).toEqual([]);
  });

  test("leaves the pane open while an item is still open", () => {
    expect(steps([...sending(BOXES.first), entered()]).at(-1)?.effects).toEqual([]);
  });

  test("holds Done only the raised items a box answers, not a ref never raised", () => {
    expect(steps(sending(BOXES.stray)).at(-1)?.effects[1]).toEqual({
      kind: "hold-sent",
      moved: [{ ref: "9efb08a1.Decide.2", how: "sent", letters: ["C"], note: "" }],
    });
  });

  test("a box that can't be emptied sends nothing, and says so", () => {
    const last = steps([PRESS, read(BOXES.first), emptied(1, false)]).at(-1);

    expect(last?.state.submit).toEqual({ tag: "refused", why: NOT_EMPTIED_TEXT });
    expect(last?.effects).toEqual([]);
  });
});

describe("a Submit refused and put back", () => {
  test("puts its answers back, then the draft after what was typed meanwhile", () => {
    const [refusal, box, put] = steps([
      ...sending(BOXES.first),
      refused("busy"),
      readBack("typed"),
      putBack(true),
    ]).slice(3);

    expect(refusal?.effects).toEqual([
      { kind: "release-sent", moved: [FIRST_SENT] },
      { kind: "read-prompt", press: 1, purpose: "put-back" },
    ]);
    expect(box?.effects).toEqual([
      {
        kind: "fill-prompt",
        press: 1,
        purpose: "put-back",
        text: `\n${BOXES.first}`,
        mode: "append",
      },
    ]);
    expect(put?.effects).toEqual([
      { kind: "set-draft", text: `typed\n${BOXES.first}` },
    ]);
    expect(put?.state.submit).toEqual({
      tag: "refused",
      why: notSentText("busy", true),
    });
  });

  test("a box that can't take the draft back leaves the draft in what the pane says", () => {
    const last = steps([
      ...sending(BOXES.first),
      refused("busy"),
      readBack(""),
      putBack(false),
    ]).at(-1);

    expect(last?.effects).toEqual([]);
    expect(last?.state.submit).toEqual({
      tag: "refused",
      why: notPutBackText("busy", BOXES.first),
    });
  });
});

describe("a press that fails", () => {
  test("ends, naming its draft once the box may have been emptied", () => {
    expect(after([PRESS, read(BOXES.first), failed("boom")]).submit).toEqual({
      tag: "refused",
      why: failedText("boom", BOXES.first),
    });
  });

  test("puts back the answers it held Done", () => {
    expect(steps([...sending(BOXES.first), failed("boom")]).at(-1)?.effects).toEqual([
      { kind: "release-sent", moved: [FIRST_SENT] },
    ]);
  });

  test("before it read the box, says only why", () => {
    expect(after([PRESS, failed("boom")]).submit).toEqual({
      tag: "refused",
      why: failedText("boom"),
    });
  });

  test("once it has ended, changes nothing", () => {
    const done = after([...sending(BOXES.first), entered()]);

    expect(step(done, failed("boom"), OUTSIDE)).toEqual({ state: done, effects: [] });
  });
});

describe("failingPress", () => {
  const reading = after([PRESS]);
  const submitting = after(sending(BOXES.first));
  const ended = after([...sending(BOXES.first), entered()]);
  const overtaken = after([...sending(BOXES.first), SESSION]);

  test("names the press under way that the effects asked a prompt call for", () => {
    expect(
      failingPress(reading, PRESS, [{ kind: "read-prompt", press: 1, purpose: "submit" }]),
    ).toBe(1);
  });

  test("else the press under way, or overtaken, whose answer the event is", () => {
    expect(failingPress(submitting, emptied(), [{ kind: "set-draft", text: "" }])).toBe(1);
    expect(failingPress(overtaken, entered(), [])).toBe(1);
  });

  test("names none for a press that has ended, so its failure is the caller's", () => {
    expect(failingPress(ended, entered(), [{ kind: "close-pane" }])).toBeUndefined();
    expect(failingPress(reading, entered(2), [])).toBeUndefined();
  });

  test("names none for an event no press made, or a failure already ending a press", () => {
    expect(failingPress(reading, SESSION, [])).toBeUndefined();
    expect(failingPress(reading, failed("boom"), [])).toBeUndefined();
  });
});

describe("readsOutside", () => {
  test("is true only for the box emptied and the engine's answer to the draft", () => {
    expect(readsOutside(emptied())).toBe(true);
    expect(readsOutside(entered())).toBe(true);
    expect(readsOutside(putBack(true))).toBe(false);
    expect(readsOutside(SESSION)).toBe(false);
    expect(readsOutside(failed("boom"))).toBe(false);
  });
});

describe("a press", () => {
  test("does nothing while a turn runs", () => {
    const last = steps([started("t1"), PRESS]).at(-1);

    expect(last?.state.submit).toEqual({ tag: "running", turn: "t1" });
    expect(last?.effects).toEqual([]);
  });

  test("does nothing while another is under way", () => {
    expect(steps([...sending(BOXES.first), PRESS]).at(-1)?.effects).toEqual([]);
    expect(steps([PRESS, PRESS]).at(-1)?.effects).toEqual([]);
  });

  test("of a box of blanks, or the plugin's line alone, sends nothing and keeps what the pane said", () => {
    const refusedOnce = [PRESS, read(BOXES.mention)];

    expect(after([PRESS, read(BOXES.blank)]).submit).toEqual({ tag: "idle" });
    expect(after([...refusedOnce, PRESS]).submit).toEqual({
      tag: "pressed",
      press: { press: 2, at: "reading" },
      said: NEEDS_ENTER_TEXT,
    });
    expect(after([...refusedOnce, PRESS, read(BOXES.header, 2)]).submit).toEqual({
      tag: "refused",
      why: NEEDS_ENTER_TEXT,
    });
  });

  test("of a draft with a file mention stays in the box, saying why", () => {
    expect(after([PRESS, read(BOXES.mention)]).submit).toEqual({
      tag: "refused",
      why: NEEDS_ENTER_TEXT,
    });
  });

  test("whose box is read while a turn that started meanwhile runs sends nothing", () => {
    const last = steps([PRESS, started("t1"), read(BOXES.first)]).at(-1);

    expect(last?.state.submit).toEqual({ tag: "running", turn: "t1" });
    expect(last?.effects).toEqual([]);
  });

  test("whose box is read once that turn has ended sends it", () => {
    expect(
      steps([PRESS, started("t1"), completed("t1"), read(BOXES.first)]).at(-1)?.effects,
    ).toEqual([
      { kind: "fill-prompt", press: 1, purpose: "empty", text: "", mode: "replace" },
    ]);
  });

  test("moves only on the answers to its own calls", () => {
    expect(after([PRESS, read(BOXES.first, 2)]).submit).toEqual({
      tag: "pressed",
      press: { press: 1, at: "reading" },
      said: "",
    });
  });
});

describe("turns", () => {
  test("a late end of an earlier turn leaves the later one running", () => {
    expect(after([started("t1"), started("t2"), completed("t1")]).submit).toEqual({
      tag: "running",
      turn: "t2",
    });
    expect(
      after([started("t1"), started("t2"), completed("t1"), completed("t2")]).submit,
    ).toEqual({ tag: "idle" });
  });

  test("the turn a sent draft starts runs on once the engine takes it", () => {
    const sent = [...sending(BOXES.first), started("t1"), entered()];

    expect(after(sent).submit).toEqual({ tag: "running", turn: "t1" });
    expect(after([...sent, completed("t1")]).submit).toEqual({ tag: "idle" });
  });

  test("a refusal that lands while a turn runs keeps the turn, and its end only the why", () => {
    const sent = [PRESS, read(BOXES.first), started("t1"), emptied(1, false)];

    expect(after(sent).submit).toEqual({
      tag: "refused",
      why: NOT_EMPTIED_TEXT,
      turn: "t1",
    });
    expect(submitShown(after(sent).submit)).toEqual({
      isBusy: true,
      problem: NOT_EMPTIED_TEXT,
    });
    expect(after([...sent, completed("t1")]).submit).toEqual({
      tag: "refused",
      why: NOT_EMPTIED_TEXT,
    });
  });

  test("a turn's start clears what the last press said", () => {
    expect(after([PRESS, read(BOXES.mention), started("t1")]).submit).toEqual({
      tag: "running",
      turn: "t1",
    });
  });
});

describe("a press a session's start overtook", () => {
  const OVERTAKEN = [...sending(BOXES.first), SESSION];

  test("leaves Submit idle, the press finishing apart", () => {
    expect(after(OVERTAKEN)).toEqual({
      presses: 1,
      submit: { tag: "idle" },
      overtaken: [
        {
          press: 1,
          at: "sending",
          draft: BOXES.first,
          stage: { at: "submitting", moved: [FIRST_SENT] },
        },
      ],
    });
  });

  test("taken, closes the pane as it would have", () => {
    const last = steps([...OVERTAKEN, entered()], BOTH_SENT).at(-1);

    expect(last?.effects).toEqual([{ kind: "close-pane" }]);
    expect(last?.state.overtaken).toEqual([]);
  });

  test("refused, puts its answers and its draft back, and the pane says so", () => {
    const [refusal, , put] = steps([
      ...OVERTAKEN,
      refused("busy"),
      readBack(""),
      putBack(true),
    ]).slice(4);

    expect(refusal?.effects).toEqual([
      { kind: "release-sent", moved: [FIRST_SENT] },
      { kind: "read-prompt", press: 1, purpose: "put-back" },
    ]);
    expect(put?.state.submit).toEqual({ tag: "refused", why: notSentText("busy") });
    expect(put?.state.overtaken).toEqual([]);
  });

  test("answered, never moves a later press: its refusal leaves the press under way sending", () => {
    const later = [...OVERTAKEN, ...sending(BOXES.both, 2)];
    const last = steps([...later, refused("busy", 1)]).at(-1);

    expect(last?.state.submit).toEqual(after(later).submit);
    expect(last?.effects).toEqual([
      { kind: "release-sent", moved: [FIRST_SENT] },
      { kind: "read-prompt", press: 1, purpose: "put-back" },
    ]);
    expect(after([...later, entered(2)]).submit).toEqual({ tag: "idle" });
  });

  // A known gap, kept from the old handlers until a later area tags each
  // hold by its press and keeps an overtaken press's message apart: the two
  // presses share the prompt box, the answers held Done and what the pane
  // says.
  test("shares the box, the answers held Done and what the pane says with a later press, as the old handlers did", () => {
    const run = steps([
      ...OVERTAKEN,
      PRESS,
      read(BOXES.both, 2),
      emptied(2),
      refused("busy", 1),
      readBack("", 1),
      putBack(true, 1),
    ]).slice(OVERTAKEN.length);
    // The answers held Done from the session's start on, which empties them.
    const held = run
      .flatMap((s) => s.effects)
      .reduce<readonly Settlement[]>(
        (sent, e) =>
          e.kind === "hold-sent"
            ? withHeld(sent, e.moved)
            : e.kind === "release-sent"
              ? withoutRead(sent, e.moved)
              : sent,
        [],
      );

    // Press 1's refusal takes back press 2's answer to the item both answer.
    expect(held.map((s) => s.ref)).toEqual(["9efb08a1.Decide.2"]);
    // Press 1's draft goes into the box press 2 emptied as it sends.
    expect(run.at(-1)?.effects).toEqual([{ kind: "set-draft", text: BOXES.first }]);
    // Press 2 sends on, the pane saying press 1's refusal meanwhile.
    expect(run.at(-1)?.state.submit).toEqual({
      tag: "pressed",
      press: {
        press: 2,
        at: "sending",
        draft: BOXES.both,
        stage: {
          at: "submitting",
          moved: [
            { ref: "9efb08a1.Decide.1", how: "sent", letters: ["A"], note: "" },
            { ref: "9efb08a1.Decide.2", how: "sent", letters: ["A", "C"], note: "" },
          ],
        },
      },
      said: notSentText("busy"),
    });
  });
});

describe("submitShown", () => {
  test("says a press does nothing while a turn runs or a press is under way", () => {
    expect(submitShown({ tag: "idle" })).toEqual({ isBusy: false, problem: "" });
    expect(submitShown({ tag: "running", turn: "t1" })).toEqual({
      isBusy: true,
      problem: "",
    });
    expect(submitShown({ tag: "refused", why: "no" })).toEqual({
      isBusy: false,
      problem: "no",
    });
    expect(
      submitShown({ tag: "pressed", press: { press: 1, at: "reading" }, said: "no" }),
    ).toEqual({ isBusy: true, problem: "no" });
  });
});

describe("turnOf", () => {
  test("names the turn Submit waits on", () => {
    expect(turnOf({ tag: "running", turn: "t1" })).toBe("t1");
    expect(turnOf({ tag: "refused", why: "no" })).toBeUndefined();
    expect(
      turnOf({ tag: "pressed", press: { press: 1, at: "reading" }, said: "", turn: "t2" }),
    ).toBe("t2");
  });
});

const ANSWERS: readonly Event["type"][] = [
  "prompt-read",
  "prompt-filled",
  "prompt-submitted",
  "press-failed",
];

const isAnswer = (event: Event): event is Answer => ANSWERS.includes(event.type);

/** The press `number` names in `state`: the one under way, or one overtaken. */
const pressIn = (state: PaneState, number: number): Press | undefined =>
  state.submit.tag === "pressed" && state.submit.press.press === number
    ? state.submit.press
    : state.overtaken.find((p) => p.press === number);

/** The stage a press is at, when it's sending. */
const stageOf = (press: Press | undefined): string | undefined =>
  press?.at === "sending" ? press.stage.at : undefined;

describe("the random event sequences", () => {
  test("have a press under way beside an overtaken one in at least a third of runs", () => {
    const runs = fc.sample(commandsArb, { numRuns: 1000, seed: 42 });
    const share =
      runs.filter((commands) =>
        walk(commands, OUTSIDE).some(
          ({ stepped }) =>
            stepped.state.submit.tag === "pressed" && stepped.state.overtaken.length > 0,
        ),
      ).length / runs.length;

    expect(share).toBeGreaterThanOrEqual(1 / 3);
  });
});

describe("Submit's invariants over random event sequences", () => {
  const sequences = fc.tuple(commandsArb, outsideArb);
  const holds = (
    check: (
      s: Readonly<{ before: PaneState; event: Event; stepped: Stepped; outside: Outside }>,
    ) => boolean,
  ) =>
    fc.assert(
      fc.property(sequences, ([events, outside]) =>
        walk(events, outside).every((s) => check({ ...s, outside })),
      ),
      { numRuns: 500 },
    );

  test("a step that reads no outside area steps the same under any", () => {
    fc.assert(
      fc.property(
        commandsArb,
        outsideArb,
        outsideArb,
        (commands, a, b) =>
          walk(commands, a).every(
            ({ before, event }) =>
              readsOutside(event) ||
              isDeepStrictEqual(step(before, event, a), step(before, event, b)),
          ),
      ),
      { numRuns: 300 },
    );
  });

  test("a failed press steps the same under any outside areas, or none", () => {
    fc.assert(
      fc.property(commandsArb, outsideArb, (commands, outside) =>
        walk(commands, outside).every(({ stepped: { state } }) =>
          [
            ...(state.submit.tag === "pressed" ? [state.submit.press] : []),
            ...state.overtaken,
          ].every(({ press }) =>
            isDeepStrictEqual(
              step(state, failed("boom", press), outside),
              step(state, failed("boom", press), NO_OUTSIDE),
            ),
          ),
        ),
      ),
      { numRuns: 300 },
    );
  });

  test("every answer Submit holds Done is a raised item's", () => {
    const raisedRefs = ITEMS.map((item) => item.ref);

    holds(({ stepped }) =>
      stepped.effects.every(
        (e) =>
          e.kind !== "hold-sent" ||
          e.moved.every((moved) => raisedRefs.includes(moved.ref)),
      ),
    );
  });

  test("the pane closes only on a draft the engine took, when nothing is left open and the setting says to", () => {
    holds(({ before, event, stepped, outside }) =>
      stepped.effects.every(
        (e) =>
          e.kind !== "close-pane" ||
          (event.type === "prompt-submitted" &&
            event.refusal === undefined &&
            stageOf(pressIn(before, event.press)) === "submitting" &&
            closesOnSubmit(outside.raised, outside.sent, outside.isClosedWhenAllSubmitted)),
      ),
    );
  });

  test("a draft is sent only by the press it names, its box just emptied", () => {
    holds(({ before, event, stepped }) =>
      stepped.effects.every(
        (e) =>
          e.kind !== "submit-prompt" ||
          (event.type === "prompt-filled" &&
            event.press === e.press &&
            stageOf(pressIn(before, e.press)) === "emptying" &&
            stageOf(pressIn(stepped.state, e.press)) === "submitting"),
      ),
    );
  });

  test("an answer to one press never changes another, nor its calls", () => {
    holds(({ before, event, stepped }) => {
      if (!isAnswer(event)) {
        return true;
      }
      const others = [
        ...(before.submit.tag === "pressed" ? [before.submit.press] : []),
        ...before.overtaken,
      ].filter((p) => p.press !== event.press);
      const isOtherUnderWay =
        before.submit.tag === "pressed" && before.submit.press.press !== event.press;

      return (
        others.every((p) => pressIn(stepped.state, p.press) === p) &&
        (!isOtherUnderWay ||
          (stepped.state.submit.tag === "pressed" &&
            stepped.state.submit.turn === turnOf(before.submit))) &&
        stepped.effects.every((e) => !("press" in e) || e.press === event.press)
      );
    });
  });

  test("a prompt call is asked only for a press still under way or overtaken", () => {
    holds(({ stepped }) =>
      stepped.effects.every(
        (e) => !("press" in e) || pressIn(stepped.state, e.press) !== undefined,
      ),
    );
  });

  test("a turn's end clears only the turn it names", () => {
    holds(({ before, event, stepped }) =>
      event.type !== "turn-completed" ||
      turnOf(stepped.state.submit) ===
        (turnOf(before.submit) === event.turn ? undefined : turnOf(before.submit)),
    );
  });

  test("a press does something exactly when the pane says it would", () => {
    holds(({ before, event, stepped }) =>
      event.type !== "submit-pressed" ||
      (submitShown(before.submit).isBusy
        ? stepped.effects.length === 0 && stepped.state === before
        : stepped.effects.length === 1),
    );
  });

  test("a step asks the engine for one thing at most, and last", () => {
    holds(({ stepped }) => {
      const asks = stepped.effects.flatMap((e, n) => (ENGINE.includes(e.kind) ? [n] : []));

      return asks.length === 0 || (asks.length === 1 && asks[0] === stepped.effects.length - 1);
    });
  });
});
