// The settings' differential test's oracle for the hooks: the interpreter
// around `step` as it was at 6784a3e, while the settings were an atom of
// their own, copied from plugin/hooks/register.tsx with the engine's `$`
// swapped for a fake. `reloadSettings` read the files and wrote the
// `settings` atom; a refresh's transcript read read them first, for the
// count line's window, and handed their problems on; Submit's step read the
// close setting from the atom through `outsideNow`; and /answers-config and
// the `kanban_outstanding` tool read the files again themselves. The step
// is 6784a3e's, in ./pane-state.ts.
//
// The fake holds each settings load, transcript read, prompt call and `gh`
// call until the test answers it, so the handlers interleave between their
// awaits as they do in the engine. A load finds the files as they were when
// it was asked for.
//
// Where the copy departs from the hooks it was taken from:
//
// - the atoms are fields of the fake, written at once;
// - no call fails, so the paths for a step or an effect that throws are
//   left out;
// - the pane opening by itself is counted in `opens`, closing in `closes`;
// - /answers-config and the tool are their settings read alone, what each
//   read kept in `said`; the tool's transcript read and `gh` call aren't
//   modelled.
//
// Temporary: deleted with the oracles once the last of the pane's areas has
// moved into src/pane/pane-state.ts.

import type { Loaded, Turn } from "../../types/index.d.ts";
import { NO_OUTSIDE, readsOutside, step } from "./pane-state.ts";
import type { Effect, Event, Found, OldPaneState, Outside } from "./pane-state.ts";
import type { Call, TranscriptReply } from "./submit.ts";
import type { Reply } from "../fixtures/submit.ts";
import { mergedQuery } from "../../src/items/outstanding.ts";

/** The fake engine: the atoms, the files, the calls waiting, and what the handlers did. */
export type SettingsEngine = {
  pane: OldPaneState;
  settings: Loaded;
  draft: string;
  /** What the settings files merge to now: a test may change them at any time. */
  files: Loaded;
  loads: { answer: () => void }[];
  reads: { answer: (r: TranscriptReply) => void }[];
  pending: { call: Call; answer: (a: Reply) => void }[];
  asks: { refs: readonly string[]; answer: (found: readonly string[]) => void }[];
  submitted: string[];
  closes: number;
  opens: number;
  /** What each read of /answers-config or the tool found, in the order they answered. */
  said: Loaded[];
};

export const settingsEngine = (pane: OldPaneState, files: Loaded): SettingsEngine => ({
  pane,
  settings: files,
  draft: "",
  files,
  loads: [],
  reads: [],
  pending: [],
  asks: [],
  submitted: [],
  closes: 0,
  opens: 0,
  said: [],
});

/** `loadSettings`: the files merged, once the test answers the load, as they were when it was asked for. */
const loadSettings = ($: SettingsEngine): Promise<Loaded> =>
  new Promise((resolve) => {
    const files = $.files;
    $.loads.push({ answer: () => resolve(files) });
  });

/** Reads the settings files again, so an edit to either is taken up at the next refresh. */
const reloadSettings = async ($: SettingsEngine): Promise<Loaded> => {
  const now = await loadSettings($);
  $.settings = now;

  return now;
};

/** This session's turns, once the test answers the read; a read the test answers with a problem throws it. */
const turnsNow = ($: SettingsEngine): Promise<readonly Turn[]> =>
  new Promise((resolve, reject) => {
    $.reads.push({
      answer: (r) => ("turns" in r ? resolve(r.turns) : reject(r.problem)),
    });
  });

/** The pull requests among `refs` that `gh` says merged, once the test answers; no call when there's nothing to ask. */
const mergedNow = async (
  $: SettingsEngine,
  refs: readonly string[],
): Promise<Readonly<{ found: ReadonlySet<string> }>> => {
  const { ordered } = mergedQuery(refs);
  const found =
    ordered.length === 0
      ? []
      : await new Promise<readonly string[]>((resolve) => {
          $.asks.push({ refs: ordered, answer: resolve });
        });

  return { found: new Set(found.filter((ref) => ordered.includes(ref))) };
};

/** /answers-config's, or the tool's, read of the settings: what it found kept. */
export const readAlone = async ($: SettingsEngine): Promise<void> => {
  $.said.push(await reloadSettings($));
};

const transcriptFound = async (
  $: SettingsEngine,
): Promise<Readonly<{ found: Found; warnings: readonly string[] }>> => {
  const { settings: s, problems } = await reloadSettings($);
  const found: Found =
    s === null
      ? { problem: "" }
      : await turnsNow($).then(
          (turns) => ({ turns, counts: s.counts }),
          (error: unknown) => ({ problem: String(error) }),
        );

  return { found, warnings: problems };
};

const outsideNow = async ($: SettingsEngine): Promise<Outside> => ({
  isClosedWhenAllSubmitted: $.settings.settings?.pane["close-when-all-submitted"] === true,
});

const stepNow = async ($: SettingsEngine, event: Event): Promise<readonly Effect[]> => {
  const outside = readsOutside(event) ? await outsideNow($) : NO_OUTSIDE;
  const stepped = step($.pane, event, outside);
  $.pane = stepped.state;

  return stepped.effects;
};

const prompt = <T>($: SettingsEngine, call: Call, answered: (a: Reply) => T): Promise<T> =>
  new Promise((resolve) => {
    $.pending.push({ call, answer: (a) => resolve(answered(a)) });
  });

const runEffects = async ($: SettingsEngine, effects: readonly Effect[]): Promise<void> => {
  const [effect, ...rest] = effects;

  if (effect === undefined) {
    return;
  }
  const answer = await runEffect($, effect);

  if (answer !== undefined) {
    await dispatch($, answer);
  }

  return runEffects($, rest);
};

/** The one way the pane's state changed: `event` stepped, then the effects it asked for run in order. */
export const dispatch = async ($: SettingsEngine, event: Event): Promise<void> =>
  runEffects($, await stepNow($, event));

const runEffect = async ($: SettingsEngine, effect: Effect): Promise<Event | undefined> => {
  switch (effect.kind) {
    case "read-prompt":
      return {
        type: "prompt-read",
        press: effect.press,
        purpose: effect.purpose,
        text: await prompt($, { kind: "read" }, (a) => a.text),
      };
    case "fill-prompt":
      return {
        type: "prompt-filled",
        press: effect.press,
        purpose: effect.purpose,
        isFilled: await prompt(
          $,
          { kind: "fill", text: effect.text, mode: effect.mode },
          (a) => a.isFilled,
        ),
      };
    case "submit-prompt": {
      $.submitted.push(effect.text);
      const refusal = await prompt($, { kind: "submit", text: effect.text }, (a) => a.refusal);

      return {
        type: "prompt-submitted",
        press: effect.press,
        ...(refusal === undefined ? {} : { refusal }),
      };
    }
    case "close-pane":
      $.closes += 1;

      return undefined;
    case "set-draft":
      $.draft = effect.text;

      return undefined;
    case "read-transcript":
      return { type: "transcript-read", refresh: effect.refresh, ...(await transcriptFound($)) };
    case "ask-merged":
      void mergedNow($, effect.refs).then(({ found }) =>
        dispatch($, { type: "merged-found", found: [...found], asked: effect.asked }),
      );

      return undefined;
    case "open-pane":
      $.opens += 1;

      return undefined;
    case "reveal":
      return undefined;
  }
};
