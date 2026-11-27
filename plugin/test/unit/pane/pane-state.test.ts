// The pane's state and the step function that moves it: Submit driven
// through named sequences of events, the state and effects checked after
// each, then through random sequences, answers for any press, repeated and
// out of turn among them, its invariants checked after every step. The
// refresh has its own, in pane-state-refresh.test.ts.

import { describe, test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { expect } from "expect";
import fc from "fast-check";

import { closesOnSubmit, heldNow, refreshed } from "../../../src/items/raised.ts";
import {
  INITIAL_PANE,
  failingPress,
  settingsOf,
  shownOf,
  step,
  submitShown,
  turnOf,
} from "../../../src/pane/pane-state.ts";
import type { Answer, Event, Stepped } from "../../../src/pane/pane-state.ts";
import {
  NEEDS_ENTER_TEXT,
  NOT_EMPTIED_TEXT,
  failedText,
  notPutBackText,
  notSentText,
} from "../../../src/pane/view.ts";
import type { Held, PaneState, Press } from "../../../types/index.d.ts";
import {
  BOXES,
  EARLIER,
  ITEMS,
  RAISED,
  ENGINE,
  START,
  commandsArb,
  startArb,
  walk,
} from "../../fixtures/submit.ts";
import { BROKEN, withClosing, withSettings } from "../../fixtures/settings.ts";
import { settledRefsOf } from "../../fixtures/raised.ts";

/** The close setting the named sequences step under, unless one says otherwise. */
const CLOSES = true;

/** Each step's state and effects, from `from` with the defaults in effect, the close setting `isClosed`, as `events` move it. */
const steps = (
  events: readonly Event[],
  isClosed: boolean = CLOSES,
  from: PaneState = START,
): readonly Stepped[] =>
  events.reduce<readonly Stepped[]>(
    (sofar, event) => [
      ...sofar,
      step(sofar.at(-1)?.state ?? withClosing(from, isClosed), event),
    ],
    [],
  );

/** The state after `events`. */
const after = (
  events: readonly Event[],
  isClosed: boolean = CLOSES,
  from: PaneState = START,
): PaneState => steps(events, isClosed, from).at(-1)?.state ?? from;

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
const BOTH_FIRST = { ...FIRST_SENT, letters: ["A"] } as const;
const BOTH_SECOND = {
  ref: "9efb08a1.Decide.2",
  how: "sent",
  letters: ["A", "C"],
  note: "",
} as const;

/** Every item settled already: a draft the engine takes leaves nothing open. */
const ALL_DONE: PaneState = { ...START, raised: refreshed(RAISED, [], [], []) };

describe("a Submit sent", () => {
  test("reads the box, empties it, holds its answers Done under the press and sends it, each call under the press's number", () => {
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
      { kind: "submit-prompt", press: 1, text: BOXES.first },
    ]);
    expect(emptiedBox?.state.sent).toEqual([{ press: 1, settled: FIRST_SENT }]);
    expect(enteredDraft?.state).toMatchObject({
      presses: 1,
      submit: { tag: "idle" },
      overtaken: [],
      sent: [{ press: 1, settled: FIRST_SENT }],
    });
    expect(enteredDraft?.effects).toEqual([]);
  });

  test("closes the pane when it leaves nothing open and the setting says to", () => {
    expect(steps([...sending(BOXES.both), entered()]).at(-1)?.effects).toEqual([
      { kind: "close-pane" },
    ]);
    expect(steps([...sending(BOXES.both), entered()], false).at(-1)?.effects).toEqual([]);
  });

  test("leaves the pane open while no settings have been read, or the defaults file can't be used", () => {
    const sent = (from: PaneState) =>
      [...sending(BOXES.both), entered()].reduce<Stepped>(
        (sofar, event) => step(sofar.state, event),
        { state: from, effects: [] },
      ).effects;

    expect(START.settings.tag).toBe("unread");
    expect(sent(START)).toEqual([]);
    expect(sent(withSettings(START, BROKEN))).toEqual([]);
    expect(sent(withClosing(START, true))).toEqual([{ kind: "close-pane" }]);
  });

  test("leaves the pane open while an item is still open", () => {
    expect(steps([...sending(BOXES.first), entered()]).at(-1)?.effects).toEqual([]);
  });

  test("holds Done only the raised items a box answers, not a ref never raised", () => {
    expect(after(sending(BOXES.stray)).sent).toEqual([
      {
        press: 1,
        settled: { ref: "9efb08a1.Decide.2", how: "sent", letters: ["C"], note: "" },
      },
    ]);
  });

  test("a box that can't be emptied sends nothing, and says so", () => {
    const last = steps([PRESS, read(BOXES.first), emptied(1, false)]).at(-1);

    expect(last?.state.submit).toEqual({ tag: "refused", why: NOT_EMPTIED_TEXT });
    expect(last?.state.sent).toEqual([]);
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
      { kind: "read-prompt", press: 1, purpose: "put-back" },
    ]);
    expect(refusal?.state.sent).toEqual([]);
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

  test("puts back only its own answers: an earlier press's answer to the same item stays Done", () => {
    const earlier = [...sending(BOXES.both), entered()];
    const last = after([...earlier, ...sending(BOXES.first, 2), refused("busy", 2)]);

    expect(last.sent).toEqual([
      { press: 1, settled: BOTH_FIRST },
      { press: 1, settled: BOTH_SECOND },
    ]);
    expect(heldNow(last.sent)).toEqual([BOTH_FIRST, BOTH_SECOND]);
  });
});

