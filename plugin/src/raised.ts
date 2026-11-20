// The Decide items raised in this session, oldest first: every item a
// `kanban_options` call drew or a refresh found open, kept once raised, with
// which are settled and which the pane has been opened over. Each function
// takes the items and returns new ones, or a part of them; none changes
// what it's given.

import { answerTo, isAnswered } from "./answers.ts";
import { refOf } from "./items.ts";
import type { DecideItem, Raised, Settlement } from "../types/index.d.ts";

export const emptyRaised: Raised = {
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
export const forSession = (raised: Raised, session: string): Raised =>
  raised.session === session ? raised : { ...emptyRaised, session };

/** `items` with each ref kept once, at its first place, holding its last content. */
const byRef = (items: readonly DecideItem[]): readonly DecideItem[] => {
  const latest = new Map(items.map((item) => [refOf(item), item]));

  return [...latest.keys()].flatMap((ref) => latest.get(ref) ?? []);
};

/** The items once `items` are merged in: one raised before keeps its place and takes the newer content; a new one goes at the end. */
export const withItems = (
  raised: Raised,
  items: readonly DecideItem[],
): Raised => ({ ...raised, items: byRef([...raised.items, ...items]) });

/**
 * The items once a refresh read the transcript and found `open`: those
 * merged in, and every raised item not among them settled, as `settlements`
 * say how; `turns`, the ids of the turns it read, kept for the pane's turn
 * headers.
 */
export const refreshed = (
  raised: Raised,
  open: readonly DecideItem[],
  settlements: readonly Settlement[],
  warnings: readonly string[],
  turns: readonly string[] = [],
): Raised => {
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
  raised: Raised,
  item: DecideItem,
): Settlement | undefined =>
  raised.settlements.findLast((settled) => settled.ref === refOf(item));

/** The items once a refresh couldn't read the transcript, for `problem`: each raised item settled or open as it was. */
export const unread = (
  raised: Raised,
  problem: string,
  warnings: readonly string[],
): Raised => ({ ...raised, problem, warnings });

/** What the pane says is wrong: the settings files' problems, then the read's, in one line; empty when nothing is. */
export const problemsOf = (raised: Raised): string =>
  [...raised.warnings, raised.problem].filter((p) => p !== "").join("; ");

/** Whether the last refresh found the item no longer open. */
export const isSettled = (raised: Raised, item: DecideItem): boolean =>
  raised.settledRefs.includes(refOf(item));

/** The raised items not settled, oldest first. */
export const stillOpen = (raised: Raised): readonly DecideItem[] =>
  raised.items.filter((item) => !isSettled(raised, item));

/** The open items raised since the last look: what opens the pane by itself. */
export const unseen = (raised: Raised): readonly DecideItem[] =>
  stillOpen(raised).filter((item) => !raised.seenRefs.includes(refOf(item)));

/** The items with every one of them looked at. */
export const seen = (raised: Raised): Raised => ({
  ...raised,
  seenRefs: raised.items.map(refOf),
});

/**
 * What the pane's Submit sends for the items: one `sent` settlement for
 * each open item the draft answers, with its letters and note.
 */
export const sentOf = (draft: string, raised: Raised): readonly Settlement[] =>
  stillOpen(raised).flatMap((item) => {
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
 * wait for the turn's end: each raised item a `sent` settlement names, and
 * the transcript leaves open, Done with it; what the transcript says of an
 * item stays first.
 */
export const withSent = (
  raised: Raised,
  sent: readonly Settlement[],
): Raised => {
  const added = sent.filter(
    (settled) =>
      !raised.settledRefs.includes(settled.ref) &&
      raised.items.some((item) => refOf(item) === settled.ref),
  );

  return added.length === 0
    ? raised
    : {
        ...raised,
        settledRefs: [...raised.settledRefs, ...added.map((s) => s.ref)],
        settlements: [...raised.settlements, ...added],
      };
};

/** How many open items the draft answers. */
export const answeredCount = (raised: Raised, draft: string): number =>
  stillOpen(raised).filter((item) => isAnswered(draft, item)).length;

/** The first open item the draft doesn't answer, if there is one. */
export const firstUnanswered = (
  raised: Raised,
  draft: string,
): DecideItem | undefined =>
  stillOpen(raised).find((item) => !isAnswered(draft, item));
