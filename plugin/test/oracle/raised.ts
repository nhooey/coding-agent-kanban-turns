// The raised items' differential test's oracle: src/items/raised.ts as it
// was at 71031b0, while `Raised` kept the settled refs and their
// settlements in two lists of their own beside the items, which `refreshed`
// and `withSent` kept in step. `OldRaised` is that shape, declared here as
// it was; test/unit/items/raised-differential.test.ts compares the core
// against it.
//
// Temporary: the oracle and its test are deleted once
// `raised-item-state-sum` has merged into `master`.

import { answerTo, isAnswered } from "../../src/items/answers.ts";
import { refOf } from "../../src/items/items.ts";
import type { DecideItem, Held, Settlement } from "../../types/index.d.ts";

/** `Raised` as 71031b0 had it. */
export type OldRaised = Readonly<{
  session: string;
  turns: readonly string[];
  items: readonly DecideItem[];
  settledRefs: readonly string[];
  settlements: readonly Settlement[];
  seenRefs: readonly string[];
  problem: string;
  warnings: readonly string[];
}>;

export const emptyRaised: OldRaised = {
  session: "",
  turns: [],
  items: [],
  settledRefs: [],
  settlements: [],
  seenRefs: [],
  problem: "",
  warnings: [],
};

/** The items raised in `session`: as they stand when they're that session's, else none. */
export const forSession = (raised: OldRaised, session: string): OldRaised =>
  raised.session === session ? raised : { ...emptyRaised, session };

/** `items` with each ref kept once, at its first place, holding its last content. */
const byRef = (items: readonly DecideItem[]): readonly DecideItem[] => {
  const latest = new Map(items.map((item) => [refOf(item), item]));

  return [...latest.keys()].flatMap((ref) => latest.get(ref) ?? []);
};

/** The items once `items` are merged in: one raised before keeps its place and takes the newer content; a new one goes at the end. */
export const withItems = (
  raised: OldRaised,
  items: readonly DecideItem[],
): OldRaised => ({ ...raised, items: byRef([...raised.items, ...items]) });

/**
 * The items once a refresh read the transcript and found `open`: those
 * merged in, and every raised item not among them settled, as `settlements`
 * say how; `turns`, the ids of the turns it read, kept for the pane's turn
 * headers.
 */
export const refreshed = (
  raised: OldRaised,
  open: readonly DecideItem[],
  settlements: readonly Settlement[],
  warnings: readonly string[],
  turns: readonly string[] = [],
): OldRaised => {
  const merged = withItems(raised, open);
  const openRefs = open.map(refOf);
  const settledRefs = merged.items
    .map(refOf)
    .filter((ref) => !openRefs.includes(ref));

  return {
    ...merged,
    turns,
    settledRefs,
    settlements: settlements.filter((settled) =>
      settledRefs.includes(settled.ref),
    ),
    problem: "",
    warnings,
  };
};

/** How the item settled, as the last refresh found; undefined when it's open, or settled in a way the transcript doesn't say. */
export const settlementOf = (
  raised: OldRaised,
  item: DecideItem,
): Settlement | undefined =>
  raised.settlements.findLast((settled) => settled.ref === refOf(item));

/** The items once a refresh couldn't read the transcript, for `problem`: each raised item settled or open as it was. */
export const unread = (
  raised: OldRaised,
  problem: string,
  warnings: readonly string[],
): OldRaised => ({ ...raised, problem, warnings });

/** What the pane says is wrong: the settings files' problems, then the read's, in one line; empty when nothing is. */
export const problemsOf = (raised: OldRaised): string =>
  [...raised.warnings, raised.problem].filter((p) => p !== "").join("; ");

/** Whether the last refresh found the item no longer open. */
export const isSettled = (raised: OldRaised, item: DecideItem): boolean =>
  raised.settledRefs.includes(refOf(item));

/** The raised items not settled, oldest first. */
export const stillOpen = (raised: OldRaised): readonly DecideItem[] =>
  raised.items.filter((item) => !isSettled(raised, item));

