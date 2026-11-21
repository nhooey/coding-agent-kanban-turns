// The differential test's oracle for the refresh: the hooks' refresh, and
// each hook's part in it, as they were while its state was five atoms,
// `raised`, `sent`, `refreshes`, `merged` and `counts`, copied from
// plugin/hooks/register.tsx at 364bb54 with the engine's `$` swapped for
// the fake in ./submit.ts. The fake holds each transcript read and `gh`
// call until the test answers it, so the handlers interleave between
// their awaits as they do in the engine. Settings that can't be used read
// no transcript, as before.
//
// Where the copy departs from the hooks it was taken from:
//
// - the settings are `$.loaded`, read at once, where `reloadSettings` read
//   the files and wrote the `settings` atom between awaits; the test may
//   change them between refreshes;
// - the pane opening by itself is counted in `$.opens`, where `announce`
//   called `$.ui.open` and scrolled it to its top;
// - `mergedNow` has no timeout and no `gh` output to parse: the test
//   answers with the pull requests merged, and never with a failure;
// - session.start's registrations of the commands and tools, which it
//   awaited before the refresh, are left out;
// - the `kanban_outstanding` tool, which also asked `gh` and joined the
//   merges it learned, isn't modelled.
//
// Temporary: the oracle and its test are deleted once the last of the
// pane's areas has moved into src/pane/pane-state.ts.

import {
  countLine,
  mergedQuery,
  openOf,
  pullRequestsToAsk,
} from "../../src/items/outstanding.ts";
import {
  forSession,
  problemsOf,
  refreshed,
  seen,
  unread,
  unseen,
  withItems,
  withSent,
} from "../../src/items/raised.ts";
import type {
  DecideItem,
  Settings,
  Settlement,
  Turn,
} from "../../types/index.d.ts";
import { isBusy, read, sessionStarted, turnCompleted, update } from "./submit.ts";
import type { OldEngine } from "./submit.ts";

/** `withoutRead` from src/items/raised.ts at 364bb54: the answers sent once a refresh has read the transcript, the ones `read` taken out by ref. */
const withoutRead = (
  sent: readonly Settlement[],
  done: readonly Settlement[],
): readonly Settlement[] =>
  sent.filter((settled) => !done.some((d) => d.ref === settled.ref));

/** The session's turns, once the test answers the read; a read the test answers with a problem throws it. */
const turnsNow = ($: OldEngine): Promise<readonly Turn[]> =>
  new Promise((resolve, reject) => {
    $.reads.push({
      answer: (r) => ("turns" in r ? resolve(r.turns) : reject(r.problem)),
    });
  });

/** The pull requests among `refs` that `gh` says merged, once the test answers; no call when there's nothing to ask. */
const mergedNow = async (
  $: OldEngine,
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

const settle = async (
  $: OldEngine,
  turns: readonly Turn[],
  window: number,
  warnings: readonly string[],
): Promise<void> => {
  const open = openOf(turns, window, new Set(await read($, "merged")));
  await update($, "counts", () => open.counts);
  await update($, "raised", (r) =>
    refreshed(
      r,
      open.items,
      open.settlements,
      warnings,
      turns.map((turn) => turn.id),
    ),
  );
};

const askMerged = async (
  $: OldEngine,
  stamp: number,
  turns: readonly Turn[],
  window: Settings["counts"],
): Promise<void> => {
  const known = new Set(await read($, "merged"));
  const { found } = await mergedNow($, pullRequestsToAsk(turns, window.turns, known));

  if (found.size > 0) {
    const now = await update($, "merged", (m) =>
      [...new Set([...m, ...found])].sort(),
    );

    if ((await read($, "refreshes")) === stamp) {
      await update($, "counts", () =>
        countLine(turns, window.turns, new Set(now)),
      );
    }
  }
};

/** The refresh; resolves to whether it read the transcript. */
export const refresh = async ($: OldEngine): Promise<boolean> => {
  const stamp = await update($, "refreshes", (n) => n + 1);
  const { counts: s, problems } = $.loaded;
  const found: Readonly<{ turns: readonly Turn[] } | { problem: string }> =
    s === null
      ? { problem: "" }
      : await turnsNow($).then(
          (turns) => ({ turns }),
          (error: unknown) => ({ problem: String(error) }),
        );

  if (s === null || "problem" in found) {
    const problem = "problem" in found ? found.problem : "";
    await update($, "raised", (r) => unread(r, problem, problems));

    return false;
  }
  await settle($, found.turns, s.turns, problems);
  void askMerged($, stamp, found.turns, s).catch(() => undefined);

  return true;
};

/** The pane opened at its top, when an item is open it hasn't been opened over. */
const announce = async ($: OldEngine): Promise<void> => {
  const r = await read($, "raised");
  await update($, "raised", seen);

  if (unseen(r).length > 0) {
    $.opens += 1;
  }
};

/** session.start's part in the refresh, after Submit's, which empties `sent`. */
export const sessionStartedRefresh = async ($: OldEngine, session: string): Promise<void> => {
  await sessionStarted($);
  await update($, "raised", (r) => forSession(r, session));
  void refresh($)
    .then(() => announce($))
    .catch(() => undefined);
};

/** turn.complete's part, for a main-loop turn: Submit's, then the refresh, then the pane opened over new items. */
export const turnCompletedRefresh = async ($: OldEngine, turn: string): Promise<void> => {
  await turnCompleted($, turn);
  const before = await read($, "sent");

  if (await refresh($)) {
    await update($, "sent", (held) => withoutRead(held, before));
  }
  await announce($);
};

/** /answers's part: the refresh, then every item looked at, as the pane opens. */
export const reopened = async ($: OldEngine): Promise<void> => {
  await refresh($);
  await update($, "raised", seen);
};

/** The `kanban_options` call's part: its items merged in. */
export const itemsDrawn = async ($: OldEngine, items: readonly DecideItem[]): Promise<void> => {
  await update($, "raised", (r) => withItems(r, items));
};

/** What the differential tests compare of the old handlers, as `observedNew` in test/fixtures/pane-model.ts does of `step`. */
export const observedOld = ($: OldEngine) => ({
  isBusy: isBusy($),
  problem: $.atoms.submitProblem,
  sent: $.atoms.sent,
  shown: withSent($.atoms.raised, $.atoms.sent),
  problems: problemsOf($.atoms.raised),
  counts: $.atoms.counts,
  draft: $.atoms.draft,
  pending: $.pending.map((p) => p.call),
  reads: $.reads.length,
  asks: $.asks.map((a) => a.refs),
  submitted: $.submitted,
  closes: $.closes,
  opens: $.opens,
});