describe("a press that fails", () => {
  test("ends, naming its draft once the box may have been emptied", () => {
    expect(after([PRESS, read(BOXES.first), failed("boom")]).submit).toEqual({
      tag: "refused",
      why: failedText("boom", BOXES.first),
    });
  });

  test("puts back the answers it held Done, and only those", () => {
    const earlier = [...sending(BOXES.both), entered()];

    expect(after([...sending(BOXES.first), failed("boom")]).sent).toEqual([]);
    expect(after([...earlier, ...sending(BOXES.first, 2), failed("boom", 2)]).sent).toEqual(
      after(earlier).sent,
    );
  });

  test("before it read the box, says only why", () => {
    expect(after([PRESS, failed("boom")]).submit).toEqual({
      tag: "refused",
      why: failedText("boom"),
    });
  });

  test("once it has ended, changes nothing", () => {
    const done = after([...sending(BOXES.first), entered()]);

    expect(step(done, failed("boom"))).toEqual({ state: done, effects: [] });
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
    expect(
      failingPress(reading, { type: "refresh-asked", releases: true }, [
        { kind: "read-transcript", refresh: 1 },
      ]),
    ).toBeUndefined();
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

  test("leaves Submit idle, the press finishing apart, and no answer held", () => {
    expect(after(OVERTAKEN)).toMatchObject({
      presses: 1,
      submit: { tag: "idle" },
      sent: [],
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
    const last = steps([...OVERTAKEN, entered()], CLOSES, ALL_DONE).at(-1);

    expect(last?.effects).toEqual([{ kind: "close-pane" }]);
    expect(last?.state.overtaken).toEqual([]);
  });

  test("refused, puts its draft back, and the pane says so on a line of its own", () => {
    const [refusal, , put] = steps([
      ...OVERTAKEN,
      refused("busy"),
      readBack(""),
      putBack(true),
    ]).slice(4);

    expect(refusal?.effects).toEqual([
      { kind: "read-prompt", press: 1, purpose: "put-back" },
    ]);
    expect(put?.state.submit).toEqual({ tag: "idle" });
    expect(put?.state.aside).toEqual({ said: notSentText("busy"), presses: 1 });
    expect(put?.state.overtaken).toEqual([]);
  });

  test("answered, never moves a later press: its refusal leaves the press under way sending", () => {
    const later = [...OVERTAKEN, ...sending(BOXES.both, 2)];
    const last = steps([...later, refused("busy", 1)]).at(-1);

    expect(last?.state.submit).toEqual(after(later).submit);
    expect(last?.effects).toEqual([
      { kind: "read-prompt", press: 1, purpose: "put-back" },
    ]);
    expect(after([...later, entered(2)]).submit).toEqual({ tag: "idle" });
  });

  // The two presses still share the prompt box, which is the engine's: the
  // overtaken press's draft goes back into the box the later one emptied.
  test("keeps to itself beside a later press: its refusal leaves the later press's answers held, and what it says stays apart from what the later press says", () => {
    const run = steps([
      ...OVERTAKEN,
      PRESS,
      read(BOXES.both, 2),
      emptied(2),
      refused("busy", 1),
      readBack("", 1),
      putBack(true, 1),
    ]).slice(OVERTAKEN.length);
    const last = run.at(-1);
    const later: readonly Held[] = [
      { press: 2, settled: BOTH_FIRST },
      { press: 2, settled: BOTH_SECOND },
    ];

    // Press 1's refusal leaves press 2's answers to both items held.
    expect(last?.state.sent).toEqual(later);
    expect(settledRefsOf(shownOf(last?.state ?? START))).toEqual(ITEMS.map((i) => i.ref));
    // Press 1's draft goes into the box press 2 emptied as it sends.
    expect(last?.effects).toEqual([{ kind: "set-draft", text: BOXES.first }]);
    // Press 2 sends on, saying nothing; press 1's refusal is said apart.
    expect(last?.state.submit).toEqual({
      tag: "pressed",
      press: {
        press: 2,
        at: "sending",
        draft: BOXES.both,
        stage: { at: "submitting", moved: later.map((h) => h.settled) },
      },
      said: "",
    });
    expect(last?.state.aside).toEqual({ said: notSentText("busy"), presses: 2 });

    // Press 2 taken: its end leaves what press 1 said, which came after it
    // was pressed.
    const taken = step(last?.state ?? START, entered(2)).state;
    expect(taken.submit).toEqual({ tag: "idle" });
    expect(taken.aside.said).toBe(notSentText("busy"));
    // A press pressed since, once it ends, says in its place.
    expect(after([PRESS, read(BOXES.mention, 3)], CLOSES, taken).aside.said).toBe("");
  });

  test("what it says goes once a turn starts, or the session starts again", () => {
    const said = after([...OVERTAKEN, refused("busy"), readBack(""), putBack(true)]);

    expect(after([started("t1")], CLOSES, said).aside.said).toBe("");
    expect(after([SESSION], CLOSES, said).aside.said).toBe("");
  });

  test("what it says stays through a later press that sends nothing and says nothing new, as for a box of blanks, which keeps all the pane said before it", () => {
    const said = after([...OVERTAKEN, refused("busy"), readBack(""), putBack(true)]);

    expect(after([PRESS, read(BOXES.blank, 2)], CLOSES, said).aside.said).toBe(
      notSentText("busy"),
    );
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
  const runs = fc.sample(commandsArb, { numRuns: 1000, seed: 42 });
  const shareOf = (isMet: (state: PaneState) => boolean, from = START): number =>
    runs.filter((commands) =>
      walk(commands, withClosing(from, CLOSES)).some(({ stepped }) => isMet(stepped.state)),
    ).length / runs.length;

  test("have a press under way beside an overtaken one in at least a third of runs", () => {
    expect(
      shareOf((state) => state.submit.tag === "pressed" && state.overtaken.length > 0),
    ).toBeGreaterThanOrEqual(1 / 3);
  });

  test("have a press hold an answer to an item an earlier press holds in at least a tenth of runs that start with one held", () => {
    expect(
      shareOf(
        (state) =>
          state.sent.some((h) =>
            state.sent.some((o) => o.press !== h.press && o.settled.ref === h.settled.ref),
          ),
        { ...START, sent: EARLIER },
      ),
    ).toBeGreaterThanOrEqual(1 / 10);
  });
});

describe("Submit's invariants over random event sequences", () => {
  const sequences = fc.tuple(commandsArb, startArb);
  const holds = (
    check: (s: Readonly<{ before: PaneState; event: Event; stepped: Stepped }>) => boolean,
  ) =>
    fc.assert(
      fc.property(sequences, ([events, from]) => walk(events, from).every(check)),
      { numRuns: 500 },
    );
  /** `state` with its settings as they are in `settings`. */
  const settingsAs = (state: PaneState, settings: PaneState): PaneState => ({
    ...state,
    settings: settings.settings,
  });

  test("a step other than the engine's answer to the draft steps the same whatever the close setting, or none read", () => {
    fc.assert(
      fc.property(commandsArb, startArb, fc.boolean(), (commands, from, isClosed) =>
        walk(commands, from).every(({ before, event }) => {
          const other = withClosing(before, isClosed);
          const none = { ...before, settings: INITIAL_PANE.settings };

          return (
            event.type === "prompt-submitted" ||
            [other, none].every((b) => {
              const stepped = step(b, event);

              return isDeepStrictEqual(
                { ...stepped, state: settingsAs(stepped.state, before) },
                step(before, event),
              );
            })
          );
        }),
      ),
      { numRuns: 300 },
    );
  });

  test("a failed press steps the same under any settings, or none", () => {
    fc.assert(
      fc.property(commandsArb, startArb, (commands, from) =>
        walk(commands, from).every(({ stepped: { state } }) =>
          [
            ...(state.submit.tag === "pressed" ? [state.submit.press] : []),
            ...state.overtaken,
          ].every(({ press }) => {
            const none = step({ ...state, settings: INITIAL_PANE.settings }, failed("boom", press));

            return isDeepStrictEqual(
              { ...none, state: settingsAs(none.state, state) },
              step(state, failed("boom", press)),
            );
          }),
        ),
      ),
      { numRuns: 300 },
    );
  });

  test("every answer Submit holds Done is a raised item's", () => {
    const raisedRefs = ITEMS.map((item) => item.ref);

    holds(({ stepped }) =>
      stepped.state.sent.every((h) => raisedRefs.includes(h.settled.ref)),
    );
  });

  test("a press holds answers only as its box is emptied, and puts back only its own", () => {
    holds(({ before, event, stepped }) => {
      const added = stepped.state.sent.filter((h) => !before.sent.includes(h));
      const gone = before.sent.filter((h) => !stepped.state.sent.includes(h));
      const press = "press" in event ? event.press : undefined;

      return (
        added.every(
          (h) =>
            event.type === "prompt-filled" &&
            event.purpose === "empty" &&
            h.press === press,
        ) &&
        (event.type === "session-started" || gone.every((h) => h.press === press))
      );
    });
  });

  test("the pane closes only on a draft the engine took, when nothing is left open and the setting says to", () => {
    holds(({ before, event, stepped }) =>
      stepped.effects.every(
        (e) =>
          e.kind !== "close-pane" ||
          (event.type === "prompt-submitted" &&
            event.refusal === undefined &&
            stageOf(pressIn(before, event.press)) === "submitting" &&
            closesOnSubmit(
              before.raised,
              heldNow(before.sent),
              settingsOf(before.settings)?.pane["close-when-all-submitted"] === true,
            )),
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

  test("an answer to one press never changes another, nor its calls, nor its holds", () => {
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
      const othersHeld = (state: PaneState) =>
        state.sent.filter((h) => h.press !== event.press);

      return (
        others.every((p) => pressIn(stepped.state, p.press) === p) &&
        (!isOtherUnderWay ||
          (stepped.state.submit.tag === "pressed" &&
            before.submit.tag === "pressed" &&
            stepped.state.submit.turn === turnOf(before.submit) &&
            stepped.state.submit.said === before.submit.said)) &&
        isDeepStrictEqual(othersHeld(stepped.state), othersHeld(before)) &&
        stepped.effects.every((e) => !("press" in e) || e.press === event.press)
      );
    });
  });

  test("what an overtaken press says changes only as one ends, a turn or a session starts, or a press pressed since it was said ends", () => {
    holds(({ before, event, stepped }) => {
      const { aside } = stepped.state;
      const endedOvertaken =
        "press" in event &&
        before.overtaken.some((p) => p.press === event.press) &&
        !stepped.state.overtaken.some((p) => p.press === event.press);
      const endedLater =
        before.submit.tag === "pressed" &&
        stepped.state.submit.tag !== "pressed" &&
        before.aside.presses < before.submit.press.press;

      return (
        aside === before.aside ||
        endedOvertaken ||
        (aside.said === "" &&
          (event.type === "turn-started" || event.type === "session-started" || endedLater))
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
