// The differential test's oracle for Submit: the hooks' Submit handlers as
// they were while Submit's state was four atoms, `submits`, `submitting`,
// `runningTurn` and `submitProblem`, copied from plugin/hooks/register.tsx
// with the engine's `$` swapped for a fake. The fake keeps the atoms in a
// record, and holds each prompt call until the test answers it, so the
// handlers interleave between their awaits as they do in the engine.
//
// Temporary: the oracle and its test are deleted once the last of the
// pane's areas has moved into src/pane/pane-state.ts.

import { closesOnSubmit, sentOf, withSent } from "../../src/items/raised.ts";
import {
  NOT_EMPTIED_TEXT,
  notPutBackText,
  notSentText,
  putBackText,
  submitStep,
} from "../../src/pane/view.ts";
import type { Raised, Settlement } from "../../types/index.d.ts";
import type { Reply } from "../fixtures/submit.ts";

/** A prompt call the plugin made, as the engine sees it. */
export type Call = Readonly<
  | { kind: "read" }
  | { kind: "fill"; text: string; mode: "replace" | "append" }
  | { kind: "submit"; text: string }
>;

type Atoms = {
  submits: number;
  submitting: number;
  runningTurn: string;
  submitProblem: string;
  sent: readonly Settlement[];
  draft: string;
};

/** The fake engine: the atoms, the prompt calls waiting for an answer, what was submitted and how often the pane closed. */
export type OldEngine = {
  atoms: Atoms;
  readonly raised: Raised;
  readonly isClosedWhenAllSubmitted: boolean;
  pending: { call: Call; answer: (a: Reply) => void }[];
  submitted: string[];
  closes: number;
};

export const oldEngine = (
  raised: Raised,
  isClosedWhenAllSubmitted: boolean,
): OldEngine => ({
  atoms: {
    submits: 0,
    submitting: 0,
    runningTurn: "",
    submitProblem: "",
    sent: [],
    draft: "",
  },
  raised,
  isClosedWhenAllSubmitted,
  pending: [],
  submitted: [],
  closes: 0,
});

const read = async <K extends keyof Atoms>($: OldEngine, key: K): Promise<Atoms[K]> =>
  $.atoms[key];

const update = async <K extends keyof Atoms>(
  $: OldEngine,
  key: K,
  change: (value: Atoms[K]) => Atoms[K],
): Promise<Atoms[K]> => {
  $.atoms[key] = change($.atoms[key]);

  return $.atoms[key];
};

const waitFor = <T>($: OldEngine, call: Call, answered: (a: Reply) => T): Promise<T> =>
  new Promise((resolve) => {
    $.pending.push({ call, answer: (a) => resolve(answered(a)) });
  });

const prompt = {
  read: ($: OldEngine) => waitFor($, { kind: "read" }, (a) => ({ text: a.text })),
  fill: ($: OldEngine, f: Readonly<{ text: string; mode: "replace" | "append" }>) =>
    waitFor($, { kind: "fill", ...f }, (a) => ({ isFilled: a.isFilled })),
  submit: ($: OldEngine, text: string) => {
    $.submitted.push(text);

    return waitFor($, { kind: "submit", text }, (a) => ({ drop: a.refusal }));
  },
};

const shownNow = async ($: OldEngine): Promise<Raised> =>
  withSent($.raised, await read($, "sent"));

const closePane = async ($: OldEngine): Promise<void> => {
  $.closes += 1;
};

const refusalOf = ($: OldEngine, text: string): Promise<string | undefined> =>
  prompt.submit($, text).then(
    (done) => done.drop,
    (error: unknown) => String(error),
  );

const putBack = async ($: OldEngine, text: string, refusal: string): Promise<void> => {
  const box = (await prompt.read($).catch(() => ({ text: "" }))).text;
  const added = putBackText(box, text);
  const put = await prompt
    .fill($, { text: added, mode: "append" })
    .catch(() => ({ isFilled: false }));

  if (put.isFilled) {
    await update($, "draft", () => `${box}${added}`);
  }
  await update($, "submitProblem", () =>
    put.isFilled ? notSentText(refusal, box !== "") : notPutBackText(refusal, text),
  );
};

const sendDraft = async ($: OldEngine, text: string): Promise<void> => {
  const emptied = await prompt.fill($, { text: "", mode: "replace" });

  if (!emptied.isFilled) {
    await update($, "submitProblem", () => NOT_EMPTIED_TEXT);

    return;
  }
  await update($, "draft", () => "");
  const moved = sentOf(text, await shownNow($));
  const isMoved = (held: Settlement) => moved.some((settled) => settled.ref === held.ref);
  await update($, "sent", (held) => [...held.filter((s) => !isMoved(s)), ...moved]);
  const refusal = await refusalOf($, text);

  if (refusal !== undefined) {
    await update($, "sent", (held) => held.filter((s) => !isMoved(s)));
    await putBack($, text, refusal);

    return;
  }
  await update($, "submitProblem", () => "");

  if (closesOnSubmit($.raised, await read($, "sent"), $.isClosedWhenAllSubmitted)) {
    await closePane($);
  }
};

/** The pane's Submit pressed. */
export const submitDraft = async ($: OldEngine): Promise<void> => {
  const stamp = await update($, "submits", (n) => n + 1);
  const holder = await update($, "submitting", (held) => (held === 0 ? stamp : held));

  if (holder !== stamp) {
    return;
  }

  try {
    const step = submitStep(
      (await prompt.read($)).text,
      (await read($, "runningTurn")) !== "",
    );

    if ("refuse" in step) {
      await update($, "submitProblem", () => step.refuse);
    } else if ("send" in step) {
      await sendDraft($, step.send);
    }
  } finally {
    await update($, "submitting", (held) => (held === stamp ? 0 : held));
  }
};

/** session.start's part in Submit. */
export const sessionStarted = async ($: OldEngine): Promise<void> => {
  await update($, "runningTurn", () => "");
  await update($, "submitting", () => 0);
  await update($, "submitProblem", () => "");
  await update($, "sent", () => []);
};

/** turn.start's part in Submit, for a main-loop turn. */
export const turnStarted = async ($: OldEngine, turn: string): Promise<void> => {
  await update($, "runningTurn", () => turn);
  await update($, "submitProblem", () => "");
};

/** turn.complete's part in Submit, for a main-loop turn. */
export const turnCompleted = async ($: OldEngine, turn: string): Promise<void> => {
  await update($, "runningTurn", (held) => (held === turn ? "" : held));
};

/** Whether a press does nothing now, as the pane drew it. */
export const isBusy = ($: OldEngine): boolean =>
  $.atoms.runningTurn !== "" || $.atoms.submitting !== 0;