/** The open items raised since the last look: what opens the pane by itself. */
export const unseen = (raised: OldRaised): readonly DecideItem[] =>
  stillOpen(raised).filter((item) => !raised.seenRefs.includes(refOf(item)));

/** The items with every one of them looked at. */
export const seen = (raised: OldRaised): OldRaised => ({
  ...raised,
  seenRefs: raised.items.map(refOf),
});

/**
 * What the pane's Submit sends for the items: one `sent` settlement for
 * each raised item the draft answers, open or answered again once Done,
 * with its letters and note.
 */
export const sentOf = (
  draft: string,
  raised: OldRaised,
): readonly Settlement[] =>
  raised.items.flatMap((item) => {
    const answer = answerTo(draft, item);

    return answer === undefined
      ? []
      : [
          {
            ref: refOf(item),
            how: "sent" as const,
            letters: answer.letters,
            note: answer.note,
          },
        ];
  });

/**
 * The items as the pane and a reply draw them while answers Submit sent
 * wait for the turn's end: each raised item a `sent` settlement names Done
 * with it, in place of what an earlier answer said of a Done one, since
 * the sent answer is the later.
 */
export const withSent = (
  raised: OldRaised,
  sent: readonly Settlement[],
): OldRaised => {
  const added = sent.filter((settled) =>
    raised.items.some((item) => refOf(item) === settled.ref),
  );
  const refs = added.map((settled) => settled.ref);

  return added.length === 0
    ? raised
    : {
        ...raised,
        settledRefs: [
          ...raised.settledRefs.filter((ref) => !refs.includes(ref)),
          ...refs,
        ],
        settlements: [
          ...raised.settlements.filter((settled) => !refs.includes(settled.ref)),
          ...added,
        ],
      };
};

/** Whether two holds are one press's answer to one item. */
const isSameHold = (a: Held, b: Held): boolean =>
  a.press === b.press && a.settled.ref === b.settled.ref;

/**
 * The answers Submit holds Done once press `press` sends `moved`: each
 * tagged with the press, at the end, in place of any the press held for
 * its ref before. Another press's hold for the same item stays, so the
 * press's refusal can't take it back.
 */
export const withHeld = (
  sent: readonly Held[],
  press: number,
  moved: readonly Settlement[],
): readonly Held[] => {
  const holds = moved.map((settled) => ({ press, settled }));

  return [...sent.filter((h) => !holds.some((m) => isSameHold(h, m))), ...holds];
};

/** The answers held once press `press` puts its own back: every other press's kept, one for the same item among them. */
export const released = (
  sent: readonly Held[],
  press: number,
): readonly Held[] => sent.filter((h) => h.press !== press);

/**
 * The answers held once a refresh has read the transcript the holds `read`
 * went into: those taken out, each by its press and item, and any held
 * since kept, a later press's answer to the same item among them.
 */
export const withoutRead = (
  sent: readonly Held[],
  read: readonly Held[],
): readonly Held[] => sent.filter((h) => !read.some((r) => isSameHold(h, r)));

/** What the held answers make Done: each item's most recently held answer, in the order they were held. */
export const heldNow = (sent: readonly Held[]): readonly Settlement[] =>
  sent
    .filter(
      (h, n) => !sent.slice(n + 1).some((later) => later.settled.ref === h.settled.ref),
    )
    .map((h) => h.settled);

/**
 * Whether a Submit that went through closes the pane: with `isEnabled`, the
 * `pane.close-when-all-submitted` setting, once the answers `sent`, this
 * Submit's and any earlier one's the turn's end hasn't read, leave no item
 * open.
 */
export const closesOnSubmit = (
  raised: OldRaised,
  sent: readonly Settlement[],
  isEnabled: boolean,
): boolean => isEnabled && stillOpen(withSent(raised, sent)).length === 0;

/** How many open items the draft answers. */
export const answeredCount = (raised: OldRaised, draft: string): number =>
  stillOpen(raised).filter((item) => isAnswered(draft, item)).length;
